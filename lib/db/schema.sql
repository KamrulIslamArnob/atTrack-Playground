-- AtTrack local SQLite schema.
--
-- This is migrations/001..019 collapsed into the final shape, translated to
-- SQLite. It is applied idempotently on first connection (lib/db/sqlite.ts).
--
-- Deliberate differences from the Postgres schema, and why:
--   * UUID        -> TEXT. Ids are generated in app code with crypto.randomUUID().
--   * TIMESTAMPTZ -> TEXT holding ISO-8601 UTC ("2026-08-08T12:00:00.000Z"),
--                    which sorts lexicographically the same as chronologically.
--   * JSONB       -> TEXT holding JSON. The query layer parses/serializes these
--                    transparently via the JSON_COLUMNS registry in lib/db/meta.ts.
--   * BOOLEAN     -> INTEGER 0/1, converted back to real booleans by the same registry.
--   * NUMERIC     -> REAL.
--   * No RLS. SQLite has no row-level security, so every query must be scoped by
--     user_id in application code. See lib/db/README note in CLAUDE.md.
--   * auth.users  -> the local `users` table below, holding a single owner row.
--                    There is no auth: no sessions, no passwords, no login.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================
-- The local owner.
--
-- AtTrack is a native single-user app: no accounts, no login, no sessions.
-- `users` holds exactly one row (see lib/db/local-user.ts), kept as a table so
-- the user_id foreign keys throughout the schema stay meaningful.
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  -- Vestigial: kept so databases created by the earlier auth build still
  -- satisfy their NOT NULL constraint. Nothing reads it.
  encrypted_password TEXT,
  email_confirmed_at TEXT,
  raw_user_meta_data TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Case-insensitive email uniqueness (Postgres/Supabase treated emails as unique).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));

-- =============================================
-- profiles (001, 002, 017, 019)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  phone TEXT,
  location TEXT,
  website TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  is_banned INTEGER NOT NULL DEFAULT 0,
  banned_at TEXT,
  onboarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- =============================================
-- companies (001)
-- =============================================
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  location TEXT,
  -- job-detail-sheet: manual Company tab enrichment, no AI
  founded_year INTEGER,
  company_type TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_name ON companies(user_id, lower(name));

-- =============================================
-- board_lists (019) — declared before jobs, which references it
-- =============================================
CREATE TABLE IF NOT EXISTS board_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('wishlist','preparing','applied','interview','offer','accepted','rejected','custom')),
  color TEXT,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_board_lists_user ON board_lists(user_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_board_lists_one_per_kind
  ON board_lists(user_id, kind) WHERE kind <> 'custom';

-- =============================================
-- documents (001, 013) — declared before jobs/positions, which reference it
-- =============================================
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('resume','cover_letter','other')),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  match_data TEXT,              -- JSON
  builder_data TEXT,             -- JSON: resume-builder document, NULL for uploaded PDFs
  generated_kind TEXT,          -- job-detail-sheet: AI Tools kind that produced this file, NULL for uploads
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, type);
-- One default document per user, matching migration 013.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_one_default
  ON documents(user_id) WHERE is_default = 1;

-- =============================================
-- positions (019)
-- =============================================
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  experience_level TEXT CHECK (experience_level IN ('entry','mid','senior')),
  resume_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_name_per_user
  ON positions(user_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_one_primary
  ON positions(user_id) WHERE is_primary = 1;

-- =============================================
-- jobs (001, 003-007, 013, 014, 016, 019)
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','interested','preparing')),
  employment_type TEXT DEFAULT 'Full-time',
  salary_range TEXT,
  application_url TEXT,
  application_email TEXT,
  application_process TEXT,
  deadline TEXT,
  source TEXT,
  work_location TEXT,
  notes TEXT,                   -- JSON: JobNote[]
  match_score REAL,
  matched_resume_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  match_reasoning TEXT,
  -- 019
  list_id TEXT REFERENCES board_lists(id) ON DELETE SET NULL,
  board_position REAL,
  position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  resume_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  project_links TEXT,           -- JSON: ProjectLink[]
  color TEXT,                   -- job-detail-sheet: per-job accent override; falls back to list color when NULL
  section_deadline TEXT,        -- ISO date/time for section target deadline
  section_deadline_list_id TEXT REFERENCES board_lists(id) ON DELETE SET NULL,
  skills TEXT,                  -- JSON: string[]
  educational_requirements TEXT,
  benefits TEXT,                -- JSON: string[]
  work_schedule TEXT,
  holiday_policy TEXT,
  map_url TEXT,
  is_unpaid INTEGER DEFAULT 0,
  salary_min REAL,
  salary_max REAL,
  salary_currency TEXT,
  salary_period TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_board ON jobs(user_id, list_id, board_position);
CREATE INDEX IF NOT EXISTS idx_jobs_position_id ON jobs(position_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_resume_id ON jobs(resume_id);
CREATE INDEX IF NOT EXISTS idx_jobs_matched_resume_id ON jobs(matched_resume_id);

-- =============================================
-- applications (001, 010, 016)
-- =============================================
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged','interview','offer','accepted','rejected','withdrawn')),
  applied_at TEXT,
  resume_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  resume_name TEXT,
  notes TEXT,                   -- plain text here, unlike jobs.notes
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);

-- =============================================
-- interviews (011)
-- =============================================
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at TEXT,
  type TEXT CHECK (type IN ('phone','video','onsite','technical','behavioral','panel')),
  location TEXT,
  meeting_url TEXT,
  interviewer_name TEXT,
  interviewer_email TEXT,
  notes TEXT,
  prep_notes TEXT,
  status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  duration_minutes INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);

-- =============================================
-- contacts, job_contacts, job_documents (job-detail-sheet)
-- contacts are user-owned and reusable across jobs (Huntr's "+Link Contact"),
-- not job-scoped — job_contacts is the many-to-many. job_documents is the
-- same shape for documents: a resume can be attached to many jobs, and an
-- AI Tools artifact auto-links to the job it was generated for.
-- =============================================
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  social_links TEXT,
  avatar_url TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_company ON contacts(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_id, lower(email));

CREATE TABLE IF NOT EXISTS job_contacts (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (job_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_job_contacts_contact ON job_contacts(contact_id);

CREATE TABLE IF NOT EXISTS job_documents (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (job_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_job_documents_document ON job_documents(document_id);

-- timeline_events and notes removed: unused by current code. Migration in
-- sqlite.ts drops them from databases that predate this deletion.

-- =============================================
-- application_emails (016)
-- =============================================
CREATE TABLE IF NOT EXISTS application_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  resume_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  resume_name TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','bounced')),
  error_message TEXT,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_application_emails_user ON application_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_job ON application_emails(job_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_application ON application_emails(application_id);

-- =============================================
-- ai_usage_logs (017)
-- =============================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  duration_ms INTEGER,
  metadata TEXT DEFAULT '{}',   -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

-- =============================================
-- ai_providers / ai_task_routes
-- =============================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini', 'anthropic', 'openai_compatible')),
  base_url TEXT,
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_user ON ai_providers(user_id);

CREATE TABLE IF NOT EXISTS ai_task_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('text', 'image', 'scraping')),
  provider_ids TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_task_routes_user ON ai_task_routes(user_id);

CREATE TABLE IF NOT EXISTS ai_tool_prompts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_prompts_user ON ai_tool_prompts(user_id);

-- =============================================
-- job_deadlines
-- =============================================
CREATE TABLE IF NOT EXISTS job_deadlines (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage_kind TEXT CHECK (stage_kind IN ('wishlist','preparing','applied','interview','offer','accepted','rejected','custom')),
  due_date TEXT NOT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_job_deadlines_job ON job_deadlines(job_id);
CREATE INDEX IF NOT EXISTS idx_job_deadlines_user ON job_deadlines(user_id);

-- =============================================
-- ai_extraction_logs (009)
-- =============================================
CREATE TABLE IF NOT EXISTS ai_extraction_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  screenshot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','success','error')),
  model TEXT NOT NULL,
  duration_ms INTEGER,
  extracted_fields TEXT,        -- JSON (was TEXT[] in Postgres)
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_extraction_logs_user ON ai_extraction_logs(user_id);

-- =============================================
-- mcq_results (012)
-- =============================================
CREATE TABLE IF NOT EXISTS mcq_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers TEXT NOT NULL,        -- JSON
  questions TEXT NOT NULL,      -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mcq_results_user ON mcq_results(user_id);
CREATE INDEX IF NOT EXISTS idx_mcq_results_job ON mcq_results(job_id);

-- =============================================
-- mcq_question_cache (020): last generated question set per job. A retake is
-- served from here while the job's content hash matches, so re-opening the
-- practice modal costs zero tokens.
-- =============================================
CREATE TABLE IF NOT EXISTS mcq_question_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  questions TEXT NOT NULL,      -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mcq_question_cache_job ON mcq_question_cache(job_id);

-- =============================================
-- ai_output_cache (021): caches the last generated email / AI tool output for
-- a given content hash so re-opening a tab is instant and costs no tokens.
-- =============================================
CREATE TABLE IF NOT EXISTS ai_output_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  output TEXT NOT NULL,          -- JSON { subject, body }
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_output_cache_hash ON ai_output_cache(user_id, content_hash);

-- =============================================
-- smtp_config (015)
-- =============================================
CREATE TABLE IF NOT EXISTS smtp_config (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
  port INTEGER NOT NULL DEFAULT 465,
  user_email TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- =============================================
-- updated_at triggers (replaces the update_updated_at() trigger from 001)
-- =============================================
CREATE TRIGGER IF NOT EXISTS trg_profiles_updated AFTER UPDATE ON profiles
BEGIN UPDATE profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_jobs_updated AFTER UPDATE ON jobs
BEGIN UPDATE jobs SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_applications_updated AFTER UPDATE ON applications
BEGIN UPDATE applications SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_interviews_updated AFTER UPDATE ON interviews
BEGIN UPDATE interviews SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_board_lists_updated AFTER UPDATE ON board_lists
BEGIN UPDATE board_lists SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_positions_updated AFTER UPDATE ON positions
BEGIN UPDATE positions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_contacts_updated AFTER UPDATE ON contacts
BEGIN UPDATE contacts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_companies_updated AFTER UPDATE ON companies
BEGIN UPDATE companies SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_documents_updated AFTER UPDATE ON documents
BEGIN UPDATE documents SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_smtp_config_updated AFTER UPDATE ON smtp_config
BEGIN UPDATE smtp_config SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

-- =============================================
-- jobs.status is DERIVED from its board list's kind (migration 019 trigger).
-- Two triggers because SQLite has no "BEFORE UPDATE OF col" with NEW assignment.
-- =============================================
CREATE TRIGGER IF NOT EXISTS trg_jobs_status_from_list_ins
AFTER INSERT ON jobs WHEN NEW.list_id IS NOT NULL
BEGIN
  UPDATE jobs SET status = CASE
    WHEN (SELECT kind FROM board_lists WHERE id = NEW.list_id) = 'wishlist' THEN 'saved'
    ELSE 'preparing' END
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_jobs_status_from_list_upd
AFTER UPDATE OF list_id ON jobs WHEN NEW.list_id IS NOT NULL
BEGIN
  UPDATE jobs SET status = CASE
    WHEN (SELECT kind FROM board_lists WHERE id = NEW.list_id) = 'wishlist' THEN 'saved'
    ELSE 'preparing' END
  WHERE id = NEW.id;
END;

-- =============================================
-- Omni-Search FTS5 Index & Triggers (022)
-- Enables unified O(1) term lookup time complexity across all app entities.
-- =============================================
CREATE VIRTUAL TABLE IF NOT EXISTS omni_search_index USING fts5(
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  user_id UNINDEXED,
  title,
  subtitle,
  content,
  href UNINDEXED,
  icon UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Triggers for jobs
CREATE TRIGGER IF NOT EXISTS trg_omni_jobs_ins AFTER INSERT ON jobs BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'job', NEW.id, NEW.user_id, NEW.title,
    COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.employment_type, '') || ' ' || COALESCE(NEW.status, '') || ' ' || COALESCE(NEW.source, ''),
    COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.notes, ''),
    '/board?jobId=' || NEW.id, 'job'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_jobs_upd AFTER UPDATE ON jobs BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'job' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'job', NEW.id, NEW.user_id, NEW.title,
    COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.employment_type, '') || ' ' || COALESCE(NEW.status, '') || ' ' || COALESCE(NEW.source, ''),
    COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.notes, ''),
    '/board?jobId=' || NEW.id, 'job'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_jobs_del AFTER DELETE ON jobs BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'job' AND entity_id = OLD.id;
END;

-- Triggers for contacts
CREATE TRIGGER IF NOT EXISTS trg_omni_contacts_ins AFTER INSERT ON contacts BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'contact', NEW.id, NEW.user_id, NEW.name,
    COALESCE(NEW.position, '') || ' ' || COALESCE(NEW.role, '') || ' ' || COALESCE(NEW.email, '') || ' ' || COALESCE(NEW.phone, ''),
    COALESCE(NEW.notes, '') || ' ' || COALESCE(NEW.linkedin_url, '') || ' ' || COALESCE(NEW.github_url, ''),
    '/crm', 'contact'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_contacts_upd AFTER UPDATE ON contacts BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'contact' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'contact', NEW.id, NEW.user_id, NEW.name,
    COALESCE(NEW.position, '') || ' ' || COALESCE(NEW.role, '') || ' ' || COALESCE(NEW.email, '') || ' ' || COALESCE(NEW.phone, ''),
    COALESCE(NEW.notes, '') || ' ' || COALESCE(NEW.linkedin_url, '') || ' ' || COALESCE(NEW.github_url, ''),
    '/crm', 'contact'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_contacts_del AFTER DELETE ON contacts BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'contact' AND entity_id = OLD.id;
END;

-- Triggers for companies
CREATE TRIGGER IF NOT EXISTS trg_omni_companies_ins AFTER INSERT ON companies BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'company', NEW.id, NEW.user_id, NEW.name,
    COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.company_type, '') || ' ' || COALESCE(NEW.country, ''),
    COALESCE(NEW.website, ''),
    '/crm', 'company'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_companies_upd AFTER UPDATE ON companies BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'company' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'company', NEW.id, NEW.user_id, NEW.name,
    COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.company_type, '') || ' ' || COALESCE(NEW.country, ''),
    COALESCE(NEW.website, ''),
    '/crm', 'company'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_companies_del AFTER DELETE ON companies BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'company' AND entity_id = OLD.id;
END;

-- Triggers for applications
CREATE TRIGGER IF NOT EXISTS trg_omni_applications_ins AFTER INSERT ON applications BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'application', NEW.id, NEW.user_id,
    COALESCE(NEW.resume_name, 'Application'),
    'Status: ' || COALESCE(NEW.status, 'draft'),
    COALESCE(NEW.notes, ''),
    '/applications', 'application'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_applications_upd AFTER UPDATE ON applications BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'application' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'application', NEW.id, NEW.user_id,
    COALESCE(NEW.resume_name, 'Application'),
    'Status: ' || COALESCE(NEW.status, 'draft'),
    COALESCE(NEW.notes, ''),
    '/applications', 'application'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_applications_del AFTER DELETE ON applications BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'application' AND entity_id = OLD.id;
END;

-- Triggers for interviews
CREATE TRIGGER IF NOT EXISTS trg_omni_interviews_ins AFTER INSERT ON interviews BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'interview', NEW.id, NEW.user_id,
    'Interview' || (CASE WHEN NEW.type IS NOT NULL THEN ' (' || NEW.type || ')' ELSE '' END),
    COALESCE(NEW.interviewer_name, '') || ' ' || COALESCE(NEW.interviewer_email, '') || ' ' || COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.status, ''),
    COALESCE(NEW.notes, '') || ' ' || COALESCE(NEW.prep_notes, ''),
    '/interviews', 'interview'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_interviews_upd AFTER UPDATE ON interviews BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'interview' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'interview', NEW.id, NEW.user_id,
    'Interview' || (CASE WHEN NEW.type IS NOT NULL THEN ' (' || NEW.type || ')' ELSE '' END),
    COALESCE(NEW.interviewer_name, '') || ' ' || COALESCE(NEW.interviewer_email, '') || ' ' || COALESCE(NEW.location, '') || ' ' || COALESCE(NEW.status, ''),
    COALESCE(NEW.notes, '') || ' ' || COALESCE(NEW.prep_notes, ''),
    '/interviews', 'interview'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_interviews_del AFTER DELETE ON interviews BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'interview' AND entity_id = OLD.id;
END;

-- Triggers for documents
CREATE TRIGGER IF NOT EXISTS trg_omni_documents_ins AFTER INSERT ON documents BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'document', NEW.id, NEW.user_id, NEW.name,
    'Type: ' || NEW.type,
    COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.file_path, ''),
    '/documents', 'document'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_documents_upd AFTER UPDATE ON documents BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'document', NEW.id, NEW.user_id, NEW.name,
    'Type: ' || NEW.type,
    COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.file_path, ''),
    '/documents', 'document'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_documents_del AFTER DELETE ON documents BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'document' AND entity_id = OLD.id;
END;

-- Triggers for job_deadlines
CREATE TRIGGER IF NOT EXISTS trg_omni_deadlines_ins AFTER INSERT ON job_deadlines BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'deadline', NEW.id, NEW.user_id, NEW.title,
    'Due: ' || NEW.due_date || (CASE WHEN NEW.stage_kind IS NOT NULL THEN ' · ' || NEW.stage_kind ELSE '' END),
    COALESCE(NEW.notes, ''),
    '/board', 'deadline'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_deadlines_upd AFTER UPDATE ON job_deadlines BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'deadline' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'deadline', NEW.id, NEW.user_id, NEW.title,
    'Due: ' || NEW.due_date || (CASE WHEN NEW.stage_kind IS NOT NULL THEN ' · ' || NEW.stage_kind ELSE '' END),
    COALESCE(NEW.notes, ''),
    '/board', 'deadline'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_deadlines_del AFTER DELETE ON job_deadlines BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'deadline' AND entity_id = OLD.id;
END;

-- Triggers for positions
CREATE TRIGGER IF NOT EXISTS trg_omni_positions_ins AFTER INSERT ON positions BEGIN
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'position', NEW.id, NEW.user_id, NEW.name,
    'Level: ' || COALESCE(NEW.experience_level, 'Standard'),
    '',
    '/board', 'position'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_positions_upd AFTER UPDATE ON positions BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'position' AND entity_id = OLD.id;
  INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
  VALUES (
    'position', NEW.id, NEW.user_id, NEW.name,
    'Level: ' || COALESCE(NEW.experience_level, 'Standard'),
    '',
    '/board', 'position'
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_omni_positions_del AFTER DELETE ON positions BEGIN
  DELETE FROM omni_search_index WHERE entity_type = 'position' AND entity_id = OLD.id;
END;


import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { moduleLogger } from "../log/index.ts";

const dbLog = moduleLogger("db");

// Single process-wide connection. `node:sqlite` is synchronous, so there is no
// pool to manage; WAL mode lets Next's concurrent request handlers read while a
// write is in flight.
//
// Cached on globalThis because Next's dev server hot-reloads modules, and a new
// DatabaseSync per reload would leak file handles and eventually lock the file.

const DB_DIR = process.env.SQLITE_DIR ?? path.join(process.cwd(), ".data");
const DB_PATH = process.env.SQLITE_PATH ?? path.join(DB_DIR, "attrack.db");

declare global {
  var __attrackDb: DatabaseSync | undefined;
}

const CURRENT_SCHEMA_VERSION = 8;

// Triggers that schema.sql redefines in place. `CREATE TRIGGER IF NOT EXISTS` is a
// no-op when an older definition already exists, so any trigger whose body or
// column list changes has to be dropped here first, before schema.sql is applied.
//
// Version 8 narrowed the omni-search triggers from `AFTER UPDATE ON <table>` to
// `AFTER UPDATE OF <the columns the index actually reads>`. Before that, writing
// board_position on a card drag — or updated_at, or a match score — deleted and
// re-tokenized the job's whole description and notes, and the DELETE scanned every
// row of the FTS index because entity_type/entity_id are UNINDEXED. Measured at
// 12x on a small database, and it grows with the index.
const REDEFINED_TRIGGERS = [
  "trg_omni_jobs_upd",
  "trg_omni_contacts_upd",
  "trg_omni_companies_upd",
  "trg_omni_applications_upd",
  "trg_omni_interviews_upd",
  "trg_omni_documents_upd",
  "trg_omni_deadlines_upd",
  "trg_omni_positions_upd",
];

function loadSqliteVec(db: DatabaseSync): boolean {
  try {
    db.enableLoadExtension(true);
    sqliteVec.load(db);
    db.enableLoadExtension(false);
    return true;
  } catch (err) {
    try {
      db.enableLoadExtension(false);
    } catch {}
    dbLog.warn({ err }, "Could not load sqlite-vec extension:");
    return false;
  }
}

function open(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH, { allowExtension: true });

  // Set busy timeout FIRST before anything else so concurrent workers wait rather than throw SQLITE_BUSY
  db.exec("PRAGMA busy_timeout = 60000");
  // WAL survives across connections; setting it every open is harmless.
  db.exec("PRAGMA journal_mode = WAL");
  // NORMAL mode avoids fsync latency on every write in WAL mode while remaining crash-safe.
  db.exec("PRAGMA synchronous = NORMAL");
  // OFF by default in SQLite — without this, ON DELETE CASCADE silently does nothing.
  db.exec("PRAGMA foreign_keys = ON");
  // Performance PRAGMAs: 64MB memory cache, RAM temp tables, 256MB memory mapping, multi-threading.
  db.exec("PRAGMA cache_size = -64000");
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA mmap_size = 268435456");
  db.exec("PRAGMA threads = 4");

  loadSqliteVec(db);

  const versionRow = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migrateStartedAt = Date.now();
    const schema = readFileSync(
      path.join(process.cwd(), "lib", "db", "schema.sql"),
      "utf8"
    );
    for (const name of REDEFINED_TRIGGERS) db.exec(`DROP TRIGGER IF EXISTS ${name}`);
    db.exec(schema);
    const applied = addMissingColumns(db);
    dropDeadTables(db);
    fixOwnerForeignKeys(db);
    dropDeadColumns(db);
    rebuildOmniSearchIndex(db);
    db.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
    dbLog.info({ event: "db.migrate", applied, durationMs: Date.now() - migrateStartedAt });
  }

  return db;
}

export function rebuildOmniSearchIndex(db: DatabaseSync) {
  try {
    db.exec("DELETE FROM omni_search_index;");
    db.exec(`
      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'job', id, user_id, title,
        COALESCE(location, '') || ' ' || COALESCE(employment_type, '') || ' ' || COALESCE(status, '') || ' ' || COALESCE(source, ''),
        COALESCE(description, '') || ' ' || COALESCE(notes, ''),
        '/board?jobId=' || id, 'job'
      FROM jobs;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'contact', id, user_id, name,
        COALESCE(position, '') || ' ' || COALESCE(role, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, ''),
        COALESCE(notes, '') || ' ' || COALESCE(linkedin_url, '') || ' ' || COALESCE(github_url, ''),
        '/crm', 'contact'
      FROM contacts;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'company', id, user_id, name,
        COALESCE(location, '') || ' ' || COALESCE(company_type, '') || ' ' || COALESCE(country, ''),
        COALESCE(website, ''),
        '/crm', 'company'
      FROM companies;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'application', id, user_id,
        COALESCE(resume_name, 'Application'),
        'Status: ' || COALESCE(status, 'draft'),
        COALESCE(notes, ''),
        '/applications', 'application'
      FROM applications;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'interview', id, user_id,
        'Interview' || (CASE WHEN type IS NOT NULL THEN ' (' || type || ')' ELSE '' END),
        COALESCE(interviewer_name, '') || ' ' || COALESCE(interviewer_email, '') || ' ' || COALESCE(location, '') || ' ' || COALESCE(status, ''),
        COALESCE(notes, '') || ' ' || COALESCE(prep_notes, ''),
        '/interviews', 'interview'
      FROM interviews;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'document', id, user_id, name,
        'Type: ' || type,
        COALESCE(content, '') || ' ' || COALESCE(file_path, ''),
        '/documents', 'document'
      FROM documents;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'deadline', id, user_id, title,
        'Due: ' || due_date || (CASE WHEN stage_kind IS NOT NULL THEN ' · ' || stage_kind ELSE '' END),
        COALESCE(notes, ''),
        '/board', 'deadline'
      FROM job_deadlines;

      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      SELECT 'position', id, user_id, name,
        'Level: ' || COALESCE(experience_level, 'Standard'),
        '',
        '/board', 'position'
      FROM positions;
    `);
  } catch (err) {
    dbLog.error({ err }, "Failed to rebuild omni search index:");
  }
}

// ---------------------------------------------------------------------------
// Forward-only migrations for databases that predate schema.sql changes.
// schema.sql's CREATE ... IF NOT EXISTS only applies to fresh databases;
// these fix existing ones in-place. Each is idempotent.
// ---------------------------------------------------------------------------

/** Drops tables that are no longer part of the schema. */
function dropDeadTables(db: DatabaseSync) {
  for (const table of ["timeline_events", "notes"]) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    } catch {
      // A missing table is the desired end state; don't fail on it.
    }
  }
  // Drop the trigger bound to the now-deleted notes table.
  try {
    db.exec("DROP TRIGGER IF EXISTS trg_notes_updated");
  } catch {
    // Already gone.
  }
}

/**
 * smtp_config and ai_extraction_logs were created referencing users(id).
 * The owner is profiles(id) — every other table uses it. SQLite has no
 * "ALTER FK", so recreate the table preserving data.
 */
function fixOwnerForeignKeys(db: DatabaseSync) {
  fixTableFK(db, "smtp_config", `CREATE TABLE smtp_config (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    port INTEGER NOT NULL DEFAULT 465,
    user_email TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  fixTableFK(db, "ai_extraction_logs", `CREATE TABLE ai_extraction_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    screenshot_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','success','error')),
    model TEXT NOT NULL,
    duration_ms INTEGER,
    extracted_fields TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
}

function fixTableFK(
  db: DatabaseSync,
  table: string,
  newSchema: string
) {
  // Inspect the current CREATE TABLE SQL to see if it still references users().
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql: string } | undefined;

  if (!row) return; // table doesn't exist yet — fresh DB, schema.sql handles it.
  if (!/REFERENCES users/i.test(row.sql)) return; // already migrated.

  db.exec("BEGIN");
  try {
    db.exec(`ALTER TABLE ${table} RENAME TO _migr_${table}_old`);
    db.exec(newSchema);
    db.exec(
      `INSERT INTO ${table} SELECT * FROM _migr_${table}_old`
    );
    db.exec(`DROP TABLE _migr_${table}_old`);
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // best-effort rollback
    }
    throw err;
  }

  // Recreate the smtp_config trigger (was dropped with the old table).
  if (table === "smtp_config") {
    db.exec(
      `CREATE TRIGGER IF NOT EXISTS trg_smtp_config_updated AFTER UPDATE ON smtp_config
       BEGIN UPDATE smtp_config SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END`
    );
  }

  // Recreate secondary indexes (dropped with the old table).
  if (table === "ai_extraction_logs") {
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_ai_extraction_logs_user ON ai_extraction_logs(user_id)"
    );
  }
}

/** Removes columns that are no longer part of the schema. */
function dropDeadColumns(db: DatabaseSync) {
  try {
    db.exec("ALTER TABLE documents DROP COLUMN application_id");
  } catch {
    // Column already gone or can't be dropped — either way, non-fatal.
  }
}

// Forward-only column additions for tables that already existed when the
// column was introduced. Append here whenever schema.sql adds a column to an
// existing CREATE TABLE — the CREATE TABLE IF NOT EXISTS block documents the
// column, this makes it actually land on a database that already has the
// table. Safe to run on every connection: ALTER TABLE ADD COLUMN throws
// "duplicate column name" once already applied, which is swallowed below.
const COLUMN_MIGRATIONS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "jobs", column: "color", ddl: "ALTER TABLE jobs ADD COLUMN color TEXT" },
  { table: "jobs", column: "section_deadline", ddl: "ALTER TABLE jobs ADD COLUMN section_deadline TEXT" },
  { table: "jobs", column: "section_deadline_list_id", ddl: "ALTER TABLE jobs ADD COLUMN section_deadline_list_id TEXT REFERENCES board_lists(id) ON DELETE SET NULL" },
  { table: "companies", column: "founded_year", ddl: "ALTER TABLE companies ADD COLUMN founded_year INTEGER" },
  { table: "companies", column: "company_type", ddl: "ALTER TABLE companies ADD COLUMN company_type TEXT" },
  { table: "companies", column: "country", ddl: "ALTER TABLE companies ADD COLUMN country TEXT" },
  { table: "documents", column: "generated_kind", ddl: "ALTER TABLE documents ADD COLUMN generated_kind TEXT" },
  { table: "companies", column: "updated_at", ddl: "ALTER TABLE companies ADD COLUMN updated_at TEXT" },
  { table: "documents", column: "updated_at", ddl: "ALTER TABLE documents ADD COLUMN updated_at TEXT" },
  { table: "contacts", column: "position", ddl: "ALTER TABLE contacts ADD COLUMN position TEXT" },
  { table: "contacts", column: "linkedin_url", ddl: "ALTER TABLE contacts ADD COLUMN linkedin_url TEXT" },
  { table: "contacts", column: "github_url", ddl: "ALTER TABLE contacts ADD COLUMN github_url TEXT" },
  { table: "companies", column: "color", ddl: "ALTER TABLE companies ADD COLUMN color TEXT" },
  { table: "contacts", column: "social_links", ddl: "ALTER TABLE contacts ADD COLUMN social_links TEXT" },
  { table: "contacts", column: "avatar_url", ddl: "ALTER TABLE contacts ADD COLUMN avatar_url TEXT" },
  { table: "documents", column: "builder_data", ddl: "ALTER TABLE documents ADD COLUMN builder_data TEXT" },
  { table: "jobs", column: "skills", ddl: "ALTER TABLE jobs ADD COLUMN skills TEXT" },
  { table: "jobs", column: "educational_requirements", ddl: "ALTER TABLE jobs ADD COLUMN educational_requirements TEXT" },
  { table: "jobs", column: "benefits", ddl: "ALTER TABLE jobs ADD COLUMN benefits TEXT" },
  { table: "jobs", column: "work_schedule", ddl: "ALTER TABLE jobs ADD COLUMN work_schedule TEXT" },
  { table: "jobs", column: "holiday_policy", ddl: "ALTER TABLE jobs ADD COLUMN holiday_policy TEXT" },
  { table: "jobs", column: "map_url", ddl: "ALTER TABLE jobs ADD COLUMN map_url TEXT" },
  { table: "jobs", column: "is_unpaid", ddl: "ALTER TABLE jobs ADD COLUMN is_unpaid INTEGER DEFAULT 0" },
  { table: "jobs", column: "salary_min", ddl: "ALTER TABLE jobs ADD COLUMN salary_min REAL" },
  { table: "jobs", column: "salary_max", ddl: "ALTER TABLE jobs ADD COLUMN salary_max REAL" },
  { table: "jobs", column: "salary_currency", ddl: "ALTER TABLE jobs ADD COLUMN salary_currency TEXT" },
  { table: "jobs", column: "salary_period", ddl: "ALTER TABLE jobs ADD COLUMN salary_period TEXT" },
  { table: "jobs", column: "state", ddl: "ALTER TABLE jobs ADD COLUMN state TEXT NOT NULL DEFAULT 'active'" },
  { table: "links", column: "tags", ddl: "ALTER TABLE links ADD COLUMN tags TEXT" },
  { table: "chat_sessions", column: "connected_source_ids", ddl: "ALTER TABLE chat_sessions ADD COLUMN connected_source_ids TEXT" },
  { table: "chat_messages", column: "feedback", ddl: "ALTER TABLE chat_messages ADD COLUMN feedback TEXT" },
  { table: "job_deadlines", column: "type", ddl: "ALTER TABLE job_deadlines ADD COLUMN type TEXT NOT NULL DEFAULT 'deadline'" },
  { table: "ai_providers", column: "verified_at", ddl: "ALTER TABLE ai_providers ADD COLUMN verified_at TEXT" },
  { table: "profiles", column: "show_raw_database", ddl: "ALTER TABLE profiles ADD COLUMN show_raw_database INTEGER NOT NULL DEFAULT 0" },
  { table: "chat_messages", column: "seq", ddl: "ALTER TABLE chat_messages ADD COLUMN seq INTEGER" },
  { table: "chat_messages", column: "thinking", ddl: "ALTER TABLE chat_messages ADD COLUMN thinking TEXT" },
  { table: "chat_messages", column: "sources", ddl: "ALTER TABLE chat_messages ADD COLUMN sources TEXT" },
  { table: "chat_messages", column: "tool_calls", ddl: "ALTER TABLE chat_messages ADD COLUMN tool_calls TEXT" },
  { table: "jobs", column: "tier", ddl: "ALTER TABLE jobs ADD COLUMN tier TEXT" },
  { table: "companies", column: "tier", ddl: "ALTER TABLE companies ADD COLUMN tier TEXT" },
];

/** Returns how many COLUMN_MIGRATIONS actually landed — zero on an
 *  already-current database, the full list on a fresh one. */
function addMissingColumns(db: DatabaseSync): number {
  // Ensure link_categories and links tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS link_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_link_categories_user ON link_categories(user_id, sort_order);

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES link_categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      notes TEXT,
      icon_url TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);
    CREATE INDEX IF NOT EXISTS idx_links_category ON links(user_id, category_id);

    CREATE TABLE IF NOT EXISTS quick_shortcuts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'link',
      sort_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_quick_shortcuts_user ON quick_shortcuts(user_id, sort_order);

    CREATE TABLE IF NOT EXISTS ai_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON ai_memories(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ai_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      model TEXT,
      persona_id TEXT,
      message_content TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_feedback_msg ON ai_feedback(message_id);

    CREATE TABLE IF NOT EXISTS extension_config (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      secret TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TRIGGER IF NOT EXISTS trg_extension_config_updated AFTER UPDATE ON extension_config
    BEGIN UPDATE extension_config SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id; END;

    CREATE VIEW IF NOT EXISTS v_jobs AS
    SELECT
      j.id,
      j.user_id,
      j.company_id,
      c.name AS company_name,
      c.website AS company_website,
      c.location AS company_location,
      j.title,
      j.description,
      j.location,
      j.status,
      j.state,
      j.employment_type,
      j.salary_range,
      j.application_url,
      j.application_email,
      j.deadline,
      j.match_score,
      j.list_id,
      j.position_id,
      j.skills,
      j.benefits,
      j.salary_min,
      j.salary_max,
      j.salary_currency,
      j.salary_period,
      j.created_at,
      j.updated_at
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id;

    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('job_description', 'job_notes', 'resume', 'document')),
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      token_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_document_chunks_user_source ON document_chunks(user_id, source_id);

  `);

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding float[768] distance_metric=cosine,
        +memory_id TEXT,
        +user_id TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        id INTEGER PRIMARY KEY,
        embedding float[768] distance_metric=cosine,
        +user_id TEXT,
        +source_id TEXT
      );
    `);
  } catch (err) {
    // sqlite-vec might not be loaded on existing connection or unsupported platform
    dbLog.warn({ err }, "Vector virtual tables skipped or not available:");
  }

  let applied = 0;
  for (const { ddl } of COLUMN_MIGRATIONS) {
    try {
      db.exec(ddl);
      applied++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name|no such table/i.test(message)) throw err;
    }
  }

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_section_deadline_list_id ON jobs(section_deadline_list_id)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON interviews(user_id, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, type)",
    "CREATE INDEX IF NOT EXISTS idx_positions_resume_id ON positions(resume_id)",
    "CREATE INDEX IF NOT EXISTS idx_applications_resume_id ON applications(resume_id)",
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_document_chunks_user_source ON document_chunks(user_id, source_id)",
  ];

  for (const idxDdl of indexes) {
    try {
      db.exec(idxDdl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name|no such column|no such table/i.test(message)) throw err;
    }
  }

  // One-time repair of chat history sequence order.
  // Re-indexes seq chronologically per session with deterministic user-before-assistant ordering.
  try {
    db.exec(`
      WITH ordered AS (
        SELECT id, (
          ROW_NUMBER() OVER (
            PARTITION BY session_id 
            ORDER BY created_at ASC, (CASE WHEN role = 'user' THEN 0 ELSE 1 END), rowid ASC
          ) - 1
        ) AS new_seq
        FROM chat_messages
      )
      UPDATE chat_messages
      SET seq = (SELECT new_seq FROM ordered WHERE ordered.id = chat_messages.id);
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/no such table/i.test(message)) throw err;
  }

  return applied;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__attrackDb) {
    globalThis.__attrackDb = open();
  }
  return globalThis.__attrackDb;
}

export const dbPath = DB_PATH;

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * ponytail: one global write transaction at a time, which is all SQLite allows
 * anyway. Nested calls are not supported — don't call this from inside itself.
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // A failed rollback would mask the original error; the original is what matters.
    }
    throw err;
  }
}

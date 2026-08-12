import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";

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

const CURRENT_SCHEMA_VERSION = 5;

function open(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);

  // WAL survives across connections; setting it every open is harmless.
  db.exec("PRAGMA journal_mode = WAL");
  // NORMAL mode avoids fsync latency on every write in WAL mode while remaining crash-safe.
  db.exec("PRAGMA synchronous = NORMAL");
  // OFF by default in SQLite — without this, ON DELETE CASCADE silently does nothing.
  db.exec("PRAGMA foreign_keys = ON");
  // Wait rather than throw SQLITE_BUSY when another handler holds the write lock.
  db.exec("PRAGMA busy_timeout = 5000");
  // Performance PRAGMAs: 64MB memory cache, RAM temp tables, 256MB memory mapping.
  db.exec("PRAGMA cache_size = -64000");
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA mmap_size = 268435456");

  // Always apply forward-only column migrations so new schema columns land idempotently on existing DBs
  addMissingColumns(db);

  const versionRow = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    const schema = readFileSync(
      path.join(process.cwd(), "lib", "db", "schema.sql"),
      "utf8"
    );
    db.exec(schema);
    dropDeadTables(db);
    fixOwnerForeignKeys(db);
    dropDeadColumns(db);
    rebuildOmniSearchIndex(db);
    db.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
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
    console.error("Failed to rebuild omni search index:", err);
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
];

function addMissingColumns(db: DatabaseSync) {
  for (const { ddl } of COLUMN_MIGRATIONS) {
    try {
      db.exec(ddl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name/i.test(message)) throw err;
    }
  }

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_jobs_section_deadline_list_id ON jobs(section_deadline_list_id)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON jobs(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON interviews(user_id, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, type)",
  ];

  for (const idxDdl of indexes) {
    try {
      db.exec(idxDdl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column name|no such column/i.test(message)) throw err;
    }
  }
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

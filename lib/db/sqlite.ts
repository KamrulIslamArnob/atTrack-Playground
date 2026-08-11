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

function open(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);

  // WAL survives across connections; setting it every open is harmless.
  db.exec("PRAGMA journal_mode = WAL");
  // OFF by default in SQLite — without this, ON DELETE CASCADE silently does nothing.
  db.exec("PRAGMA foreign_keys = ON");
  // Wait rather than throw SQLITE_BUSY when another handler holds the write lock.
  db.exec("PRAGMA busy_timeout = 5000");

  const schema = readFileSync(
    path.join(process.cwd(), "lib", "db", "schema.sql"),
    "utf8"
  );
  // Every statement is CREATE ... IF NOT EXISTS, so this creates missing
  // tables. It does NOT add columns to a table that already exists — SQLite
  // has no "ADD COLUMN IF NOT EXISTS", and re-running the CREATE is a no-op
  // once the table is there. addMissingColumns() below is what makes adding
  // a column to an existing table (e.g. jobs.color) actually reach a
  // database that predates that column.
  db.exec(schema);
  addMissingColumns(db);

  return db;
}

// Forward-only column additions for tables that already existed when the
// column was introduced. Append here whenever schema.sql adds a column to an
// existing CREATE TABLE — the CREATE TABLE IF NOT EXISTS block documents the
// column, this makes it actually land on a database that already has the
// table. Safe to run on every connection: ALTER TABLE ADD COLUMN throws
// "duplicate column name" once already applied, which is swallowed below.
const COLUMN_MIGRATIONS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "jobs", column: "color", ddl: "ALTER TABLE jobs ADD COLUMN color TEXT" },
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

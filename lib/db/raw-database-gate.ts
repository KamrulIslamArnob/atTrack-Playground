import { getDb } from "./sqlite.ts";

// Relative, .ts-extensioned import (not "@/lib/db/sqlite") — matches the rest
// of lib/db/*.ts, kept standalone-Node-runnable on purpose (see tsconfig.json).

/** Gate for the raw database viewer (/preferences/database, /api/database*).
 *  Off by default — a full table/column browser with inline editing, no
 *  allowlist or confirmation, is overwhelming (and easy to misuse) for
 *  anyone who isn't comfortable with databases. Opt-in from Settings. */
export function isRawDatabaseEnabled(userId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT show_raw_database FROM profiles WHERE id = ?")
    .get(userId) as { show_raw_database: number | null } | undefined;
  return Boolean(row?.show_raw_database);
}

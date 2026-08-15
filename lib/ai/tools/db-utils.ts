// Shared helpers for the chatbot's database tools. Generalized on purpose:
// the agent is granted full read/write access to the user's own workspace
// database (any table), with owner-scoping auto-detected per table. Deletes
// are gated behind an interactive approval (see lib/ai-chatbot/db-approval.ts)
// and never run until the user explicitly allows them.
//
// Uses the @/ alias like the rest of lib/ai/tools.
import { getDb } from "@/lib/db/sqlite";

/** A SQL identifier is safe iff it matches this — never interpolate raw input
 *  into SQL without it. Applies to table and column names. */
export function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

export function tableExists(table: string): boolean {
  if (!isValidIdentifier(table)) return false;
  const row = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

/** Column names for a table (empty for unknown tables). */
export function getColumns(table: string): string[] {
  return getColumnsWithTypes(table).map((c) => c.name);
}

export interface ColumnInfo {
  name: string;
  type: string;
}

/** Columns with their declared types (empty for unknown tables). */
export function getColumnsWithTypes(table: string): ColumnInfo[] {
  if (!tableExists(table)) return [];
  const rows = getDb().prepare(`PRAGMA table_info("${table}")`).all() as {
    name: string;
    type: string;
  }[];
  return rows.map((r) => ({ name: r.name, type: (r.type ?? "").toUpperCase() }));
}

/** Columns whose declared type is text-like — eligible for substring filter. */
export function getTextColumns(table: string): string[] {
  return getColumnsWithTypes(table)
    .filter((c) => /CHAR|TEXT|CLOB/.test(c.type))
    .map((c) => c.name);
}

/** Which column scopes a table to the current user. Prefers `user_id`; falls
 *  back to the first column ending in `_user_id`. `null` means the table has no
 *  owner column — for a single local user we then operate without a filter. */
export function resolveOwnerColumn(table: string): string | null {
  const cols = getColumns(table);
  if (cols.includes("user_id")) return "user_id";
  const alt = cols.find((c) => c.endsWith("_user_id"));
  return alt ?? null;
}

/** Columns the model is never allowed to set directly — ownership and
 *  timestamps are always server-managed. */
export const ALWAYS_BLOCKED_COLUMNS = new Set([
  "id",
  "user_id",
  "created_at",
  "updated_at",
]);

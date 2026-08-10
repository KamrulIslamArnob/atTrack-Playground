// SQLite stores neither JSON nor booleans natively, so the query layer converts
// them on the way in and out. Everything that needs conversion is declared here
// in one place — if you add a JSON or boolean column to schema.sql, add it here
// in the same change or reads will hand back a raw string / 0|1 to the callers.

export const JSON_COLUMNS: Record<string, readonly string[]> = {
  jobs: ["notes", "project_links"],
  documents: ["match_data", "builder_data"],
  mcq_results: ["answers", "questions"],
  activity_logs: ["metadata"],
  ai_usage_logs: ["metadata"],
  ai_extraction_logs: ["extracted_fields"],
  timeline_events: ["metadata"],
  users: ["raw_user_meta_data"],
  ai_task_routes: ["provider_ids"],
};

export const BOOLEAN_COLUMNS: Record<string, readonly string[]> = {
  profiles: ["is_banned"],
  documents: ["is_default"],
  positions: ["is_primary"],
};

/** Columns that get an auto-generated UUID on insert when absent. */
export const ID_COLUMN = "id";

/**
 * Tables whose primary key is not a generated UUID, so inserts must supply it.
 * `sessions` is keyed by the token hash; `profiles` by the user id.
 */
// job_contacts / job_documents are composite-PK join tables with no "id"
// column at all — without this, insert() auto-adds a random "id" value that
// doesn't exist on the table, SQLite throws, and the query builder swallows
// it into {error} (see query.ts's execute()). Every link/unlink call site
// insert()s into these two without checking .error, so the failure was
// silent: the contact/document got created, the job link just never landed.
// `profiles` is keyed by the user id (set on insert), so it must not get a
// random id either.
export const NO_AUTO_ID = new Set(["profiles", "job_contacts", "job_documents"]);

export function jsonColumns(table: string): readonly string[] {
  return JSON_COLUMNS[table] ?? [];
}

export function booleanColumns(table: string): readonly string[] {
  return BOOLEAN_COLUMNS[table] ?? [];
}

/** SQLite row -> JS object: parse JSON columns, coerce 0/1 to booleans. */
export function decodeRow<T extends Record<string, unknown>>(
  table: string,
  row: T | undefined
): T | undefined {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };

  for (const col of jsonColumns(table)) {
    const raw = out[col];
    if (typeof raw === "string") {
      try {
        out[col] = JSON.parse(raw);
      } catch {
        // A column that should hold JSON but doesn't is a data bug, not a
        // reason to fail the whole read. Surface null and keep going.
        out[col] = null;
      }
    }
  }

  for (const col of booleanColumns(table)) {
    if (out[col] !== null && out[col] !== undefined) out[col] = Boolean(out[col]);
  }

  return out as T;
}

/** JS value -> SQLite binding: serialize objects, booleans to 0/1. */
export function encodeValue(table: string, column: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;

  if (jsonColumns(table).includes(column)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  // Any remaining object heading for a TEXT column (e.g. an array) is stored as
  // JSON rather than "[object Object]".
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

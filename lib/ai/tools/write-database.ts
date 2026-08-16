// Creates or updates rows in ANY table of the user's own workspace database.
// Executes immediately — no confirmation (deletes are the only gated op, see
// delete-database.ts / lib/ai-chatbot/db-approval.ts). Ownership is always
// forced to the current user; id/created_at/updated_at are never set by the
// model, and neither is jobs.status — it's derived from list_id by a DB
// trigger (trg_jobs_status_from_list_* in lib/db/schema.sql). Uses raw SQL so
// any valid table/column works.
import type { ToolDefinition } from "./types";
import { getDb } from "@/lib/db/sqlite";
import { createDbClient } from "@/lib/db/client";
import { ensureApplication } from "@/lib/actions/board";
import { logResourceActivity } from "@/lib/actions/activity-log";
import {
  isValidIdentifier,
  tableExists,
  getColumns,
  getColumnsWithTypes,
  resolveOwnerColumn,
  ALWAYS_BLOCKED_COLUMNS,
} from "./db-utils";

/** Columns that are technically real columns but derived, not model-writable,
 *  on a specific table — the model must go through the domain path instead
 *  (here: move list_id, and a DB trigger recomputes status). */
const EXTRA_BLOCKED_COLUMNS: Record<string, Set<string>> = {
  jobs: new Set(["status"]),
};

/** True when `listId` names a board list owned by `userId` whose kind is
 *  "applied" — the same check the drag-and-drop path uses before calling
 *  ensureApplication (lib/actions/board.ts). */
function isAppliedKindList(userId: string, listId: unknown): boolean {
  if (typeof listId !== "string" || !listId) return false;
  const row = getDb()
    .prepare(`SELECT kind FROM board_lists WHERE id = ? AND user_id = ?`)
    .get(listId, userId) as { kind: string } | undefined;
  return row?.kind === "applied";
}

export const writeDatabaseTool: ToolDefinition = {
  name: "write_database",
  sourceId: "db_query",
  description:
    "Create or update a row in ANY table of the user's own workspace database. Executes immediately, no confirmation needed. Pass `action` ('insert' | 'update'), `table` (any table), `id` (required for update, ignored for insert), and `values` (column -> value). `user_id`/ownership and `id`/`created_at`/`updated_at` are always server-managed. For jobs, never set `status` — it's derived automatically from `list_id`; set `list_id` to move a job between board columns (look the list's id up with query_database on board_lists first), and moving into an Applied-kind list automatically creates the matching application record.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["insert", "update"] },
      table: { type: "string", description: "Any existing table name." },
      id: { type: "string", description: "Row id. Required for update, ignored for insert." },
      values: {
        type: "object",
        description: "Column name -> new value. Unknown or blocked columns are dropped and reported back.",
      },
    },
    required: ["action", "table", "values"],
  },
  execute: async (args, ctx) => {
    const action = args.action === "insert" || args.action === "update" ? args.action : null;
    const table = typeof args.table === "string" ? args.table.trim() : "";
    if (!action || !tableExists(table)) {
      return {
        content: `Invalid write: action must be "insert" or "update" and table must be an existing table.`,
        citations: [],
      };
    }

    const ownerCol = resolveOwnerColumn(table);
    const allCols = getColumns(table);
    const rowId = typeof args.id === "string" ? args.id.trim() : "";
    if (action === "update" && !rowId) {
      return { content: 'Update requires an "id" — look the row up first (e.g. with query_database).', citations: [table] };
    }

    const rawValues = args.values && typeof args.values === "object" ? { ...(args.values as Record<string, unknown>) } : {};
    const db = getDb();

    // Auto-resolve common human-friendly fields for foreign keys
    if (table === "jobs") {
      if (typeof rawValues.company === "string" && rawValues.company.trim() && !rawValues.company_id) {
        const compName = rawValues.company.trim();
        const existing = db
          .prepare("SELECT id FROM companies WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1")
          .get(ctx.userId, compName) as { id: string } | undefined;
        if (existing) {
          rawValues.company_id = existing.id;
        } else {
          const newCompId = crypto.randomUUID();
          db.prepare("INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)").run(newCompId, ctx.userId, compName);
          rawValues.company_id = newCompId;
        }
        delete rawValues.company;
      }
      const stageOrList = (rawValues.stage || rawValues.list) as string | undefined;
      if (typeof stageOrList === "string" && stageOrList.trim() && !rawValues.list_id) {
        const target = stageOrList.trim();
        const listRow = db
          .prepare("SELECT id FROM board_lists WHERE user_id = ? AND (lower(name) = lower(?) OR lower(kind) = lower(?)) ORDER BY sort_order LIMIT 1")
          .get(ctx.userId, target, target) as { id: string } | undefined;
        if (listRow) {
          rawValues.list_id = listRow.id;
        }
        delete rawValues.stage;
        delete rawValues.list;
      }
    } else if (table === "links") {
      if (typeof rawValues.category === "string" && rawValues.category.trim() && !rawValues.category_id) {
        const catName = rawValues.category.trim();
        const existingCat = db
          .prepare("SELECT id FROM link_categories WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1")
          .get(ctx.userId, catName) as { id: string } | undefined;
        if (existingCat) {
          rawValues.category_id = existingCat.id;
        } else {
          const newCatId = crypto.randomUUID();
          db.prepare("INSERT INTO link_categories (id, user_id, name) VALUES (?, ?, ?)").run(newCatId, ctx.userId, catName);
          rawValues.category_id = newCatId;
        }
        delete rawValues.category;
      }
    }

    const values: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, val] of Object.entries(rawValues)) {
      if (
        !isValidIdentifier(key) ||
        !allCols.includes(key) ||
        ALWAYS_BLOCKED_COLUMNS.has(key) ||
        EXTRA_BLOCKED_COLUMNS[table]?.has(key)
      ) {
        dropped.push(key);
        continue;
      }
      values[key] = val;
    }

    if (action === "insert") {
      if (Object.keys(values).length === 0) {
        return { content: "Nothing to insert — all provided columns were unknown or blocked.", citations: [table] };
      }
      if (ownerCol) values[ownerCol] = ctx.userId;
      // Mirror lib/db/query.ts's insert path: a TEXT primary key has no
      // SQL-level default, so this tool must generate the same kind of id
      // every other write path does — otherwise the row lands with a NULL
      // id, invisible to the rest of the app. INTEGER PRIMARY KEY tables
      // autoincrement on their own and must NOT get an explicit id.
      const idType = getColumnsWithTypes(table).find((c) => c.name === "id")?.type;
      const generatesId = idType !== undefined && idType !== "INTEGER";
      if (generatesId) values.id = crypto.randomUUID();

      const cols = Object.keys(values);
      const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
      let newId: string | number;
      try {
        const info = db.prepare(sql).run(...(cols.map((c) => values[c]) as never[]));
        newId = generatesId ? (values.id as string) : Number(info.lastInsertRowid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: `Insert into ${table} failed: ${msg}`, citations: [table] };
      }

      if (table === "jobs" && isAppliedKindList(ctx.userId, values.list_id)) {
        await ensureApplication(createDbClient(), ctx.userId, String(newId));
      }
      // Column names only, never their values — see lib/actions/activity-log.ts.
      void logResourceActivity(ctx.userId, "chat_insert", table, String(newId), { columns: cols.join(",") });

      const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
      return {
        content: `Created ${table} row ${newId}: ${JSON.stringify(values)}.${droppedNote}`,
        citations: [table],
      };
    }

    if (Object.keys(values).length === 0) {
      return { content: "Nothing to update after dropping unknown/blocked fields.", citations: [table] };
    }
    const setCols = Object.keys(values);
    const sql =
      `UPDATE "${table}" SET ${setCols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?` +
      (ownerCol ? ` AND "${ownerCol}" = ?` : "");
    const params: unknown[] = [...setCols.map((c) => values[c]), rowId];
    if (ownerCol) params.push(ctx.userId);

    let changes: number;
    try {
      const info = db.prepare(sql).run(...(params as never[]));
      changes = Number(info.changes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Update to ${table} failed: ${msg}`, citations: [table] };
    }
    if (changes === 0) {
      return { content: `No ${table} row with id ${rowId} for this user — nothing updated.`, citations: [table] };
    }

    if (table === "jobs" && isAppliedKindList(ctx.userId, values.list_id)) {
      await ensureApplication(createDbClient(), ctx.userId, rowId);
    }
    void logResourceActivity(ctx.userId, "chat_update", table, rowId, { columns: setCols.join(",") });

    const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
    return { content: `Updated ${table} row ${rowId}.${droppedNote}`, citations: [table] };
  },
};

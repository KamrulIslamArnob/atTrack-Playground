// Creates or updates rows in the user's own workspace database. Executes
// immediately — no confirmation (unlike delete-database.ts). See
// docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// Uses the @/* alias like the rest of lib/ai/tools/ (not relative-.ts, unlike
// db-tables.ts/delete-database.ts) because ensureApplication pulls in
// lib/actions/board.ts -> @/lib/auth, which is Next-only regardless — there's
// no standalone-runnability to gain by relativizing just this file.
import type { ToolDefinition } from "./types";
import { createDbClient, type DbClient } from "@/lib/db/client";
import { ensureApplication } from "@/lib/actions/board";
import { WRITABLE_TABLES, FK_NAME_FIELDS, findOrCreateByName } from "./db-tables";

/** Never settable by the model, on any table. */
const ALWAYS_BLOCKED = new Set(["id", "user_id", "status", "created_at", "updated_at"]);

/** Board columns a job can be placed in by name (case-insensitive) or by kind
 *  (wishlist/preparing/applied/interview/offer/accepted/rejected/custom). */
async function resolveBoardList(
  db: DbClient,
  userId: string,
  identifier: string
): Promise<{ id: string; kind: string } | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const { data: byKind } = await db
    .from("board_lists")
    .select("id,kind")
    .eq("user_id", userId)
    .eq("kind", trimmed.toLowerCase())
    .maybeSingle();
  if (byKind) return { id: byKind.id as string, kind: byKind.kind as string };

  const { data: byName } = await db
    .from("board_lists")
    .select("id,kind")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (byName) return { id: byName.id as string, kind: byName.kind as string };

  return null;
}

/** Appends a job to the end of `listId`'s column — no drag-precision reordering. */
async function nextBoardPosition(db: DbClient, userId: string, listId: string): Promise<number> {
  const { data: last } = await db
    .from("jobs")
    .select("board_position")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .order("board_position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(last?.board_position) || 0) + 1000;
}

export const writeDatabaseTool: ToolDefinition = {
  name: "write_database",
  sourceId: "db_query",
  description:
    'Creates or updates a row in the user\'s own workspace database (jobs, companies, documents, ai_memories, contacts, link_categories, links, ai_tool_prompts). Executes immediately, no confirmation needed. For jobs: pass `company` (a name) instead of company_id and it is found or created automatically; pass `list` (the board column\'s name or kind, e.g. "MCQ" or "applied") instead of list_id to place or move the job there — entering an Applied-kind column automatically creates the matching application record, same as dragging the card. Never pass `status` — it is derived automatically from the column the job is in. `action: "update"` requires the row\'s `id` (look it up with query_database first if you don\'t have it); `action: "insert"` creates a new row (documents and ai_tool_prompts don\'t support insert here — update only).',
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["insert", "update"] },
      table: { type: "string", enum: Object.keys(WRITABLE_TABLES) },
      id: { type: "string", description: "Row id. Required for update, ignored for insert." },
      values: {
        type: "object",
        description: "Column name -> new value. Unknown or blocked columns are dropped and reported back in the result.",
      },
    },
    required: ["action", "table", "values"],
  },
  execute: async (args, ctx) => {
    const action = args.action === "insert" || args.action === "update" ? args.action : null;
    const table = typeof args.table === "string" ? args.table : "";
    const def = WRITABLE_TABLES[table];
    if (!action || !def) {
      return {
        content: `Invalid write: action must be "insert" or "update", table must be one of ${Object.keys(WRITABLE_TABLES).join(", ")}.`,
        citations: [],
      };
    }
    if (action === "insert" && !def.allowInsert) {
      return { content: `${def.label} does not support creating new rows through chat — update an existing one instead.`, citations: [def.label] };
    }
    if (action === "update" && !def.allowUpdate) {
      return { content: `${def.label} does not support updates through chat.`, citations: [def.label] };
    }
    const rowId = typeof args.id === "string" ? args.id : "";
    if (action === "update" && !rowId) {
      return { content: 'Update requires an "id" — look the row up first (e.g. with query_database).', citations: [def.label] };
    }
    const rawValues = args.values && typeof args.values === "object" ? (args.values as Record<string, unknown>) : {};

    const virtualFields = new Set<string>((FK_NAME_FIELDS[table] ?? []).map((fk) => fk.virtualField));
    if (table === "jobs") virtualFields.add("list");

    const allowedCols = new Set(action === "insert" ? def.insertColumns : def.updateColumns);
    const values: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, val] of Object.entries(rawValues)) {
      if (virtualFields.has(key)) continue;
      if (ALWAYS_BLOCKED.has(key) || !allowedCols.has(key)) {
        dropped.push(key);
        continue;
      }
      values[key] = val;
    }

    const db = createDbClient();
    const notes: string[] = [];

    for (const fk of FK_NAME_FIELDS[table] ?? []) {
      const raw = rawValues[fk.virtualField];
      if (typeof raw === "string" && raw.trim()) {
        const resolved = await findOrCreateByName(db, fk.table, ctx.userId, raw);
        if ("error" in resolved) notes.push(`Could not resolve "${fk.virtualField}": ${resolved.error}`);
        else values[fk.column] = resolved.id;
      }
    }

    let targetListKind: string | null = null;
    if (table === "jobs") {
      const rawList = typeof rawValues.list === "string" && rawValues.list.trim() ? rawValues.list : undefined;
      // Every job must land in a column or it's invisible on /board — default
      // new jobs to Wishlist when no column was given, matching
      // app/api/extension/add-job/route.ts. Updates leave list_id untouched
      // when `list` is omitted (a normal partial update).
      const listIdent = rawList ?? (action === "insert" ? "wishlist" : undefined);
      if (listIdent) {
        const list = await resolveBoardList(db, ctx.userId, listIdent);
        if (list) {
          values.list_id = list.id;
          targetListKind = list.kind;
          values.board_position = await nextBoardPosition(db, ctx.userId, list.id);
        } else {
          notes.push(
            `Board column "${listIdent}" not found — left where it was. Use the exact column name or kind (wishlist/preparing/applied/interview/offer/accepted/rejected).`
          );
        }
      }
    }

    if (action === "update" && Object.keys(values).length === 0) {
      return { content: "Nothing to update after dropping unknown/blocked fields.", citations: [def.label] };
    }

    const selectCols = ["id", ...Object.keys(values).filter((c) => c !== "user_id")].join(",");

    if (action === "insert") {
      values.user_id = ctx.userId;
      const { data, error } = await db.from(table).insert(values).select(selectCols).single();
      if (error || !data) {
        return { content: `Insert into ${def.label} failed: ${error?.message ?? "unknown error"}`, citations: [def.label] };
      }
      const newId = data.id as string;
      if (table === "jobs" && targetListKind === "applied") await ensureApplication(db, ctx.userId, newId);
      const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
      const extra = notes.length ? ` ${notes.join(" ")}` : "";
      return { content: `Created ${def.label} row ${newId}: ${JSON.stringify(data)}.${droppedNote}${extra}`, citations: [def.label] };
    }

    const { data, error } = await db
      .from(table)
      .update(values)
      .eq("id", rowId)
      .eq(def.ownerCol, ctx.userId)
      .select(selectCols)
      .maybeSingle();
    if (error) {
      return { content: `Update to ${def.label} failed: ${error.message}`, citations: [def.label] };
    }
    if (!data) {
      return { content: `No ${def.label} row with id ${rowId} for this user — nothing updated.`, citations: [def.label] };
    }
    if (table === "jobs" && targetListKind === "applied") await ensureApplication(db, ctx.userId, rowId);
    const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
    const extra = notes.length ? ` ${notes.join(" ")}` : "";
    return { content: `Updated ${def.label} row ${rowId}: ${JSON.stringify(data)}.${droppedNote}${extra}`, citations: [def.label] };
  },
};

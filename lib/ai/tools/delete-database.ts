// Deletes rows from the user's own workspace tables. NEVER deletes on the
// call that proposes it — only when a LATER call (different traceId) repeats
// the exact same table+ids while a pending record still matches. See
// docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// Relative, .ts-extensioned imports (not the `@/*` alias) so this file can be
// imported directly by scripts/verify-db-write-delete.ts under plain Node —
// same reason lib/db/*.ts does it (see tsconfig.json).
import type { ToolDefinition } from "./types";
import { createDbClient } from "../../db/client.ts";
import { WRITABLE_TABLES } from "./db-tables.ts";

interface PendingDelete {
  table: string;
  ids: string[];
  traceId: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
/** One pending delete per user — a fresh propose overwrites any older one.
 *  Module-level and in-memory: a dev hot-reload or process restart just
 *  clears it, and the model re-proposes. Fine for a single local user. */
const pending = new Map<string, PendingDelete>();

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export const deleteDatabaseTool: ToolDefinition = {
  name: "delete_database",
  sourceId: "db_query",
  description:
    "Deletes rows from the user's own workspace database (jobs, companies, documents, ai_memories, contacts, link_categories, links, ai_tool_prompts). SAFETY: the first call never deletes anything — it returns the exact matching rows and the SQL that would run, and you must show that to the user and stop. Only call this tool again — with the exact same table and ids — after the user explicitly confirms in a LATER message. Never call it a second time in the same reply.",
  parameters: {
    type: "object",
    properties: {
      table: { type: "string", enum: Object.keys(WRITABLE_TABLES) },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Row ids to delete — get them from query_database or a prior write_database result.",
      },
    },
    required: ["table", "ids"],
  },
  execute: async (args, ctx) => {
    const table = typeof args.table === "string" ? args.table : "";
    const def = WRITABLE_TABLES[table];
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];
    if (!def || ids.length === 0) {
      return {
        content: `Invalid delete: table must be one of ${Object.keys(WRITABLE_TABLES).join(", ")}, and ids must be a non-empty array of strings.`,
        citations: [],
      };
    }

    const db = createDbClient();
    const { data: rows, error: fetchError } = await db
      .from(table)
      .select("*")
      .eq(def.ownerCol, ctx.userId)
      .in("id", ids);
    if (fetchError) {
      return { content: `Couldn't look up ${def.label} rows: ${fetchError.message}`, citations: [def.label] };
    }
    const found = (rows ?? []) as Record<string, unknown>[];
    if (found.length === 0) {
      pending.delete(ctx.userId);
      return { content: `No ${def.label} rows found for those ids — nothing to delete.`, citations: [def.label] };
    }
    const foundIds = found.map((r) => String(r.id));

    const existing = pending.get(ctx.userId);
    const currentTraceId = ctx.traceId ?? "";
    const isConfirming =
      !!existing &&
      existing.table === table &&
      sameIds(existing.ids, foundIds) &&
      existing.expiresAt > Date.now() &&
      existing.traceId !== currentTraceId;

    if (isConfirming) {
      pending.delete(ctx.userId);
      const { error: delError } = await db.from(table).delete().eq(def.ownerCol, ctx.userId).in("id", foundIds);
      if (delError) {
        return { content: `Delete failed: ${delError.message}`, citations: [def.label] };
      }
      return {
        content: `Deleted ${found.length} row(s) from ${def.label} (ids: ${foundIds.join(", ")}).`,
        citations: [def.label],
      };
    }

    pending.set(ctx.userId, { table, ids: foundIds, traceId: currentTraceId, expiresAt: Date.now() + TTL_MS });
    const summary = found.map((r) => `  - ${r.id}: ${JSON.stringify(r).slice(0, 200)}`).join("\n");
    const sql = `DELETE FROM ${table} WHERE id IN (${foundIds.map(() => "?").join(",")}) AND ${def.ownerCol} = ?`;
    return {
      content:
        `About to delete ${found.length} row(s) from ${def.label}:\n${summary}\n\n` +
        `SQL: ${sql}\n\n` +
        `This has NOT run yet. Show this to the user and ask them to confirm. Only call delete_database again, with the same table and ids, after they say yes in their next message.`,
      citations: [def.label],
    };
  },
};

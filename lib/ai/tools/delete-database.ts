// Deletes rows from ANY table in the user's own workspace database — but NEVER
// on the proposing call. It looks the rows up (owner-scoped), stores a pending
// approval, and returns an `approval` payload so the pipeline can pause the
// chat and render an Allow/Deny card. The actual DELETE runs only when the user
// approves via /api/chat (see lib/ai-chatbot/db-approval.ts). This is the only
// gated database operation; reads and writes execute immediately.
import type { ToolDefinition } from "./types";
import { getDb } from "@/lib/db/sqlite";
import { tableExists, resolveOwnerColumn } from "./db-utils";
import { createPendingDbDelete } from "@/lib/ai-chatbot/db-approval";

export const deleteDatabaseTool: ToolDefinition = {
  name: "delete_database",
  sourceId: "db_query",
  description:
    "Deletes rows from ANY table in the user's own workspace database. SAFETY: this NEVER deletes on the call that proposes it. It returns the exact matching rows and the SQL that would run, then the chat pauses for the user's explicit approval (an Allow/Deny card). Call it once with `table` and `ids` — do NOT call it again to confirm; approval happens in the UI. The delete only runs if the user clicks Allow.",
  parameters: {
    type: "object",
    properties: {
      table: { type: "string", description: "Any existing table name." },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Row ids to delete — get them from query_database or a prior write_database result.",
      },
    },
    required: ["table", "ids"],
  },
  execute: async (args, ctx) => {
    const table = typeof args.table === "string" ? args.table.trim() : "";
    if (!tableExists(table)) {
      return { content: `Table "${table}" does not exist.`, citations: [] };
    }
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];
    if (ids.length === 0) {
      return { content: "Provide a non-empty `ids` array of row ids to delete.", citations: [table] };
    }

    const ownerCol = resolveOwnerColumn(table);
    const db = getDb();
    const placeholders = ids.map(() => "?").join(",");
    const lookupParams: unknown[] = [...ids];
    let lookupSql = `SELECT * FROM "${table}" WHERE id IN (${placeholders})`;
    if (ownerCol) {
      lookupSql += ` AND "${ownerCol}" = ?`;
      lookupParams.push(ctx.userId);
    }
    const found = db.prepare(lookupSql).all(...(lookupParams as never[])) as Record<string, unknown>[];
    if (found.length === 0) {
      return { content: `No ${table} rows found for those ids — nothing to delete.`, citations: [table] };
    }
    const foundIds = found.map((r) => String(r.id));
    const summary = found.map((r) => `  - ${r.id}: ${JSON.stringify(r).slice(0, 200)}`).join("\n");
    const sql = `DELETE FROM "${table}" WHERE id IN (${foundIds.map(() => "?").join(",")})${
      ownerCol ? ` AND "${ownerCol}" = ?` : ""
    }`;

    const approvalId = createPendingDbDelete({
      userId: ctx.userId,
      table,
      ownerCol,
      ids: foundIds,
      label: table,
      preview: summary,
      sql,
    });

    return {
      content:
        `About to delete ${found.length} row(s) from "${table}":\n${summary}\n\n` +
        `SQL: ${sql}\n\n` +
        `This has NOT run yet. The chat is now waiting for your approval — click Allow to delete, or Deny to cancel.`,
      citations: [table],
      approval: {
        approvalId,
        label: table,
        preview: summary,
        sql,
      },
    };
  },
};

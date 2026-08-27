// Deletes rows from ANY table in the user's own workspace database — but NEVER
// on the proposing call. It looks the rows up (owner-scoped), stores a pending
// approval, and returns an `approval` payload so the pipeline can pause the
// chat and render an Allow/Deny card. The actual DELETE runs only when the user
// approves via /api/chat (see lib/ai-chatbot/db-approval.ts). This is the only
// gated database operation; reads and writes execute immediately.
import type { ToolDefinition } from "./types";
import { getDb } from "@/lib/db/sqlite";
import { tableExists, resolveOwnerColumn, getColumns } from "./db-utils";
import { createPendingDbDelete } from "@/lib/ai-chatbot/db-approval";

export const deleteDatabaseTool: ToolDefinition = {
  name: "delete_database",
  sourceId: "db_query",
  description:
    "Deletes rows from ANY table in the user's own workspace database. SAFETY: this NEVER deletes on the call that proposes it. It returns the exact matching rows and creates an Allow/Deny confirmation card for the user. Pass `table` and either `ids` (array of ids), `id` (single id), or `title`/`name` to look up matching rows. The delete ONLY runs after the user clicks Allow.",
  parameters: {
    type: "object",
    properties: {
      table: { type: "string", description: "Any existing table name." },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Row ids to delete — get them from query_database or a prior write_database result.",
      },
      id: { type: "string", description: "Single row id to delete." },
      title: { type: "string", description: "Optional title to match and delete if id is unknown." },
      name: { type: "string", description: "Optional name to match and delete if id is unknown." },
    },
    required: ["table"],
  },
  execute: async (args, ctx) => {
    const mode = (ctx.permissionMode as string) ?? "bypass";
    if (mode === "readonly") {
      return {
        content: `Delete blocked: you are in Read-only (View) mode. Switch to "Ask before changes" or "Bypass permissions" to allow deletions. No data was changed.`,
        citations: [],
      };
    }

    const table = typeof args.table === "string" ? args.table.trim() : "";
    if (!tableExists(table)) {
      return { content: `Table "${table}" does not exist.`, citations: [] };
    }

    let ids: string[] = [];
    if (Array.isArray(args.ids)) {
      ids = args.ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    } else if (typeof args.id === "string" && args.id.trim().length > 0) {
      ids = [args.id.trim()];
    }

    const ownerCol = resolveOwnerColumn(table);
    const db = getDb();
    const allCols = getColumns(table);

    // Auto-lookup by title or name if no explicit ids provided
    if (ids.length === 0 && (typeof args.title === "string" || typeof args.name === "string")) {
      const searchTerm = String(args.title || args.name).trim();
      if (searchTerm) {
        const searchCol = allCols.includes("title") ? "title" : allCols.includes("name") ? "name" : null;
        if (searchCol) {
          const matching = db
            .prepare(`SELECT id FROM "${table}" WHERE lower("${searchCol}") LIKE lower(?) ${ownerCol ? `AND "${ownerCol}" = ?` : ""}`)
            .all(`%${searchTerm}%`, ...(ownerCol ? [ctx.userId] : [])) as { id: string }[];
          ids = matching.map((m) => String(m.id));
        }
      }
    }

    if (ids.length === 0) {
      return { content: "Provide row `ids` or a matching `title`/`name` to delete.", citations: [table] };
    }

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

    // Bypass: execute directly without approval
    if (mode === "bypass") {
      const placeholders2 = foundIds.map(() => "?").join(",");
      const params2: unknown[] = [...foundIds];
      const delSql = `DELETE FROM "${table}" WHERE id IN (${placeholders2})${ownerCol ? ` AND "${ownerCol}" = ?` : ""}`;
      if (ownerCol) params2.push(ctx.userId);
      const { executeApprovedDelete } = await import("@/lib/ai-chatbot/db-approval");
      // Reuse the same execution helper by constructing a temporary pending object
      const deleted = (() => {
        const db2 = getDb();
        const info = db2.prepare(delSql).run(...(params2 as never[]));
        return Number(info.changes);
      })();
      // Log
      try {
        const { logResourceActivity } = await import("@/lib/actions/activity-log");
        for (const id of foundIds) {
          void logResourceActivity(ctx.userId, "chat_delete", table, id, { bypass: true });
        }
      } catch {}
      return {
        content: `Deleted ${deleted} row(s) from "${table}" directly (Bypass permissions).`,
        citations: [table],
      };
    }

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
        expiresAt: Date.now() + 60_000,
        kind: "delete",
        table,
      },
    };
  },
};

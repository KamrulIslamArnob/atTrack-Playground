import type { ToolDefinition } from "./types";
import { createDbClient } from "@/lib/db/client";

/**
 * Read-only database query tool. SECURITY: this is intentionally NOT arbitrary
 * SQL. The model may only (a) pick from an ALLOWED table list, (b) optionally
 * filter by a free-text term against safe text columns, and (c) receive a
 * fixed projection of columns. Every query is forced to `user_id = $userId`
 * (or the table's equivalent owner column) so data can never cross user
 * boundaries. Writes / DDL / other tables are rejected.
 */

const ALLOWED_TABLES: Record<string, { ownerCol: string; columns: string[]; label: string }> = {
  jobs: { ownerCol: "user_id", columns: ["id", "title", "company_name", "state", "list_id", "deadline", "match_score"], label: "Job Applications" },
  contacts: { ownerCol: "user_id", columns: ["id", "name", "role", "company_name", "email"], label: "Contacts CRM" },
  link_categories: { ownerCol: "user_id", columns: ["id", "name", "sort_order"], label: "Link Categories" },
  social_links: { ownerCol: "user_id", columns: ["id", "title", "url", "category_name"], label: "Social Links" },
  ai_tool_prompts: { ownerCol: "user_id", columns: ["id", "kind", "system_prompt"], label: "AI Prompts" },
};

export const queryDatabaseTool: ToolDefinition = {
  name: "query_database",
  sourceId: "db_query",
  description:
    "Run a read-only, scoped query against the user's own workspace database tables (jobs, contacts, links, prompts). Use when the user wants a count, aggregate, or filtered view that the other tools don't directly provide. You may only read the allowlisted tables; all results are automatically scoped to the user's own data. Never ask for or expect write/delete access.",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        enum: Object.keys(ALLOWED_TABLES),
        description: "Which allowlisted table to read.",
      },
      filterText: {
        type: "string",
        description: "Optional case-insensitive substring filter applied to the table's safe text columns.",
      },
      limit: {
        type: "number",
        description: "Max rows to return (1-50). Default 20.",
      },
    },
    required: ["table"],
  },
  execute: async (args, ctx) => {
    const table = typeof args.table === "string" ? args.table : "";
    const def = ALLOWED_TABLES[table];
    if (!def) {
      return {
        content: `Table "${table}" is not allowlisted. Allowed: ${Object.keys(ALLOWED_TABLES).join(", ")}.`,
        citations: [],
      };
    }
    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
    const filterText = typeof args.filterText === "string" ? args.filterText : "";

    try {
      const db = createDbClient();
      let q = db
        .from(table)
        .select(def.columns.join(","))
        .eq(def.ownerCol, ctx.userId)
        .limit(limit);

      if (filterText) {
        // Apply ILIKE on the first text-ish column only (safe, single OR).
        const textCol = def.columns.find((c) => c !== "id" && c !== def.ownerCol) ?? def.columns[0];
        q = q.ilike(textCol, `%${filterText}%`);
      }

      const { data, error } = await q;
      if (error) {
        return { content: `Query failed: ${error.message}`, citations: [def.label] };
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      return {
        content:
          rows.length > 0
            ? `${def.label} (${rows.length} row(s)):\n${rows
                .map((r) => JSON.stringify(r))
                .join("\n")}`
            : `No rows found in ${def.label} for the current user.`,
        citations: [def.label],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Database query error: ${msg}`, citations: [def.label] };
    }
  },
};

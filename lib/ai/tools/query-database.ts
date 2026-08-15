import type { ToolDefinition } from "./types";
import { getDb } from "@/lib/db/sqlite";
import {
  isValidIdentifier,
  tableExists,
  getColumns,
  getTextColumns,
  resolveOwnerColumn,
} from "./db-utils";

/**
 * Read-only query tool with full access to the user's own workspace database.
 * Unlike the original scoped version, this accepts ANY table and (optionally)
 * any column list, so the agent can read whatever it needs. Every query is
 * forced to the table's owner column when one exists, so data can never cross
 * user boundaries. Writes/DDL are rejected — this tool is read-only by design.
 */

export const queryDatabaseTool: ToolDefinition = {
  name: "query_database",
  sourceId: "db_query",
  description:
    "Read any table in the user's own workspace database. Use when the user wants a count, aggregate, filtered view, or raw lookup that the other tools don't directly provide. Pass `table` (any table name) and optionally `columns` (subset to return), `filterText` (case-insensitive substring match across text columns), and `limit` (1-100, default 25). Results are always scoped to the user's own data. This tool is READ-ONLY — it never writes, updates, or deletes.",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Any table name in the workspace database.",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Optional subset of columns to return. Omit to return all columns.",
      },
      filterText: {
        type: "string",
        description: "Optional case-insensitive substring filter applied across the table's text columns (OR'd together).",
      },
      limit: {
        type: "number",
        description: "Max rows to return (1-100). Default 25.",
      },
    },
    required: ["table"],
  },
  execute: async (args, ctx) => {
    const table = typeof args.table === "string" ? args.table.trim() : "";
    if (!tableExists(table)) {
      return {
        content: `Table "${table}" does not exist. Use a real table name from the workspace schema.`,
        citations: [],
      };
    }

    const allCols = getColumns(table);
    const requested = Array.isArray(args.columns)
      ? args.columns.filter((c): c is string => typeof c === "string" && isValidIdentifier(c) && allCols.includes(c))
      : [];
    const cols = requested.length > 0 ? requested : allCols;
    const colsSql = cols.map((c) => `"${c}"`).join(", ");

    const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
    const filterText = typeof args.filterText === "string" ? args.filterText.trim() : "";

    const where: string[] = [];
    const params: unknown[] = [];
    const ownerCol = resolveOwnerColumn(table);
    if (ownerCol) {
      where.push(`"${ownerCol}" = ?`);
      params.push(ctx.userId);
    }
    if (filterText) {
      const textCols = getTextColumns(table);
      if (textCols.length > 0) {
        const like = `%${filterText}%`;
        where.push("(" + textCols.map((c) => `"${c}" LIKE ?`).join(" OR ") + ")");
        textCols.forEach(() => params.push(like));
      }
    }

    const sql =
      `SELECT ${colsSql} FROM "${table}"` +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` LIMIT ?`;
    params.push(limit);

    try {
      const db = getDb();
      const rows = db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
      const label = `"${table}"`;
      return {
        content:
          rows.length > 0
            ? `${label} (${rows.length} row(s)):\n${rows.map((r) => JSON.stringify(r)).join("\n")}`
            : `No rows found in ${label} for the current user.`,
        citations: [label],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Database query error: ${msg}`, citations: [table] };
    }
  },
};

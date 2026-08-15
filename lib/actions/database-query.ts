"use server";

import { getDb } from "@/lib/db/sqlite";
import { getUser } from "@/lib/auth";

export interface SqlQueryResult {
  success: boolean;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  availableTables?: string[];
}

const ALLOWED_TABLES = [
  "jobs",
  "v_jobs",
  "companies",
  "positions",
  "documents",
  "contacts",
  "job_contacts",
  "job_documents",
  "job_deadlines",
  "links",
  "link_categories",
  "quick_shortcuts",
  "ai_memories",
  "ai_tool_prompts",
  "interviews",
  "applications",
  "mcq_results",
  "profiles",
  "board_lists",
];

/**
 * Executes a read-only SQL query against the local SQLite database when approved by the user.
 */
export async function executeLocalSqlQuery(sqlText: string): Promise<SqlQueryResult> {
  try {
    const { userId } = await getUser();
    let cleanSql = sqlText.trim().replace(/^```sql\s*/i, "").replace(/\s*```$/i, "").trim();

    // Remove trailing semicolons for uniform execution
    if (cleanSql.endsWith(";")) {
      cleanSql = cleanSql.slice(0, -1).trim();
    }

    if (!cleanSql) {
      return { success: false, error: "Empty SQL query provided.", availableTables: ALLOWED_TABLES };
    }

    // Security check: strictly read-only queries (SELECT / WITH)
    const forbiddenPattern = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|VACUUM|PRAGMA|EXEC|EXECUTE)\b/i;
    if (forbiddenPattern.test(cleanSql)) {
      return {
        success: false,
        error: "Security restriction: Only read-only SELECT queries are permitted on the local database.",
        availableTables: ALLOWED_TABLES,
      };
    }

    if (!/^(SELECT|WITH)\b/i.test(cleanSql)) {
      return {
        success: false,
        error: "Invalid query: Query must begin with SELECT or WITH.",
        availableTables: ALLOWED_TABLES,
      };
    }

    // Security check: block restricted tables (raw text match, robust against subqueries/CTEs)
    const restrictedTablePattern = /\b(users|smtp_config|ai_providers)\b/i;
    if (restrictedTablePattern.test(cleanSql)) {
      return {
        success: false,
        error: "Query references a restricted table.",
        availableTables: ALLOWED_TABLES,
      };
    }

    const db = getDb();
    let results: Record<string, unknown>[] = [];

    try {
      const stmt = db.prepare(cleanSql);
      results = stmt.all() as Record<string, unknown>[];
    } catch (queryErr) {
      const errMsg = queryErr instanceof Error ? queryErr.message : String(queryErr);
      // Auto-fallback: if company_name was queried directly on jobs without join, execute via v_jobs view
      if (/no such column.*company_name/i.test(errMsg) && /\bFROM\s+jobs\b/i.test(cleanSql)) {
        const fallbackSql = cleanSql.replace(/\bFROM\s+jobs\b/gi, "FROM v_jobs");
        const fallbackStmt = db.prepare(fallbackSql);
        results = fallbackStmt.all() as Record<string, unknown>[];
      } else {
        throw queryErr;
      }
    }

    // Convert rows to plain objects to ensure safe Next.js Server Action serialization
    const rows = JSON.parse(JSON.stringify(results.slice(0, 50))) as Record<string, unknown>[];

    return {
      success: true,
      rows,
      rowCount: results.length,
      availableTables: ALLOWED_TABLES,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: msg,
      availableTables: ALLOWED_TABLES,
    };
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/sqlite";
import { getUser } from "@/lib/auth";
import { isRawDatabaseEnabled } from "@/lib/db/raw-database-gate";
import { withRoute } from "@/lib/log/route";

export const dynamic = "force-dynamic";

// Tables that store credentials/secrets (SMTP password, encrypted AI provider
// keys, the local user record). Never exposed or writable through the
// generic database admin UI, regardless of caller — this app has no login,
// so there is no auth check to gate these routes with; exclusion is the gate.
// Duplicated (not imported) in app/api/database/update/route.ts: route.ts
// files may only export recognized handler/config names, so a plain `const`
// export here fails Next's generated route-type check.
const RESTRICTED_TABLES = new Set(["users", "smtp_config", "ai_providers", "extension_config"]);

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: number;
}

export interface ForeignKeyInfo {
  from: string;
  to_table: string;
  to_column: string;
  on_update: string;
  on_delete: string;
}

export interface TableData {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/**
 * Single-call database introspection. Returns every user table's schema,
 * foreign keys, and all rows in one shot — the client caches this and
 * never hits the API again until it remounts.
 */
export const GET = withRoute("/api/database", async () => {
  try {
    const { userId } = await getUser();
    if (!isRawDatabaseEnabled(userId)) {
      return NextResponse.json(
        { error: "The raw database viewer is turned off. Turn it on in Settings to use it." },
        { status: 403 }
      );
    }

    const db = getDb();

    // 1. List all user tables (skip sqlite_ internal tables).
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    const result: TableData[] = [];

    for (const { name } of tables) {
      if (RESTRICTED_TABLES.has(name)) continue;

      try {
        // 2. Column metadata via PRAGMA.
        const columns = db
          .prepare(`PRAGMA table_info("${name}")`)
          .all() as unknown as ColumnInfo[];

        // 3. Foreign keys — tells the client which columns participate in
        //    cascading constraints and should be read-only.
        const foreignKeys = db
          .prepare(`PRAGMA foreign_key_list("${name}")`)
          .all() as unknown as ForeignKeyInfo[];

        // 4. All rows — guard against corrupt/locked tables so one bad table
        //    doesn't take the whole viewer down (and a second click while
        //    already on the page doesn't hard-crash the route).
        let rows: Record<string, unknown>[] = [];
        try {
          rows = db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
        } catch (err) {
          // Return empty rows for this table but keep the schema so the UI can still render it.
          rows = [];
        }

        result.push({
          name,
          columns,
          foreignKeys,
          rows,
          rowCount: rows.length,
        });
      } catch (err) {
        // Skip a single broken table but keep serving the rest — prevents a full 500
        // when a concurrent write holds a lock or a table is mid-migration.
        continue;
      }
    }

    return NextResponse.json({ tables: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load database" },
      { status: 500 }
    );
  }
});

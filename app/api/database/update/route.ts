import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/sqlite";
import { getUser } from "@/lib/auth";
import { isRawDatabaseEnabled } from "@/lib/db/raw-database-gate";
import { withRoute } from "@/lib/log/route";

export const dynamic = "force-dynamic";

// Tables that store credentials/secrets. Kept in sync with the twin
// definition in app/api/database/route.ts (not imported: route.ts files may
// only export recognized handler/config names, so a plain `const` export
// there fails Next's generated route-type check).
const RESTRICTED_TABLES = new Set(["users", "smtp_config", "ai_providers", "extension_config"]);

type SQLiteInputValue = string | number | bigint | Uint8Array | null;

function isSQLiteInputValue(value: unknown): value is SQLiteInputValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  );
}

interface UpdateBody {
  table: string;
  column: string;
  pkColumn: string;
  pkValue: string | number;
  value: unknown;
}

/**
 * Updates a single cell. Refuses to write columns that participate in
 * a foreign key with ON UPDATE CASCADE — changing those would trigger
 * a cascading ripple the user didn't explicitly ask for.
 */
export const PUT = withRoute("/api/database/update", async (req: Request) => {
  const { userId } = await getUser();
  if (!isRawDatabaseEnabled(userId)) {
    return NextResponse.json(
      { error: "The raw database viewer is turned off. Turn it on in Settings to use it." },
      { status: 403 }
    );
  }

  const body = (await req.json()) as UpdateBody;
  const { table, column, pkColumn, pkValue, value } = body;

  // --- validation -----------------------------------------------------------
  // Whitelist: only simple identifiers. No spaces, quotes, semicolons.
  const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (!ident.test(table) || !ident.test(column) || !ident.test(pkColumn)) {
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  }

  // Credential-bearing tables are never writable through this admin route.
  if (RESTRICTED_TABLES.has(table)) {
    return NextResponse.json(
      { error: `Table "${table}" cannot be edited through this route.` },
      { status: 400 }
    );
  }

  const db = getDb();

  // Reject cascading FK columns.
  const fks = db
    .prepare(`PRAGMA foreign_key_list("${table}")`)
    .all() as Array<{ from: string; on_update: string }>;
  const cascading = fks.find(
    (fk) => fk.from === column && fk.on_update.toUpperCase() === "CASCADE"
  );
  if (cascading) {
    return NextResponse.json(
      { error: `Column "${column}" has ON UPDATE CASCADE and cannot be edited directly.` },
      { status: 409 }
    );
  }

  // Reject primary keys — they're identity columns.
  const pkCol = db
    .prepare(`PRAGMA table_info("${table}")`)
    .all() as Array<{ name: string; pk: number }>;
  if (pkCol.find((c) => c.name === column && c.pk > 0)) {
    return NextResponse.json(
      { error: "Primary key columns cannot be edited." },
      { status: 409 }
    );
  }

  // --- execute -------------------------------------------------------------
  const sql = `UPDATE "${table}" SET "${column}" = ? WHERE "${pkColumn}" = ?`;
  const sqlValue = typeof value === "boolean" ? Number(value) : value;
  if (!isSQLiteInputValue(sqlValue)) {
    return NextResponse.json(
      { error: "Unsupported value type for database update." },
      { status: 400 }
    );
  }

  try {
    db.prepare(sql).run(sqlValue, pkValue);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }

  // Return the updated row so the client can refresh its cache.
  const updated = db
    .prepare(`SELECT * FROM "${table}" WHERE "${pkColumn}" = ?`)
    .get(pkValue) as Record<string, unknown> | undefined;

  return NextResponse.json({ ok: true, row: updated });
});

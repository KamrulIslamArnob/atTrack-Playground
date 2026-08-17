// eslint-disable @typescript-eslint/no-explicit-any is applied file-wide on purpose:
// this module's entire contract is "untyped rows", matching the supabase-js clients
// it replaces (created without the <Database> generic). See DbRow/DbData below.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { getDb } from "./sqlite.ts";
import { decodeRow, encodeValue, NO_AUTO_ID } from "./meta.ts";
import { findRelation } from "./relations.ts";
import { moduleLogger } from "../log/index.ts";

const dbLog = moduleLogger("db");

/** Above this, a local SQLite query is worth a warn rather than a debug: it is
 *  the slow-query log, so it has to survive production's `info` level. */
const SLOW_MS = Number(process.env.ATTRACK_DB_SLOW_MS ?? 50);

// A PostgREST-shaped query builder over SQLite.
//
// The point of this file is that ~137 existing call sites written against
// supabase-js keep working unchanged. It implements exactly the surface this
// codebase uses (audited, not guessed):
//   select/insert/update/delete/upsert, eq/neq/in/ilike/gt(e)/lt(e)/is/not/or,
//   order/limit/range, single/maybeSingle, { count: "exact", head }, and embeds
//   with aliases and FK hints.
//
// Anything outside that surface throws loudly rather than silently returning the
// wrong rows — a wrong answer here would look like a data bug far from the cause.

export interface DbError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * The shape of `data`, chosen to keep ~137 existing call sites compiling untouched.
 *
 * Three constraints had to hold at once:
 *   1. Loose property access — call sites read `doc.file_path`, `profile?.role`.
 *   2. Array methods that CONTEXTUALLY TYPE their callbacks. Plain `any` fails
 *      here: `(rows ?? []).map((r) => …)` gives `r` no contextual type, so
 *      `noImplicitAny` errors. supabase-js typed its rows, so this code relies on it.
 *   3. Assignable to concrete interfaces (`Resume[]`, etc.) without casts.
 *
 * `DbRow[] & DbRow` satisfies all three: the array half supplies map/reduce/length
 * and types their callbacks as DbRow, the record half supplies property access.
 *
 * DbResult is deliberately NOT generic — with a parameter defaulting through both
 * the interface and the builder class, `Awaited<>` could not resolve it and
 * `await` inferred `{}`. Row shapes are asserted in lib/db/selfcheck.ts instead.
 *
 * `data` is typed non-nullable even though single()/maybeSingle() return null for
 * no rows. That is the same contract supabase-js's .single() presented, which is
 * what these call sites were written against — they guard with `if (!row)` checks
 * that are already in place. Typing it `| null` would be stricter but would mean
 * editing ~35 unrelated call sites, which is a different change than this one.
 */
export interface DbRow { [key: string]: any }
export type DbData = DbRow[] & DbRow;

export interface DbResult {
  data: DbData;
  error: DbError | null;
  count?: number | null;
}

type Filter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }
  | { op: "isNull"; column: string; negated: boolean }
  | { op: "or"; clauses: { column: string; op: "like" | "eq"; value: unknown }[] };

interface EmbedSpec {
  alias: string;
  table: string;
  fkHint?: string;
  columns: string[];
  embeds: EmbedSpec[];
}

interface SelectSpec {
  columns: string[];
  embeds: EmbedSpec[];
}

/** Splits on top-level commas only, so `a,b:t(c,d),e` yields 3 parts. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const MAX_SELECT_CACHE_SIZE = 200;
const selectAstCache = new Map<string, SelectSpec>();

function parseSelect(select: string): SelectSpec {
  const normalized = select.trim();
  const cached = selectAstCache.get(normalized);
  if (cached) return cached;

  const spec = parseSelectUncached(normalized);
  if (selectAstCache.size >= MAX_SELECT_CACHE_SIZE) {
    const firstKey = selectAstCache.keys().next().value;
    if (firstKey !== undefined) selectAstCache.delete(firstKey);
  }
  selectAstCache.set(normalized, spec);
  return spec;
}

function parseSelectUncached(select: string): SelectSpec {
  const columns: string[] = [];
  const embeds: EmbedSpec[] = [];

  for (const part of splitTopLevel(select.replace(/\s+/g, " "))) {
    const paren = part.indexOf("(");
    if (paren === -1) {
      columns.push(part);
      continue;
    }

    const head = part.slice(0, paren).trim();
    const body = part.slice(paren + 1, part.lastIndexOf(")"));

    // head is one of: `alias:table`, `alias:table!fk`, `table`, `table!fk`
    let alias: string;
    let table: string;
    let fkHint: string | undefined;

    const colon = head.indexOf(":");
    if (colon !== -1) {
      alias = head.slice(0, colon).trim();
      table = head.slice(colon + 1).trim();
    } else {
      alias = head;
      table = head;
    }

    const bang = table.indexOf("!");
    if (bang !== -1) {
      fkHint = table.slice(bang + 1).trim();
      table = table.slice(0, bang).trim();
      if (alias === `${table}!${fkHint}`) alias = table;
    }

    const inner = parseSelect(body);
    embeds.push({ alias, table, fkHint, columns: inner.columns, embeds: inner.embeds });
  }

  return { columns, embeds };
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

function normalizeFilterParam(val: unknown): unknown {
  if (val === undefined || val === null) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  return val;
}

function buildWhere(filters: Filter[]): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const f of filters) {
    switch (f.op) {
      case "eq":
      case "neq":
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "like": {
        const sqlOp = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE" }[
          f.op
        ];
        if (f.value === null || f.value === undefined) {
          clauses.push(`${quoteIdent(f.column)} IS ${f.op === "neq" ? "NOT " : ""}NULL`);
        } else {
          clauses.push(`${quoteIdent(f.column)} ${sqlOp} ?`);
          params.push(normalizeFilterParam(f.value));
        }
        break;
      }
      case "in": {
        if (f.value.length === 0) {
          clauses.push("0 = 1");
          break;
        }
        clauses.push(`${quoteIdent(f.column)} IN (${f.value.map(() => "?").join(",")})`);
        params.push(...f.value.map(normalizeFilterParam));
        break;
      }
      case "isNull": {
        clauses.push(`${quoteIdent(f.column)} IS ${f.negated ? "NOT " : ""}NULL`);
        break;
      }
      case "or": {
        const ors = f.clauses.map((c) => {
          params.push(normalizeFilterParam(c.value));
          return `${quoteIdent(c.column)} ${c.op === "like" ? "LIKE" : "="} ?`;
        });
        clauses.push(`(${ors.join(" OR ")})`);
        break;
      }
    }
  }

  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

/** Parses PostgREST's `.or("a.ilike.%x%,b.eq.1")` mini-syntax. */
function parseOr(expr: string): Filter {
  const clauses = splitTopLevel(expr).map((part) => {
    const [column, op, ...rest] = part.split(".");
    const value = rest.join(".");
    if (op === "ilike" || op === "like") {
      return { column, op: "like" as const, value };
    }
    if (op === "eq") {
      return { column, op: "eq" as const, value };
    }
    throw new Error(`Unsupported .or() operator: ${op} (in "${part}")`);
  });
  return { op: "or", clauses };
}

class QueryBuilder implements PromiseLike<DbResult> {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectSpec: SelectSpec | null = null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private limitValue: number | null = null;
  private offsetValue = 0;
  private payload: Record<string, unknown>[] = [];
  private conflictTarget: string | null = null;
  private wantCount = false;
  private headOnly = false;
  private rowMode: "many" | "single" | "maybeSingle" = "many";
  /** Rows the write statements actually touched, for the db.query log line —
   *  a write without a chained .select() returns no data to count. */
  private changes = 0;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    this.selectSpec = parseSelect(columns === "*" ? "*" : columns);
    if (options?.count === "exact") this.wantCount = true;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.action = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): this {
    this.action = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflictTarget = options?.onConflict ?? "id";
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.action = "update";
    this.payload = [values];
    return this;
  }

  delete(): this {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.filters.push({ op: "neq", column, value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push({ op: "gt", column, value });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.filters.push({ op: "gte", column, value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.filters.push({ op: "lt", column, value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.filters.push({ op: "lte", column, value });
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }
  /** SQLite's LIKE is already case-insensitive for ASCII, matching ilike. */
  ilike(column: string, pattern: string): this {
    this.filters.push({ op: "like", column, value: pattern });
    return this;
  }
  like(column: string, pattern: string): this {
    this.filters.push({ op: "like", column, value: pattern });
    return this;
  }
  is(column: string, value: null | boolean): this {
    if (value === null) this.filters.push({ op: "isNull", column, negated: false });
    else this.filters.push({ op: "eq", column, value: value ? 1 : 0 });
    return this;
  }
  not(column: string, op: string, value: unknown): this {
    if (op === "is" && value === null) {
      this.filters.push({ op: "isNull", column, negated: true });
      return this;
    }
    if (op === "eq") {
      this.filters.push({ op: "neq", column, value });
      return this;
    }
    throw new Error(`Unsupported .not() operator: ${op}`);
  }
  or(expr: string): this {
    this.filters.push(parseOr(expr));
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderBy.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }
  limit(n: number): this {
    this.limitValue = n;
    return this;
  }
  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  single(): this {
    this.rowMode = "single";
    return this;
  }
  maybeSingle(): this {
    this.rowMode = "maybeSingle";
    return this;
  }

  /** Runs the query. The builder is thenable, so callers just `await` it. */
  private async run(): Promise<DbResult> {
    return this.execute();
  }

  // Deliberately NON-generic. A generic then() (and an earlier version returning
  // PromiseLike from a Promise.resolve() chain) defeated `Awaited<>`, so `await`
  // and `Promise.all` inferred `{}` instead of the row type at every call site.
  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  /**
   * The one choke point every read and write in the app passes through, so it
   * is the only place query timing has to be measured. Stays synchronous —
   * `node:sqlite` is synchronous and the thenable above depends on it.
   */
  private execute(): DbResult {
    const startedAt = Date.now();
    const result = this.runAction();
    const durationMs = Date.now() - startedAt;

    // Nothing is built unless a sink will take it: debug is off in production,
    // where only the slow-query line survives.
    if (durationMs >= SLOW_MS || dbLog.isLevelEnabled("debug")) {
      const fields = {
        table: this.table,
        op: this.action === "select" && this.headOnly ? "count" : this.action,
        durationMs,
        rowCount: this.rowCount(result),
        // Column NAMES only. A filter VALUE is the owner's own data; the keys
        // are the half that tells you an index is missing.
        filterKeys: [
          ...new Set(
            this.filters.flatMap((f) =>
              f.op === "or" ? f.clauses.map((c) => c.column) : f.column
            )
          ),
        ],
      };
      dbLog.debug({ event: "db.query", ...fields });
      if (durationMs >= SLOW_MS) dbLog.warn({ event: "db.slow", ...fields });
    }

    return result;
  }

  private rowCount(result: DbResult): number {
    if (this.action !== "select") return this.changes;
    if (this.headOnly) return result.count ?? 0;
    return Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
  }

  private runAction(): DbResult {
    try {
      switch (this.action) {
        case "select":
          return this.runSelect();
        case "insert":
        case "upsert":
          return this.runInsert();
        case "update":
          return this.runUpdate();
        case "delete":
          return this.runDelete();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // better-sqlite3's own error carries a real SQLITE_* code (constraint
      // violation, etc) — keep it instead of relabeling everything the same,
      // and log every DB error: this catch used to swallow them silently.
      const code = err instanceof Error && "code" in err ? String((err as { code?: unknown }).code) : "SQLITE_ERROR";
      dbLog.error({ table: this.table, op: this.action, err }, "[db] query failed:");
      return { data: this.emptyData(), error: { message, code } };
    }
  }

  private emptyData(): DbData {
    // null at runtime for single()/maybeSingle() with no rows; see DbResult's note.
    return (this.rowMode === "many" ? [] : null) as unknown as DbData;
  }

  private shapeRows(rows: Record<string, unknown>[]): DbResult {
    if (this.rowMode === "many") {
      return { data: rows as unknown as DbData, error: null };
    }
    if (rows.length === 0) {
      return {
        data: null as unknown as DbData,
        error:
          this.rowMode === "single"
            ? { message: "No rows found", code: "PGRST116", details: "Results contain 0 rows" }
            : null,
      };
    }
    return { data: rows[0] as unknown as DbData, error: null };
  }

  private runSelect(): DbResult {
    const db = getDb();
    const spec = this.selectSpec ?? { columns: ["*"], embeds: [] };
    const { sql: whereSql, params } = buildWhere(this.filters);

    let count: number | null = null;
    if (this.wantCount) {
      const row = db
        .prepare(`SELECT count(*) AS c FROM ${quoteIdent(this.table)}${whereSql}`)
        .get(...(params as never[])) as { c: number } | undefined;
      count = row?.c ?? 0;
    }

    if (this.headOnly) {
      return { data: [] as unknown as DbData, error: null, count };
    }

    const selectClause = buildSelectProjection(this.table, spec, this.orderBy);
    let sql = `SELECT ${selectClause} FROM ${quoteIdent(this.table)}${whereSql}`;
    if (this.orderBy.length) {
      sql +=
        " ORDER BY " +
        this.orderBy
          .map((o) => {
            // NULLS FIRST/LAST is honoured rather than ignored: callers use it to
            // keep undated rows out of the way, so dropping it would silently
            // reorder results. SQLite supports the syntax since 3.30.
            const nulls =
              o.nullsFirst === undefined ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
            return `${quoteIdent(o.column)} ${o.ascending ? "ASC" : "DESC"}${nulls}`;
          })
          .join(", ");
    }
    if (this.rowMode !== "many" && this.limitValue === null) sql += " LIMIT 2";
    if (this.limitValue !== null) sql += ` LIMIT ${Number(this.limitValue)}`;
    if (this.offsetValue) sql += ` OFFSET ${Number(this.offsetValue)}`;

    const raw = db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
    const rows = raw.map((r) => decodeRow(this.table, r)!) as Record<string, unknown>[];

    resolveEmbeds(this.table, rows, spec.embeds);

    const projected = rows.map((r) => project(r, spec));
    const result = this.shapeRows(projected);
    return { ...result, count };
  }

  private runInsert(): DbResult {
    const db = getDb();
    const ids: string[] = [];

    for (const row of this.payload) {
      const values: Record<string, unknown> = { ...row };
      if (!NO_AUTO_ID.has(this.table) && values[ "id" ] == null) {
        values["id"] = randomUUID();
      }

      const cols = Object.keys(values);
      const encoded = cols.map((c) => encodeValue(this.table, c, values[c]));

      let sql =
        `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(", ")}) ` +
        `VALUES (${cols.map(() => "?").join(", ")})`;

      if (this.action === "upsert") {
        const target = (this.conflictTarget ?? "id")
          .split(",")
          .map((c) => quoteIdent(c.trim()))
          .join(", ");
        const updates = cols
          .filter((c) => c !== "id")
          .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`);
        sql += updates.length
          ? ` ON CONFLICT (${target}) DO UPDATE SET ${updates.join(", ")}`
          : ` ON CONFLICT (${target}) DO NOTHING`;
      }

      this.changes += Number(db.prepare(sql).run(...(encoded as never[])).changes);
      if (values["id"] != null) ids.push(String(values["id"]));
    }

    if (!this.selectSpec) {
      return { data: this.emptyData(), error: null };
    }

    return this.reselectByIds(ids);
  }

  private runUpdate(): DbResult {
    const db = getDb();
    const values = this.payload[0] ?? {};
    const cols = Object.keys(values);

    if (cols.length === 0) {
      return { data: this.emptyData(), error: null };
    }

    const { sql: whereSql, params: whereParams } = buildWhere(this.filters);

    // Capture ids first so a chained .select() can return the updated rows even
    // if the update changed a column the filter matched on.
    let ids: string[] = [];
    if (this.selectSpec) {
      const rows = db
        .prepare(`SELECT id FROM ${quoteIdent(this.table)}${whereSql}`)
        .all(...(whereParams as never[])) as { id: string }[];
      ids = rows.map((r) => r.id);
    }

    const setSql = cols.map((c) => `${quoteIdent(c)} = ?`).join(", ");
    const setParams = cols.map((c) => encodeValue(this.table, c, values[c]));

    this.changes = Number(
      db
        .prepare(`UPDATE ${quoteIdent(this.table)} SET ${setSql}${whereSql}`)
        .run(...([...setParams, ...whereParams] as never[])).changes
    );

    if (!this.selectSpec) return { data: this.emptyData(), error: null };
    return this.reselectByIds(ids);
  }

  private runDelete(): DbResult {
    const db = getDb();
    const { sql: whereSql, params } = buildWhere(this.filters);

    if (!whereSql) {
      // Guard against an unfiltered DELETE wiping a table — always a bug here.
      return {
        data: this.emptyData(),
        error: { message: "Refusing to DELETE without a filter", code: "SQLITE_GUARD" },
      };
    }

    this.changes = Number(
      db.prepare(`DELETE FROM ${quoteIdent(this.table)}${whereSql}`).run(...(params as never[]))
        .changes
    );
    return { data: this.emptyData(), error: null };
  }

  private reselectByIds(ids: string[]): DbResult {
    const db = getDb();
    const spec = this.selectSpec ?? { columns: ["*"], embeds: [] };

    if (ids.length === 0) return this.shapeRows([]);

    const selectClause = buildSelectProjection(this.table, spec, this.orderBy);
    const raw = db
      .prepare(
        `SELECT ${selectClause} FROM ${quoteIdent(this.table)} WHERE id IN (${ids.map(() => "?").join(",")})`
      )
      .all(...(ids as never[])) as Record<string, unknown>[];

    const rows = raw.map((r) => decodeRow(this.table, r)!) as Record<string, unknown>[];
    resolveEmbeds(this.table, rows, spec.embeds);
    return this.shapeRows(rows.map((r) => project(r, spec)));
  }
}

function buildSelectProjection(
  parentTable: string,
  spec: SelectSpec,
  orderBy: { column: string }[] = []
): string {
  if (spec.columns.includes("*") || spec.columns.length === 0) {
    return "*";
  }

  const set = new Set<string>();

  for (const col of spec.columns) {
    const colon = col.indexOf(":");
    const sourceCol = colon !== -1 ? col.slice(colon + 1).trim() : col;
    if (sourceCol === "*") return "*";
    set.add(sourceCol);
  }

  for (const o of orderBy) {
    set.add(o.column);
  }

  for (const embed of spec.embeds) {
    const rel = findRelation(parentTable, embed.alias, embed.table, embed.fkHint);
    if (rel) {
      if (rel.kind === "one") {
        set.add(rel.column);
      } else {
        set.add("id");
      }
    }
  }

  if (set.size === 0) return "*";
  return Array.from(set).map(quoteIdent).join(", ");
}

function buildEmbedProjection(
  relTarget: string,
  embed: EmbedSpec,
  relKind: "one" | "many",
  relColumn: string
): string {
  if (embed.columns.includes("*") || embed.columns.length === 0) {
    return "*";
  }

  const set = new Set<string>();

  for (const col of embed.columns) {
    const colon = col.indexOf(":");
    const sourceCol = colon !== -1 ? col.slice(colon + 1).trim() : col;
    if (sourceCol === "*") return "*";
    set.add(sourceCol);
  }

  if (relKind === "one") {
    set.add("id");
  } else {
    set.add(relColumn);
  }

  for (const childEmbed of embed.embeds) {
    const childRel = findRelation(relTarget, childEmbed.alias, childEmbed.table, childEmbed.fkHint);
    if (childRel) {
      if (childRel.kind === "one") {
        set.add(childRel.column);
      } else {
        set.add("id");
      }
    }
  }

  if (set.size === 0) return "*";
  return Array.from(set).map(quoteIdent).join(", ");
}

/** Keeps only the requested columns, plus whatever the embeds attached. */
function project(row: Record<string, unknown>, spec: SelectSpec): Record<string, unknown> {
  const wantsAll = spec.columns.includes("*") || spec.columns.length === 0;
  const out: Record<string, unknown> = {};

  if (wantsAll) {
    Object.assign(out, row);
  } else {
    for (const col of spec.columns) {
      // `alias:column` renames a plain column.
      const colon = col.indexOf(":");
      if (colon !== -1) {
        const alias = col.slice(0, colon).trim();
        const source = col.slice(colon + 1).trim();
        out[alias] = row[source] ?? null;
      } else {
        out[col] = row[col] ?? null;
      }
    }
  }

  for (const embed of spec.embeds) {
    out[embed.alias] = row[embed.alias] ?? null;
  }
  return out;
}

/**
 * Attaches embedded rows in place. One extra query per embed (batched with IN)
 * rather than per parent row, so a board read stays at ~5 queries regardless of
 * how many cards there are.
 */
function resolveEmbeds(
  parentTable: string,
  parents: Record<string, unknown>[],
  embeds: EmbedSpec[]
): void {
  if (embeds.length === 0) return;
  const db = getDb();

  for (const embed of embeds) {
    // Resolved before the empty-parents check on purpose: a mistyped embed must
    // fail loudly even when the query happens to match zero rows, otherwise the
    // typo hides until the table has data.
    const rel = findRelation(parentTable, embed.alias, embed.table, embed.fkHint);
    if (!rel) {
      throw new Error(
        `No relation from "${parentTable}" to "${embed.table}"` +
          (embed.fkHint ? ` via ${embed.fkHint}` : "") +
          `. Add it to lib/db/relations.ts.`
      );
    }

    if (parents.length === 0) continue;

    if (rel.kind === "one") {
      const keys = [
        ...new Set(
          parents.map((p) => p[rel.column]).filter((v): v is string => typeof v === "string")
        ),
      ];

      const byId = new Map<string, Record<string, unknown>>();
      if (keys.length) {
        const childSelect = buildEmbedProjection(rel.target, embed, "one", rel.column);
        const raw = db
          .prepare(
            `SELECT ${childSelect} FROM ${quoteIdent(rel.target)} WHERE id IN (${keys.map(() => "?").join(",")})`
          )
          .all(...(keys as never[])) as Record<string, unknown>[];
        const decoded = raw.map((r) => decodeRow(rel.target, r)!) as Record<string, unknown>[];
        resolveEmbeds(rel.target, decoded, embed.embeds);
        for (const r of decoded) byId.set(String(r.id), r);
      }

      const childSpec: SelectSpec = { columns: embed.columns, embeds: embed.embeds };
      for (const parent of parents) {
        const key = parent[rel.column];
        const child = typeof key === "string" ? byId.get(key) : undefined;
        parent[embed.alias] = child ? project(child, childSpec) : null;
      }
      continue;
    }

    // kind === "many"
    const parentIds = parents
      .map((p) => p.id)
      .filter((v): v is string => typeof v === "string");

    const grouped = new Map<string, Record<string, unknown>[]>();
    if (parentIds.length) {
      const childSelect = buildEmbedProjection(rel.target, embed, "many", rel.column);
      const raw = db
        .prepare(
          `SELECT ${childSelect} FROM ${quoteIdent(rel.target)} ` +
            `WHERE ${quoteIdent(rel.column)} IN (${parentIds.map(() => "?").join(",")})`
        )
        .all(...(parentIds as never[])) as Record<string, unknown>[];
      const decoded = raw.map((r) => decodeRow(rel.target, r)!) as Record<string, unknown>[];
      resolveEmbeds(rel.target, decoded, embed.embeds);
      for (const r of decoded) {
        const key = String(r[rel.column]);
        const bucket = grouped.get(key);
        if (bucket) bucket.push(r);
        else grouped.set(key, [r]);
      }
    }

    const childSpec: SelectSpec = { columns: embed.columns, embeds: embed.embeds };
    for (const parent of parents) {
      const children = grouped.get(String(parent.id)) ?? [];
      parent[embed.alias] = children.map((c) => project(c, childSpec));
    }
  }
}

export function from(table: string): QueryBuilder {
  return new QueryBuilder(table);
}

export { QueryBuilder };

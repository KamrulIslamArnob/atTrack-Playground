// Creates or updates rows in ANY table of the user's own workspace database.
// Executes immediately — no confirmation (deletes are the only gated op, see
// delete-database.ts / lib/ai-chatbot/db-approval.ts). Ownership is always
// forced to the current user; id/created_at/updated_at are never set by the
// model, and neither is jobs.status — it's derived from list_id by a DB
// trigger (trg_jobs_status_from_list_* in lib/db/schema.sql). Uses raw SQL so
// any valid table/column works.
import type { ToolDefinition } from "./types";
import type { ChatArtifact, JobArtifactSnapshot, ContactArtifactSnapshot, LinkArtifactSnapshot, MemoryArtifactSnapshot, InterviewArtifactSnapshot } from "@/lib/types/chat-artifact";
import { createPendingWrite, buildWriteSqlPreview } from "@/lib/ai-chatbot/write-approval";
import { getDb } from "@/lib/db/sqlite";
import { createDbClient } from "@/lib/db/client";
import { ensureApplication } from "@/lib/actions/board";
import { logResourceActivity } from "@/lib/actions/activity-log";
import {
  isValidIdentifier,
  tableExists,
  getColumns,
  getColumnsWithTypes,
  resolveOwnerColumn,
  ALWAYS_BLOCKED_COLUMNS,
} from "./db-utils";

// Build frozen snapshot for inline chat card after a successful insert/update.
// Snapshot is intentionally denormalized (JOINed company/list names) so the
// chat history stays readable even if the linked company later changes name.
// One extra SELECT per write is cheap on local SQLite vs. a round-trip fetch.
function buildArtifactSnapshot(table: string, rowId: string, userId: string): ChatArtifact | undefined {
  const db = getDb();
  try {
    if (table === "jobs") {
      const row = db
        .prepare(
          `SELECT j.id, j.title, j.state, j.location, j.employment_type, j.work_location, j.salary_range, j.salary_min, j.salary_max, j.created_at, j.list_id,
                  c.name as company_name, c.website as company_website, c.logo_url as company_logo_url, c.color as company_color,
                  bl.name as list_name, bl.kind as list_kind
           FROM jobs j
           LEFT JOIN companies c ON j.company_id = c.id
           LEFT JOIN board_lists bl ON j.list_id = bl.id
           WHERE j.id = ? AND j.user_id = ?`
        )
        .get(rowId, userId) as
        | (JobArtifactSnapshot & { id: string; title: string; company_name: string | null })
        | undefined;
      if (!row) return undefined;
      const snapshot: JobArtifactSnapshot = {
        id: row.id,
        title: row.title,
        company_name: row.company_name ?? null,
        company_website: row.company_website ?? null,
        company_logo_url: row.company_logo_url ?? null,
        company_color: row.company_color ?? null,
        location: row.location ?? null,
        employment_type: row.employment_type ?? null,
        work_location: row.work_location ?? null,
        salary_range: row.salary_range ?? null,
        salary_min: row.salary_min ?? null,
        salary_max: row.salary_max ?? null,
        state: row.state ?? null,
        list_id: row.list_id ?? null,
        list_name: row.list_name ?? null,
        list_kind: row.list_kind ?? null,
        created_at: row.created_at,
      };
      return {
        id: `artifact_${rowId}`,
        kind: "job",
        table,
        rowId,
        title: snapshot.title,
        subtitle: snapshot.company_name ?? undefined,
        snapshot,
      };
    }
    if (table === "contacts") {
      const row = db
        .prepare(
          `SELECT c.id, c.name, c.role, c.email, c.phone, c.position, c.linkedin_url, c.avatar_url,
                  comp.name as company_name
           FROM contacts c
           LEFT JOIN companies comp ON c.company_id = comp.id
           WHERE c.id = ? AND c.user_id = ?`
        )
        .get(rowId, userId) as
        | (ContactArtifactSnapshot & { id: string; name: string })
        | undefined;
      if (!row) return undefined;
      const snapshot: ContactArtifactSnapshot = {
        id: row.id,
        name: row.name,
        role: row.role ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        company_name: row.company_name ?? null,
        avatar_url: row.avatar_url ?? null,
        linkedin_url: row.linkedin_url ?? null,
      };
      return { id: `artifact_${rowId}`, kind: "contact", table, rowId, title: snapshot.name, subtitle: snapshot.company_name ?? snapshot.email ?? undefined, snapshot };
    }
    if (table === "links") {
      const row = db
        .prepare(
          `SELECT l.id, l.title, l.url, l.notes, lc.name as category_name
           FROM links l
           LEFT JOIN link_categories lc ON l.category_id = lc.id
           WHERE l.id = ? AND l.user_id = ?`
        )
        .get(rowId, userId) as (LinkArtifactSnapshot & { id: string; title: string; url: string }) | undefined;
      if (!row) return undefined;
      const snapshot: LinkArtifactSnapshot = {
        id: row.id,
        title: row.title,
        url: row.url,
        notes: row.notes ?? null,
        category_name: row.category_name ?? null,
      };
      return { id: `artifact_${rowId}`, kind: "link", table, rowId, title: snapshot.title, subtitle: snapshot.category_name ?? undefined, snapshot };
    }
    if (table === "ai_memories") {
      const row = db
        .prepare(`SELECT id, title, description FROM ai_memories WHERE id = ? AND user_id = ?`)
        .get(rowId, userId) as (MemoryArtifactSnapshot & { id: string; description: string }) | undefined;
      if (!row) return undefined;
      const snapshot: MemoryArtifactSnapshot = {
        id: row.id,
        title: row.title ?? null,
        description: row.description,
      };
      return { id: `artifact_${rowId}`, kind: "memory", table, rowId, title: snapshot.title ?? "Memory", subtitle: snapshot.description.slice(0, 60), snapshot };
    }
    if (table === "interviews") {
      const row = db
        .prepare(
          `SELECT i.id, i.scheduled_at, i.type, i.location, i.interviewer_name, i.status,
                  j.title as job_title, comp.name as company_name
           FROM interviews i
           LEFT JOIN jobs j ON i.job_id = j.id
           LEFT JOIN companies comp ON j.company_id = comp.id
           WHERE i.id = ? AND i.user_id = ?`
        )
        .get(rowId, userId) as (InterviewArtifactSnapshot & { id: string; job_title: string | null }) | undefined;
      if (!row) return undefined;
      const snapshot: InterviewArtifactSnapshot = {
        id: row.id,
        job_title: row.job_title ?? null,
        company_name: row.company_name ?? null,
        scheduled_at: row.scheduled_at ?? null,
        type: row.type ?? null,
        location: row.location ?? null,
        interviewer_name: row.interviewer_name ?? null,
        status: row.status ?? null,
      };
      return {
        id: `artifact_${rowId}`,
        kind: "interview",
        table,
        rowId,
        title: snapshot.job_title ?? "Interview",
        subtitle: snapshot.company_name ?? snapshot.interviewer_name ?? undefined,
        snapshot,
      };
    }
  } catch {
    // Snapshot is best-effort; write still succeeded even if artifact fetch fails.
  }
  return undefined;
}

/** Columns that are technically real columns but derived, not model-writable,
 *  on a specific table — the model must go through the domain path instead
 *  (here: move list_id, and a DB trigger recomputes status). */
const EXTRA_BLOCKED_COLUMNS: Record<string, Set<string>> = {
  jobs: new Set(["status"]),
};

/** True when `listId` names a board list owned by `userId` whose kind is
 *  "applied" — the same check the drag-and-drop path uses before calling
 *  ensureApplication (lib/actions/board.ts). */
function isAppliedKindList(userId: string, listId: unknown): boolean {
  if (typeof listId !== "string" || !listId) return false;
  const row = getDb()
    .prepare(`SELECT kind FROM board_lists WHERE id = ? AND user_id = ?`)
    .get(listId, userId) as { kind: string } | undefined;
  return row?.kind === "applied";
}

export const writeDatabaseTool: ToolDefinition = {
  name: "write_database",
  sourceId: "db_query",
  description:
    "Create or update a row in ANY table of the user's own workspace database. Executes immediately, no confirmation needed. Pass `action` ('insert' | 'update'), `table` (any table), `id` (required for update, ignored for insert), and `values` (column -> value). `user_id`/ownership and `id`/`created_at`/`updated_at` are always server-managed. For jobs, never set `status` — it's derived automatically from `list_id`; set `list_id` to move a job between board columns (look the list's id up with query_database on board_lists first), and moving into an Applied-kind list automatically creates the matching application record.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["insert", "update"] },
      table: { type: "string", description: "Any existing table name." },
      id: { type: "string", description: "Row id. Required for update, ignored for insert." },
      values: {
        type: "object",
        description: "Column name -> new value. Unknown or blocked columns are dropped and reported back.",
      },
    },
    required: ["action", "table", "values"],
  },
  execute: async (args, ctx) => {
    const mode = (ctx.permissionMode as string) ?? "bypass";
    // Read-only blocks all writes immediately — no pending, just inform.
    if (mode === "readonly") {
      return {
        content: `Write blocked: you are in Read-only (View) mode. Switch to "Ask before changes" or "Bypass permissions" to allow modifications. No data was changed.`,
        citations: [],
      };
    }

    const action = args.action === "insert" || args.action === "update" ? args.action : null;
    const table = typeof args.table === "string" ? args.table.trim() : "";
    if (!action || !tableExists(table)) {
      return {
        content: `Invalid write: action must be "insert" or "update" and table must be an existing table.`,
        citations: [],
      };
    }

    const ownerCol = resolveOwnerColumn(table);
    const allCols = getColumns(table);
    const rowId = typeof args.id === "string" ? args.id.trim() : "";
    if (action === "update" && !rowId) {
      return { content: 'Update requires an "id" — look the row up first (e.g. with query_database).', citations: [table] };
    }

    const rawValues = args.values && typeof args.values === "object" ? { ...(args.values as Record<string, unknown>) } : {};
    const db = getDb();

    // Auto-resolve common human-friendly fields for foreign keys
    if (table === "jobs") {
      if (typeof rawValues.company === "string" && rawValues.company.trim() && !rawValues.company_id) {
        const compName = rawValues.company.trim();
        const existing = db
          .prepare("SELECT id FROM companies WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1")
          .get(ctx.userId, compName) as { id: string } | undefined;
        if (existing) {
          rawValues.company_id = existing.id;
        } else {
          const newCompId = crypto.randomUUID();
          db.prepare("INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)").run(newCompId, ctx.userId, compName);
          rawValues.company_id = newCompId;
        }
        delete rawValues.company;
      }
      const stageOrList = (rawValues.stage || rawValues.list) as string | undefined;
      if (typeof stageOrList === "string" && stageOrList.trim() && !rawValues.list_id) {
        const target = stageOrList.trim();
        const listRow = db
          .prepare("SELECT id FROM board_lists WHERE user_id = ? AND (lower(name) = lower(?) OR lower(kind) = lower(?)) ORDER BY sort_order LIMIT 1")
          .get(ctx.userId, target, target) as { id: string } | undefined;
        if (listRow) {
          rawValues.list_id = listRow.id;
        }
        delete rawValues.stage;
        delete rawValues.list;
      }
    } else if (table === "links") {
      if (typeof rawValues.category === "string" && rawValues.category.trim() && !rawValues.category_id) {
        const catName = rawValues.category.trim();
        const existingCat = db
          .prepare("SELECT id FROM link_categories WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1")
          .get(ctx.userId, catName) as { id: string } | undefined;
        if (existingCat) {
          rawValues.category_id = existingCat.id;
        } else {
          const newCatId = crypto.randomUUID();
          db.prepare("INSERT INTO link_categories (id, user_id, name) VALUES (?, ?, ?)").run(newCatId, ctx.userId, catName);
          rawValues.category_id = newCatId;
        }
        delete rawValues.category;
      }
    }

    const values: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, val] of Object.entries(rawValues)) {
      if (
        !isValidIdentifier(key) ||
        !allCols.includes(key) ||
        ALWAYS_BLOCKED_COLUMNS.has(key) ||
        EXTRA_BLOCKED_COLUMNS[table]?.has(key)
      ) {
        dropped.push(key);
        continue;
      }
      values[key] = val;
    }

    if (action === "insert") {
      if (Object.keys(values).length === 0) {
        return { content: "Nothing to insert — all provided columns were unknown or blocked.", citations: [table] };
      }
      if (ownerCol) values[ownerCol] = ctx.userId;
      // Mirror lib/db/query.ts's insert path: a TEXT primary key has no
      // SQL-level default, so this tool must generate the same kind of id
      // every other write path does — otherwise the row lands with a NULL
      // id, invisible to the rest of the app. INTEGER PRIMARY KEY tables
      // autoincrement on their own and must NOT get an explicit id.
      const idType = getColumnsWithTypes(table).find((c) => c.name === "id")?.type;
      const generatesId = idType !== undefined && idType !== "INTEGER";
      if (generatesId) values.id = crypto.randomUUID();

      const needsApproval = mode === "ask" || mode === "strict";
      if (needsApproval) {
        const sqlPreview = buildWriteSqlPreview(table, "insert", values);
        const preview = `INSERT ${table}:\n${JSON.stringify(values, null, 2).slice(0, 900)}${dropped.length ? `\n(ignored: ${dropped.join(", ")})` : ""}`;
        const approvalId = createPendingWrite({
          userId: ctx.userId,
          table,
          action: "insert",
          values,
          preview,
          sql: sqlPreview,
        });
        return {
          content: `Ready to create ${table} row: ${JSON.stringify(values)}.\n\nThis has NOT run yet — waiting for your approval (Ask before changes). Click Allow to create, or Deny to cancel.`,
          citations: [table],
          approval: {
            approvalId,
            label: table,
            preview,
            sql: sqlPreview,
            expiresAt: Date.now() + 60_000,
            kind: "write",
            table,
            action: "insert",
          },
        };
      }

      const cols = Object.keys(values);
      const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
      let newId: string | number;
      try {
        const info = db.prepare(sql).run(...(cols.map((c) => values[c]) as never[]));
        newId = generatesId ? (values.id as string) : Number(info.lastInsertRowid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: `Insert into ${table} failed: ${msg}`, citations: [table] };
      }

      if (table === "jobs" && isAppliedKindList(ctx.userId, values.list_id)) {
        await ensureApplication(createDbClient(), ctx.userId, String(newId));
      }
      // Column names only, never their values — see lib/actions/activity-log.ts.
      void logResourceActivity(ctx.userId, "chat_insert", table, String(newId), { columns: cols.join(",") });

      const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
      const artifact = buildArtifactSnapshot(table, String(newId), ctx.userId);
      return {
        content: `Created ${table} row ${newId}: ${JSON.stringify(values)}.${droppedNote}`,
        citations: [table],
        ...(artifact ? { artifact, artifacts: [artifact] } : {}),
      };
    }

    if (Object.keys(values).length === 0) {
      return { content: "Nothing to update after dropping unknown/blocked fields.", citations: [table] };
    }
    const needsApprovalUpdate = mode === "ask" || mode === "strict";
    if (needsApprovalUpdate) {
      const sqlPreview = buildWriteSqlPreview(table, "update", values, rowId, ctx.userId);
      const preview = `UPDATE ${table} ${rowId}:\n${JSON.stringify(values, null, 2).slice(0, 900)}${dropped.length ? `\n(ignored: ${dropped.join(", ")})` : ""}`;
      const approvalId = createPendingWrite({
        userId: ctx.userId,
        table,
        action: "update",
        id: rowId,
        values,
        preview,
        sql: sqlPreview,
      });
      return {
        content: `Ready to update ${table} row ${rowId}: ${JSON.stringify(values)}.\n\nThis has NOT run yet — waiting for your approval (Ask before changes). Click Allow to update, or Deny to cancel.`,
        citations: [table],
        approval: {
          approvalId,
          label: table,
          preview,
          sql: sqlPreview,
          expiresAt: Date.now() + 60_000,
          kind: "write",
          table,
          action: "update",
        },
      };
    }

    const setCols = Object.keys(values);
    const sql =
      `UPDATE "${table}" SET ${setCols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?` +
      (ownerCol ? ` AND "${ownerCol}" = ?` : "");
    const params: unknown[] = [...setCols.map((c) => values[c]), rowId];
    if (ownerCol) params.push(ctx.userId);

    let changes: number;
    try {
      const info = db.prepare(sql).run(...(params as never[]));
      changes = Number(info.changes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: `Update to ${table} failed: ${msg}`, citations: [table] };
    }
    if (changes === 0) {
      return { content: `No ${table} row with id ${rowId} for this user — nothing updated.`, citations: [table] };
    }

    if (table === "jobs" && isAppliedKindList(ctx.userId, values.list_id)) {
      await ensureApplication(createDbClient(), ctx.userId, rowId);
    }
    void logResourceActivity(ctx.userId, "chat_update", table, rowId, { columns: setCols.join(",") });

    const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
    const artifactUp = buildArtifactSnapshot(table, rowId, ctx.userId);
    return {
      content: `Updated ${table} row ${rowId}.${droppedNote}`,
      citations: [table],
      ...(artifactUp ? { artifact: artifactUp, artifacts: [artifactUp] } : {}),
    };
  },
};

// Server-side store for pending WRITE approvals (INSERT/UPDATE).
// When permissionMode is "ask" or "strict", write_database does not execute
// immediately. Instead it stores a pending write here and returns an approval
// payload. The pipeline emits an SSE `approval` frame, the client shows the
// modal, and on Allow the pending write is consumed and executed. This mirrors
// the DELETE flow in db-approval.ts but for writes.

import { getDb } from "@/lib/db/sqlite";
import { createDbClient } from "@/lib/db/client";
import { ensureApplication } from "@/lib/actions/board";
import { logResourceActivity } from "@/lib/actions/activity-log";
import {
  tableExists,
  getColumns,
  getColumnsWithTypes,
  resolveOwnerColumn,
  isValidIdentifier,
  ALWAYS_BLOCKED_COLUMNS,
} from "@/lib/ai/tools/db-utils";

export interface PendingWrite {
  approvalId: string;
  userId: string;
  table: string;
  action: "insert" | "update";
  id?: string;
  values: Record<string, unknown>;
  preview: string;
  sql: string;
  expiresAt: number;
}

const TTL_MS = 60_000;
const store = new Map<string, PendingWrite>();

function isAppliedKindList(userId: string, listId: unknown): boolean {
  if (typeof listId !== "string" || !listId) return false;
  const row = getDb()
    .prepare(`SELECT kind FROM board_lists WHERE id = ? AND user_id = ?`)
    .get(listId, userId) as { kind: string } | undefined;
  return row?.kind === "applied";
}

export function createPendingWrite(input: Omit<PendingWrite, "approvalId" | "expiresAt">): string {
  const approvalId = crypto.randomUUID();
  store.set(approvalId, {
    ...input,
    approvalId,
    expiresAt: Date.now() + TTL_MS,
  });
  return approvalId;
}

export function consumePendingWrite(approvalId: string, userId: string): PendingWrite | null {
  const pending = store.get(approvalId);
  if (!pending) return null;
  store.delete(approvalId);
  if (pending.userId !== userId || pending.expiresAt < Date.now()) return null;
  return pending;
}

export async function executeApprovedWrite(pending: PendingWrite): Promise<{ newId?: string; changes?: number; content: string }> {
  const db = getDb();
  const { table, action, values, userId } = pending;
  const ownerCol = resolveOwnerColumn(table);

  if (action === "insert") {
    const cols = Object.keys(values);
    const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    const info = db.prepare(sql).run(...(cols.map((c) => values[c]) as never[]));
    const newId = (values.id as string) ?? String(info.lastInsertRowid);
    if (table === "jobs" && isAppliedKindList(userId, values.list_id)) {
      await ensureApplication(createDbClient(), userId, newId);
    }
    void logResourceActivity(userId, "chat_insert", table, newId, { columns: cols.join(","), approved: true });
    return { newId, content: `Created ${table} row ${newId}` };
  } else {
    const setCols = Object.keys(values);
    if (setCols.length === 0) return { content: "Nothing to update" };
    const rowId = pending.id!;
    const sql = `UPDATE "${table}" SET ${setCols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?` + (ownerCol ? ` AND "${ownerCol}" = ?` : "");
    const params: unknown[] = [...setCols.map((c) => values[c]), rowId];
    if (ownerCol) params.push(userId);
    const info = db.prepare(sql).run(...(params as never[]));
    const changes = Number(info.changes);
    if (table === "jobs" && isAppliedKindList(userId, values.list_id)) {
      await ensureApplication(createDbClient(), userId, rowId);
    }
    void logResourceActivity(userId, "chat_update", table, rowId, { columns: setCols.join(","), approved: true });
    return { changes, content: `Updated ${table} row ${rowId}` };
  }
}

// Helper to build SQL preview for the approval modal (without executing)
export function buildWriteSqlPreview(table: string, action: "insert" | "update", values: Record<string, unknown>, id?: string, userId?: string): string {
  if (action === "insert") {
    const cols = Object.keys(values);
    return `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  } else {
    const setCols = Object.keys(values);
    const ownerCol = resolveOwnerColumn(table);
    return `UPDATE "${table}" SET ${setCols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?` + (ownerCol ? ` AND "${ownerCol}" = ?` : "");
  }
}

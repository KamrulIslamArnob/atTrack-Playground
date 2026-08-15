// Server-side store for pending DELETE approvals. A delete tool call never
// deletes: it stores a proposal here and returns an `approvalId` to the client,
// which renders an Allow/Deny card. The chat turn ends. When the user decides,
// /api/chat receives the decision, consumes the pending entry, and only then
// runs the delete (on Allow) — Deny removes it without any execution.
//
// In-memory + module-level: a dev hot-reload or process restart just clears it
// and the model re-proposes. Fine for a single local user.
import { getDb } from "@/lib/db/sqlite";
import { logResourceActivity } from "@/lib/actions/activity-log";

export interface PendingDbDelete {
  approvalId: string;
  userId: string;
  table: string;
  ownerCol: string | null;
  ids: string[];
  /** Human-readable table label for the UI. */
  label: string;
  /** Human-readable summary of the rows about to be deleted. */
  preview: string;
  /** The literal SQL that would run on approval. */
  sql: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const store = new Map<string, PendingDbDelete>();

export function createPendingDbDelete(
  input: Omit<PendingDbDelete, "approvalId" | "expiresAt">
): string {
  const approvalId = crypto.randomUUID();
  store.set(approvalId, {
    ...input,
    approvalId,
    expiresAt: Date.now() + TTL_MS,
  });
  return approvalId;
}

/** Returns the pending delete if it matches the user and is unexpired, then
 *  removes it so a decision can only be applied once. */
export function consumePendingDbDelete(
  approvalId: string,
  userId: string
): PendingDbDelete | null {
  const pending = store.get(approvalId);
  if (!pending) return null;
  store.delete(approvalId);
  if (pending.userId !== userId || pending.expiresAt < Date.now()) {
    return null;
  }
  return pending;
}

/** Executes a previously-approved delete. Owner-scoped when the table has an
 *  owner column; otherwise scoped to the exact ids (single local user). */
export function executeApprovedDelete(pending: PendingDbDelete): number {
  const db = getDb();
  const placeholders = pending.ids.map(() => "?").join(",");
  const params: unknown[] = [...pending.ids];
  let sql: string;
  if (pending.ownerCol) {
    sql = `DELETE FROM "${pending.table}" WHERE id IN (${placeholders}) AND "${pending.ownerCol}" = ?`;
    params.push(pending.userId);
  } else {
    sql = `DELETE FROM "${pending.table}" WHERE id IN (${placeholders})`;
  }
  const info = db.prepare(sql).run(...(params as never[]));
  const deleted = Number(info.changes);
  // One line per row, so the trail answers "what was removed" without ever
  // holding the removed content. See lib/actions/activity-log.ts.
  if (deleted > 0) {
    for (const id of pending.ids) {
      void logResourceActivity(pending.userId, "chat_delete", pending.table, id, { confirmed: true });
    }
  }
  return deleted;
}

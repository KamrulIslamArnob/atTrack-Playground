"use server";

// Audit trail.
//
// Every consequential mutation in lib/actions emits one line here: who, what
// action, which resource type, which id. There is no activity_log table —
// the NDJSON log under .data/logs IS the trail. That is the right shape for a
// single-user local app: it survives a database reset, it is greppable, and it
// costs one synchronous fd write instead of an INSERT on the request path.
//
// WHAT NEVER GOES IN: field values. Not the job title, not the company, not the
// contact's name or address, not the note body, not the document contents. An
// audit trail answers "what did I do to which record, and when" — reconstructing
// the record itself is the database's job, not the log's.
//
// CALL THESE WITHOUT `await`: `void logResourceActivity(...)`. The body is
// synchronous end to end; the promise only exists because "use server" requires
// every export to be async. Awaiting it would put a microtask between an action
// and its own return for no benefit.

import { moduleLogger } from "@/lib/log";
import { requestId } from "@/lib/log/request";

const auditLog = moduleLogger("audit");

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/** Shapes only — counts, booleans, enum-ish names. Never a field value. */
export type ActivityMetadata = Record<string, string | number | boolean | null | undefined>;

/**
 * No IP, no user agent, by design.
 *
 * atTrack runs as a local single-user desktop app with no reverse proxy in
 * front of it, so every request originates from 127.0.0.1 and every user agent
 * is the same Electron shell. Recording either would be inventing provenance
 * that does not exist, which is worse than recording nothing.
 */
export async function getClientContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  return { ipAddress: null, userAgent: null };
}

function emit(
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  metadata?: ActivityMetadata
): void {
  try {
    auditLog.info({
      event: `audit.${action}`,
      userId,
      resource,
      resourceId,
      reqId: requestId(),
      ...metadata,
    });
  } catch {
    // An audit line must never be the thing that fails a mutation the user
    // already committed. Swallowing also keeps the `void`-call sites from
    // producing an unhandled rejection.
  }
}

/** Generic activity, not tied to a single record (export, bulk import, sync). */
export async function logActivity(
  userId: string,
  action: string,
  metadata?: ActivityMetadata
): Promise<void> {
  emit(userId, action, "system", null, metadata);
}

/** A create/update/delete against one record. `resource` is the table-ish name. */
export async function logResourceActivity(
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  metadata?: ActivityMetadata
): Promise<void> {
  emit(userId, action, resource, resourceId, metadata);
}

/**
 * Kept for the interface it promised. There is no login, signup, or session in
 * atTrack, so nothing calls this today — it exists so that reinstating auth does
 * not have to reinvent where those events go.
 */
export async function logAuthActivity(
  userId: string,
  action: string,
  metadata?: ActivityMetadata
): Promise<void> {
  emit(userId, action, "auth", null, metadata);
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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

interface ActivityLogParams {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("activity_logs").insert({
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch {
    // Activity logging should never break the main flow
  }
}

export async function logAuthActivity(
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logActivity({
    userId,
    action,
    resource: "auth",
    metadata,
  });
}

export async function logResourceActivity(
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logActivity({
    userId,
    action,
    resource,
    resourceId,
    metadata,
  });
}

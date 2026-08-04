"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIpAddress } from "@/lib/activity-messages";

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

export async function getClientContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const headerList = await headers();
    const ipAddress = normalizeIpAddress(headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    const userAgent = headerList.get("user-agent") ?? null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { ipAddress, userAgent } = params.ipAddress
      ? { ipAddress: params.ipAddress, userAgent: params.userAgent }
      : await getClientContext();

    const admin = createAdminClient();
    await admin.from("activity_logs").insert({
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId ?? null,
      metadata: params.metadata ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
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

"use server";

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

export async function getClientContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  return { ipAddress: null, userAgent: null };
}

export async function logActivity(..._args: unknown[]): Promise<void> {}
export async function logAuthActivity(..._args: unknown[]): Promise<void> {}
export async function logResourceActivity(..._args: unknown[]): Promise<void> {}

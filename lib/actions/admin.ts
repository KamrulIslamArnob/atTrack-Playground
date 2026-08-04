"use server";

import { getAdminUser } from "@/lib/auth";
import type { ActivityLog } from "@/lib/actions/activity-log";
import { logResourceActivity } from "@/lib/actions/activity-log";
import { createAdminClient } from "@/lib/supabase/admin";

interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalJobs: number;
  totalApplications: number;
  totalInterviews: number;
  totalDocuments: number;
  totalAiRequests: number;
  aiRequestsToday: number;
  recentActivity: ActivityLog[];
  usersTrend: { date: string; count: number }[];
  jobsByStatus: { status: string; count: number }[];
  activityByAction: { action: string; count: number }[];
  aiTrend: { date: string; requests: number }[];
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { supabase } = await getAdminUser();

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceIso = since.toISOString();

  // Parallel queries
  const [
    usersRes,
    activeRes,
    bannedRes,
    jobsRes,
    appsRes,
    interviewsRes,
    docsRes,
    aiTotalRes,
    aiTodayRes,
    activityRes,
    usersTrendRes,
    jobsStatusRes,
    activityActionRes,
    aiTrendRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("interviews").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }),
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("profiles").select("created_at").gte("created_at", sinceIso),
    supabase.from("jobs").select("status"),
    supabase.from("activity_logs").select("action").gte("created_at", sinceIso),
    supabase.from("ai_usage_logs").select("created_at").gte("created_at", sinceIso),
  ]);

  const usersTrendMap: Record<string, number> = {};
  for (const row of usersTrendRes.data ?? []) {
    const k = new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    usersTrendMap[k] = (usersTrendMap[k] ?? 0) + 1;
  }
  const usersTrend = Object.entries(usersTrendMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const statusMap: Record<string, number> = {};
  for (const row of jobsStatusRes.data ?? []) {
    statusMap[row.status] = (statusMap[row.status] ?? 0) + 1;
  }
  const jobsByStatus = Object.entries(statusMap)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const actionMap: Record<string, number> = {};
  for (const row of activityActionRes.data ?? []) {
    actionMap[row.action] = (actionMap[row.action] ?? 0) + 1;
  }
  const activityByAction = Object.entries(actionMap)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  const aiTrendMap: Record<string, number> = {};
  for (const row of aiTrendRes.data ?? []) {
    const k = new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    aiTrendMap[k] = (aiTrendMap[k] ?? 0) + 1;
  }
  const aiTrend = Object.entries(aiTrendMap)
    .map(([date, requests]) => ({ date, requests }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalUsers: usersRes.count ?? 0,
    activeUsers: activeRes.count ?? 0,
    bannedUsers: bannedRes.count ?? 0,
    totalJobs: jobsRes.count ?? 0,
    totalApplications: appsRes.count ?? 0,
    totalInterviews: interviewsRes.count ?? 0,
    totalDocuments: docsRes.count ?? 0,
    totalAiRequests: aiTotalRes.count ?? 0,
    aiRequestsToday: aiTodayRes.count ?? 0,
    recentActivity: (activityRes.data ?? []) as ActivityLog[],
    usersTrend,
    jobsByStatus,
    activityByAction,
    aiTrend,
  };
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: string;
  is_banned: boolean;
  banned_at: string | null;
  created_at: string;
  last_sign_in: string | null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const { supabase } = await getAdminUser();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (!profiles) return [];

  // Get auth users for email (requires service-role key)
  const { data: authUsers } = await createAdminClient().auth.admin.listUsers();
  const authMap = new Map(authUsers.users.map((u) => [u.id, u]));

  return profiles.map((p) => {
    const auth = authMap.get(p.id);
    return {
      id: p.id,
      email: auth?.email ?? "unknown",
      full_name: p.full_name ?? auth?.user_metadata?.full_name ?? "Unknown",
      avatar_url: p.avatar_url ?? auth?.user_metadata?.avatar_url,
      role: p.role ?? "user",
      is_banned: p.is_banned ?? false,
      banned_at: p.banned_at ?? null,
      created_at: p.created_at,
      last_sign_in: auth?.last_sign_in_at ?? null,
    };
  });
}

async function getTargetInfo(userId: string): Promise<{ email?: string; full_name?: string }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return {
      email: data?.user?.email ?? undefined,
      full_name: data?.user?.user_metadata?.full_name ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function banUser(userId: string): Promise<{ error?: string }> {
  const { supabase, userId: adminId } = await getAdminUser();

  if (userId === adminId) {
    return { error: "Cannot ban yourself" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: true, banned_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  const target = await getTargetInfo(userId);
  await logResourceActivity(adminId, "ban", "user", userId, target);
  return {};
}

export async function unbanUser(userId: string): Promise<{ error?: string }> {
  const { supabase, userId: adminId } = await getAdminUser();

  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: false, banned_at: null })
    .eq("id", userId);

  if (error) return { error: error.message };

  const target = await getTargetInfo(userId);
  await logResourceActivity(adminId, "unban", "user", userId, target);
  return {};
}

export async function promoteToAdmin(userId: string): Promise<{ error?: string }> {
  const { supabase, userId: adminId } = await getAdminUser();

  if (userId === adminId) {
    return { error: "Cannot change your own role" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", userId);

  if (error) return { error: error.message };

  const target = await getTargetInfo(userId);
  await logResourceActivity(adminId, "promote", "user", userId, target);
  return {};
}

export async function demoteToUser(userId: string): Promise<{ error?: string }> {
  const { supabase, userId: adminId } = await getAdminUser();

  if (userId === adminId) {
    return { error: "Cannot change your own role" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "user" })
    .eq("id", userId);

  if (error) return { error: error.message };

  const target = await getTargetInfo(userId);
  await logResourceActivity(adminId, "demote", "user", userId, target);
  return {};
}

export interface AdminActivityLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export async function getAdminActivityLog(
  page: number = 1,
  limit: number = 50,
  filter?: { action?: string; resource?: string; user_id?: string }
): Promise<{ logs: AdminActivityLogEntry[]; total: number }> {
  const { supabase } = await getAdminUser();

  let query = supabase
    .from("activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filter?.action) query = query.eq("action", filter.action);
  if (filter?.resource) query = query.eq("resource", filter.resource);
  if (filter?.user_id) query = query.eq("user_id", filter.user_id);

  const { data, count } = await query
    .range((page - 1) * limit, page * limit - 1);

  if (!data) return { logs: [], total: 0 };

  // Batch fetch auth users for emails (requires service-role key)
  const { data: authUsers } = await createAdminClient().auth.admin.listUsers();
  const authMap = new Map(authUsers.users.map((u) => [u.id, u]));

  return {
    logs: data.map((l) => {
      const auth = authMap.get(l.user_id);
      return {
        id: l.id,
        user_id: l.user_id,
        user_email: auth?.email ?? "unknown",
        user_name: auth?.user_metadata?.full_name ?? "Unknown",
        action: l.action,
        resource: l.resource,
        resource_id: l.resource_id,
        metadata: l.metadata ?? {},
        ip_address: l.ip_address ?? "",
        user_agent: l.user_agent ?? "",
        created_at: l.created_at,
      };
    }),
    total: count ?? 0,
  };
}

export interface AdminAiUsageEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}

export async function getAdminAiUsage(
  page: number = 1,
  limit: number = 50,
  filter?: { action?: string; user_id?: string }
): Promise<{ logs: AdminAiUsageEntry[]; total: number; totalTokens: number; totalCost: number }> {
  const { supabase } = await getAdminUser();

  let query = supabase
    .from("ai_usage_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filter?.action) query = query.eq("action", filter.action);
  if (filter?.user_id) query = query.eq("user_id", filter.user_id);

  const { data, count } = await query
    .range((page - 1) * limit, page * limit - 1);

  // Totals
  const { data: allData } = await supabase
    .from("ai_usage_logs")
    .select("input_tokens, output_tokens, cost_usd");

  const totalTokens = allData?.reduce((sum, l) => sum + (l.input_tokens ?? 0) + (l.output_tokens ?? 0), 0) ?? 0;
  const totalCost = allData?.reduce((sum, l) => sum + (l.cost_usd ?? 0), 0) ?? 0;

  if (!data) return { logs: [], total: 0, totalTokens, totalCost };

  const { data: authUsers } = await createAdminClient().auth.admin.listUsers();
  const authMap = new Map(authUsers.users.map((u) => [u.id, u]));

  return {
    logs: data.map((l) => {
      const auth = authMap.get(l.user_id);
      return {
        id: l.id,
        user_id: l.user_id,
        user_email: auth?.email ?? "unknown",
        user_name: auth?.user_metadata?.full_name ?? "Unknown",
        action: l.action,
        model: l.model,
        input_tokens: l.input_tokens ?? 0,
        output_tokens: l.output_tokens ?? 0,
        total_tokens: (l.input_tokens ?? 0) + (l.output_tokens ?? 0),
        cost_usd: l.cost_usd ?? 0,
        created_at: l.created_at,
      };
    }),
    total: count ?? 0,
    totalTokens,
    totalCost,
  };
}

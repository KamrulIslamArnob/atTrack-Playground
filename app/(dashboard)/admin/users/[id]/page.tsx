"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  getAdminUserDetail,
  getAdminActivityLog,
  getAdminAiUsage,
} from "@/lib/actions/admin";
import type {
  AdminUserDetail,
  AdminActivityLogEntry,
  AdminAiUsageEntry,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  ArrowLeft,
  Loader2,
  Briefcase,
  FileText,
  CalendarDays,
  Activity,
  Cpu,
  Mail,
  Ban,
  Globe,
  Clock,
  Coins,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { normalizeIpAddress } from "@/lib/activity-messages";
import { formatActivityMessage, ACTION_COLORS } from "@/lib/activity-messages";
import { formatAiUsageMessage, AI_ACTION_COLORS, AI_ACTION_LABELS } from "@/lib/ai-usage-messages";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [activity, setActivity] = useState<AdminActivityLogEntry[]>([]);
  const [aiUsage, setAiUsage] = useState<AdminAiUsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    getAdminUserDetail(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    getAdminActivityLog(1, 100, { user_id: userId }).then((result) => {
      if (!cancelled) {
        setActivity(result.logs);
        setActivityLoading(false);
      }
    });
    getAdminAiUsage(1, 100, { user_id: userId }).then((result) => {
      if (!cancelled) {
        setAiUsage(result.logs);
        setAiLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">User not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/admin/users")}>
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/users")}
              className="flex size-9 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight">User Profile</h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Details and history for {user.full_name || user.email}.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Profile card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.full_name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted text-xl font-medium text-muted-foreground">
                {user.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{user.full_name}</h2>
              {user.is_banned && (
                <Badge variant="destructive" className="text-[10px]">Banned</Badge>
              )}
              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                {user.role}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              {user.email}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
              </span>
              {user.last_sign_in && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  Last sign in {formatDistanceToNow(new Date(user.last_sign_in), { addSuffix: true })}
                </span>
              )}
              {user.banned_at && (
                <span className="flex items-center gap-1.5 text-destructive">
                  <Ban className="size-3.5" />
                  Banned {formatDistanceToNow(new Date(user.banned_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
          <StatItem icon={Briefcase} label="Jobs" value={user.job_count} />
          <StatItem icon={FileText} label="Applications" value={user.application_count} />
          <StatItem icon={FileText} label="Documents" value={user.document_count} />
          <StatItem icon={CalendarDays} label="Interviews" value={user.interview_count} />
          <StatItem icon={Activity} label="Activity" value={user.activity_count} />
          <StatItem icon={Cpu} label="AI Requests" value={user.ai_usage_count} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <div className="mt-4">
            {activityLoading ? (
              <div className="flex items-center justify-center rounded-4xl border border-border py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : activity.length > 0 ? (
              <div className="rounded-4xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">IP</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((log, index) => (
                      <tr
                        key={log.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-4xl px-2 py-0.5 text-[10px] font-medium ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[320px]">
                          <span className="text-sm">{formatActivityMessage(log)}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {log.ip_address ? (
                              <>
                                <Globe className="size-3.5 shrink-0" />
                                {normalizeIpAddress(log.ip_address)}
                              </>
                            ) : (
                              <span className="text-muted-foreground/50">-</span>
                            )}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-right text-xs text-muted-foreground"
                          title={new Date(log.created_at).toLocaleString()}
                        >
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-usage">
          <div className="mt-4">
            {aiLoading ? (
              <div className="flex items-center justify-center rounded-4xl border border-border py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : aiUsage.length > 0 ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
                    <div className="flex size-10 items-center justify-center rounded-4xl bg-violet-500/10">
                      <Zap className="size-5 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold tracking-tight">
                        {aiUsage.reduce((sum, l) => sum + l.total_tokens, 0).toLocaleString()}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">Total Tokens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
                    <div className="flex size-10 items-center justify-center rounded-4xl bg-amber-500/10">
                      <Coins className="size-5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold tracking-tight">
                        ${aiUsage.reduce((sum, l) => sum + l.cost_usd, 0).toFixed(4)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">Total Cost</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
                    <div className="flex size-10 items-center justify-center rounded-4xl bg-blue-500/10">
                      <Cpu className="size-5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-bold tracking-tight">
                        {aiUsage.length.toLocaleString()}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">Total Requests</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-4xl border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Model</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Tokens</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Cost</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Duration</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsage.map((log, index) => {
                        const meta = (log.metadata ?? {}) as Record<string, unknown>;
                        const isError = meta.status === "error";
                        return (
                          <tr
                            key={log.id}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-4xl px-2 py-0.5 text-[10px] font-medium ${AI_ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}
                              >
                                {AI_ACTION_LABELS[log.action] ?? log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[320px]">
                              <span className={`text-sm ${isError ? "text-destructive" : ""}`}>
                                {formatAiUsageMessage(log)}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground truncate block max-w-[160px]">{log.model}</span>
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              <span className="text-xs">
                                {log.input_tokens.toLocaleString()} → {log.output_tokens.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">
                                ${log.cost_usd.toFixed(4)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right hidden lg:table-cell">
                              <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                                {log.duration_ms != null ? (
                                  <>
                                    <Clock className="size-3" />
                                    {log.duration_ms < 1000
                                      ? `${log.duration_ms}ms`
                                      : `${(log.duration_ms / 1000).toFixed(1)}s`}
                                  </>
                                ) : (
                                  "-"
                                )}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-right text-xs text-muted-foreground"
                              title={new Date(log.created_at).toLocaleString()}
                            >
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">No AI usage yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-4xl border border-border bg-muted/40 px-3 py-2.5">
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{value.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

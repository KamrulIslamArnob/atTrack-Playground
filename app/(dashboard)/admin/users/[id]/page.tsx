"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  ArrowLeft,
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
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { normalizeIpAddress } from "@/lib/activity-messages";
import { formatActivityMessage, ACTION_COLORS } from "@/lib/activity-messages";
import { formatAiUsageMessage, AI_ACTION_COLORS, AI_ACTION_LABELS } from "@/lib/ai-usage-messages";

const DEBOUNCE_MS = 400;

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Activity tab state
  const [activity, setActivity] = useState<AdminActivityLogEntry[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPerPage, setActivityPerPage] = useState(20);
  const [activitySearchInput, setActivitySearchInput] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityActionFilter, setActivityActionFilter] = useState("all");
  const [activitySort, setActivitySort] = useState("newest");
  const activityDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // AI Usage tab state
  const [aiUsage, setAiUsage] = useState<AdminAiUsageEntry[]>([]);
  const [aiTotal, setAiTotal] = useState(0);
  const [aiTotalTokens, setAiTotalTokens] = useState(0);
  const [aiTotalCost, setAiTotalCost] = useState(0);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiPage, setAiPage] = useState(1);
  const [aiPerPage, setAiPerPage] = useState(20);
  const [aiSearchInput, setAiSearchInput] = useState("");
  const [aiSearch, setAiSearch] = useState("");
  const [aiActionFilter, setAiActionFilter] = useState("all");
  const [aiSort, setAiSort] = useState("newest");
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Load user profile
  useEffect(() => {
    getAdminUserDetail(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  // Load activity logs
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    const result = await getAdminActivityLog(activityPage, activityPerPage, {
      user_id: userId,
      action: activityActionFilter === "all" ? undefined : activityActionFilter,
      search: activitySearch || undefined,
      sort: activitySort,
    });
    setActivity(result.logs);
    setActivityTotal(result.total);
    setActivityLoading(false);
  }, [userId, activityPage, activityPerPage, activityActionFilter, activitySearch, activitySort]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  // Load AI usage
  const loadAiUsage = useCallback(async () => {
    setAiLoading(true);
    const result = await getAdminAiUsage(aiPage, aiPerPage, {
      user_id: userId,
      action: aiActionFilter === "all" ? undefined : aiActionFilter,
      search: aiSearch || undefined,
      sort: aiSort,
    });
    setAiUsage(result.logs);
    setAiTotal(result.total);
    setAiTotalTokens(result.totalTokens);
    setAiTotalCost(result.totalCost);
    setAiLoading(false);
  }, [userId, aiPage, aiPerPage, aiActionFilter, aiSearch, aiSort]);

  useEffect(() => { loadAiUsage(); }, [loadAiUsage]);

  function handleActivitySearch(value: string) {
    setActivitySearchInput(value);
    if (activityDebounceRef.current) clearTimeout(activityDebounceRef.current);
    activityDebounceRef.current = setTimeout(() => {
      setActivitySearch(value);
      setActivityPage(1);
    }, DEBOUNCE_MS);
  }

  function handleAiSearch(value: string) {
    setAiSearchInput(value);
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(() => {
      setAiSearch(value);
      setAiPage(1);
    }, DEBOUNCE_MS);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="-mx-6 border-b border-border pb-6">
          <div className="flex items-center gap-4 px-6">
            <Skeleton className="size-9 shrink-0 rounded-4xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <Skeleton className="h-4 w-64" />
        <div className="rounded-4xl border border-border bg-gradient-to-br from-primary/10 via-card to-background p-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="mx-auto h-4 w-48 sm:mx-0" />
              <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-4xl border border-border bg-muted/40 px-3 py-2.5">
                <Skeleton className="size-4 shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs labels={{ [userId]: "Unknown" }} />
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

      <Breadcrumbs labels={{ [userId]: user.full_name }} />

      {/* Profile card with gradient */}
      <div className="rounded-4xl border border-border bg-gradient-to-br from-primary/10 via-card to-background p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
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
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-lg font-semibold">{user.full_name}</h2>
              {user.is_banned && (
                <Badge variant="destructive" className="text-[10px]">Banned</Badge>
              )}
              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                {user.role}
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              <Mail className="size-3.5" />
              {user.email}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground sm:justify-start">
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
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="activity" className="flex-1 sm:flex-none">Activity Log</TabsTrigger>
          <TabsTrigger value="ai-usage" className="flex-1 sm:flex-none">AI Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <div className="mt-4 space-y-4">
            {/* Search + filters row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={activitySearchInput}
                  onChange={(e) => handleActivitySearch(e.target.value)}
                  placeholder="Search action or resource..."
                  className="h-10 pl-9 pr-9 text-sm"
                />
                {activitySearchInput && (
                  <button
                    onClick={() => { setActivitySearchInput(""); setActivitySearch(""); setActivityPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Action</span>
                <Select
                  value={activityActionFilter}
                  onValueChange={(v) => { setActivityActionFilter(v ?? "all"); setActivityPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[130px]">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {Object.entries(ACTION_COLORS).map(([action]) => (
                      <SelectItem key={action} value={action}>
                        <span className="capitalize">{action.replace(/_/g, " ")}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Sort</span>
                <Select
                  value={activitySort}
                  onValueChange={(v) => { setActivitySort(v ?? "newest"); setActivityPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 lg:ml-auto">
                <span className="text-xs text-muted-foreground">Per page</span>
                <Select
                  value={String(activityPerPage)}
                  onValueChange={(v) => { setActivityPerPage(Number(v ?? 20)); setActivityPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 30, 50, 100].map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  disabled={activityPage <= 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setActivityPage((p) => Math.min(Math.max(1, Math.ceil(activityTotal / activityPerPage)), p + 1))}
                  disabled={activityPage >= Math.max(1, Math.ceil(activityTotal / activityPerPage))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Active filters */}
            {(activitySearch || activityActionFilter !== "all") && (
              <div className="flex items-center gap-2">
                {activitySearch && (
                  <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs">
                    &quot;{activitySearch}&quot;
                    <button onClick={() => { setActivitySearchInput(""); setActivitySearch(""); setActivityPage(1); }} className="ml-0.5 hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {activityActionFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs capitalize">
                    Action: {activityActionFilter.replace(/_/g, " ")}
                    <button onClick={() => { setActivityActionFilter("all"); setActivityPage(1); }} className="ml-0.5 hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => { setActivitySearchInput(""); setActivitySearch(""); setActivityActionFilter("all"); setActivityPage(1); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results count */}
            <div className="text-xs text-muted-foreground">
              {activityTotal} activity log{activityTotal !== 1 ? "s" : ""} found
            </div>

            {/* Table */}
            {activityLoading ? (
              <div className="rounded-4xl border border-border">
                <div className="bg-muted/50 px-4 py-3">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-3 flex-1" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
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
                          {(activityPage - 1) * activityPerPage + index + 1}
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
                <p className="text-sm text-muted-foreground">
                  {activitySearch || activityActionFilter !== "all" ? "No activity matches your filters." : "No activity yet."}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai-usage">
          <div className="mt-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
                <div className="flex size-10 items-center justify-center rounded-4xl bg-violet-500/10">
                  <Zap className="size-5 text-violet-500" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold tracking-tight">
                    {aiTotalTokens.toLocaleString()}
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
                    ${aiTotalCost.toFixed(4)}
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
                    {aiTotal.toLocaleString()}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">Total Requests</p>
                </div>
              </div>
            </div>

            {/* Search + filters row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={aiSearchInput}
                  onChange={(e) => handleAiSearch(e.target.value)}
                  placeholder="Search action or model..."
                  className="h-10 pl-9 pr-9 text-sm"
                />
                {aiSearchInput && (
                  <button
                    onClick={() => { setAiSearchInput(""); setAiSearch(""); setAiPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Action</span>
                <Select
                  value={aiActionFilter}
                  onValueChange={(v) => { setAiActionFilter(v ?? "all"); setAiPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[130px]">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {Object.entries(AI_ACTION_LABELS).map(([action, label]) => (
                      <SelectItem key={action} value={action}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Sort</span>
                <Select
                  value={aiSort}
                  onValueChange={(v) => { setAiSort(v ?? "newest"); setAiPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 lg:ml-auto">
                <span className="text-xs text-muted-foreground">Per page</span>
                <Select
                  value={String(aiPerPage)}
                  onValueChange={(v) => { setAiPerPage(Number(v ?? 20)); setAiPage(1); }}
                >
                  <SelectTrigger className="h-10 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 30, 50, 100].map((opt) => (
                      <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setAiPage((p) => Math.max(1, p - 1))}
                  disabled={aiPage <= 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => setAiPage((p) => Math.min(Math.max(1, Math.ceil(aiTotal / aiPerPage)), p + 1))}
                  disabled={aiPage >= Math.max(1, Math.ceil(aiTotal / aiPerPage))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            {/* Active filters */}
            {(aiSearch || aiActionFilter !== "all") && (
              <div className="flex items-center gap-2">
                {aiSearch && (
                  <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs">
                    &quot;{aiSearch}&quot;
                    <button onClick={() => { setAiSearchInput(""); setAiSearch(""); setAiPage(1); }} className="ml-0.5 hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {aiActionFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs capitalize">
                    Action: {AI_ACTION_LABELS[aiActionFilter] ?? aiActionFilter}
                    <button onClick={() => { setAiActionFilter("all"); setAiPage(1); }} className="ml-0.5 hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={() => { setAiSearchInput(""); setAiSearch(""); setAiActionFilter("all"); setAiPage(1); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results count */}
            <div className="text-xs text-muted-foreground">
              {aiTotal} AI usage log{aiTotal !== 1 ? "s" : ""} found
            </div>

            {/* Table */}
            {aiLoading ? (
              <div className="rounded-4xl border border-border">
                <div className="bg-muted/50 px-4 py-3">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-3 flex-1" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : aiUsage.length > 0 ? (
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
                            {(aiPage - 1) * aiPerPage + index + 1}
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
            ) : (
              <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {aiSearch || aiActionFilter !== "all" ? "No AI usage matches your filters." : "No AI usage yet."}
                </p>
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

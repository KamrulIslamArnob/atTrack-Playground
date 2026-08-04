"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAdminAiUsage, getAdminUsers } from "@/lib/actions/admin";
import type { AdminAiUsageEntry } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Cpu,
  Coins,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatAiUsageMessage, AI_ACTION_COLORS, AI_ACTION_LABELS } from "@/lib/ai-usage-messages";

export default function AdminAiUsagePage() {
  const [logs, setLogs] = useState<AdminAiUsageEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [emailToUserId, setEmailToUserId] = useState<Record<string, string>>({});

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const filter: Record<string, string> = {};
    if (actionFilter && actionFilter !== "all") filter.action = actionFilter;
    if (userIdFilter) filter.user_id = userIdFilter;

    const result = await getAdminAiUsage(page, perPage, filter as Parameters<typeof getAdminAiUsage>[2]);
    setLogs(result.logs);
    setTotal(result.total);
    setTotalTokens(result.totalTokens);
    setTotalCost(result.totalCost);
    setLoading(false);
  }, [page, perPage, actionFilter, userIdFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    getAdminUsers().then((users) => {
      const map: Record<string, string> = {};
      for (const u of users) map[u.email.toLowerCase()] = u.id;
      setEmailToUserId(map);
    });
  }, []);

  const applySearch = useCallback((value: string) => {
    const userId = emailToUserId[value.trim().toLowerCase()];
    setUserIdFilter(userId ?? "");
    setPage(1);
  }, [emailToUserId]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applySearch(value), 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function clearSearch() {
    setSearch("");
    setUserIdFilter("");
    setPage(1);
  }

  const totalPages = Math.ceil(total / perPage);
  const hasActiveFilters = actionFilter !== "all" || userIdFilter !== "";

  const successCount = logs.filter((l) => (l.metadata as Record<string, unknown>)?.status !== "error").length;
  const errorCount = logs.length - successCount;

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">AI Usage</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Every AI request across the platform, with token counts and cost.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadLogs}>
            <Loader2 className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Breadcrumbs />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <QuickStat icon={Cpu} label="Total Requests" value={total.toLocaleString()} color="text-blue-500" bgColor="bg-blue-500/10" />
        <QuickStat icon={Zap} label="Total Tokens" value={totalTokens.toLocaleString()} color="text-violet-500" bgColor="bg-violet-500/10" />
        <QuickStat icon={Coins} label="Estimated Cost" value={`$${totalCost.toFixed(4)}`} color="text-amber-500" bgColor="bg-amber-500/10" />
        <QuickStat icon={CheckCircle2} label="Successful" value={successCount.toLocaleString()} color="text-emerald-500" bgColor="bg-emerald-500/10" />
        <QuickStat icon={XCircle} label="Failed" value={errorCount.toLocaleString()} color="text-rose-500" bgColor="bg-rose-500/10" />
      </div>

      {/* Search, filter, per page, pagination — one row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by email..."
            className="h-10 pl-9 pr-9 text-sm"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Action</span>
          <Select
            value={actionFilter}
            onValueChange={(v) => { setActionFilter(v ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-full lg:w-[160px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(AI_ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 lg:ml-auto">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => { setPerPage(Number(v ?? 30)); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[20, 30, 50, 100].map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {userIdFilter && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs">
              User: {search || "filtered"}
              <button onClick={clearSearch} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          {actionFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs capitalize">
              Action: {AI_ACTION_LABELS[actionFilter] ?? actionFilter}
              <button
                onClick={() => { setActionFilter("all"); setPage(1); }}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              setActionFilter("all");
              setUserIdFilter("");
              setPage(1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} request{total !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-4xl border border-border">
          <div className="bg-muted/50 px-4 py-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 10 }).map((_, i) => (
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
      ) : logs.length > 0 ? (
        <div className="rounded-4xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
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
              {logs.map((log, index) => {
                const meta = (log.metadata ?? {}) as Record<string, unknown>;
                const isError = meta.status === "error";
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {(page - 1) * perPage + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{log.user_name}</div>
                      <div className="text-xs text-muted-foreground">{log.user_email}</div>
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
                      {isError && typeof meta.error === "string" && (
                        <div className="mt-0.5 text-xs text-destructive/80 truncate max-w-[280px]">
                          {meta.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground truncate block max-w-[160px]">{log.model}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs">
                        {log.input_tokens.toLocaleString()} → {log.output_tokens.toLocaleString()}
                      </span>
                      {meta.cached_tokens ? (
                        <div className="text-[10px] text-muted-foreground">
                          {Number(meta.cached_tokens).toLocaleString()} cached
                        </div>
                      ) : null}
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
            {hasActiveFilters
              ? "No AI usage matches your filters."
              : "No AI usage yet."}
          </p>
        </div>
      )}
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-4xl border border-border bg-card p-4">
      <div className={`flex size-10 items-center justify-center rounded-4xl ${bgColor}`}>
        <Icon className={`size-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-bold tracking-tight">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

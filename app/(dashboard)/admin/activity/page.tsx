"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminActivityLog } from "@/lib/actions/admin";
import type { AdminActivityLogEntry } from "@/lib/actions/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Globe,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatActivityMessage, normalizeIpAddress, ACTION_COLORS } from "@/lib/activity-messages";

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<AdminActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const filter: Record<string, string> = {};
    if (actionFilter && actionFilter !== "all") filter.action = actionFilter;
    if (resourceFilter && resourceFilter !== "all") filter.resource = resourceFilter;
    if (userIdFilter) filter.user_id = userIdFilter;

    const result = await getAdminActivityLog(page, perPage, filter as Parameters<typeof getAdminActivityLog>[2]);
    setLogs(result.logs);
    setTotal(result.total);
    setLoading(false);
  }, [page, perPage, actionFilter, resourceFilter, userIdFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function handleSearch() {
    const match = logs.find((l) => l.user_email === search);
    setUserIdFilter(match?.user_id ?? "");
    setPage(1);
  }

  function clearSearch() {
    setSearch("");
    setUserIdFilter("");
    setPage(1);
  }

  const totalPages = Math.ceil(total / perPage);
  const hasActiveFilters =
    actionFilter !== "all" || resourceFilter !== "all" || userIdFilter !== "";

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Activity Log</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Every action across the platform, with the actor and timestamp.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadLogs}>
            <Loader2 className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Breadcrumbs />

      {/* Search, filter, per page, pagination — one row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
            <SelectTrigger className="h-10 w-full lg:w-[140px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="save">Save</SelectItem>
              <SelectItem value="send">Send</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="extract">Extract</SelectItem>
              <SelectItem value="ban">Ban</SelectItem>
              <SelectItem value="unban">Unban</SelectItem>
              <SelectItem value="promote">Promote</SelectItem>
              <SelectItem value="demote">Demote</SelectItem>
              <SelectItem value="sign_in">Sign In</SelectItem>
              <SelectItem value="sign_up">Sign Up</SelectItem>
              <SelectItem value="sign_out">Sign Out</SelectItem>
              <SelectItem value="account_deletion">Account Deletion</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Resource</span>
          <Select
            value={resourceFilter}
            onValueChange={(v) => { setResourceFilter(v ?? "all"); setPage(1); }}
          >
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="job">Job</SelectItem>
              <SelectItem value="application">Application</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="mcq_result">MCQ</SelectItem>
              <SelectItem value="screenshot">Screenshot</SelectItem>
              <SelectItem value="smtp">SMTP</SelectItem>
              <SelectItem value="profile">Profile</SelectItem>
              <SelectItem value="avatar">Avatar</SelectItem>
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
              Action: {actionFilter.replace("_", " ")}
              <button
                onClick={() => { setActionFilter("all"); setPage(1); }}
                className="ml-0.5 hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {resourceFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2.5 py-1 text-xs">
              Resource: {resourceFilter}
              <button
                onClick={() => { setResourceFilter("all"); setPage(1); }}
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
              setResourceFilter("all");
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
        {total} entr{total !== 1 ? "ies" : "y"} found
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center rounded-4xl border border-border py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length > 0 ? (
        <div className="rounded-4xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">IP</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.user_name}</div>
                    <div className="text-xs text-muted-foreground">{log.user_email}</div>
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
            {hasActiveFilters
              ? "No activity matches your filters."
              : "No activity yet."}
          </p>
        </div>
      )}
    </div>
  );
}

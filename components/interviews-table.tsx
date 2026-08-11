"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Video,
  User,
  ExternalLink,
  Pencil,
} from "lucide-react";
import type { Interview } from "@/lib/actions/interviews";
import { getCalendarLinkFromInterview } from "@/lib/calendar";
import { InterviewForm } from "@/components/interview-form";

interface InterviewsTableProps {
  interviews: Interview[];
  total: number;
  initialSearch: string;
  initialStatus: string;
  initialSort: string;
  page: number;
  totalPages: number;
  perPage: number;
}

const typeColors: Record<string, string> = {
  phone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  video: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  onsite: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  technical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  behavioral: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  panel: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rescheduled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

const statusOptions = ["scheduled", "completed", "cancelled", "rescheduled"];

export function InterviewsTable({
  interviews,
  total,
  initialSearch,
  initialStatus,
  initialSort,
  page,
  totalPages,
  perPage,
}: InterviewsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = initialSearch || initialStatus !== "all" || initialSort !== "newest";

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      if (key !== "page") params.set("page", "1");
      router.push(`/interviews?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams("search", value);
      }, 300);
    },
    [updateParams]
  );

  const handleStatusChange = useCallback(
    (value: string | null) => {
      const v = value ?? "all";
      setStatusFilter(v);
      updateParams("status", v);
    },
    [updateParams]
  );

  const handleSortChange = useCallback(
    (value: string | null) => {
      const v = value ?? "newest";
      setSort(v);
      updateParams("sort", v);
    },
    [updateParams]
  );

  const formatDate = (iso: string | null) => {
    if (!iso) return "Not scheduled";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Search, filter, sort, per page, pagination — one row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by job, company, interviewer..."
            className="h-10 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="date-asc">Soonest</SelectItem>
              <SelectItem value="date-desc">Furthest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 lg:ml-auto">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => updateParams("perPage", v ?? "30")}
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
            onClick={() => updateParams("page", String(Math.max(1, page - 1)))}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => updateParams("page", String(Math.min(totalPages, page + 1)))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {initialSearch && (
            <span className="inline-flex items-center gap-1 rounded-2xl bg-muted px-2.5 py-1 text-xs">
              Search: {initialSearch}
              <button onClick={() => updateParams("search", "")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          {initialStatus !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-2xl bg-muted px-2.5 py-1 text-xs">
              Status: {statusLabels[initialStatus]}
              <button onClick={() => updateParams("status", "all")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          {initialSort !== "newest" && (
            <span className="inline-flex items-center gap-1 rounded-2xl bg-muted px-2.5 py-1 text-xs">
              Sort: {initialSort}
              <button onClick={() => updateParams("sort", "newest")} className="ml-0.5 hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSort("newest");
              router.push("/interviews");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} interview{total !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {interviews.length > 0 ? (
        <div className="rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Job</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Interviewer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((interview, index) => {
                const calendarUrl = getCalendarLinkFromInterview(interview);
                return (
                  <tr
                    key={interview.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {(page - 1) * perPage + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${interview.job?.id}`}
                        className="font-medium hover:text-green-800 dark:hover:text-lime-400 transition-all duration-200 ease-out hover:translate-x-0.5 inline-block"
                      >
                        {interview.job?.title ?? "Untitled"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {interview.job?.company?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="size-3.5 shrink-0" />
                        {formatDate(interview.scheduled_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {interview.type ? (
                        <span
                          className={`inline-block rounded-2xl px-2 py-0.5 text-[10px] font-medium ${typeColors[interview.type] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {interview.type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="size-3.5 shrink-0" />
                        {interview.interviewer_name ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {interview.meeting_url ? (
                          <>
                            <Video className="size-3.5 shrink-0" />
                            <span>Video</span>
                          </>
                        ) : interview.location ? (
                          <>
                            <MapPin className="size-3.5 shrink-0" />
                            <span>{interview.location}</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-2xl px-2 py-0.5 text-[10px] font-medium ${statusColors[interview.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {statusLabels[interview.status] ?? interview.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {calendarUrl && interview.status === "scheduled" && (
                          <a
                            href={calendarUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-green-800 dark:hover:text-lime-400 transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                            Calendar
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedInterview(interview)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-green-800 dark:hover:text-lime-400 transition-colors"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No interviews match your filters."
              : "No interviews yet."}
          </p>
        </div>
      )}

      {selectedInterview && (
        <InterviewForm
          interview={selectedInterview}
          onClose={() => {
            setSelectedInterview(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

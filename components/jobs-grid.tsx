"use client";

import { useCallback, useMemo, useState } from "react";
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
  ExternalLink,
  Mail,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_STATUS_LABELS } from "@/lib/types/job";

interface JobListItem {
  id: string;
  title: string;
  status: string;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  application_url: string | null;
  application_email: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  created_at: string;
  company: {
    name: string;
    location: string | null;
  } | null;
  applications: {
    id: string;
    status: string;
    applied_at: string | null;
  }[];
}

interface JobsGridProps {
  jobs: JobListItem[];
  total: number;
  initialSearch: string;
  initialStatus: string;
  page: number;
  totalPages: number;
  perPage: number;
}

const statusColors: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  interested: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  applied: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const statusLabels: Record<string, string> = JOB_STATUS_LABELS;

const statusOptions = ["saved", "interested", "preparing"];

function matchBadgeClass(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

// One enriched row shape the table sorts and renders from — computed once per
// jobs/prop change instead of re-derived per cell.
interface Row {
  job: JobListItem;
  displayStatus: string;
  dateLabel: string;
  dateValue: number | null;
}

function enrichJob(job: JobListItem): Row {
  const hasApplied = job.applications && job.applications.length > 0;
  const latestApplication = hasApplied ? job.applications[0] : null;
  const displayStatus = hasApplied && job.status === "saved" ? "applied" : job.status;

  const dateIso = latestApplication?.applied_at ?? job.deadline ?? null;
  const dateLabel = latestApplication?.applied_at
    ? `Applied ${formatDate(latestApplication.applied_at)}`
    : job.deadline
      ? `Due ${formatDate(job.deadline)}`
      : "—";

  return {
    job,
    displayStatus,
    dateLabel,
    dateValue: dateIso ? new Date(dateIso).getTime() : null,
  };
}

type SortKey =
  | "title"
  | "company"
  | "location"
  | "employment_type"
  | "work_location"
  | "salary_range"
  | "match_score"
  | "status"
  | "date";
type SortDir = "asc" | "desc";

// Numeric/date columns read best newest/highest-first on first click; text
// columns read best A→Z first.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  title: "asc",
  company: "asc",
  location: "asc",
  employment_type: "asc",
  work_location: "asc",
  salary_range: "asc",
  match_score: "desc",
  status: "asc",
  date: "desc",
};

function sortValue(row: Row, key: SortKey): string | number | null {
  switch (key) {
    case "title":
      return row.job.title || null;
    case "company":
      return row.job.company?.name || null;
    case "location":
      return row.job.location || null;
    case "employment_type":
      return row.job.employment_type || null;
    case "work_location":
      return row.job.work_location || null;
    case "salary_range":
      return row.job.salary_range || null;
    case "match_score":
      return row.job.match_score;
    case "status":
      return statusLabels[row.displayStatus] ?? row.displayStatus;
    case "date":
      return row.dateValue;
  }
}

// Nulls always sort last regardless of direction — an empty salary or match
// score isn't "less than zero", it's "unknown", so it shouldn't lead an
// ascending sort.
function compareRows(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aNull = av === null || av === "";
  const bNull = bv === null || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof av === "number" && typeof bv === "number") {
    return dir === "asc" ? av - bv : bv - av;
  }
  const cmp = String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

function SortHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === columnKey;
  return (
    <th scope="col" className={cn("border-r border-border px-3 py-2.5 text-left last:border-r-0", className)}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-30" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

export function JobsGrid({
  jobs,
  total,
  initialSearch,
  initialStatus,
  page,
  totalPages,
  perPage,
}: JobsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== "page") {
        params.delete("page");
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      const timeout = setTimeout(() => {
        updateParams("search", value);
      }, 300);
      return () => clearTimeout(timeout);
    },
    [updateParams]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      updateParams("status", value);
    },
    [updateParams]
  );

  // Column-header click is the sort UI now — same three-state cycle a table
  // like this should have: unsorted → this column's natural direction → flipped.
  const handleHeaderSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const hasActiveFilters = initialStatus !== "all" || initialSearch !== "";

  const rows = useMemo(() => {
    const enriched = jobs.map(enrichJob);
    if (!sortKey) return enriched;
    return [...enriched].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [jobs, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by role, company, or location..."
            className="h-10 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v) => handleStatusChange(v ?? "all")}>
            <SelectTrigger className="h-10 w-full lg:w-[130px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 lg:ml-auto">
          <span className="text-xs text-muted-foreground">Per page</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("perPage", v ?? "30");
              params.set("page", "1");
              router.push(`?${params.toString()}`);
            }}
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
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.max(1, page - 1)));
              router.push(`?${params.toString()}`);
            }}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.min(totalPages, page + 1)));
              router.push(`?${params.toString()}`);
            }}
            disabled={page >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {initialSearch && (
            <span className="inline-flex items-center gap-1 rounded-2xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              &quot;{initialSearch}&quot;
              <button onClick={() => { setSearch(""); updateParams("search", ""); }} className="ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          )}
          {initialStatus !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-2xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary capitalize">
              {statusLabels[initialStatus] ?? initialStatus}
              <button onClick={() => handleStatusChange("all")} className="ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              router.push("/jobs");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        {total} job{total !== 1 ? "s" : ""} found
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <SortHeader label="Title" columnKey="title" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} className="min-w-[200px]" />
                <SortHeader label="Company" columnKey="company" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} className="min-w-[140px]" />
                <SortHeader label="Location" columnKey="location" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} className="min-w-[160px]" />
                <SortHeader label="Type" columnKey="employment_type" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} />
                <SortHeader label="Work" columnKey="work_location" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} />
                <SortHeader label="Salary" columnKey="salary_range" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} className="min-w-[140px]" />
                <SortHeader label="Match" columnKey="match_score" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} />
                <SortHeader label="Status" columnKey="status" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} />
                <SortHeader label="Date" columnKey="date" sortKey={sortKey} sortDir={sortDir} onSort={handleHeaderSort} className="min-w-[140px]" />
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ job, displayStatus, dateLabel }) => (
                <tr
                  key={job.id}
                  className="group relative border-b border-border/60 odd:bg-card even:bg-muted/30 last:border-b-0 hover:bg-primary/5"
                >
                  <td className="border-r border-border px-3 py-3 font-semibold last:border-r-0">
                    <Link href={`/jobs/${job.id}`} className="static group-hover:text-primary transition-colors">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {job.title}
                    </Link>
                  </td>
                  <td className="border-r border-border max-w-[180px] truncate px-3 py-3 text-muted-foreground last:border-r-0">
                    {job.company?.name ?? "Unknown company"}
                  </td>
                  <td className="border-r border-border max-w-[200px] truncate px-3 py-3 text-muted-foreground last:border-r-0">
                    {job.location ?? "—"}
                  </td>
                  <td className="border-r border-border px-3 py-3 last:border-r-0">
                    {job.employment_type ? (
                      <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {job.employment_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="border-r border-border px-3 py-3 last:border-r-0">
                    {job.work_location ? (
                      <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {job.work_location}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="border-r border-border px-3 py-3 text-muted-foreground last:border-r-0">
                    {job.salary_range || <span className="text-muted-foreground/50">Unspecified</span>}
                  </td>
                  <td className="border-r border-border px-3 py-3 last:border-r-0">
                    {job.match_score != null ? (
                      <span
                        className={cn(
                          "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
                          matchBadgeClass(job.match_score)
                        )}
                        title={job.match_reasoning ?? undefined}
                      >
                        {job.match_score}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="border-r border-border px-3 py-3 last:border-r-0">
                    <span
                      className={cn(
                        "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
                        statusColors[displayStatus] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {displayStatus === "applied" ? "Applied" : statusLabels[displayStatus] ?? displayStatus}
                    </span>
                  </td>
                  <td className="border-r border-border whitespace-nowrap px-3 py-3 text-xs text-muted-foreground last:border-r-0">{dateLabel}</td>
                  <td className="relative z-10 px-3 py-3 text-right">
                    {job.application_url && (
                      <a
                        href={job.application_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open application link"
                        className="inline-flex text-muted-foreground/40 transition-colors hover:text-primary"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    {!job.application_url && job.application_email && (
                      <a
                        href={`mailto:${job.application_email}`}
                        aria-label="Email application contact"
                        className="inline-flex text-muted-foreground/40 transition-colors hover:text-primary"
                      >
                        <Mail className="size-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? "No jobs match your filters." : "No jobs yet."}
          </p>
        </div>
      )}
    </div>
  );
}

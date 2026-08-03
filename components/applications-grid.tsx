"use client";

import { useState, useCallback } from "react";
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
import { Search, X, ChevronLeft, ChevronRight, MapPin, DollarSign, Building2, ExternalLink, Mail } from "lucide-react";

interface Application {
  id: string;
  applied_at: string | null;
  created_at: string;
  job: {
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
    company: {
      name: string;
      location: string | null;
    } | null;
  } | null;
}

interface ApplicationsGridProps {
  applications: Application[];
  total: number;
  initialSearch: string;
  initialStatus: string;
  initialSort: string;
  page: number;
  totalPages: number;
  perPage: number;
}

const statusColors: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  interested: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  applied: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  interview: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  withdrawn: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusOptions = [
  "saved",
  "interested",
  "preparing",
  "applied",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
];

export function ApplicationsGrid({
  applications,
  total,
  initialSearch,
  initialStatus,
  initialSort,
  page,
  totalPages,
  perPage,
}: ApplicationsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "applied_newest") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset page when filters change
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
      // Debounce: update URL after typing stops
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

  const handleSortChange = useCallback(
    (value: string) => {
      setSort(value);
      updateParams("sort", value);
    },
    [updateParams]
  );

  const hasActiveFilters = initialStatus !== "all" || initialSort !== "newest" || initialSearch !== "";

  return (
    <div className="space-y-4">
      {/* Search and filter button */}
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by role, company, or location..."
            className="h-10 pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v) => handleStatusChange(v ?? "all")}>
            <SelectTrigger className="h-10 w-[130px]">
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => handleSortChange(v ?? "applied_newest")}>
            <SelectTrigger className="h-10 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="applied_newest">Date applied ↓</SelectItem>
              <SelectItem value="applied_oldest">Date applied ↑</SelectItem>
              <SelectItem value="deadline_earliest">Deadline ↑</SelectItem>
              <SelectItem value="deadline_latest">Deadline ↓</SelectItem>
              <SelectItem value="company_az">Company A→Z</SelectItem>
              <SelectItem value="company_za">Company Z→A</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 ml-auto">
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
            <span className="inline-flex items-center gap-1 rounded-4xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              &quot;{initialSearch}&quot;
              <button onClick={() => { setSearch(""); updateParams("search", ""); }} className="ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          )}
          {initialStatus !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary capitalize">
              {initialStatus}
              <button onClick={() => handleStatusChange("all")} className="ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          )}
          {initialSort !== "applied_newest" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {initialSort === "applied_oldest" ? "Oldest applied" : initialSort === "deadline_earliest" ? "Deadline ↑" : initialSort === "deadline_latest" ? "Deadline ↓" : initialSort === "company_az" ? "Company A→Z" : initialSort === "company_za" ? "Company Z→A" : initialSort}
              <button onClick={() => handleSortChange("applied_newest")} className="ml-0.5">
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
        {total} application{total !== 1 ? "s" : ""} found
      </div>

      {/* Cards grid */}
      {applications.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <Link
              key={app.id}
              href={`/jobs/${app.job?.id}`}
              className="group rounded-4xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
                    {app.job?.title ?? "Untitled"}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{app.job?.company?.name ?? "Unknown company"}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {app.job?.match_score != null && (
                    <span
                      className={`rounded-4xl px-2.5 py-1 text-[10px] font-medium ${
                        app.job.match_score >= 80
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : app.job.match_score >= 50
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                      title={app.job.match_reasoning ?? undefined}
                    >
                      {app.job.match_score}% match
                    </span>
                  )}
                  <span className={`shrink-0 rounded-4xl px-2.5 py-1 text-[10px] font-medium ${statusColors[app.job?.status ?? "saved"] ?? "bg-muted text-muted-foreground"}`}>
                    {statusLabels[app.job?.status ?? "saved"] ?? "Saved"}
                  </span>
                </div>
              </div>

              <div className="mt-1 space-y-1.5">
                {app.job?.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span>{app.job.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <DollarSign className="size-3.5 shrink-0" />
                  <span className={app.job?.salary_range ? "" : "text-muted-foreground/50"}>
                    {app.job?.salary_range || "Unspecified"}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/70">
                  {app.job?.employment_type && (
                    <span className="rounded-4xl bg-muted px-2 py-0.5">
                      {app.job.employment_type}
                    </span>
                  )}
                  {app.job?.work_location && (
                    <span className="rounded-4xl bg-muted px-2 py-0.5">
                      {app.job.work_location}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground/60">
                <span>
                  {app.applied_at
                    ? `Applied ${new Date(app.applied_at).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })}`
                    : app.job?.deadline
                      ? `Deadline ${new Date(app.job.deadline).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })}`
                      : "No deadline"}
                </span>
                {app.job?.application_url && (
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                )}
                {!app.job?.application_url && app.job?.application_email && (
                  <Mail className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-4xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No applications match your filters."
              : "No applications yet."}
          </p>
        </div>
      )}
    </div>
  );
}

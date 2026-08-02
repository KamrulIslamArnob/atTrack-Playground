"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, MapPin, Building2, Briefcase, Clock, ExternalLink } from "lucide-react";

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
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sort, setSort] = useState(initialSort);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "newest") {
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(true)}
          className="relative h-10 gap-2"
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {hasActiveFilters && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
          )}
        </Button>
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
          {initialSort !== "newest" && (
            <span className="inline-flex items-center gap-1 rounded-4xl bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {initialSort === "oldest" ? "Oldest first" : "By company"}
              <button onClick={() => handleSortChange("newest")} className="ml-0.5">
                <X className="size-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              router.push("/applications");
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
              href={`/applications/${app.id}`}
              className="group rounded-4xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
                    {app.job?.title ?? "Untitled"}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{app.job?.company?.name ?? "Unknown company"}</span>
                  </p>
                </div>
                <span className={`shrink-0 rounded-4xl px-2.5 py-1 text-[10px] font-medium capitalize ${statusColors[app.job?.status ?? "saved"] ?? "bg-muted text-muted-foreground"}`}>
                  {app.job?.status ?? "saved"}
                </span>
              </div>

              <div className="mt-4 space-y-1.5">
                {app.job?.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span>{app.job.location}</span>
                  </div>
                )}
                {app.job?.salary_range && (
                  <div className="text-sm text-muted-foreground">
                    {app.job.salary_range}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
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
                <span className={app.applied_at ? "" : "text-red-500 dark:text-red-400"}>
                  {app.applied_at
                    ? `Applied ${new Date(app.applied_at).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })}`
                    : app.job?.deadline
                      ? `Deadline ${new Date(app.job.deadline).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" })}`
                      : ""}
                </span>
                {app.job?.application_url && (
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
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
          {!hasActiveFilters && <AddJobDialog />}
        </div>
      )}

      {/* Filters dialog */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-4xl border border-border bg-card p-6 shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(v) => handleStatusChange(v ?? "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sort by</Label>
                <Select value={sort} onValueChange={(v) => handleSortChange(v ?? "newest")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="company">Company name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setSort("newest");
                  router.push("/applications");
                  setShowFilters(false);
                }}
              >
                Reset
              </Button>
              <Button size="sm" onClick={() => setShowFilters(false)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

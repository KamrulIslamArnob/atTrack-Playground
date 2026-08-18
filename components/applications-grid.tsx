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
import { Search, Building2, Mail } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { MapPinIcon } from "@/components/ui/map-pin";
import { DollarSignIcon } from "@/components/ui/dollar-sign";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/table-pagination";
import { APPLICATION_STATUS_LABELS } from "@/lib/types/job";

interface Application {
  id: string;
  status: string;
  applied_at: string | null;
  created_at: string;
  resume_id: string | null;
  resume_name: string | null;
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
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  acknowledged: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  interview: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  offer: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  accepted: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  withdrawn: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = APPLICATION_STATUS_LABELS;

const statusOptions = [
  "draft",
  "submitted",
  "acknowledged",
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

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateParams("page", String(newPage));
    },
    [updateParams]
  );

  const handlePerPageChange = useCallback(
    (newPerPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("perPage", String(newPerPage));
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const hasActiveFilters =
    initialStatus !== "all" ||
    initialSort !== "applied_newest" ||
    initialSearch !== "";

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by role, company, or location..."
            className="h-9 pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Status</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => handleStatusChange(v ?? "all")}
          >
            <SelectTrigger className="h-9 w-full lg:w-[130px] text-xs">
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
          <span className="shrink-0 text-xs text-muted-foreground">Sort</span>
          <Select
            value={sort}
            onValueChange={(v) => handleSortChange(v ?? "applied_newest")}
          >
            <SelectTrigger className="h-9 w-full lg:w-[160px] text-xs">
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
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {initialSearch && (
            <span className="inline-flex items-center gap-1 rounded-2xl border border-lime-500/50 bg-lime-400/25 px-2.5 py-1 text-xs font-semibold text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200">
              &quot;{initialSearch}&quot;
              <button
                onClick={() => {
                  setSearch("");
                  updateParams("search", "");
                }}
                className="ml-0.5"
              >
                <XIcon className="size-3 text-lime-900 dark:text-lime-300" />
              </button>
            </span>
          )}
          {initialStatus !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-2xl border border-lime-500/50 bg-lime-400/25 px-2.5 py-1 text-xs font-semibold text-lime-950 capitalize dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200">
              {statusLabels[initialStatus] ?? initialStatus}
              <button
                onClick={() => {
                  setStatusFilter("all");
                  updateParams("status", "all");
                }}
                className="ml-0.5"
              >
                <XIcon className="size-3 text-lime-900 dark:text-lime-300" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSort("applied_newest");
              router.push("?");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Applications Grid list */}
      {applications.length > 0 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={app.job ? `/jobs` : "#"}
                className="group block rounded-2xl border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading text-base font-semibold leading-tight tracking-tight group-hover:text-primary transition-colors truncate">
                      {app.job?.title || "Untitled Job"}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {app.job?.company?.name || "Unknown Company"}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium ${
                      statusColors[app.status] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {statusLabels[app.status] || app.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {app.job?.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPinIcon className="size-3.5 shrink-0" />
                      <span>{app.job.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSignIcon className="size-3.5 shrink-0" />
                    <span
                      className={
                        app.job?.salary_range ? "" : "text-muted-foreground/50"
                      }
                    >
                      {app.job?.salary_range || "Unspecified"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/70">
                    {app.job?.employment_type && (
                      <span className="rounded-2xl bg-muted px-2 py-0.5">
                        {app.job.employment_type}
                      </span>
                    )}
                    {app.job?.work_location && (
                      <span className="rounded-2xl bg-muted px-2 py-0.5">
                        {app.job.work_location}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-between text-xs text-muted-foreground/60">
                  <span>
                    {app.applied_at
                      ? `Applied ${new Date(app.applied_at).toLocaleDateString(
                          "en-US",
                          { month: "long", day: "2-digit", year: "numeric" }
                        )}`
                      : app.job?.deadline
                      ? app.job.deadline.trim().toLowerCase() === "asap"
                        ? "Apply ASAP"
                        : app.job.deadline.trim().toLowerCase() === "unknown"
                        ? "Unknown deadline"
                        : `Deadline ${new Date(
                            app.job.deadline
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            day: "2-digit",
                            year: "numeric",
                          })}`
                      : "No deadline"}
                  </span>
                  {app.job?.application_url && (
                    <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-green-800 dark:group-hover:text-lime-400 transition-colors" />
                  )}
                  {!app.job?.application_url && app.job?.application_email && (
                    <Mail className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-green-800 dark:group-hover:text-lime-400 transition-colors" />
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Bottom Table Pagination */}
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            perPage={perPage}
            onPageChange={handlePageChange}
            onPerPageChange={handlePerPageChange}
            perPageOptions={[20, 30, 50, 100]}
            itemLabel="applications"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
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

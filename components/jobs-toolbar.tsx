"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { Input } from "@/components/ui/input";
import { ImportChoice } from "@/components/import-choice";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JOB_STATUS_LABELS } from "@/lib/types/job";

const statusLabels: Record<string, string> = JOB_STATUS_LABELS;
const statusOptions = ["saved", "interested", "preparing"];

interface JobsToolbarProps {
  initialSearch: string;
  initialStatus: string;
  page: number;
  totalPages: number;
  perPage: number;
}

/**
 * Compact toolbar controls for the Jobs page — search pill, status pill,
 * per-page selector, pagination, and Add Job button.
 *
 * Designed to sit inside `<JobViewHeader>` children (Layer 2 toolbar row).
 */
export function JobsToolbar({
  initialSearch,
  initialStatus,
  page,
  totalPages,
  perPage,
}: JobsToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);

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

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        updateParams("search", value);
      }, 300);
    },
    [updateParams]
  );

  const statusLabel =
    initialStatus === "all"
      ? "All"
      : statusLabels[initialStatus] ?? initialStatus;

  const perPageLabel = String(perPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      {/* Left: 1. Search, 2. Add Job */}
      <div className="flex items-center gap-2">
        <div className="relative w-40 sm:w-56">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search jobs..."
            className="h-8 pl-8 text-xs bg-card border-border"
          />
        </div>
        <ImportChoice />
      </div>

      {/* Right (End of row): Status + Per page + Pagination icons */}
      <div className="flex items-center gap-2">
        {/* Status pill dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground">
            Status: <span className="text-foreground">{statusLabel}</span>
            <ChevronDownIcon className="size-3" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={initialStatus}
              onValueChange={(v) => updateParams("status", v)}
            >
              <DropdownMenuRadioItem value="all">
                All statuses
              </DropdownMenuRadioItem>
              {statusOptions.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {statusLabels[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Per-page pill dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground">
            Per page: <span className="text-foreground">{perPageLabel}</span>
            <ChevronDownIcon className="size-3" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={String(perPage)}
              onValueChange={(v) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("perPage", v ?? "30");
                params.set("page", "1");
                router.push(`?${params.toString()}`);
              }}
            >
              {[20, 30, 50, 100].map((opt) => (
                <DropdownMenuRadioItem key={opt} value={String(opt)}>
                  {opt}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Pagination pill with move buttons */}
        <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.max(1, page - 1)));
              router.push(`?${params.toString()}`);
            }}
            className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
          </button>
          <span className="w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(Math.min(totalPages, page + 1)));
              router.push(`?${params.toString()}`);
            }}
            className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

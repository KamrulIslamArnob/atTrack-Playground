"use client";

import { useMemo } from "react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function TablePagination({
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 30, 50, 100],
  itemLabel = "items",
  className,
}: TablePaginationProps) {
  const startItem = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(total, page * perPage);

  // Generate page numbers with ellipses: e.g. [1, 2, 3, 4, 5] or [1, '...', 4, 5, 6, '...', 20]
  const visiblePages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 text-xs text-muted-foreground border-t border-border/80 bg-muted/20 select-none",
        className
      )}
    >
      {/* Item Range Info */}
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <span>Showing</span>
        <span className="text-foreground font-semibold">{startItem}–{endItem}</span>
        <span>of</span>
        <span className="text-foreground font-semibold">{total}</span>
        <span>{itemLabel}</span>
      </div>

      {/* Controls: Rows per page & Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        {onPerPageChange && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">Rows:</span>
            <Select
              value={String(perPage)}
              onValueChange={(v) => onPerPageChange(Number(v))}
            >
              <SelectTrigger className="h-6.5 w-[62px] text-[11px] font-medium bg-card border-border/70 rounded-lg px-2 shadow-2xs hover:border-border transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl shadow-lg border-border/80 min-w-[70px]">
                {perPageOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="size-6.5 flex items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <ChevronLeftIcon className="size-3" />
          </button>

          {visiblePages.map((p, idx) =>
            p === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-0.5 text-xs text-muted-foreground/50 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                className={cn(
                  "size-6.5 rounded-lg text-[11px] font-medium transition-all shadow-2xs cursor-pointer flex items-center justify-center active:scale-95",
                  p === page
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="size-6.5 flex items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <ChevronRightIcon className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

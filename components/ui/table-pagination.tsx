"use client";

import { useMemo } from "react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { Button } from "@/components/ui/button";
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
        "flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-xs text-muted-foreground border-t border-border mt-3 select-none",
        className
      )}
    >
      {/* Item Range Info */}
      <div className="flex items-center gap-1.5 font-medium">
        <span>
          Showing <span className="text-foreground font-semibold">{startItem}</span>–
          <span className="text-foreground font-semibold">{endItem}</span> of{" "}
          <span className="text-foreground font-semibold">{total}</span> {itemLabel}
        </span>
      </div>

      {/* Controls: Rows per page & Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        {onPerPageChange && (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Rows per page:</span>
            <Select
              value={String(perPage)}
              onValueChange={(v) => onPerPageChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-[68px] text-xs bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
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
          <Button
            variant="outline"
            size="icon"
            className="size-7 border-border hover:bg-muted"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>

          {visiblePages.map((p, idx) =>
            p === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-xs text-muted-foreground select-none"
              >
                …
              </span>
            ) : (
              <Button
                key={`page-${p}`}
                variant={p === page ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "size-7 text-xs",
                  p === page
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => onPageChange(Number(p))}
              >
                {p}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            className="size-7 border-border hover:bg-muted"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

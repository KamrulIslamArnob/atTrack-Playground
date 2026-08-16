"use client";

import Link from "next/link";
import { KanbanSquare, List } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InfoTooltip, StageTooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface JobViewHeaderProps {
  currentView: "board" | "list";
  onViewChange?: (view: "board" | "list") => void;
  children?: React.ReactNode;
  hideBreadcrumbRow?: boolean;
}

export function JobViewHeader({
  currentView,
  onViewChange,
  children,
  hideBreadcrumbRow,
}: JobViewHeaderProps) {
  const isBoard = currentView === "board";

  return (
    <PageHeader
      title={
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Toggle Switch */}
          <div
            role="tablist"
            aria-label="Job view switcher"
            className="inline-flex items-center rounded-xl bg-muted/70 p-1 border border-border/70 shadow-xs shrink-0"
          >
            {onViewChange ? (
              <button
                type="button"
                role="tab"
                aria-selected={isBoard}
                onClick={() => onViewChange("board")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer",
                  isBoard
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <KanbanSquare className="size-4 shrink-0" />
                <span>Board</span>
              </button>
            ) : (
              <Link
                href="/jobs?view=board"
                role="tab"
                aria-selected={isBoard}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97]",
                  isBoard
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <KanbanSquare className="size-4 shrink-0" />
                <span>Board</span>
              </Link>
            )}

            {onViewChange ? (
              <button
                type="button"
                role="tab"
                aria-selected={!isBoard}
                onClick={() => onViewChange("list")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer",
                  !isBoard
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <List className="size-4 shrink-0" />
                <span>List</span>
              </button>
            ) : (
              <Link
                href="/jobs?view=list"
                role="tab"
                aria-selected={!isBoard}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97]",
                  !isBoard
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium"
                )}
              >
                <List className="size-4 shrink-0" />
                <span>List</span>
              </Link>
            )}
          </div>

          {isBoard && (
            <InfoTooltip
              content={<StageTooltipContent />}
              side="right"
            />
          )}

          <p className="text-sm font-normal text-muted-foreground">
            {isBoard
              ? "Every job you're tracking, laid out in columns. Drag a card to move it to the next stage."
              : "Every job you've saved, in one list. Search, filter, and open any of them."}
          </p>
        </div>
      }
      hideBreadcrumbRow={hideBreadcrumbRow}
    >
      {children}
    </PageHeader>
  );
}

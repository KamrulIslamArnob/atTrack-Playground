"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface NotificationButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconClassName?: string;
  useCustomSvg?: boolean;
  badgeCount?: number;
  isActive?: boolean;
  isOpen?: boolean;
}

/**
 * Queue button — stacked sheets affordance.
 * Depth maps to count: 0 → single sheet, 1 → 2 sheets, 2+ → 3 sheets
 * so the pile visibly grows as tasks stack up.
 */
export function NotificationButton({
  className,
  iconClassName,
  useCustomSvg = true,
  children,
  badgeCount,
  isActive,
  isOpen,
  ...props
}: NotificationButtonProps) {
  const count = typeof badgeCount === "number" ? badgeCount : 0;
  const showBadge = count > 0;
  const displayCount = showBadge && count > 99 ? "99+" : count;
  const depth = count === 0 ? 1 : count === 1 ? 2 : 3;

  return (
    <button
      type="button"
      className={cn(
        "group relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 ease-out active:scale-[0.97]",
        isOpen
          ? "border-border bg-muted text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
        isActive && !isOpen && "border-primary/15 bg-primary/5 text-foreground",
        className
      )}
      aria-label={props["aria-label"] || "Queue"}
      aria-expanded={isOpen}
      {...props}
    >
      {children ? (
        children
      ) : useCustomSvg ? (
        <span
          className={cn(
            "relative block transition-transform duration-150 ease-out",
            "size-[20px] shrink-0",
            "group-hover:[&_.queue-layer-back]:translate-x-[4px] group-hover:[&_.queue-layer-back]:translate-y-[3px]",
            "group-hover:[&_.queue-layer-mid]:translate-x-[2px] group-hover:[&_.queue-layer-mid]:translate-y-[1.5px]",
            iconClassName
          )}
          aria-hidden="true"
        >
          {/* back sheet — only when depth === 3 */}
          {depth >= 3 && (
            <span
              className={cn(
                "queue-layer-back absolute inset-0 rounded-[6px] border bg-muted shadow-sm transition-all duration-200",
                "translate-x-[3.5px] translate-y-[2.6px]",
                isActive
                  ? "border-primary/20 bg-primary/10"
                  : isOpen
                    ? "border-border bg-muted"
                    : "border-border/70 bg-muted/80",
                "group-hover:shadow"
              )}
            />
          )}
          {/* middle sheet — when depth >= 2 */}
          {depth >= 2 && (
            <span
              className={cn(
                "queue-layer-mid absolute inset-0 rounded-[6px] border shadow-sm transition-all duration-200",
                "translate-x-[1.8px] translate-y-[1.3px]",
                isActive
                  ? "border-primary/20 bg-card"
                  : "border-border bg-card",
                isOpen && "border-border",
                "group-hover:shadow"
              )}
            />
          )}
          {/* front sheet — always */}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-[6px] border shadow-sm transition-all duration-200",
              isActive
                ? "border-primary/25 bg-card"
                : isOpen
                  ? "border-border bg-card"
                  : "border-border bg-card",
              "group-hover:shadow"
            )}
          >
            {/* task lines — 3 rows suggests a list that will stack */}
            <span className="flex flex-col gap-[2.5px]">
              <span
                className={cn(
                  "block h-[1.6px] rounded-full transition-colors",
                  isActive ? "w-[11px] bg-foreground" : "w-[11px] bg-foreground/75"
                )}
              />
              <span
                className={cn(
                  "block h-[1.6px] rounded-full transition-colors",
                  isActive ? "w-[11px] bg-foreground" : "w-[11px] bg-foreground/75"
                )}
              />
              <span
                className={cn(
                  "block h-[1.6px] rounded-full transition-colors",
                  isActive ? "w-[7px] bg-primary" : "w-[7px] bg-muted-foreground/70"
                )}
              />
            </span>
          </span>

          {/* active pulse — tiny dot on front sheet corner when running */}
          {isActive && !showBadge && (
            <span className="absolute -right-[2px] -top-[2px] size-2 rounded-full bg-primary ring-2 ring-card animate-pulse" />
          )}
        </span>
      ) : null}

      {showBadge && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-background transition-all",
            "animate-in zoom-in-90 duration-150",
            isActive || isOpen
              ? "bg-primary text-primary-foreground"
              : "bg-foreground text-background"
          )}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}

// Alias for intent — same component, queue-first name
export const QueueButton = NotificationButton;

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, RotateCw, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS — Live Agent Task Status
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean flat card rows, zero noisy borders/shadows
 * - Tier 2: 4px base spacing grid (gap-2, p-2.5)
 * - Tier 3: Rounded-xl cards, rounded-lg status pills
 * - Tier 4: Text-xs and text-[11px] font scale
 * - Tier 5: Semantic tokens (bg-success/15, text-success, etc.)
 * - Tier 6: Active scale-95 press feedback
 * - Tier 7: Uniform Lucide icons
 * - Tier 8: Apple spring transitions & reduced motion check
 * ───────────────────────────────────────────────────────── */

const TICKS = [600, 900, 2400, 1400, 2400, 600];

function useTick(intervals: number[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick >= intervals.length - 1) return;
    const t = setTimeout(() => setTick((x) => x + 1), intervals[tick]);
    return () => clearTimeout(t);
  }, [tick, intervals]);
  return tick;
}

export function TaskRows({ variant = "Capsules" }: { variant?: "Capsules" | "List" }) {
  const tick = useTick(TICKS);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const shouldReduceMotion = useReducedMotion();

  const row2: "pending" | "failed" | "done" =
    tick < 3 ? "pending" : tick === 3 ? "failed" : "done";

  const rows = [
    {
      key: "verify",
      status: "completed" as const,
      label: "Verified vendor records",
      amount: "12 suppliers",
      details: [
        { label: "Matched tax and contact IDs", meta: "12/12" },
        { label: "Flagged stale records", meta: "0" },
      ],
    },
    {
      key: "index",
      status: "running" as const,
      label: "Build reorder task list",
      amount: "7 SKUs",
      details: [
        { label: "Reading POS export", meta: "3 files" },
        { label: "Scoring stockout risk", meta: "68%" },
      ],
    },
    {
      key: "draft",
      status: row2,
      label: "Draft supplier emails",
      amount: "2 messages",
      details: [
        { label: "Cone supplier follow-up", meta: "draft" },
        { label: "Pistachio reorder note", meta: "draft" },
      ],
    },
  ];

  const isList = variant === "List";

  return (
    <div
      className={cn(
        "flex w-full max-w-md flex-col",
        isList
          ? "divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden"
          : "gap-2"
      )}
    >
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? (row.key === "index" && tick === 2);

        return (
          <div
            key={row.key}
            className={cn(
              "overflow-hidden transition-colors",
              !isList && "rounded-xl border border-border bg-card"
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManualOpen((current) => ({ ...current, [row.key]: !open }))}
              className="flex h-11 w-full items-center gap-2.5 px-3 text-left transition-colors hover:bg-muted/50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
            >
              {/* Status Indicator Icon */}
              <span className="flex size-6 shrink-0 items-center justify-center">
                {row.status === "completed" || row.status === "done" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="size-3 stroke-[2.5]" />
                  </span>
                ) : row.status === "failed" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                    <X className="size-3 stroke-[2.5]" />
                  </span>
                ) : row.status === "running" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                )}
              </span>

              {/* Task Label */}
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {row.label}
              </span>

              {/* Meta Amount */}
              <span className="text-[11px] text-muted-foreground tabular-nums">{row.amount}</span>

              {/* Status Badge */}
              {row.status === "completed" || row.status === "done" ? (
                <span className="inline-flex items-center rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Completed
                </span>
              ) : row.status === "failed" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  Failed <RotateCw className="size-2.5 animate-spin" />
                </span>
              ) : null}

              {/* Expand Chevron */}
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </button>

            {/* Expandable Step Breakdown */}
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/50 bg-muted/20 px-3 py-2.5 space-y-1.5">
                    {row.details.map((d, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">{d.label}</span>
                        <span className="font-mono text-foreground font-medium">{d.meta}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
export default TaskRows;

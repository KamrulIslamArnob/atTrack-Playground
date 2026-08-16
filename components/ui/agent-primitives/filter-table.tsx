"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * FILTER TABLE — Live Status Filter & Task Grid
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean flat table design, no superfluous shadow
 * - Tier 2: 4px spacing grid (p-2, gap-1.5)
 * - Tier 3: Rounded-2xl table container, rounded-xl chips, rounded-lg badges
 * - Tier 4: Text-xs cell fonts, text-[11px] headers and dates
 * - Tier 5: Semantic design tokens (text-success, bg-warning/10, etc.)
 * - Tier 6: Active scale-95 press feedback
 * - Tier 7: Uniform sizing
 * - Tier 8: Apple spring transitions & reduced motion check
 * ───────────────────────────────────────────────────────── */

type Status = "todo" | "progress" | "done";

const FILTERS: { key: "all" | Status; label: string; count: number }[] = [
  { key: "all", label: "All", count: 5 },
  { key: "todo", label: "To do", count: 2 },
  { key: "progress", label: "In Progress", count: 2 },
  { key: "done", label: "Completed", count: 1 },
];

const ROWS: { task: string; date: string; status: Status; owner: string }[] = [
  { task: "Prepare interview questions", date: "Dec 03", status: "todo", owner: "Senior Recruiter" },
  { task: "Review job description alignment", date: "Sep 22", status: "progress", owner: "AI Advisor" },
  { task: "Update salary benchmark ranges", date: "Jan 02", status: "todo", owner: "Career Coach" },
  { task: "Draft follow-up email sequence", date: "Nov 08", status: "progress", owner: "Job Tracker" },
  { task: "Submit tailored application packet", date: "Apr 14", status: "done", owner: "Hiring Manager" },
];

const STATUS_BADGES: Record<Status, { label: string; tint: string }> = {
  todo: { label: "To do", tint: "bg-warning/10 text-warning" },
  progress: { label: "In Progress", tint: "bg-info/10 text-info" },
  done: { label: "Completed", tint: "bg-success/10 text-success" },
};

export function FilterTable() {
  const [filter, setFilter] = useState<"all" | Status>("all");
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="w-full max-w-lg space-y-2.5">
      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{f.label}</span>
              <span
                className={cn(
                  "rounded-md px-1 py-0.2 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task Grid Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="min-w-[420px]">
          {/* Header Row */}
          <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr] border-b border-border bg-muted/40 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>Task name</span>
            <span>Date</span>
            <span>Status</span>
            <span>Advisor</span>
          </div>

          {/* Body Rows */}
          <div className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {ROWS.map((row) => {
                const shown = filter === "all" || row.status === filter;
                if (!shown) return null;

                const badge = STATUS_BADGES[row.status];

                return (
                  <motion.div
                    key={row.task}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-[1.4fr_0.6fr_0.9fr_0.9fr] items-center px-3.5 py-2.5 text-xs transition-colors hover:bg-muted/40">
                      <span className="truncate font-medium text-foreground">{row.task}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{row.date}</span>
                      <span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                            badge.tint
                          )}
                        >
                          {badge.label}
                        </span>
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{row.owner}</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
export default FilterTable;

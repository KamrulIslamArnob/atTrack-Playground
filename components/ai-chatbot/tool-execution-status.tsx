"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Check,
  Loader2,
  Sparkles,
  FileText,
  Briefcase,
  Code2,
  Database,
  Search,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

const EASE = [0.23, 1, 0.32, 1] as const;

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail?: string;
  duration?: string;
  iconType?: "resume" | "job" | "github" | "search" | "database" | "ai";
}

export interface ToolExecutionStatusProps {
  steps?: ToolExecutionStep[];
  sources?: string[];
  isStreaming?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

export function ToolExecutionStatus({
  steps,
  sources,
  isStreaming = false,
  className,
  defaultExpanded = false,
}: ToolExecutionStatusProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const reduceMotion = useReducedMotion();

  // Derive execution steps from REAL server-supplied steps only. No hardcoded
  // fallback list — if the server didn't report tool calls, render nothing.
  const derivedSteps: ToolExecutionStep[] = React.useMemo(() => {
    if (steps && steps.length > 0) return steps;
    if (!sources || sources.length === 0) return [];
    // If only source labels arrived (no per-tool steps), show them as completed
    // entries without inventing an "Analyzing context" running step.
    return sources.map((src, idx) => {
      const lower = src.toLowerCase();
      let iconType: ToolExecutionStep["iconType"] = "database";
      if (lower.includes("resume") || lower.includes("doc")) iconType = "resume";
      else if (lower.includes("job") || lower.includes("app")) iconType = "job";
      else if (lower.includes("github") || lower.includes("code")) iconType = "github";
      else if (lower.includes("search")) iconType = "search";
      return { id: `source-${idx}`, label: src, status: "completed", iconType };
    });
  }, [steps, sources]);

  const completedCount = derivedSteps.filter((s) => s.status === "completed").length;
  const isRunning = derivedSteps.some((s) => s.status === "running");

  if (derivedSteps.length === 0) return null;

  return (
    <div className={cn("my-2 overflow-hidden rounded-xl border border-border/40 bg-muted/30 dark:bg-muted/15", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="flex size-4 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"
          >
            <ChevronRight className="size-3" />
          </motion.div>

          <span className="flex items-center gap-1.5 font-medium">
            {isRunning ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span className="text-foreground">Executing workspace tools...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-primary" />
                <span>Used {completedCount} workspace {completedCount === 1 ? "source" : "sources"}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          {isRunning ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
              Live
            </span>
          ) : (
            <span className="tabular-nums font-mono text-[10px] opacity-80">
              {completedCount}/{derivedSteps.length} ready
            </span>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden border-t border-border/30 bg-card/40 px-3 py-2.5"
          >
            <div className="space-y-1.5">
              {derivedSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <StepIcon status={step.status} iconType={step.iconType} />
                    <span
                      className={cn(
                        "truncate font-medium",
                        step.status === "completed" && "text-foreground",
                        step.status === "running" && "text-primary font-semibold animate-pulse",
                        step.status === "pending" && "text-muted-foreground/60",
                        step.status === "failed" && "text-destructive font-medium"
                      )}
                    >
                      {step.status === "completed" ? `✓ ${step.label}` : step.label}
                    </span>
                  </div>

                  {step.detail && (
                    <span className="ml-2 truncate text-[11px] text-muted-foreground/70">
                      {step.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepIcon({
  status,
  iconType,
}: {
  status: ToolExecutionStep["status"];
  iconType?: ToolExecutionStep["iconType"];
}) {
  if (status === "running") {
    return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />;
  }

  if (status === "failed") {
    return <AlertCircle className="size-3.5 shrink-0 text-destructive" />;
  }

  if (status === "pending") {
    return <div className="size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />;
  }

  // Completed
  switch (iconType) {
    case "resume":
      return <FileText className="size-3.5 shrink-0 text-primary" />;
    case "job":
      return <Briefcase className="size-3.5 shrink-0 text-primary" />;
    case "github":
      return <Code2 className="size-3.5 shrink-0 text-primary" />;
    case "search":
      return <Search className="size-3.5 shrink-0 text-primary" />;
    default:
      return <Check className="size-3.5 shrink-0 text-primary font-bold" />;
  }
}

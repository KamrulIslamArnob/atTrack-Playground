"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown, Loader2, Briefcase, Code2, Database, AlertCircle } from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { SparklesIcon } from "@/components/ui/sparkles";
import { FileTextIcon } from "@/components/ui/file-text";
import { SearchIcon } from "@/components/ui/search";
import { useReducedMotion } from "motion/react";

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  /** JSON-encoded call arguments, rendered as the inline chip. */
  detail?: string;
  /** What the tool returned, revealed when the row is expanded. */
  result?: string;
  error?: string;
  duration?: string;
  iconType?: "resume" | "job" | "github" | "search" | "database" | "ai";
  /** How the answer got this data. `tool` is a function the model chose to
   *  call; `source` is workspace data retrieval pre-fetched before the model
   *  ran. Both are provenance and both belong in the trace. */
  kind?: "tool" | "source";
}

function iconTypeForSource(label: string): ToolExecutionStep["iconType"] {
  const lower = label.toLowerCase();
  if (lower.includes("resume") || lower.includes("doc")) return "resume";
  if (lower.includes("job") || lower.includes("app")) return "job";
  if (lower.includes("github") || lower.includes("code")) return "github";
  if (lower.includes("search")) return "search";
  return "database";
}

export interface ToolExecutionStatusProps {
  steps?: ToolExecutionStep[];
  sources?: string[];
  isStreaming?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

/** `search_jobs` -> `Search jobs`. Tool names are snake_case identifiers; the
 *  trace is user-facing, so show them as words. */
function humanizeToolName(name: string): string {
  const words = name.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Picks the one argument worth showing inline. A tool call's full JSON is
 *  noise in a one-line chip — the query or id is the part a reader scans for. */
function summarizeArgs(detail?: string): string | null {
  if (!detail) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(detail) as Record<string, unknown>;
  } catch {
    return detail.slice(0, 80);
  }

  const entries = Object.entries(parsed).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) return null;

  const preferred = ["query", "q", "search", "name", "title", "id", "sql"];
  const hit = entries.find(([key]) => preferred.includes(key.toLowerCase()));
  const [key, value] = hit ?? entries[0];
  const rendered = typeof value === "string" ? value : JSON.stringify(value);

  // A preferred key speaks for itself ("senior react roles"); anything else
  // needs its name or the chip is a bare, meaningless value ("50").
  const text = hit ? rendered : `${key}: ${rendered}`;
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

/** Result payloads are whole documents; the trace shows the first few lines as
 *  evidence, not the entire body. */
function resultPreview(result?: string): string[] {
  if (!result) return [];
  return result
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((line) => (line.length > 110 ? `${line.slice(0, 110)}…` : line));
}

/**
 * The agent trace: a collapsed one-line header that shimmers while tools run
 * and settles once they finish, over an expandable list of the calls made.
 * Each row expands again to show what that tool actually returned.
 */
export function ToolExecutionStatus({
  steps,
  sources,
  isStreaming = false,
  className,
  defaultExpanded = false,
}: ToolExecutionStatusProps) {
  const reduceMotion = useReducedMotion();
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(
    defaultExpanded ? true : null
  );
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  // Tool calls and retrieved sources arrive on separate SSE frames and are
  // BOTH provenance for the answer. Merge them: treating them as either/or
  // silently hid the retrieved sources whenever the model also called a tool.
  // Everything here is server-supplied — nothing is invented when a frame is
  // absent.
  const derivedSteps: ToolExecutionStep[] = React.useMemo(() => {
    const toolRows: ToolExecutionStep[] = (steps ?? []).map((step) => ({
      ...step,
      kind: "tool",
    }));

    const sourceRows: ToolExecutionStep[] = (sources ?? []).map((src, idx) => ({
      id: `source-${idx}`,
      label: src,
      status: "completed",
      kind: "source",
      iconType: iconTypeForSource(src),
    }));

    return [...toolRows, ...sourceRows];
  }, [steps, sources]);

  const toolCount = derivedSteps.filter((s) => s.kind === "tool").length;
  const sourceCount = derivedSteps.filter((s) => s.kind === "source").length;
  const isRunning = isStreaming || derivedSteps.some((s) => s.status === "running");

  // Open while work is happening, settle closed once it lands — unless the
  // reader has taken control, whose choice then sticks.
  const expanded = manualExpanded ?? isRunning;

  // The connector line is drawn as an absolutely-positioned rule, so it has to
  // be measured rather than stretched — its height follows the trace content.
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [derivedSteps.length, expanded, openRows]);

  if (derivedSteps.length === 0) return null;

  const toggleRow = (id: string) =>
    setOpenRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Name each kind for what it is. Calling a tool call a "workspace source"
  // (the previous wording) misreports what the answer actually did.
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const settledLabel =
    toolCount > 0 && sourceCount > 0
      ? `Ran ${plural(toolCount, "tool")} · read ${plural(sourceCount, "source")}`
      : toolCount > 0
        ? `Ran ${plural(toolCount, "tool")}`
        : `Used ${plural(sourceCount, "workspace source")}`;

  const headerLabel = isRunning ? "Running workspace tools" : settledLabel;

  return (
    <div className={cn("my-1.5 flex w-full flex-col", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => !(current ?? isRunning))}
        className="micro-press -mx-1.5 flex w-fit items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
      >
        {isRunning ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}

        <span
          className={cn(
            "whitespace-nowrap text-[13px] font-medium",
            isRunning ? "agent-shimmer" : "agent-fade-up text-muted-foreground"
          )}
        >
          {headerLabel}
        </span>

        {!isRunning && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {derivedSteps.length}
          </span>
        )}

        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-300",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expandable trace. grid-template-rows 0fr -> 1fr animates to the
          content's natural height without measuring it. */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "var(--ease-out-quint)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative ml-[5px] mt-1 pl-4">
            <span
              aria-hidden="true"
              className="absolute left-[3px] w-px bg-border"
              style={{
                top: -6,
                height: lineHeight ? lineHeight - 2 : 0,
                transition: reduceMotion
                  ? undefined
                  : "height var(--duration-slower) var(--ease-out-quint)",
              }}
            />

            <div ref={traceRef} className="flex flex-col gap-0.5 py-1">
              {derivedSteps.map((step, i) => {
                const isSource = step.kind === "source";
                // Retrieval labels are already display text ("Job
                // Applications"); only tool identifiers need humanizing.
                const rowLabel = isSource ? step.label : humanizeToolName(step.label);
                const chip = isSource ? null : summarizeArgs(step.detail);
                const preview = resultPreview(step.result);
                const canExpand = preview.length > 0 || Boolean(step.error);
                const rowOpen = openRows.has(step.id);

                return (
                  <div
                    key={step.id}
                    className={reduceMotion ? undefined : "agent-fade-up"}
                    style={
                      reduceMotion
                        ? undefined
                        : { animationDelay: `${Math.min(i, 6) * 60}ms` }
                    }
                  >
                    <button
                      type="button"
                      disabled={!canExpand}
                      aria-expanded={canExpand ? rowOpen : undefined}
                      onClick={() => canExpand && toggleRow(step.id)}
                      className={cn(
                        "group/row -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors",
                        canExpand ? "hover:bg-muted/60" : "cursor-default"
                      )}
                    >
                      <span className="relative flex size-4 shrink-0 items-center justify-center">
                        <StepIcon
                          status={step.status}
                          iconType={step.iconType}
                          className={cn(
                            "transition-opacity duration-100",
                            canExpand && "group-hover/row:opacity-0",
                            canExpand && rowOpen && "opacity-0"
                          )}
                        />
                        {canExpand && (
                          <ChevronDown
                            className={cn(
                              "absolute size-3 text-muted-foreground transition-[opacity,transform] duration-150",
                              rowOpen
                                ? "rotate-0 opacity-100"
                                : "-rotate-90 opacity-0 group-hover/row:opacity-100"
                            )}
                          />
                        )}
                      </span>

                      <span
                        className={cn(
                          "min-w-0 truncate text-[12.5px]",
                          isSource ? "font-normal text-muted-foreground" : "shrink-0 font-medium",
                          step.status === "failed" && "text-destructive",
                          !isSource && step.status !== "failed" && "text-foreground"
                        )}
                      >
                        {rowLabel}
                      </span>

                      {/* Chip is sized to its content, capped so a long query
                          truncates instead of pushing the row wide. */}
                      {chip && (
                        <span className="inline-flex h-5 min-w-0 max-w-[65%] items-center truncate rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                          {chip}
                        </span>
                      )}
                    </button>

                    {canExpand && (
                      <div
                        className="grid transition-[grid-template-rows,opacity] duration-300"
                        style={{
                          gridTemplateRows: rowOpen ? "1fr" : "0fr",
                          opacity: rowOpen ? 1 : 0,
                          transitionTimingFunction: "var(--ease-out-quint)",
                        }}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="mb-1 ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-border py-0.5 pl-3.5">
                            {step.error ? (
                              <span className="text-[11.5px] leading-relaxed text-destructive">
                                {step.error}
                              </span>
                            ) : (
                              preview.map((line, idx) => (
                                <span
                                  key={idx}
                                  className="truncate text-[11.5px] leading-relaxed text-muted-foreground"
                                >
                                  {line}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIcon({
  status,
  iconType,
  className,
}: {
  status: ToolExecutionStep["status"];
  iconType?: ToolExecutionStep["iconType"];
  className?: string;
}) {
  const base = cn("size-3.5 shrink-0", className);

  if (status === "running") {
    return <Loader2 className={cn(base, "animate-spin text-muted-foreground")} />;
  }

  if (status === "failed") {
    return <AlertCircle className={cn(base, "text-destructive")} />;
  }

  if (status === "pending") {
    return (
      <span
        className={cn(
          "size-3 shrink-0 rounded-full border border-dashed border-muted-foreground/40",
          className
        )}
      />
    );
  }

  switch (iconType) {
    case "resume":
      return <FileTextIcon className={cn(base, "text-muted-foreground")} />;
    case "job":
      return <Briefcase className={cn(base, "text-muted-foreground")} />;
    case "github":
      return <Code2 className={cn(base, "text-muted-foreground")} />;
    case "search":
      return <SearchIcon className={cn(base, "text-muted-foreground")} />;
    case "database":
      return <Database className={cn(base, "text-muted-foreground")} />;
    default:
      return <CheckIcon className={cn(base, "text-muted-foreground")} />;
  }
}

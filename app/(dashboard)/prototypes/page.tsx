"use client";

import * as React from "react";
import { Building2, Brain, CheckCircle2, ListTodo, Table, Filter, Loader } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { CheckIcon } from "@/components/ui/check";
import { MessageSquareIcon } from "@/components/ui/message-square";
import { cn } from "@/lib/utils";
import {
  ThinkingState,
  ApprovalCard,
  TaskRows,
  PromptBar,
  RecordsTable,
  FilterTable,
  LoadingState,
} from "@/components/ui/agent-primitives";

type VariantKey = "quiet" | "apple" | "tactile";
type PrimitiveKey = "thinking" | "approval" | "tasks" | "prompt" | "records" | "filter" | "loading";

interface VariantOption {
  id: VariantKey;
  name: string;
  axis: string;
  tradeoff: string;
}

const VARIANTS: VariantOption[] = [
  {
    id: "quiet",
    name: "Quiet",
    axis: "Minimal Motion & Flat Borders",
    tradeoff: "Daily-use utility tool; zero distraction, restrained 140ms ease-out.",
  },
  {
    id: "apple",
    name: "Apple Fluid",
    axis: "Translucent Materials & Spring Physics",
    tradeoff: "Glassmorphism, spring physics, light-catch borders, continuous feedback.",
  },
  {
    id: "tactile",
    name: "Tactile Push",
    axis: "3D Physical Press & High Tactility",
    tradeoff: "Interactive 3D push states, rich feedback, highly memorable.",
  },
];

const PRIMITIVES: { id: PrimitiveKey; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "thinking", name: "Thinking State", icon: Brain },
  { id: "approval", name: "Approval Card", icon: CheckCircle2 },
  { id: "tasks", name: "Task Rows", icon: ListTodo },
  { id: "prompt", name: "Prompt Bar", icon: MessageSquareIcon },
  { id: "records", name: "Records Table", icon: Table },
  { id: "filter", name: "Filter Table", icon: Filter },
  { id: "loading", name: "Loading State", icon: Loader },
];

export default function PrototypesPage() {
  const [activeVariant, setActiveVariant] = React.useState<VariantKey>("apple");
  const [activePrimitive, setActivePrimitive] = React.useState<PrimitiveKey>("thinking");
  const [thinkingVariant, setThinkingVariant] = React.useState<"Steps" | "Reasoning" | "Search" | "Coding">("Steps");

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-10 font-sans text-foreground space-y-10">
      {/* ── Section 1: Agent UI Primitives (10-Tier Impeccable Design) ── */}
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
            <SparklesIcon className="size-3.5" />
            <span>Interactive Agent Primitives</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
            AI Agent UI Component Kit
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Polished interactive components built according to 10-Tier craft standards: expandable traces, human approvals, task matrices, and adaptive composers.
          </p>
        </div>

        {/* Primitive Switcher Bar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5">
          {PRIMITIVES.map((p) => {
            const isActive = activePrimitive === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePrimitive(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Active Primitive Sandbox Stage */}
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-card/40 p-4 sm:p-8">
          {activePrimitive === "thinking" && (
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center gap-1.5 border-b border-border pb-3">
                {(["Steps", "Reasoning", "Search", "Coding"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setThinkingVariant(mode)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                      thinkingVariant === mode
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <ThinkingState variant={thinkingVariant} />
            </div>
          )}

          {activePrimitive === "approval" && <ApprovalCard />}
          {activePrimitive === "tasks" && <TaskRows variant="Capsules" />}
          {activePrimitive === "prompt" && <PromptBar variant="Rounded" />}
          {activePrimitive === "records" && <RecordsTable />}
          {activePrimitive === "filter" && <FilterTable />}
          {activePrimitive === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <LoadingState label="Analyzing job fits" variant="Drive" />
              <LoadingState label="Indexing skills" variant="Dots" />
              <LoadingState label="Syncing database" variant="Orbit" />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Motion Design Variants ── */}
      <div className="mx-auto max-w-4xl space-y-6 pt-6 border-t border-border">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            UI & Motion Design Variants
          </h2>
          <p className="text-xs text-muted-foreground">
            Flip between three UI directions to explore interaction models, translucent depth, and tactile feedback.
          </p>
        </div>

        {/* Variant Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {VARIANTS.map((v) => {
              const isActive = activeVariant === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveVariant(v.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && <CheckIcon className="size-3.5" />}
                  <span>{v.name}</span>
                </button>
              );
            })}
          </div>
          <div className="px-3 text-xs text-muted-foreground font-mono">
            Active: <span className="font-semibold text-foreground">{activeVariant}</span>
          </div>
        </div>

        {/* Current Variant Explanation Card */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs space-y-1">
          <div className="font-semibold text-foreground">
            Axis: {VARIANTS.find((v) => v.id === activeVariant)?.axis}
          </div>
          <div className="text-muted-foreground">
            {VARIANTS.find((v) => v.id === activeVariant)?.tradeoff}
          </div>
        </div>

        {/* Render Variant Showcase */}
        <div className="rounded-2xl border border-border bg-background p-6 md:p-10 flex items-center justify-center min-h-[340px]">
          {activeVariant === "quiet" && (
            <div className="w-full max-w-md space-y-3.5 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Quiet Direction
                  </span>
                  <h3 className="mt-2 text-base font-bold text-foreground">Senior Frontend Engineer</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="size-3.5" /> Stripe • San Francisco, CA
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">94% Match</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Restrained layout with sharp contrast, zero unnecessary animations, and 140ms ease-out transitions for rapid daily productivity.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-xl border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-95 cursor-pointer"
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95 cursor-pointer"
                >
                  Apply Now
                </button>
              </div>
            </div>
          )}

          {activeVariant === "apple" && (
            <div className="w-full max-w-md space-y-3.5 rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xl p-5 shadow-xs transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                    Apple Fluid Direction
                  </span>
                  <h3 className="mt-2 text-base font-bold text-foreground">Design Engineer</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="size-3.5" /> Apple • Cupertino, CA
                  </p>
                </div>
                <span className="rounded-full bg-success/15 text-success px-2.5 py-0.5 text-xs font-bold">
                  98% Match
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Translucent glass surfaces with backdrop blur, iOS spring dynamics, light-catch top border, and continuous feedback.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-xl border border-border bg-background/50 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all active:scale-95 hover:bg-muted cursor-pointer"
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs transition-all active:scale-95 hover:bg-primary/90 cursor-pointer"
                >
                  Apply Now
                </button>
              </div>
            </div>
          )}

          {activeVariant === "tactile" && (
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Tactile Push Direction
                  </span>
                  <h3 className="mt-2 text-base font-bold text-foreground">Full Stack Developer</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="size-3.5" /> Vercel • Remote
                  </p>
                </div>
                <span className="rounded-lg bg-warning/15 border border-warning/30 px-2 py-0.5 text-xs font-bold text-warning">
                  92% Match
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                3D depth and physical pushable button states with momentum spring animations. Instant tactile responsiveness on every click.
              </p>
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-border bg-muted/60 py-2 text-xs font-semibold text-foreground active:scale-95 transition-transform cursor-pointer"
                >
                  Details
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground active:scale-95 transition-transform cursor-pointer"
                >
                  Apply Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

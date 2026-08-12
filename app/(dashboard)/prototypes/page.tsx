"use client";

import * as React from "react";
import { Sparkles, Building2, Calendar, MapPin, ExternalLink, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type VariantKey = "quiet" | "apple" | "tactile";

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
    tradeoff: "Glassmorphism, spring physics, light-catch borders, continuous feedback.",
    axis: "Translucent Materials & Spring Physics",
  },
  {
    id: "tactile",
    name: "Tactile Push",
    tradeoff: "Interactive 3D push states, rich feedback, highly memorable.",
    axis: "3D Physical Press & High Tactility",
  },
];

export default function PrototypesPage() {
  const [activeVariant, setActiveVariant] = React.useState<VariantKey>("apple");

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans text-foreground">
      {/* Header & Description */}
      <div className="mx-auto max-w-4xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          <span>Interactive UI Prototype Harness (emi-prototype)</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl font-heading">
          UI & Motion Design Variants
        </h1>
        <p className="text-sm text-muted-foreground">
          Flip between three genuinely different UI directions live to explore interaction models, translucent depth, and physical press feedback.
        </p>
      </div>

      {/* Harness Control Switcher Bar */}
      <div className="mx-auto mt-8 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {VARIANTS.map((v) => {
              const isActive = activeVariant === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveVariant(v.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 ease-out select-none",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {isActive && <Check className="size-3.5" />}
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
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs space-y-1">
          <div className="font-semibold text-foreground">
            Axis: {VARIANTS.find((v) => v.id === activeVariant)?.axis}
          </div>
          <div className="text-muted-foreground">
            {VARIANTS.find((v) => v.id === activeVariant)?.tradeoff}
          </div>
        </div>
      </div>

      {/* Render Active Variant Component */}
      <div className="mx-auto mt-8 max-w-4xl">
        <div className="rounded-3xl border border-border bg-background p-6 md:p-10 shadow-xs flex items-center justify-center min-h-[380px]">
          {activeVariant === "quiet" && (
            <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 transition-[border-color] duration-140 ease-out hover:border-foreground/30">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Quiet Direction
                  </span>
                  <h2 className="mt-2 text-lg font-bold text-foreground">Senior Frontend Engineer</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Building2 className="size-3.5" /> Stripe • San Francisco, CA
                  </p>
                </div>
                <span className="text-xs font-semibold text-primary">94% Match</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Restrained layout with sharp contrast, zero unnecessary animations, and 140ms ease-out transitions for rapid daily productivity.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <button className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition-colors duration-140 hover:bg-muted active:bg-muted/80">
                  View Details
                </button>
                <button className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity duration-140 hover:opacity-90 active:opacity-100">
                  Apply Now
                </button>
              </div>
            </div>
          )}

          {activeVariant === "apple" && (
            <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/20 dark:border-white/10 bg-card/70 backdrop-blur-xl p-6 shadow-xl transition-[transform,box-shadow] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    Apple Fluid Direction
                  </span>
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground font-heading">
                    Design Engineer
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Building2 className="size-3.5" /> Apple • Cupertino, CA
                  </p>
                </div>
                <span className="rounded-full bg-gradient-to-r from-lime-400 to-lime-500 px-3 py-1 text-xs font-bold text-black shadow-xs">
                  98% Match
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Translucent glass surfaces with <code className="font-mono text-primary">backdrop-filter</code>, iOS spring dynamics, light-catch top border, and continuous feedback.
              </p>
              <div className="pt-2 flex items-center justify-between">
                <button className="rounded-xl border border-border bg-background/50 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-foreground transition-[transform,background-color] duration-160 ease-out active:scale-[0.96] hover:bg-muted">
                  View Details
                </button>
                <button className="rounded-xl bg-gradient-brand px-5 py-2.5 text-xs font-bold text-black shadow-md transition-[transform,box-shadow] duration-160 ease-out active:scale-[0.96] hover:shadow-lg">
                  Apply Now
                </button>
              </div>
            </div>
          )}

          {activeVariant === "tactile" && (
            <div className="w-full max-w-md space-y-5 rounded-3xl border border-border bg-card p-6 shadow-md transition-all duration-200 hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-bold text-indigo-500">
                    Tactile Push Direction
                  </span>
                  <h2 className="mt-3 text-lg font-bold text-foreground">Full Stack Developer</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Building2 className="size-3.5" /> Vercel • Remote
                  </p>
                </div>
                <span className="rounded-xl bg-amber-400/20 border border-amber-500/30 px-2.5 py-1 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  92% Match
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                3D depth and physical pushable button states with momentum spring animations. Instant tactile responsiveness on every click.
              </p>
              <div className="pt-2 flex items-center justify-between gap-3">
                <button className="pushable-status flex-1">
                  <span className="pushable-shadow" />
                  <span className="pushable-edge" />
                  <span className="pushable-front w-full justify-center">Details</span>
                </button>
                <button className="pushable-apply flex-1">
                  <span className="pushable-shadow" />
                  <span className="pushable-edge" />
                  <span className="pushable-front w-full justify-center">Apply Now</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

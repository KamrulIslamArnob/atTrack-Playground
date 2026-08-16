"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — Pixel-Grid Loader with Elapsed Timer
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean flat layout, zero unnecessary glow
 * - Tier 2: 4px spacing rhythm (gap-2, p-1)
 * - Tier 3: Rounded-lg pixel cells
 * - Tier 4: Text-xs label, text-[11px] font-mono timer
 * - Tier 5: Semantic design tokens (text-foreground, bg-foreground)
 * - Tier 8: Smooth frame cycles & reduced-motion fallback
 * ───────────────────────────────────────────────────────── */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3),
    c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS: Record<string, { delays: (number | null)[]; dur: number; round: boolean }> = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function LoadingState({
  label = "Processing",
  variant = "Drive",
}: {
  label?: string;
  variant?: "Drive" | "Dots" | "Orbit";
}) {
  const elapsed = useElapsed();
  const shouldReduceMotion = useReducedMotion();
  const { delays, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  return (
    <div className="flex w-fit items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs">
      {/* Pixel Grid Matrix */}
      {shouldReduceMotion ? (
        <Loader2 className="size-3.5 animate-spin text-primary" />
      ) : (
        <span aria-hidden className="grid grid-cols-3 gap-0.5">
          {delays.map((d, i) => (
            <span
              key={i}
              className={cn(
                "size-1 bg-foreground transition-opacity",
                round ? "rounded-full" : "rounded-xs"
              )}
              style={{
                opacity: d === null ? 0.15 : 0.4,
                animation: d === null ? "none" : `pulse 1.2s ease-in-out ${d}ms infinite`,
              }}
            />
          ))}
        </span>
      )}

      {/* Action Label */}
      <span className="text-xs font-semibold text-foreground">{label}</span>

      {/* Live Timer */}
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {elapsed}
      </span>
    </div>
  );
}
export default LoadingState;

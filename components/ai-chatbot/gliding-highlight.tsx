"use client";

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface GlidingHighlightProps {
  /** Row elements the highlight can land on, indexed to match `activeIndex`. */
  rowRefs: RefObject<(HTMLElement | null)[]>;
  activeIndex: number;
  /** Hidden until the list is engaged, so an untouched menu shows no selection. */
  visible: boolean;
  /** Re-measure when these change (row count, filter query, open state). */
  deps?: unknown[];
  className?: string;
}

/**
 * One highlight pill that slides between menu rows, instead of every row
 * toggling its own background. The movement is what communicates "this is a
 * single selection moving", which per-row backgrounds cannot express.
 *
 * Position is measured rather than computed: rows differ in height, and the
 * menu is filtered live, so offsets are only knowable after layout.
 */
export function GlidingHighlight({
  rowRefs,
  activeIndex,
  visible,
  deps = [],
  className,
}: GlidingHighlightProps) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  // Deliberately useEffect, not useLayoutEffect. The rows attach themselves via
  // inline ref callbacks, which React recreates every render — so it detaches
  // them (writing null into every slot) and re-attaches during commit. A layout
  // effect on this component runs BEFORE those re-attachments and would measure
  // null forever. Passive effects run after refs are attached.
  //
  // `visible` is a dependency so the highlight measures at the moment it is
  // first revealed, whatever happened on earlier renders.
  useEffect(() => {
    const target = rowRefs.current?.[activeIndex];
    if (target) setBox({ top: target.offsetTop, height: target.offsetHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, visible, rowRefs, ...deps]);

  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-1 rounded-lg bg-muted", className)}
      style={{
        top: box?.top ?? 0,
        height: box?.height ?? 0,
        opacity: box && visible ? 1 : 0,
        transition:
          "top var(--duration-base) var(--ease-out-quint), height var(--duration-base) var(--ease-out-quint), opacity var(--duration-instant) ease",
      }}
    />
  );
}

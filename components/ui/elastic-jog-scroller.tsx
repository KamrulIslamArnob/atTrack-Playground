"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollerStage {
  id: string;
  name: string;
  count?: number;
  color?: string | null;
}

interface ElasticJogScrollerProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  stages?: ScrollerStage[];
  activeStageId?: string;
  onSelectStage?: (id: string) => void;
  className?: string;
}

// 12 precision dial tick angles for rotary mechanical dial
const DIAL_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

export function ElasticJogScroller({
  scrollRef,
  stages = [],
  activeStageId,
  onSelectStage,
  className,
}: ElasticJogScrollerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeStage, setActiveStage] = useState<ScrollerStage | null>(null);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(22);

  const trackRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);

  // Motion values for elastic spring responsiveness
  const dialRotation = useMotionValue(0);
  const smoothRotation = useSpring(dialRotation, {
    stiffness: shouldReduceMotion ? 1000 : 460,
    damping: 28,
    mass: 0.7,
  });

  const elasticThumbOffset = useMotionValue(0);
  const smoothThumbOffset = useSpring(elasticThumbOffset, {
    stiffness: shouldReduceMotion ? 1000 : 520,
    damping: 30,
  });

  const isPointerDown = useRef(false);
  const dragMode = useRef<"dial" | "track" | null>(null);
  const lastPointerX = useRef(0);

  // Sync scroll position & dimensions from scrollRef
  const updateFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(1, el.scrollWidth - el.clientWidth);
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScroll(hasOverflow);

    // Dynamic thumb width based on viewport visibility ratio (min 16%, max 45%)
    const visibleRatio = el.clientWidth / (el.scrollWidth || 1);
    const calculatedWidth = Math.min(45, Math.max(16, visibleRatio * 100));
    setThumbWidthPercent(calculatedWidth);

    const progress = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));
    setScrollProgress(progress);

    // Continuous spin degree based on scrollLeft pixels (1 revolution per 320px)
    const deg = (el.scrollLeft / 320) * 360;
    dialRotation.set(deg);

    // Track active stage
    if (stages.length > 0) {
      if (activeStageId) {
        const found = stages.find((s) => s.id === activeStageId);
        if (found) setActiveStage(found);
      } else {
        const idx = Math.min(
          stages.length - 1,
          Math.max(0, Math.round(progress * (stages.length - 1)))
        );
        setActiveStage(stages[idx] ?? null);
      }
    }
  }, [scrollRef, stages, activeStageId, dialRotation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFromScroll();
    const observer = new ResizeObserver(updateFromScroll);
    observer.observe(el);
    el.addEventListener("scroll", updateFromScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateFromScroll);
    };
  }, [scrollRef, updateFromScroll]);

  // Handle Drag on Rotary Dial
  const handleDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    dragMode.current = "dial";
    lastPointerX.current = e.clientX;
    setIsDragging(true);
  };

  // Handle Track Drag
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || !scrollRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    dragMode.current = "track";
    setIsDragging(true);

    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
    scrollRef.current.scrollLeft = ratio * maxScroll;
    lastPointerX.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || !scrollRef.current) return;
    const deltaX = e.clientX - lastPointerX.current;
    lastPointerX.current = e.clientX;

    if (dragMode.current === "dial") {
      // Speed multiplier for dial
      const scrollDelta = deltaX * 2.2;
      scrollRef.current.scrollLeft += scrollDelta;
    } else if (dragMode.current === "track" && trackRef.current) {
      // Direct track scrub ratio
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = ratio * maxScroll;
    }

    // Elastic rubber-banding if dragging past edges
    const atStart = scrollRef.current.scrollLeft <= 0 && deltaX < 0;
    const atEnd =
      scrollRef.current.scrollLeft >=
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 1 &&
      deltaX > 0;

    if (atStart || atEnd) {
      const currentOffset = elasticThumbOffset.get();
      elasticThumbOffset.set(currentOffset + deltaX * 0.35);
    } else {
      elasticThumbOffset.set(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDown.current = false;
    dragMode.current = null;
    setIsDragging(false);
    elasticThumbOffset.set(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard navigation on Jog Scroller
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const step = 200;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: -step, behavior: "smooth" });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: step, behavior: "smooth" });
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    } else if (e.key === "End") {
      e.preventDefault();
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
    }
  };

  // Handle stage jump
  const handleStageClick = (stage: ScrollerStage, idx: number) => {
    if (onSelectStage) {
      onSelectStage(stage.id);
      return;
    }
    if (!scrollRef.current) return;
    const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
    const targetScroll = (idx / Math.max(1, stages.length - 1)) * maxScroll;
    scrollRef.current.scrollTo({ left: targetScroll, behavior: "smooth" });
  };

  // Mouse wheel over widget to scroll board
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    scrollRef.current.scrollLeft += delta * 1.5;
  };

  if (!canScroll && stages.length <= 1) return null;

  const activeLabel = activeStage?.name || stages[0]?.name || "Board";

  return (
    <aside
      aria-label="Horizontal board scroller"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex justify-center select-none",
        className
      )}
    >
      <motion.div
        role="slider"
        tabIndex={0}
        aria-label="Horizontal scroll navigator"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${activeLabel} (${Math.round(scrollProgress * 100)}%)`}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-background/80 dark:bg-card/75 px-1.5 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.1)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] backdrop-blur-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 hover:border-border hover:shadow-xl",
          isDragging && "ring-2 ring-primary/40 shadow-2xl scale-[1.02]"
        )}
      >
        {/* Precision Knurled Rotary Jog Dial */}
        <div
          ref={dialRef}
          onPointerDown={handleDialPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Drag to spin & scrub horizontally"
          className="group relative flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted/90 via-card to-muted border border-border/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_1px_3px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4)] cursor-grab active:cursor-grabbing touch-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {/* Rotating Mechanical Dial with 12 Radials */}
          <motion.div
            style={{ rotate: smoothRotation }}
            className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none"
          >
            {/* 12-hour mechanical dial markings */}
            {DIAL_TICKS.map((angle) => {
              const isMajor = angle % 90 === 0;
              return (
                <div
                  key={angle}
                  style={{ transform: `rotate(${angle}deg)` }}
                  className="absolute inset-0 flex items-start justify-center"
                >
                  <span
                    className={cn(
                      "w-0.5 rounded-full transition-colors",
                      isMajor
                        ? "h-1 bg-primary/90"
                        : "h-0.5 bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
                    )}
                  />
                </div>
              );
            })}

            {/* Inner Gyro Disc */}
            <Disc3 className="size-3 text-primary/80 group-hover:text-primary transition-colors" />
          </motion.div>

          {/* Center Glass Hub */}
          <div className="size-2 rounded-full bg-background/95 border border-border/80 shadow-xs z-10 flex items-center justify-center">
            <span className="size-0.5 rounded-full bg-primary/80" />
          </div>
        </div>

        {/* Minimal Single-Row Elastic Scrubber Track */}
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative h-2 w-[140px] sm:w-[190px] md:w-[230px] rounded-full bg-muted/80 hover:bg-muted cursor-pointer overflow-hidden border border-border/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition-colors touch-none"
        >
          {/* Stage Divider Dots */}
          {stages.map((st, i) => {
            const pos = (i / Math.max(1, stages.length - 1)) * 100;
            const isCurrent = activeStage?.id === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageClick(st, i);
                }}
                title={`${st.name}${typeof st.count === "number" ? ` (${st.count})` : ""}`}
                style={{ left: `${pos}%` }}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all z-10 cursor-pointer",
                  isCurrent
                    ? "size-2 bg-primary ring-2 ring-primary/30 shadow-xs"
                    : "size-1 bg-foreground/30 hover:bg-primary hover:scale-125"
                )}
              />
            );
          })}

          {/* Elastic Dynamic Sliding Thumb */}
          <motion.div
            style={{
              left: `${scrollProgress * (100 - thumbWidthPercent)}%`,
              width: `${thumbWidthPercent}%`,
              x: smoothThumbOffset,
            }}
            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-primary via-primary/95 to-primary/85 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
          />
        </div>
      </motion.div>
    </aside>
  );
}

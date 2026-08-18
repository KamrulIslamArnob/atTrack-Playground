"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface PipelineStage {
  id: string;
  name: string;
  count?: number;
  color?: string | null;
}

interface PipelineViewportNavigatorProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  stages?: PipelineStage[];
  activeStageId?: string;
  onSelectStage?: (id: string) => void;
  className?: string;
}

export function PipelineViewportNavigator({
  scrollRef,
  stages = [],
  className,
}: PipelineViewportNavigatorProps) {
  const shouldReduceMotion = useReducedMotion();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(25);
  const [elasticOffset, setElasticOffset] = useState(0);

  const widgetRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Physics & Animation State
  const isPointerDown = useRef(false);
  const virtualScrollRef = useRef(0);
  const targetScrollRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Velocity tracking for kinetic inertia / fling
  const pointerHistory = useRef<{ x: number; time: number }[]>([]);

  // Update layout & scroll state from DOM element
  const updateFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const hasOverflow = maxScroll > 4;
    setCanScroll(hasOverflow);

    const visibleRatio = Math.min(1, Math.max(0.15, el.clientWidth / (el.scrollWidth || 1)));
    const calculatedWidth = Math.min(60, Math.max(18, visibleRatio * 100));
    setThumbWidthPercent(calculatedWidth);

    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollLeft / maxScroll)) : 0;
    setScrollProgress(progress);

    if (!isPointerDown.current && animFrameRef.current === null) {
      virtualScrollRef.current = el.scrollLeft;
      targetScrollRef.current = el.scrollLeft;
    }
  }, [scrollRef]);

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
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [scrollRef, updateFromScroll]);

  // Frame-Rate Independent Exponential Smoothing Physics Engine (Lenis / critically-damped spring)
  const startPhysicsLoop = useCallback(() => {
    if (animFrameRef.current !== null) return;
    lastTimeRef.current = performance.now();

    const physicsStep = (time: number) => {
      if (!scrollRef.current) {
        animFrameRef.current = null;
        return;
      }

      const el = scrollRef.current;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const prevTime = lastTimeRef.current ?? time;
      lastTimeRef.current = time;

      // Delta time in seconds (clamped to prevent huge leaps on background tab wake)
      const dt = Math.min((time - prevTime) / 1000, 0.048);

      const current = virtualScrollRef.current;
      const target = Math.max(0, Math.min(maxScroll, targetScrollRef.current));
      const diff = target - current;

      if (Math.abs(diff) < 0.25) {
        virtualScrollRef.current = target;
        el.scrollLeft = target;
        animFrameRef.current = null;
        lastTimeRef.current = null;
        return;
      }

      // Exponential Decay Smoothing: f(t) = 1 - e^(-lambda * dt)
      // lambda = 22 for snappy zero-latency responsiveness with buttery curve
      const lambda = 22;
      const factor = 1 - Math.exp(-lambda * dt);
      const nextScroll = current + diff * factor;

      virtualScrollRef.current = nextScroll;
      el.scrollLeft = Math.round(nextScroll * 10) / 10;

      animFrameRef.current = requestAnimationFrame(physicsStep);
    };

    animFrameRef.current = requestAnimationFrame(physicsStep);
  }, [scrollRef]);

  // Wheel / Trackpad listener with fluid momentum accumulation
  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    const onWheelNative = (e: WheelEvent) => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScroll <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      // Normalise delta based on input device mode
      const scaleFactor = e.deltaMode === 1 ? 38 : e.deltaMode === 2 ? 650 : 2.6;
      const scrollImpulse = rawDelta * scaleFactor * (e.deltaMode === 0 ? 0.95 : 1.1);

      targetScrollRef.current = Math.max(
        0,
        Math.min(maxScroll, targetScrollRef.current + scrollImpulse)
      );

      startPhysicsLoop();
    };

    widget.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      widget.removeEventListener("wheel", onWheelNative);
    };
  }, [scrollRef, startPhysicsLoop]);

  // Track Pointer Down (Grab / Click)
  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || !scrollRef.current) return;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    setIsDragging(true);

    const now = performance.now();
    pointerHistory.current = [{ x: e.clientX, time: now }];

    const rect = trackRef.current.getBoundingClientRect();
    const maxScroll = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
    if (maxScroll > 0) {
      const thumbPx = (rect.width * thumbWidthPercent) / 100;
      const usableTrack = Math.max(1, rect.width - thumbPx);
      const clickThumbCenter = e.clientX - rect.left - thumbPx / 2;
      const ratio = Math.max(0, Math.min(1, clickThumbCenter / usableTrack));
      const exactScroll = ratio * maxScroll;

      virtualScrollRef.current = exactScroll;
      targetScrollRef.current = exactScroll;
      scrollRef.current.scrollLeft = exactScroll;
    }
  };

  // Track Pointer Move (Direct 1:1 Tracking + Elastic Boundary Resistance)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current || !scrollRef.current || !trackRef.current) return;

    const now = performance.now();
    pointerHistory.current.push({ x: e.clientX, time: now });
    // Keep last 60ms of movement samples for kinetic inertia calculation
    pointerHistory.current = pointerHistory.current.filter((p) => now - p.time <= 80);

    const rect = trackRef.current.getBoundingClientRect();
    const maxScroll = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
    if (maxScroll <= 0) return;

    const thumbPx = (rect.width * thumbWidthPercent) / 100;
    const usableTrack = Math.max(1, rect.width - thumbPx);
    const pointerOffset = e.clientX - rect.left - thumbPx / 2;

    // Elastic rubber-band displacement
    if (pointerOffset < 0) {
      const overshoot = Math.abs(pointerOffset);
      setElasticOffset(-Math.pow(overshoot, 0.72) * 1.8);
      virtualScrollRef.current = 0;
      targetScrollRef.current = 0;
      scrollRef.current.scrollLeft = 0;
    } else if (pointerOffset > usableTrack) {
      const overshoot = pointerOffset - usableTrack;
      setElasticOffset(Math.pow(overshoot, 0.72) * 1.8);
      virtualScrollRef.current = maxScroll;
      targetScrollRef.current = maxScroll;
      scrollRef.current.scrollLeft = maxScroll;
    } else {
      setElasticOffset(0);
      const ratio = pointerOffset / usableTrack;
      const exactScroll = ratio * maxScroll;
      virtualScrollRef.current = exactScroll;
      targetScrollRef.current = exactScroll;
      scrollRef.current.scrollLeft = exactScroll;
    }
  };

  // Track Pointer Up (Release + Kinetic Inertial Fling)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    setIsDragging(false);
    setElasticOffset(0);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (!trackRef.current || !scrollRef.current) return;
    const maxScroll = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
    if (maxScroll <= 0) return;

    // Calculate kinetic release velocity from pointer history
    const history = pointerHistory.current;
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const timeDiff = (newest.time - oldest.time) / 1000;

      if (timeDiff > 0.01 && timeDiff < 0.12) {
        const pxDiff = newest.x - oldest.x;
        const velocityPxPerSec = pxDiff / timeDiff;

        if (Math.abs(velocityPxPerSec) > 80) {
          const rect = trackRef.current.getBoundingClientRect();
          const thumbPx = (rect.width * thumbWidthPercent) / 100;
          const usableTrack = Math.max(1, rect.width - thumbPx);
          const scrubRatio = maxScroll / usableTrack;

          // Momentum fling projection with natural damping
          const impulseScroll = velocityPxPerSec * 0.28 * scrubRatio;
          targetScrollRef.current = Math.max(
            0,
            Math.min(maxScroll, virtualScrollRef.current + impulseScroll)
          );
          startPhysicsLoop();
        }
      }
    }
    pointerHistory.current = [];
  };

  // Keyboard navigation with smooth exponential curve
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const maxScroll = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
    const step = Math.max(360, Math.round(scrollRef.current.clientWidth * 0.45));

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      targetScrollRef.current = Math.max(0, targetScrollRef.current - step);
      startPhysicsLoop();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      targetScrollRef.current = Math.min(maxScroll, targetScrollRef.current + step);
      startPhysicsLoop();
    } else if (e.key === "Home") {
      e.preventDefault();
      targetScrollRef.current = 0;
      startPhysicsLoop();
    } else if (e.key === "End") {
      e.preventDefault();
      targetScrollRef.current = maxScroll;
      startPhysicsLoop();
    }
  };

  if (!canScroll && stages.length <= 1) return null;

  const maxThumbLeft = 100 - thumbWidthPercent;
  const thumbLeftPercent = Math.max(0, Math.min(maxThumbLeft, scrollProgress * maxThumbLeft));

  return (
    <div
      ref={widgetRef}
      role="region"
      aria-label="Horizontal scrollbar"
      className={cn("inline-flex items-center select-none", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        role="scrollbar"
        aria-orientation="horizontal"
        tabIndex={0}
        aria-label="Board horizontal scrollbar"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-controls="board-scroll-container"
        onKeyDown={handleKeyDown}
        className={cn(
          "group relative flex items-center h-8 px-1.5 rounded-xl border border-border/80 bg-card shadow-2xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          (isDragging || isHovered) && "border-primary/40 shadow-xs"
        )}
      >
        {/* Elastic Scrollbar Track & Draggable Thumb */}
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "relative flex items-center h-4.5 w-[150px] sm:w-[190px] md:w-[230px] rounded-full bg-muted/80 cursor-pointer touch-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-200 overflow-hidden",
            (isHovered || isDragging) && "bg-muted"
          )}
          title="Drag or click to scroll pipeline"
        >
          {/* Scrollbar Draggable Thumb with Elastic Spring Physics */}
          <motion.div
            animate={{
              left: `${thumbLeftPercent}%`,
              width: `${thumbWidthPercent}%`,
              x: elasticOffset,
              scaleY: isDragging ? 1.08 : isHovered ? 1.04 : 1,
              scaleX: isDragging ? 0.98 : 1,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : isDragging
                ? {
                    left: { duration: 0 },
                    width: { duration: 0 },
                    x: { type: "spring", stiffness: 700, damping: 32 },
                    scaleY: { duration: 0.08 },
                    scaleX: { duration: 0.08 },
                  }
                : {
                    left: { type: "spring", stiffness: 450, damping: 36 },
                    width: { type: "spring", stiffness: 450, damping: 36 },
                    x: { type: "spring", stiffness: 500, damping: 26 },
                    scaleY: { type: "spring", stiffness: 400, damping: 25 },
                    scaleX: { type: "spring", stiffness: 400, damping: 25 },
                  }
            }
            className={cn(
              "absolute top-0.5 bottom-0.5 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center select-none will-change-transform shadow-xs transition-colors duration-150",
              isDragging
                ? "bg-primary shadow-md"
                : isHovered
                ? "bg-primary/90 text-primary-foreground shadow-xs"
                : "bg-muted-foreground/45 hover:bg-primary/80"
            )}
          >
            {/* Micro grip ridges on thumb */}
            <div className="flex items-center gap-[3px] opacity-75 pointer-events-none transition-opacity group-hover:opacity-90">
              <span className="h-2.5 w-[2px] rounded-full bg-background/90" />
              <span className="h-2.5 w-[2px] rounded-full bg-background/90" />
              <span className="h-2.5 w-[2px] rounded-full bg-background/90" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

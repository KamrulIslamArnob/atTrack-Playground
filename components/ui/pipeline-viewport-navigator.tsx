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
      const BALL_SIZE = 14;
      const usableTrack = Math.max(1, rect.width - BALL_SIZE);
      const clickThumbCenter = e.clientX - rect.left - BALL_SIZE / 2;
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

    const BALL_SIZE = 14;
    const usableTrack = Math.max(1, rect.width - BALL_SIZE);
    const pointerOffset = e.clientX - rect.left - BALL_SIZE / 2;

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
          const BALL_SIZE = 14;
          const usableTrack = Math.max(1, rect.width - BALL_SIZE);
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

  const BALL_SIZE = 14;

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
          "group relative flex items-center h-7 px-2 rounded-full border border-border/70 bg-card shadow-2xs transition-all duration-200 focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-primary/40",
          (isDragging || isHovered) && "border-primary/40 shadow-xs"
        )}
      >
        {/* Elastic Scrollbar Track Rail */}
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={cn(
            "relative flex items-center h-1.5 w-[85px] sm:w-[120px] md:w-[150px] rounded-full bg-muted cursor-pointer touch-none shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] transition-all duration-200",
            (isHovered || isDragging) && "bg-muted/90"
          )}
          title="Drag or click to scroll pipeline"
        >
          {/* Active progress fill */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full bg-primary/20 transition-all duration-75"
            style={{ width: `calc(${scrollProgress * 100}% - ${scrollProgress * BALL_SIZE}px + ${BALL_SIZE / 2}px)` }}
          />

          {/* Draggable Blue Ball with Elastic Spring Physics */}
          <motion.div
            animate={{
              left: `calc(${scrollProgress * 100}% - ${scrollProgress * BALL_SIZE}px)`,
              x: elasticOffset,
              scale: isDragging ? 1.25 : isHovered ? 1.15 : 1,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : isDragging
                ? {
                    left: { duration: 0 },
                    x: { type: "spring", stiffness: 700, damping: 32 },
                    scale: { duration: 0.08 },
                  }
                : {
                    left: { type: "spring", stiffness: 450, damping: 36 },
                    x: { type: "spring", stiffness: 500, damping: 26 },
                    scale: { type: "spring", stiffness: 400, damping: 25 },
                  }
            }
            className={cn(
              "absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-blue-500 dark:bg-blue-400 cursor-grab active:cursor-grabbing flex items-center justify-center select-none will-change-transform shadow-[0_1px_3px_rgba(37,99,235,0.4),0_0_6px_rgba(59,130,246,0.35)] transition-shadow duration-150",
              isDragging && "bg-blue-600 shadow-[0_2px_6px_rgba(37,99,235,0.5),0_0_10px_rgba(59,130,246,0.5)]"
            )}
          >
            {/* Inner specular highlight reflection */}
            <div className="size-1 rounded-full bg-white/70 -translate-y-0.5 -translate-x-0.5 pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

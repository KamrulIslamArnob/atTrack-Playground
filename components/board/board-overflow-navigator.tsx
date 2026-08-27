"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { cn } from "@/lib/utils";

interface BoardOverflowNavigatorProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children?: React.ReactNode;
}

export function BoardOverflowNavigator({
  scrollRef,
  className,
  children,
}: BoardOverflowNavigatorProps) {
  const shouldReduceMotion = useReducedMotion();
  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const continuousScrollId = useRef<number | null>(null);

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScroll(maxScroll > 6);
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < maxScroll - 10);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollEdges();
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(el);
    el.addEventListener("scroll", updateScrollEdges, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateScrollEdges);
      if (continuousScrollId.current !== null) {
        cancelAnimationFrame(continuousScrollId.current);
      }
    };
  }, [scrollRef, updateScrollEdges]);

  const startContinuousScroll = useCallback(
    (direction: -1 | 1) => {
      if (!scrollRef.current || continuousScrollId.current !== null) return;
      let speed = 8;
      const scrollStep = () => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollLeft += direction * speed;
        speed = Math.min(24, speed + 0.5);
        continuousScrollId.current = requestAnimationFrame(scrollStep);
      };
      continuousScrollId.current = requestAnimationFrame(scrollStep);
    },
    [scrollRef]
  );

  const stopContinuousScroll = useCallback(() => {
    if (continuousScrollId.current !== null) {
      cancelAnimationFrame(continuousScrollId.current);
      continuousScrollId.current = null;
    }
  }, []);

  const handleScrollLeft = () => {
    if (!scrollRef.current) return;
    const step = Math.max(300, Math.round(scrollRef.current.clientWidth * 0.5));
    scrollRef.current.scrollBy({ left: -step, behavior: "smooth" });
  };

  const handleScrollRight = () => {
    if (!scrollRef.current) return;
    const step = Math.max(300, Math.round(scrollRef.current.clientWidth * 0.5));
    scrollRef.current.scrollBy({ left: step, behavior: "smooth" });
  };

  return (
    <div className={cn("relative w-full flex-1 min-h-0", className)}>
      {/* Sticky viewport-tracking container for left and right overflow controls */}
      <div className="sticky top-0 left-0 right-0 h-0 pointer-events-none z-30">
        {/* Left Overflow Quick-Scroll Button & Subtle Edge Halo */}
        <AnimatePresence>
          {canScroll && canScrollLeft && (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 top-[45vh] -translate-y-1/2 flex items-center justify-start pointer-events-none"
            >
              {/* Soft edge fade halo around button */}
              <div className="pointer-events-none absolute -left-6 -top-20 -bottom-20 w-24 bg-gradient-to-r from-background via-background/60 to-transparent blur-xs z-10" />

              <button
                type="button"
                onClick={handleScrollLeft}
                onPointerDown={() => {
                  const timer = setTimeout(() => startContinuousScroll(-1), 220);
                  const clear = () => {
                    clearTimeout(timer);
                    stopContinuousScroll();
                    window.removeEventListener("pointerup", clear);
                    window.removeEventListener("pointercancel", clear);
                  };
                  window.addEventListener("pointerup", clear, { once: true });
                  window.addEventListener("pointercancel", clear, { once: true });
                }}
                aria-label="Scroll pipeline left"
                title="Scroll pipeline left (click or press and hold)"
                className="pointer-events-auto relative z-20 flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ml-1"
              >
                <ChevronLeftIcon className="size-5 transition-transform" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Overflow Quick-Scroll Button & Subtle Edge Halo */}
        <AnimatePresence>
          {canScroll && canScrollRight && (
            <motion.div
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute right-0 top-[45vh] -translate-y-1/2 flex items-center justify-end pointer-events-none"
            >
              {/* Soft edge fade halo around button */}
              <div className="pointer-events-none absolute -right-6 -top-20 -bottom-20 w-24 bg-gradient-to-l from-background via-background/60 to-transparent blur-xs z-10" />

              <button
                type="button"
                onClick={handleScrollRight}
                onPointerDown={() => {
                  const timer = setTimeout(() => startContinuousScroll(1), 220);
                  const clear = () => {
                    clearTimeout(timer);
                    stopContinuousScroll();
                    window.removeEventListener("pointerup", clear);
                    window.removeEventListener("pointercancel", clear);
                  };
                  window.addEventListener("pointerup", clear, { once: true });
                  window.addEventListener("pointercancel", clear, { once: true });
                }}
                aria-label="Scroll pipeline right"
                title="Scroll pipeline right (click or press and hold)"
                className="pointer-events-auto relative z-20 flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mr-1"
              >
                <ChevronRightIcon className="size-5 transition-transform" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {children}
    </div>
  );
}

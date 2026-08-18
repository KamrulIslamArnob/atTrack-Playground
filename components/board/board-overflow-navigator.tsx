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
      {/* Left Overflow Edge Gradient & Floating Quick-Scroll Button */}
      <AnimatePresence>
        {canScroll && canScrollLeft && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute -left-6 top-0 bottom-0 min-h-full w-28 bg-gradient-to-r from-background via-background/85 to-transparent z-20"
          >
            <div className="sticky top-1/2 -translate-y-1/2 pl-3 flex items-center justify-start pointer-events-none">
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
                className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border/90 shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeftIcon className="size-5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Overflow Edge Gradient & Floating Quick-Scroll Button */}
      <AnimatePresence>
        {canScroll && canScrollRight && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute -right-6 top-0 bottom-0 min-h-full w-28 bg-gradient-to-l from-background via-background/85 to-transparent z-20"
          >
            <div className="sticky top-1/2 -translate-y-1/2 pr-3 flex items-center justify-end pointer-events-none">
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
                className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border/90 shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRightIcon className="size-5 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}

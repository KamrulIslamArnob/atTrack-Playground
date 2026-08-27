"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [boardRect, setBoardRect] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const continuousScrollId = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateRect = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBoardRect({
      left: rect.left,
      width: rect.width,
      top: rect.top,
      height: rect.height,
    });
  }, [scrollRef]);

  const updateScrollEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScroll(maxScroll > 6);
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < maxScroll - 10);
    updateRect();
  }, [scrollRef, updateRect]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollEdges();
    updateRect();

    const observer = new ResizeObserver(() => {
      updateScrollEdges();
      updateRect();
    });
    observer.observe(el);

    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    window.addEventListener("scroll", updateRect, { capture: true, passive: true });
    window.addEventListener("resize", updateRect, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      if (continuousScrollId.current !== null) {
        cancelAnimationFrame(continuousScrollId.current);
      }
    };
  }, [scrollRef, updateScrollEdges, updateRect]);

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
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Left Overflow Edge Full-Height Viewport Gradient & Centered Button */}
            <AnimatePresence>
              {canScroll && canScrollLeft && boardRect && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    position: "fixed",
                    left: boardRect.left,
                    top: Math.max(0, boardRect.top),
                    bottom: 0,
                    width: "7rem",
                  }}
                  className="pointer-events-none z-30 bg-gradient-to-r from-background via-background/85 to-transparent flex items-center justify-start pl-3"
                >
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
                    className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronLeftIcon className="size-5 transition-transform" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Right Overflow Edge Full-Height Viewport Gradient & Centered Button */}
            <AnimatePresence>
              {canScroll && canScrollRight && boardRect && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    position: "fixed",
                    left: boardRect.left + boardRect.width - 112,
                    top: Math.max(0, boardRect.top),
                    bottom: 0,
                    width: "7rem",
                  }}
                  className="pointer-events-none z-30 bg-gradient-to-l from-background via-background/85 to-transparent flex items-center justify-end pr-3"
                >
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
                    className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-background/95 backdrop-blur-md border border-border shadow-xl text-foreground hover:bg-primary hover:text-white hover:border-primary hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronRightIcon className="size-5 transition-transform" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>,
          document.body
        )}

      {children}
    </div>
  );
}

"use client";

import { useEffect } from "react";

interface ScrollAnimationState {
  targetX: number;
  currentX: number;
  targetY: number;
  currentY: number;
  animId: number | null;
  lastTime: number;
}

const activeScrollers = new Map<HTMLElement, ScrollAnimationState>();

/**
 * Finds the nearest ancestor element that can scroll in the requested direction.
 */
function findScrollableTarget(
  startEl: HTMLElement | null,
  deltaX: number,
  deltaY: number
): { element: HTMLElement; canScrollX: boolean; canScrollY: boolean } | null {
  let curr: HTMLElement | null = startEl;

  while (curr && curr !== document.documentElement) {
    // Avoid interfering with range inputs, chatbot viewports, or specifically excluded containers
    if (
      (curr.tagName === "INPUT" && (curr as HTMLInputElement).type === "range") ||
      curr.hasAttribute("data-no-smooth-scroll") ||
      curr.getAttribute("data-slot") === "aui_thread-viewport" ||
      curr.classList.contains("aui-root") ||
      curr.classList.contains("aui-thread-root")
    ) {
      return null;
    }

    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;

    const scrollableY = (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && curr.scrollHeight > curr.clientHeight + 2;
    const scrollableX = (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") && curr.scrollWidth > curr.clientWidth + 2;

    const maxScrollY = curr.scrollHeight - curr.clientHeight;
    const maxScrollX = curr.scrollWidth - curr.clientWidth;

    const canScrollDown = deltaY > 0 && curr.scrollTop < maxScrollY - 1;
    const canScrollUp = deltaY < 0 && curr.scrollTop > 1;
    const canScrollRight = deltaX > 0 && curr.scrollLeft < maxScrollX - 1;
    const canScrollLeft = deltaX < 0 && curr.scrollLeft > 1;

    const matchesY = scrollableY && (canScrollDown || canScrollUp);
    const matchesX = scrollableX && (canScrollRight || canScrollLeft);

    if (matchesY || matchesX) {
      return {
        element: curr,
        canScrollX: matchesX,
        canScrollY: matchesY,
      };
    }

    curr = curr.parentElement;
  }

  // Fallback check on documentElement/body for standalone pages (like public landing/terms)
  const docEl = document.documentElement;
  const docScrollableY = docEl.scrollHeight > window.innerHeight + 2;
  if (docScrollableY && ((deltaY > 0 && window.scrollY < docEl.scrollHeight - window.innerHeight - 1) || (deltaY < 0 && window.scrollY > 1))) {
    return {
      element: docEl,
      canScrollX: false,
      canScrollY: true,
    };
  }

  return null;
}

export function SmoothScrollEnhancer() {
  useEffect(() => {
    // Respect accessibility reduced-motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const onWheel = (e: WheelEvent) => {
      // Allow ctrl/cmd + wheel for browser zooming
      if (e.ctrlKey || e.metaKey) return;

      const rawDeltaX = e.deltaX;
      const rawDeltaY = e.deltaY;
      if (rawDeltaX === 0 && rawDeltaY === 0) return;

      const target = findScrollableTarget(e.target as HTMLElement | null, rawDeltaX, rawDeltaY);
      if (!target) return;

      const { element, canScrollX, canScrollY } = target;
      const isDoc = element === document.documentElement;

      // Normalise scale for lines/pages vs pixels
      const scaleMultiplier = e.deltaMode === 1 ? 30 : e.deltaMode === 2 ? 550 : 1.15;
      const deltaX = rawDeltaX * scaleMultiplier;
      const deltaY = rawDeltaY * scaleMultiplier;

      const maxScrollY = isDoc
        ? document.documentElement.scrollHeight - window.innerHeight
        : element.scrollHeight - element.clientHeight;
      const maxScrollX = isDoc
        ? document.documentElement.scrollWidth - window.innerWidth
        : element.scrollWidth - element.clientWidth;

      let state = activeScrollers.get(element);
      const currentY = isDoc ? window.scrollY : element.scrollTop;
      const currentX = isDoc ? window.scrollX : element.scrollLeft;

      if (!state) {
        state = {
          targetX: currentX,
          currentX,
          targetY: currentY,
          currentY,
          animId: null,
          lastTime: performance.now(),
        };
        activeScrollers.set(element, state);
      }

      if (canScrollY) {
        state.targetY = Math.max(0, Math.min(maxScrollY, state.targetY + deltaY));
      }
      if (canScrollX) {
        state.targetX = Math.max(0, Math.min(maxScrollX, state.targetX + deltaX));
      }

      e.preventDefault();

      if (state.animId === null) {
        state.lastTime = performance.now();

        const step = (time: number) => {
          const st = activeScrollers.get(element);
          if (!st) return;

          const dt = Math.min((time - st.lastTime) / 1000, 0.048);
          st.lastTime = time;

          // Exponential smoothing factor: 1 - e^(-lambda * dt)
          // lambda = 20 gives high-precision, zero-latency, buttery glide
          const factor = 1 - Math.exp(-20 * dt);

          let continueX = false;
          let continueY = false;

          if (canScrollY) {
            const curY = isDoc ? window.scrollY : element.scrollTop;
            const diffY = st.targetY - curY;
            if (Math.abs(diffY) > 0.4) {
              const nextY = curY + diffY * factor;
              st.currentY = nextY;
              if (isDoc) {
                window.scrollTo({ top: nextY, behavior: "instant" });
              } else {
                element.scrollTop = nextY;
              }
              continueY = true;
            } else {
              st.currentY = st.targetY;
              if (isDoc) {
                window.scrollTo({ top: st.targetY, behavior: "instant" });
              } else {
                element.scrollTop = st.targetY;
              }
            }
          }

          if (canScrollX) {
            const curX = isDoc ? window.scrollX : element.scrollLeft;
            const diffX = st.targetX - curX;
            if (Math.abs(diffX) > 0.4) {
              const nextX = curX + diffX * factor;
              st.currentX = nextX;
              if (isDoc) {
                window.scrollTo({ left: nextX, behavior: "instant" });
              } else {
                element.scrollLeft = nextX;
              }
              continueX = true;
            } else {
              st.currentX = st.targetX;
              if (isDoc) {
                window.scrollTo({ left: st.targetX, behavior: "instant" });
              } else {
                element.scrollLeft = st.targetX;
              }
            }
          }

          if (continueX || continueY) {
            st.animId = requestAnimationFrame(step);
          } else {
            st.animId = null;
            activeScrollers.delete(element);
          }
        };

        state.animId = requestAnimationFrame(step);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
      for (const st of activeScrollers.values()) {
        if (st.animId !== null) cancelAnimationFrame(st.animId);
      }
      activeScrollers.clear();
    };
  }, []);

  return null;
}

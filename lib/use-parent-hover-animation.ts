"use client";

import { useEffect } from "react";
import type { useAnimation } from "motion/react";

export function useParentHoverAnimation(
  controls: ReturnType<typeof useAnimation>,
  containerRef: React.RefObject<HTMLElement | null>,
  isControlledRef?: React.RefObject<boolean>
) {
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const parent =
      node.closest(
        "button, a, [role='button'], .group, [data-slot], [tabindex]"
      ) || node.parentElement;

    if (!parent) return;

    const handleParentEnter = () => {
      if (!isControlledRef?.current) {
        controls.start("animate");
      }
    };

    const handleParentLeave = () => {
      if (!isControlledRef?.current) {
        controls.start("normal");
      }
    };

    parent.addEventListener("mouseenter", handleParentEnter);
    parent.addEventListener("mouseleave", handleParentLeave);

    return () => {
      parent.removeEventListener("mouseenter", handleParentEnter);
      parent.removeEventListener("mouseleave", handleParentLeave);
    };
  }, [controls, containerRef, isControlledRef]);
}

"use client";

import type { Transition } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface LayersIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LayersIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 14,
  mass: 1,
};

const LayersIcon = forwardRef<LayersIconHandle, LayersIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useParentHoverAnimation(controls, containerRef, isControlledRef);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: async () => {
          await controls.start("firstState");
          await controls.start("secondState");
        },
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      async (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          await controls.start("firstState");
          await controls.start("secondState");
        }
      },
      [controls, onMouseEnter]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        ref={containerRef}
        style={{ ...(size != null ? { width: size, height: size } : {}), ...(props.style as any) }}
        className={cn("inline-flex items-center justify-center shrink-0", className)}
        
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          className="size-full overflow-visible"
          fill="none"
          height="100%"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <motion.path
            animate={controls}
            d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"
            transition={DEFAULT_TRANSITION}
            variants={{
              normal: { y: 0 },
              firstState: { y: -9 },
              secondState: { y: 0 },
            }}
          />
          <motion.path
            animate={controls}
            d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
            transition={DEFAULT_TRANSITION}
            variants={{
              normal: { y: 0 },
              firstState: { y: -5 },
              secondState: { y: 0 },
            }}
          />
        </svg>
      </div>
    );
  }
);

LayersIcon.displayName = "LayersIcon";

export { LayersIcon };


"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface PauseIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PauseIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const BASE_RECT_VARIANTS: Variants = {
  normal: {
    y: 0,
  },
};

const BASE_RECT_TRANSITION = {
  transition: {
    times: [0, 0.2, 0.5, 1],
    duration: 0.5,
    stiffness: 260,
    damping: 20,
  },
};

const LEFT_RECT_VARIANTS: Variants = {
  ...BASE_RECT_VARIANTS,
  animate: {
    y: [0, 2, 0, 0],
    ...BASE_RECT_TRANSITION,
  },
};

const RIGHT_RECT_VARIANTS: Variants = {
  ...BASE_RECT_VARIANTS,
  animate: {
    y: [0, 0, 2, 0],
    ...BASE_RECT_TRANSITION,
  },
};

const PauseIcon = forwardRef<PauseIconHandle, PauseIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size, ...props }, ref) => {
    const controls = useAnimation();
    const isControlledRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useParentHoverAnimation(controls, containerRef, isControlledRef);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else {
          controls.start("animate");
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
          <motion.rect
            animate={controls}
            height="16"
            rx="1"
            variants={LEFT_RECT_VARIANTS}
            width="4"
            x="6"
            y="4"
          />
          <motion.rect
            animate={controls}
            height="16"
            rx="1"
            variants={RIGHT_RECT_VARIANTS}
            width="4"
            x="14"
            y="4"
          />
        </svg>
      </div>
    );
  }
);

PauseIcon.displayName = "PauseIcon";

export { PauseIcon };


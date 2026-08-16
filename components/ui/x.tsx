"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface XIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface XIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const PATH_VARIANTS: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
  },
};

const XIcon = forwardRef<XIconHandle, XIconProps>(
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
          <motion.path
            animate={controls}
            d="M18 6 6 18"
            variants={PATH_VARIANTS}
          />
          <motion.path
            animate={controls}
            d="m6 6 12 12"
            transition={{ delay: 0.2 }}
            variants={PATH_VARIANTS}
          />
        </svg>
      </div>
    );
  }
);

XIcon.displayName = "XIcon";

export { XIcon };

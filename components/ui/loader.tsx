"use client";

import type { Transition, Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface LoaderIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LoaderIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const G_VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: {
    rotate: 360,
    transition: {
      repeat: Number.POSITIVE_INFINITY,
      duration: 0.8,
      ease: "linear",
    },
  },
};

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 50,
  damping: 10,
};

const LoaderIcon = forwardRef<LoaderIconHandle, LoaderIconProps>(
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
          <motion.g
            animate={controls}
            style={{ transformOrigin: "12px 12px" }}
            transition={DEFAULT_TRANSITION}
            variants={G_VARIANTS}
          >
            <path d="M12 2v4" />
            <path d="m16.2 7.8 2.9-2.9" />
            <path d="M18 12h4" />
            <path d="m16.2 16.2 2.9 2.9" />
            <path d="M12 18v4" />
            <path d="m4.9 19.1 2.9-2.9" />
            <path d="M2 12h4" />
            <path d="m4.9 4.9 2.9 2.9" />
          </motion.g>
        </svg>
      </div>
    );
  }
);

LoaderIcon.displayName = "LoaderIcon";

export { LoaderIcon };


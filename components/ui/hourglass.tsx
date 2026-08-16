"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface HourglassIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HourglassIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const HOURGLASS_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
  animate: {
    rotate: 180,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 18,
    },
  },
};

const HourglassIcon = forwardRef<HourglassIconHandle, HourglassIconProps>(
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
        style={{
          ...(size != null ? { width: size, height: size } : {}),
          ...(props.style as any),
        }}
        className={cn("inline-flex items-center justify-center shrink-0", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <motion.svg
          animate={controls}
          initial="normal"
          variants={HOURGLASS_VARIANTS}
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
          <path d="M5 22h14" />
          <path d="M5 2h14" />
          <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
          <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        </motion.svg>
      </div>
    );
  }
);

HourglassIcon.displayName = "HourglassIcon";

export { HourglassIcon };

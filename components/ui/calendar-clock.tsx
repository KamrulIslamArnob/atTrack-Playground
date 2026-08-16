"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface CalendarClockIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface CalendarClockIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const CLOCK_HAND_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    originX: "0%",
    originY: "100%",
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  animate: {
    rotate: 360,
    originX: "0%",
    originY: "100%",
    transition: {
      duration: 0.7,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const CALENDAR_VARIANTS: Variants = {
  normal: {
    scale: 1,
    transition: { duration: 0.3 },
  },
  animate: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.4,
      ease: "easeInOut",
    },
  },
};

const CalendarClockIcon = forwardRef<CalendarClockIconHandle, CalendarClockIconProps>(
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
          variants={CALENDAR_VARIANTS}
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
          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h5" />
          <circle cx="16" cy="16" r="6" />
          <motion.line
            animate={controls}
            variants={CLOCK_HAND_VARIANTS}
            x1="16"
            x2="16"
            y1="16"
            y2="13"
          />
          <line x1="16" x2="18" y1="16" y2="16" />
        </motion.svg>
      </div>
    );
  }
);

CalendarClockIcon.displayName = "CalendarClockIcon";

export { CalendarClockIcon };

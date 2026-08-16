"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";
import { useParentHoverAnimation } from "@/lib/use-parent-hover-animation";

export interface PlayIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface PlayIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number | string;
}

const PATH_VARIANTS: Variants = {
  normal: {
    x: 0,
    rotate: 0,
  },
  animate: {
    x: [0, -1, 2, 0],
    rotate: [0, -10, 0, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.2, 0.5, 1],
      stiffness: 260,
      damping: 20,
    },
  },
};

const PlayIcon = forwardRef<PlayIconHandle, PlayIconProps>(
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
        <motion.svg
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
          <motion.polygon
            animate={controls}
            points="6 3 20 12 6 21 6 3"
            variants={PATH_VARIANTS}
          />
        </motion.svg>
      </div>
    );
  }
);

PlayIcon.displayName = "PlayIcon";

export { PlayIcon };


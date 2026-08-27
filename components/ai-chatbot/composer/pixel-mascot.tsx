"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";

interface PixelMascotProps {
  className?: string;
  size?: number;
}

/**
 * 8-bit retro pixel art mascot (Tracky companion) matching the orange sprite
 * in the UI design. Features interactive pixel hover reactions.
 */
function PixelMascotComponent({ className, size = 20 }: PixelMascotProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const handleClick = () => {
    setClickCount((c) => c + 1);
  };

  return (
    <div
      role="img"
      aria-label="Tracky pixel mascot"
      title="Tracky AI Copilot"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{ width: size, height: size }}
      className={cn(
        "relative flex items-center justify-center cursor-pointer select-none transition-transform duration-200",
        isHovered && "scale-110 -translate-y-0.5",
        className
      )}
    >
      {/* 8-bit SVG Pixel Sprite rendering */}
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        className={cn(
          "drop-shadow-[0_2px_4px_rgba(249,115,22,0.3)] transition-transform duration-150",
          clickCount % 2 === 1 && "scale-y-95"
        )}
        style={{ shapeRendering: "crispEdges" }}
      >
        {/* Antennas / Ears */}
        <rect x="2" y="2" width="2" height="2" fill="#ea580c" />
        <rect x="12" y="2" width="2" height="2" fill="#ea580c" />

        {/* Head / Body upper */}
        <rect x="3" y="4" width="10" height="2" fill="#f97316" />
        <rect x="2" y="6" width="12" height="4" fill="#f97316" />

        {/* Highlight brow */}
        <rect x="4" y="4" width="8" height="1" fill="#fb923c" />

        {/* Eyes (dark pixel eyes) */}
        <rect x="4" y="7" width="2" height="2" fill={isHovered ? "#ea580c" : "#1c1917"} />
        <rect x="10" y="7" width="2" height="2" fill={isHovered ? "#ea580c" : "#1c1917"} />

        {/* Eye gleam */}
        <rect x="4" y="7" width="1" height="1" fill="#ffffff" />
        <rect x="10" y="7" width="1" height="1" fill="#ffffff" />

        {/* Lower torso */}
        <rect x="3" y="10" width="10" height="2" fill="#f97316" />

        {/* Legs / Tentacles */}
        <rect x="2" y="12" width="2" height="3" fill="#ea580c" />
        <rect x="5" y="12" width="2" height="2" fill="#ea580c" />
        <rect x="9" y="12" width="2" height="2" fill="#ea580c" />
        <rect x="12" y="12" width="2" height="3" fill="#ea580c" />
      </svg>
    </div>
  );
}

export const PixelMascot = memo(PixelMascotComponent);

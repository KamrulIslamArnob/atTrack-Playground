"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface ThemeLogoProps {
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}

export function ThemeLogo({
  width = 24,
  height = 24,
  alt = "BetterJob",
  className,
  priority = false,
}: ThemeLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const src = mounted && resolvedTheme === "dark" ? "/icon-256-dark.svg" : "/icon-256.svg";

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

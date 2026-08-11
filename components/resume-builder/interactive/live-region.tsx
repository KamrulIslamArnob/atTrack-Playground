"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LiveRegionProps {
  className?: string;
}

export function LiveRegion({ className }: LiveRegionProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 1000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {message}
    </div>
  );
}

export function useAnnounce() {
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    // Clear after announcement
    setTimeout(() => setAnnouncement(""), 1000);
  }, []);

  return { announcement, announce };
}

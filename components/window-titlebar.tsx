"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// h-9 below, in px — the one other place that needs this number (SheetContent,
// to clear the same reserved strip) imports it here instead of re-deriving it.
export const ELECTRON_TITLEBAR_HEIGHT = "36px";

export function WindowTitlebar({ className }: { className?: string }) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      const timeout = setTimeout(() => {
        setIsElectron(true);
      }, 0);

      return () => clearTimeout(timeout);
    }
  }, []);

  if (!isElectron) {
    return null;
  }

  return (
    <div
      className={cn(
        "app-drag-region flex h-9 w-full select-none items-center justify-between border-b border-border/50 bg-background px-3 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="truncate">atTrack</span>
      </div>
      {/* Space reserved for Electron native titleBarOverlay window buttons */}
      <div className="w-36 h-full" />
    </div>
  );
}

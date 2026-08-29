"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Square, Copy, X } from "lucide-react";

// h-9 below, in px — the one other place that needs this number (SheetContent,
// to clear the same reserved strip) imports it here instead of re-deriving it.
export const ELECTRON_TITLEBAR_HEIGHT = "36px";

type PlatformType = "darwin" | "win32" | "linux";

export function WindowTitlebar({ className }: { className?: string }) {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<PlatformType>("win32");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isElectron) {
      const ua = window.navigator.userAgent.toLowerCase();
      let detectedPlatform: PlatformType = "win32";
      if (ua.includes("mac")) {
        detectedPlatform = "darwin";
      } else if (ua.includes("linux")) {
        detectedPlatform = "linux";
      } else {
        detectedPlatform = "win32";
      }
      setPlatform(detectedPlatform);

      const timeout = setTimeout(() => {
        setIsElectron(true);
        document.documentElement.classList.add("is-electron");
      }, 0);

      // Listen for window maximize/restore events
      const unsubscribe = window.electronAPI?.onMaximizedChange?.((maximized) => {
        setIsMaximized(maximized);
      });

      return () => {
        clearTimeout(timeout);
        unsubscribe?.();
        document.documentElement.classList.remove("is-electron");
      };
    }
  }, []);

  if (!isElectron) {
    return null;
  }

  const handleMinimize = () => window.electronAPI?.minimize?.();
  const handleMaximize = () => window.electronAPI?.maximize?.();
  const handleClose = () => window.electronAPI?.close?.();

  return (
    <div
      className={cn(
        "app-drag-region flex h-9 w-full select-none items-center justify-between border-b border-border/50 bg-background text-xs text-muted-foreground",
        platform === "darwin" ? "pl-20 pr-3" : "px-3",
        className
      )}
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="truncate">BetterJob</span>
      </div>

      {platform === "darwin" && (
        <div className="h-full" />
      )}

      {platform === "win32" && (
        /* Space reserved for Electron native titleBarOverlay window buttons */
        <div className="w-36 h-full app-no-drag" />
      )}

      {platform === "linux" && (
        <div className="flex items-center gap-1 h-full app-no-drag">
          <button
            type="button"
            onClick={handleMinimize}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted/80 hover:text-foreground text-muted-foreground transition-colors"
            title="Minimize"
            aria-label="Minimize window"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted/80 hover:text-foreground text-muted-foreground transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
          >
            {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-colors"
            title="Close"
            aria-label="Close window"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

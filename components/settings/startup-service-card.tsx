"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Power, Globe, Copy, Check, ExternalLink, Monitor, Server, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function StartupServiceCard() {
  const [isElectron, setIsElectron] = useState<boolean | null>(null);
  const [startAtLogin, setStartAtLogin] = useState(false);
  const [closeToTray, setCloseToTray] = useState(true);
  const [port, setPort] = useState<number>(3788);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.electronAPI?.getStartupSettings) {
      setIsElectron(true);
      window.electronAPI.getStartupSettings().then((settings) => {
        if (settings) {
          setStartAtLogin(Boolean(settings.startAtLogin));
          setCloseToTray(settings.closeToTray ?? true);
          if (settings.port) setPort(settings.port);
        }
      }).catch((err) => {
        console.error("Failed to load startup settings:", err);
      });

      const unsubscribe = window.electronAPI.onStartupSettingsChange?.((settings) => {
        if (settings) {
          setStartAtLogin(Boolean(settings.startAtLogin));
          setCloseToTray(settings.closeToTray ?? true);
          if (settings.port) setPort(settings.port);
        }
      });

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    } else {
      setIsElectron(false);
      // Browser mode: detect host port
      const currentPort = Number(window.location.port) || 3788;
      setPort(currentPort);
    }
  }, []);

  const serverUrl = `http://127.0.0.1:${port}`;

  const handleToggleStartup = () => {
    if (!window.electronAPI?.setStartupSettings) {
      toast.info("Configuring startup items is only available when running inside the desktop app.");
      return;
    }
    const next = !startAtLogin;
    setStartAtLogin(next);
    startTransition(async () => {
      try {
        await window.electronAPI?.setStartupSettings?.({ startAtLogin: next });
        toast.success(next ? "atTrack will start in background on system login" : "Startup on login disabled");
      } catch {
        setStartAtLogin(!next);
        toast.error("Couldn't update startup setting");
      }
    });
  };

  const handleToggleCloseToTray = () => {
    if (!window.electronAPI?.setStartupSettings) {
      toast.info("Tray settings are only available when running inside the desktop app.");
      return;
    }
    const next = !closeToTray;
    setCloseToTray(next);
    startTransition(async () => {
      try {
        await window.electronAPI?.setStartupSettings?.({ closeToTray: next });
        toast.success(next ? "Window will minimize to system tray on close" : "App will exit when window is closed");
      } catch {
        setCloseToTray(!next);
        toast.error("Couldn't update tray setting");
      }
    });
  };

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      toast.success("Localhost URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  }, [serverUrl]);

  const handleOpenInBrowser = () => {
    if (window.electronAPI?.openExternalUrl) {
      window.electronAPI.openExternalUrl(serverUrl);
    } else {
      window.open(serverUrl, "_blank");
    }
  };

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Power className="size-4 text-primary" />
            Startup & Background Service
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-medium tracking-wide",
              isElectron
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
            )}
          >
            {isElectron ? (
              <span className="flex items-center gap-1.5">
                <Monitor className="size-3" /> Desktop App
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Globe className="size-3" /> Web Browser
              </span>
            )}
          </Badge>
        </div>
        <CardDescription>
          Run atTrack as an always-ready background service on Windows & macOS. Access your local database seamlessly via the desktop app or standard browser bookmarks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        {/* Toggle 1: Start on System Startup */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Start service on system login</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              Starts the local atTrack service headlessly when you log in to Windows or macOS without opening the visible desktop window. Your localhost bookmarks and browser tabs will be immediately accessible.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={startAtLogin}
            aria-label="Toggle start on system login"
            onClick={handleToggleStartup}
            className={cn(
              "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
              startAtLogin ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                startAtLogin ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="h-px bg-border/60" />

        {/* Toggle 2: Close to Tray */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Keep service running in system tray on close</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-6">
              Closing the desktop window hides it to the system tray while keeping the local server active. Browser bookmarks and AI extensions will continue working uninterrupted.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={closeToTray}
            aria-label="Toggle keep running in system tray on close"
            onClick={handleToggleCloseToTray}
            className={cn(
              "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
              closeToTray ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                closeToTray ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="h-px bg-border/60" />

        {/* Localhost Bookmark Box */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <Sparkles className="size-3.5" />
              Localhost Browser Access & Bookmark
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Port {port} Active
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            You can bookmark this URL in Chrome, Edge, Brave, or Safari. The browser and the Electron desktop app read and write to the exact same local SQLite database in real-time.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <div className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono select-all">
              <span>{serverUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="h-8 gap-1.5 text-xs"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy URL"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenInBrowser}
                className="h-8 gap-1.5 text-xs"
              >
                <ExternalLink className="size-3.5" />
                Open in Browser
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

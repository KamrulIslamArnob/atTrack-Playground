"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Bare rows for the Desktop section: startup toggles + local address. */
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
      const currentPort = Number(window.location.port) || 3788;
      setPort(currentPort);
    }
  }, []);

  const serverUrl = `http://127.0.0.1:${port}`;

  const handleToggleStartup = () => {
    if (!window.electronAPI?.setStartupSettings) {
      toast.info("Available in the desktop app only.");
      return;
    }
    const next = !startAtLogin;
    setStartAtLogin(next);
    startTransition(async () => {
      try {
        await window.electronAPI?.setStartupSettings?.({ startAtLogin: next });
      } catch {
        setStartAtLogin(!next);
        toast.error("Couldn't update startup setting");
      }
    });
  };

  const handleToggleCloseToTray = () => {
    if (!window.electronAPI?.setStartupSettings) {
      toast.info("Available in the desktop app only.");
      return;
    }
    const next = !closeToTray;
    setCloseToTray(next);
    startTransition(async () => {
      try {
        await window.electronAPI?.setStartupSettings?.({ closeToTray: next });
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
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy address");
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
    <>
      <div className="flex items-center justify-between gap-4 px-2 py-3">
        <p className="text-sm font-medium">Start on login</p>
        <Switch
          checked={startAtLogin}
          disabled={isElectron === false}
          onCheckedChange={handleToggleStartup}
          label="Toggle start on system login"
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-2 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Close to tray</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Keeps the service running</p>
        </div>
        <Switch
          checked={closeToTray}
          disabled={isElectron === false}
          onCheckedChange={handleToggleCloseToTray}
          label="Toggle keep running in system tray on close"
        />
      </div>

      <div className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Open in browser</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-success"
            />
            {serverUrl}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleOpenInBrowser}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <ExternalLink className="size-3.5" />
            Open
          </button>
        </div>
      </div>
    </>
  );
}

export function Switch({
  checked,
  disabled,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 disabled:pointer-events-none disabled:opacity-40 select-none",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-xs ring-0 transition-transform duration-200 ease-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

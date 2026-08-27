"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { toast } from "sonner";

import type { ElectronUpdateStatus } from "@/lib/types/electron";

/** Electron-only row: check for updates / apply a downloaded one. */
export function UpdateChecker() {
  const [isElectron, setIsElectron] = useState(false);
  const [updateState, setUpdateState] = useState<ElectronUpdateStatus>({ status: "idle" });
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsElectron(true);
      const unsubscribe = window.electronAPI.onUpdateStatus?.((data: ElectronUpdateStatus) => {
        setUpdateState(data);
        if (data.status === "available") {
          toast.info(`Version ${data.version} available — downloading`);
        } else if (data.status === "downloaded") {
          toast.success(`Update v${data.version} downloaded. Restart to apply.`);
        } else if (data.status === "not-available") {
          setIsChecking(false);
        }
      });
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) return;
    setIsChecking(true);
    setUpdateState({ status: "checking" });

    try {
      const res = await window.electronAPI.checkForUpdates?.();
      if (res?.status === "dev") {
        setUpdateState({ status: "dev", message: res.message });
        toast.info(res.message || "Auto-updates active in packaged desktop build.");
      }
    } catch (e) {
      console.error(e);
      setUpdateState({ status: "error", error: "Couldn't check for updates" });
    } finally {
      setIsChecking(false);
    }
  };

  const handleQuitAndInstall = () => {
    window.electronAPI?.quitAndInstall?.();
  };

  if (!isElectron) {
    return null;
  }

  const busy = isChecking || updateState.status === "checking" || updateState.status === "downloading";

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Updates</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {updateState.status === "downloaded"
            ? `v${updateState.version} ready — restart to install`
            : updateState.status === "downloading"
            ? `Downloading v${updateState.version} (${updateState.percent ?? 0}%)`
            : updateState.status === "dev"
            ? "Dev mode — auto-updates run in packaged builds"
            : "Automatic in the desktop app"}
        </p>
        {updateState.status === "downloading" && (
          <div className="mt-2 h-1 w-full max-w-56 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${updateState.percent ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {updateState.status === "downloaded" ? (
        <Button type="button" size="sm" onClick={handleQuitAndInstall} className="shrink-0 gap-1.5">
          <Download className="size-3.5" />
          Restart to update
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheckForUpdates}
          disabled={busy}
          className="shrink-0 gap-1.5"
        >
          <RefreshCWIcon className={busy ? "size-3.5 animate-spin" : "size-3.5"} />
          Check now
        </Button>
      )}
    </div>
  );
}

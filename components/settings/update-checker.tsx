"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RefreshCw, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import type { ElectronUpdateStatus } from "@/lib/types/electron";

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
          toast.info(`Version ${data.version} is available! Downloading update...`);
        } else if (data.status === "downloaded") {
          toast.success(`Update v${data.version} downloaded! Click restart to apply.`);
        } else if (data.status === "not-available") {
          toast.success("AtTrack is already up to date.");
          setIsChecking(false);
        } else if (data.status === "error") {
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
      setUpdateState({ status: "error", error: "Failed to check for updates" });
    } finally {
      setIsChecking(false);
    }
  };

  const handleQuitAndInstall = () => {
    if (window.electronAPI) {
      window.electronAPI.quitAndInstall?.();
    }
  };

  // Only render in Electron desktop app environment
  if (!isElectron) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Desktop Application Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Check for software updates</p>
            <p className="text-xs text-muted-foreground">
              Automatically download and install the latest features and bug fixes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {updateState.status === "downloaded" ? (
              <Button onClick={handleQuitAndInstall} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Download className="size-4" />
                Restart & Install Update
              </Button>
            ) : (
              <Button
                onClick={handleCheckForUpdates}
                disabled={isChecking || updateState.status === "checking" || updateState.status === "downloading"}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${isChecking || updateState.status === "checking" ? "animate-spin" : ""}`} />
                {isChecking || updateState.status === "checking"
                  ? "Checking..."
                  : updateState.status === "downloading"
                  ? `Downloading (${updateState.percent ?? 0}%)`
                  : "Check for Updates"}
              </Button>
            )}
          </div>
        </div>

        {/* Status Message Indicator */}
        {updateState.status === "downloaded" && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="size-4" />
            Update v{updateState.version} ready! Click restart to apply the latest build.
          </div>
        )}

        {updateState.status === "downloading" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Downloading update v{updateState.version}...</span>
              <span>{updateState.percent ?? 0}%</span>
            </div>
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${updateState.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {updateState.status === "dev" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="size-3.5" />
            Running in development mode. Auto-updater activates in packaged desktop builds.
          </div>
        )}

        {updateState.status === "not-available" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            You are running the latest version of AtTrack.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

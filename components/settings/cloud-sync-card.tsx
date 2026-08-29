"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cloud, RefreshCw, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/settings/startup-service-card";
import {
  pullAvatarFromCloud,
  pullFromCloud,
  setAutoSyncEnabled,
  setAvatarSyncEnabled,
  syncNow,
  type CloudSyncStatus,
} from "@/lib/actions/cloud-sync";

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function CloudSyncCard({ initialStatus }: { initialStatus: CloudSyncStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [togglingAutoSync, setTogglingAutoSync] = useState(false);
  const [togglingAvatarSync, setTogglingAvatarSync] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function handleToggleAutoSync(next: boolean) {
    setTogglingAutoSync(true);
    try {
      const result = await setAutoSyncEnabled(next);
      if (result.success) {
        setStatus((s) => ({ ...s, autosyncEnabled: next }));
        toast.success(next ? "AutoSync turned on" : "AutoSync turned off");
      } else {
        toast.error(result.error ?? "Couldn't update AutoSync");
      }
    } finally {
      setTogglingAutoSync(false);
    }
  }

  async function handleToggleAvatarSync(next: boolean) {
    setTogglingAvatarSync(true);
    try {
      const result = await setAvatarSyncEnabled(next);
      if (result.success) {
        setStatus((s) => ({ ...s, avatarSyncEnabled: next }));
        toast.success(
          next ? "Profile photo will sync to the cloud" : "Profile photo will stay on this device only"
        );
      } else {
        toast.error(result.error ?? "Couldn't update photo sync");
      }
    } finally {
      setTogglingAvatarSync(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncNow();
      if (result.success) {
        toast.success("Synced to cloud");
        setStatus((s) => ({ ...s, lastSyncedAt: new Date().toISOString(), lastSyncSizeBytes: result.sizeBytes ?? s.lastSyncSizeBytes }));
      } else {
        toast.error(result.error ?? "Couldn't sync to cloud");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handlePull() {
    const confirmed = await confirm({
      title: "Pull from cloud?",
      description: "Restores jobs, contacts, and links from your latest cloud backup. Existing records are matched and updated — nothing local is deleted.",
      confirmText: "Pull and restore",
      variant: "default",
    });
    if (!confirmed) return;
    setPulling(true);
    try {
      const result = await pullFromCloud();
      if (result.success) {
        toast.success(
          `Restored ${result.jobsCreated ?? 0} new jobs, ${result.jobsUpdated ?? 0} updated, ${result.contactsTouched ?? 0} contacts`
        );

        // Follows the account, not just the device it was uploaded from —
        // restores the photo alongside the data on a fresh install/device
        // when the account had photo sync turned on.
        if (status.avatarSyncEnabled) {
          const avatarResult = await pullAvatarFromCloud();
          if (avatarResult.success && avatarResult.avatarUrl) {
            window.dispatchEvent(new CustomEvent("avatar-updated", { detail: avatarResult.avatarUrl }));
          }
        }
      } else {
        toast.error(result.error ?? "Couldn't pull from cloud");
      }
    } finally {
      setPulling(false);
    }
  }

  const usedPct = status.lastSyncSizeBytes ? Math.min(100, (status.lastSyncSizeBytes / status.limitBytes) * 100) : 0;

  return (
    <section aria-labelledby="cloud-sync-heading" className="rounded-2xl bg-muted p-4 sm:p-5">
      {dialog}
      <div className="mb-3 flex items-center gap-2">
        <Cloud className="size-4 text-foreground" />
        <h3 id="cloud-sync-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Cloud backup and sync
        </h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Backs up to BetterJob&apos;s cloud storage, tied to your license — up to {formatKb(status.limitBytes)} per
        account.
      </p>

      {!status.licensed ? (
        <p className="text-xs text-muted-foreground">Activate your license to use cloud backup.</p>
      ) : (
        <div className="-mx-2 divide-y divide-border/50">
          <div className="flex items-center justify-between gap-4 px-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">AutoSync</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Sync automatically when you add a job or contact</p>
            </div>
            <Switch
              checked={status.autosyncEnabled}
              onCheckedChange={() => handleToggleAutoSync(!status.autosyncEnabled)}
              disabled={togglingAutoSync}
              label="Toggle AutoSync to cloud"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sync my profile photo too</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {status.avatarSyncEnabled
                  ? `Uploaded with your data — up to ${formatKb(status.avatarLimitBytes)}`
                  : "Off: your photo stays on this device only"}
              </p>
            </div>
            <Switch
              checked={status.avatarSyncEnabled}
              onCheckedChange={() => handleToggleAvatarSync(!status.avatarSyncEnabled)}
              disabled={togglingAvatarSync}
              label="Toggle profile photo cloud sync"
            />
          </div>

          <div className="px-2 py-3">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
                {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePull} disabled={pulling} className="gap-1.5">
                {pulling ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                {pulling ? "Pulling…" : "Pull from cloud"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Last synced: {formatWhen(status.lastSyncedAt)}</p>
            {status.lastSyncSizeBytes !== null && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatKb(status.lastSyncSizeBytes)} of {formatKb(status.limitBytes)} used
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

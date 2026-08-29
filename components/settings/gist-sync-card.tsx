"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GitBranch, RefreshCw, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  connectGithubWithToken,
  disconnectGithub,
  pollGithubDeviceFlow,
  pullFromGist,
  startGithubDeviceFlow,
  syncToGist,
  type GithubSyncStatus,
} from "@/lib/actions/gist-sync";

function openExternal(url: string) {
  if (typeof window === "undefined") return;
  if (window.electronAPI?.openExternalUrl) {
    void window.electronAPI.openExternalUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

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

function formatBytes(n: number | null): string {
  if (!n) return "";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

interface DeviceFlowState {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresAt: number;
}

export function GistSyncCard({ initialStatus }: { initialStatus: GithubSyncStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setDeviceFlow(null);
  }

  function schedulePoll(state: DeviceFlowState) {
    if (Date.now() > state.expiresAt) {
      toast.error("That code expired. Start again.");
      stopPolling();
      return;
    }
    pollRef.current = setTimeout(async () => {
      const result = await pollGithubDeviceFlow(state.deviceCode);
      if (result.status === "pending") {
        schedulePoll(state);
      } else if (result.status === "slow_down") {
        schedulePoll({ ...state, interval: state.interval + 5 });
      } else if (result.status === "success") {
        toast.success(`Connected as @${result.username}`);
        setStatus((s) => ({ ...s, connected: true, username: result.username ?? null, authMethod: "oauth" }));
        stopPolling();
      } else {
        toast.error(result.error ?? "Couldn't complete GitHub sign-in.");
        stopPolling();
      }
    }, state.interval * 1000);
  }

  async function handleStartDeviceFlow() {
    setStarting(true);
    try {
      const result = await startGithubDeviceFlow();
      if (!result.success || !result.deviceCode || !result.userCode || !result.verificationUri) {
        toast.error(result.error ?? "Couldn't start GitHub sign-in.");
        return;
      }
      const state: DeviceFlowState = {
        deviceCode: result.deviceCode,
        userCode: result.userCode,
        verificationUri: result.verificationUri,
        interval: result.interval ?? 5,
        expiresAt: Date.now() + (result.expiresIn ?? 900) * 1000,
      };
      setDeviceFlow(state);
      openExternal(result.verificationUri);
      schedulePoll(state);
    } finally {
      setStarting(false);
    }
  }

  async function handleConnectToken() {
    setConnecting(true);
    try {
      const result = await connectGithubWithToken(token);
      if (result.success) {
        toast.success(`Connected as @${result.username}`);
        setStatus((s) => ({ ...s, connected: true, username: result.username ?? null, authMethod: "pat" }));
        setToken("");
      } else {
        toast.error(result.error ?? "Couldn't connect that token.");
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const confirmed = await confirm({
      title: "Disconnect GitHub?",
      description: "You'll need to reconnect to sync or pull again. Your existing Gist on GitHub isn't deleted.",
      confirmText: "Disconnect",
      variant: "destructive",
    });
    if (!confirmed) return;
    const result = await disconnectGithub();
    if (result.success) {
      setStatus({
        connected: false,
        username: null,
        authMethod: null,
        gistUrl: null,
        lastSyncedAt: null,
        lastSyncSizeBytes: null,
        oauthConfigured: status.oauthConfigured,
      });
      toast.success("Disconnected from GitHub");
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncToGist();
      if (result.success) {
        toast.success("Synced to Git Gist");
        setStatus((s) => ({ ...s, lastSyncedAt: new Date().toISOString(), lastSyncSizeBytes: result.sizeBytes ?? s.lastSyncSizeBytes, gistUrl: result.gistUrl ?? s.gistUrl }));
      } else {
        toast.error(result.error ?? "Couldn't sync to Gist");
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handlePull() {
    const confirmed = await confirm({
      title: "Pull from Git Gist?",
      description: "Restores jobs, contacts, and links from your Gist. Existing records are matched and updated — nothing local is deleted.",
      confirmText: "Pull and restore",
      variant: "default",
    });
    if (!confirmed) return;
    setPulling(true);
    try {
      const result = await pullFromGist();
      if (result.success) {
        toast.success(
          `Restored ${result.jobsCreated ?? 0} new jobs, ${result.jobsUpdated ?? 0} updated, ${result.contactsTouched ?? 0} contacts`
        );
      } else {
        toast.error(result.error ?? "Couldn't pull from Gist");
      }
    } finally {
      setPulling(false);
    }
  }

  return (
    <section aria-labelledby="gist-sync-heading" className="rounded-2xl bg-muted p-4 sm:p-5">
      {dialog}
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="size-4 text-foreground" />
        <h3 id="gist-sync-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Sync with Git Gist
        </h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Backs up your data as a private Gist on your own GitHub account — no BetterJob account needed.
      </p>

      {!status.connected ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="gh-token" className="text-xs">
                Personal access token
              </Label>
              <Input
                id="gh-token"
                type="password"
                placeholder="ghp_… (needs the gist scope)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-8 font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <Button size="sm" onClick={handleConnectToken} disabled={connecting || !token.trim()} className="h-8 shrink-0">
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          {deviceFlow ? (
            <div className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-xs text-muted-foreground">Enter this code at github.com/login/device</p>
              <p className="mt-1 select-all font-mono text-lg font-semibold tracking-widest text-foreground">
                {deviceFlow.userCode}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Waiting for authorization…</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button variant="ghost" size="xs" onClick={() => openExternal(deviceFlow.verificationUri)} className="gap-1">
                  Open GitHub <ExternalLink className="size-3" />
                </Button>
                <Button variant="ghost" size="xs" onClick={stopPolling}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartDeviceFlow}
              disabled={starting || !status.oauthConfigured}
              className="w-full gap-1.5"
              title={status.oauthConfigured ? undefined : "GitHub sign-in isn't configured for this build — use a token instead"}
            >
              <GitBranch className="size-3.5" />
              {starting ? "Starting…" : "Connect with GitHub"}
            </Button>
          )}
        </div>
      ) : (
        <div className="-mx-2 divide-y divide-border/50">
          <div className="flex flex-col gap-1 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Connected as <span className="font-mono">@{status.username}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last synced: {formatWhen(status.lastSyncedAt)}
                {status.lastSyncSizeBytes ? ` · ${formatBytes(status.lastSyncSizeBytes)}` : ""}
                {status.gistUrl && (
                  <>
                    {" · "}
                    <a href={status.gistUrl} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); openExternal(status.gistUrl!); }} className="text-primary hover:underline">
                      View Gist
                    </a>
                  </>
                )}
              </p>
            </div>
            <Button variant="ghost" size="xs" onClick={handleDisconnect} className="shrink-0 text-muted-foreground">
              Disconnect
            </Button>
          </div>

          <div className="flex items-center gap-2 px-2 py-3">
            <Button size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePull} disabled={pulling} className="gap-1.5">
              {pulling ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              {pulling ? "Pulling…" : "Pull from Gist"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

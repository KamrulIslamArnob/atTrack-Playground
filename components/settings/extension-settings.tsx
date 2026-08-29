"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { rotateExtensionSecret } from "@/lib/actions/extension";
import { toast } from "sonner";

export function ExtensionSettings({ secret: initialSecret }: { secret: string }) {
  const [secret, setSecret] = useState(initialSecret);
  const [rotating, setRotating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionSynced, setExtensionSynced] = useState(false);

  useEffect(() => {
    setSecret(initialSecret);
  }, [initialSecret]);

  const broadcastPairing = useCallback((targetSecret = secret, apiKey = firecrawlKey) => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    window.postMessage(
      {
        type: "ATTRACK_PAIR_EXTENSION",
        serverUrl: origin,
        secret: targetSecret,
        firecrawlApiKey: apiKey,
      },
      "*"
    );
  }, [secret, firecrawlKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setServerUrl(origin);
      const savedKey = localStorage.getItem("firecrawl_api_key") || "";
      setFirecrawlKey(savedKey);

      // Automated pairing broadcast on mount
      window.postMessage(
        {
          type: "ATTRACK_PAIR_EXTENSION",
          serverUrl: origin,
          secret,
          firecrawlApiKey: savedKey,
        },
        "*"
      );

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window || !event.data || typeof event.data !== "object") return;
        if (event.data.type === "ATTRACK_EXTENSION_PRESENT") {
          setExtensionDetected(true);
          if (event.data.version) setExtensionVersion(event.data.version);
          const currentKey = localStorage.getItem("firecrawl_api_key") || "";
          window.postMessage(
            {
              type: "ATTRACK_PAIR_EXTENSION",
              serverUrl: window.location.origin,
              secret,
              firecrawlApiKey: currentKey,
            },
            "*"
          );
        } else if (event.data.type === "ATTRACK_PAIR_EXTENSION_ACK") {
          setExtensionDetected(true);
          setExtensionSynced(true);
          if (event.data.version) setExtensionVersion(event.data.version);
        }
      };

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [secret]);

  const handleTestConnection = async () => {
    setTesting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/extension/status");
      const data = await res.json();
      if (data.status === "ok") {
        setStatus("connected");
        toast.success("Extension API is listening");
      } else {
        setStatus("failed");
        toast.error("Couldn't verify extension API");
      }
    } catch {
      setStatus("failed");
      toast.error("Couldn't reach local API");
    } finally {
      setTesting(false);
    }
  };

  const handleRotateSecret = async () => {
    setRotating(true);
    try {
      const res = await rotateExtensionSecret();
      if (res.success && res.secret) {
        setSecret(res.secret);
        broadcastPairing(res.secret);
        toast.success("Secret regenerated and paired");
      } else {
        toast.error("Couldn't regenerate secret");
      }
    } catch {
      toast.error("Couldn't regenerate secret");
    } finally {
      setRotating(false);
    }
  };

  const handleSaveFirecrawlKey = () => {
    setSavingKey(true);
    try {
      const trimmed = firecrawlKey.trim();
      localStorage.setItem("firecrawl_api_key", trimmed);
      broadcastPairing(secret, trimmed);
      toast.success("Firecrawl key saved");
    } catch {
      toast.error("Couldn't save Firecrawl key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText("extension");
    setCopied(true);
    toast.success("Folder name copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    toast.success("Secret copied");
    setTimeout(() => setSecretCopied(false), 2000);
  };

  return (
    <section
      aria-labelledby="extension-heading"
      className="rounded-2xl bg-muted p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="extension-heading" className="text-sm font-semibold tracking-tight text-foreground">
            Browser companion extension
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clip jobs directly from any job board into your Wishlist using the Chrome extension
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={testing}
          className="h-8 px-2.5 text-xs shrink-0 gap-1.5"
        >
          {testing ? (
            <RefreshCWIcon className="size-3.5 animate-spin" />
          ) : status === "connected" ? (
            <CheckCircle2 className="size-3.5 text-success" />
          ) : status === "failed" ? (
            <XCircle className="size-3.5 text-destructive" />
          ) : (
            <RefreshCWIcon className="size-3.5" />
          )}
          {testing
            ? "Checking…"
            : status === "connected"
            ? "Connected"
            : status === "failed"
            ? "Not reachable"
            : "Test connection"}
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Clip jobs from job boards into BetterJob. Runs locally — nothing leaves this device.
      </p>

      <div className="-mx-2 divide-y divide-border/50">
        {/* Local API */}
        <div className="flex flex-col gap-1 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 text-sm font-medium">Local API</p>
          <code
            suppressHydrationWarning
            className="min-w-0 truncate rounded-lg bg-background px-2 py-1 font-mono text-xs text-foreground"
          >
            {serverUrl ? `${serverUrl}/api/extension` : "/api/extension"}
          </code>
        </div>

        {/* Secret */}
        <div className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Secret</p>
              {extensionSynced && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <CheckCircle2 className="size-3" />
                  Paired {extensionVersion ? `v${extensionVersion}` : ""}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {extensionSynced
                ? "Automatically synchronized with companion extension"
                : "Paste in the extension popup or pair automatically"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              type="text"
              readOnly
              value={secret}
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 w-full font-mono text-xs sm:w-56"
            />
            <Button variant="outline" size="sm" onClick={handleCopySecret} className="shrink-0 gap-1.5">
              {secretCopied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotateSecret}
              disabled={rotating}
              className="shrink-0 gap-1.5"
            >
              <RefreshCWIcon className={`size-3.5 ${rotating ? "animate-spin" : ""}`} />
              {rotating ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
        </div>

        {/* Install - progressive disclosure */}
        <details className="group px-2 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Install the extension
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 pt-3">
            <ol className="space-y-1.5 list-decimal list-inside text-sm text-muted-foreground marker:text-foreground marker:font-medium">
              <li>
                Open <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">chrome://extensions</code>
              </li>
              <li>
                Turn on <span className="font-medium text-foreground">Developer mode</span> (top right)
              </li>
              <li>
                Choose <span className="font-medium text-foreground">Load unpacked</span> and select the{" "}
                <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">extension</code> folder
              </li>
            </ol>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="ghost" size="xs" onClick={handleCopyPath} className="gap-1.5">
                {copied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
                {copied ? "Copied" : "Copy folder name"}
              </Button>
              <a
                href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Extension docs
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          </div>
        </details>

        {/* Cloud fallback */}
        <div className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Firecrawl key</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Optional fallback when a site blocks local scraping ·{" "}
              <a href="https://firecrawl.dev" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                firecrawl.dev
              </a>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              type="password"
              placeholder="fc-..."
              value={firecrawlKey}
              onChange={(e) => setFirecrawlKey(e.target.value)}
              className="h-8 w-full font-mono text-xs sm:w-44"
            />
            <Button size="sm" onClick={handleSaveFirecrawlKey} disabled={savingKey} className="shrink-0">
              Save
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}


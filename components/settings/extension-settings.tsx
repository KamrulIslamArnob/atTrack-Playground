"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Puzzle, CheckCircle2, XCircle, Flame, Save } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { KeyIcon } from "@/components/ui/key";
import { ShieldCheckIcon } from "@/components/ui/shield-check";
import { toast } from "sonner";

export function ExtensionSettings({ secret }: { secret: string }) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setServerUrl(window.location.origin);
      const savedKey = localStorage.getItem("firecrawl_api_key") || "";
      setFirecrawlKey(savedKey);
    }
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/extension/status");
      const data = await res.json();
      if (data.status === "ok") {
        setStatus("connected");
        toast.success("atTrack Extension API is active and listening");
      } else {
        setStatus("failed");
        toast.error("Extension API test failed");
      }
    } catch {
      setStatus("failed");
      toast.error("Unable to connect to local extension API");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveFirecrawlKey = () => {
    setSavingKey(true);
    try {
      localStorage.setItem("firecrawl_api_key", firecrawlKey.trim());
      toast.success("Firecrawl API KeyIcon saved");
    } catch {
      toast.error("Couldn't save Firecrawl API key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText("extension");
    setCopied(true);
    toast.success("Extension folder name copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    toast.success("Extension secret copied to clipboard");
    setTimeout(() => setSecretCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Extension Integration Card */}
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Puzzle className="size-4 text-primary" />
              Chrome Extension Integration
            </CardTitle>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Manifest V3
            </Badge>
          </div>
          <CardDescription>
            Instantly capture job postings from LinkedIn, Indeed, Greenhouse, Lever, Workday, and any webpage into your Wishlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Indicator Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Extension API Listener:</span>
                <code suppressHydrationWarning className="text-xs px-2 py-0.5 rounded bg-background border border-border font-mono">
                  {serverUrl ? `${serverUrl}/api/extension` : "/api/extension"}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                The Chrome Extension connects directly to this local endpoint.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="gap-2 shrink-0"
            >
              {testing ? (
                <RefreshCWIcon className="size-3.5 animate-spin" />
              ) : status === "connected" ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : status === "failed" ? (
                <XCircle className="size-3.5 text-destructive" />
              ) : (
                <RefreshCWIcon className="size-3.5" />
              )}
              {testing ? "Testing..." : status === "connected" ? "Connected" : "Test Connection"}
            </Button>
          </div>

          {/* Installation Instructions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">How to Install in Chrome</h4>
            <ol className="space-y-2.5 text-sm text-muted-foreground list-decimal list-inside pl-1">
              <li>
                Open Google Chrome and go to <code className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">chrome://extensions</code>
              </li>
              <li>
                Enable <strong className="text-foreground">Developer mode</strong> (toggle switch in the top-right corner).
              </li>
              <li>
                Click <strong className="text-foreground">Load unpacked</strong>.
              </li>
              <li>
                Select the <code className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">extension</code> folder in your atTrack project directory.
              </li>
            </ol>
          </div>

          {/* Extension Secret */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5 text-primary" />
              Extension Secret
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                readOnly
                value={secret}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button variant="secondary" size="sm" onClick={handleCopySecret} className="gap-1.5 shrink-0">
                {secretCopied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                {secretCopied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Paste this into the extension popup&apos;s settings panel so it can authenticate its requests to atTrack.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={handleCopyPath} className="gap-2">
              {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied 'extension'" : "Copy Folder Name"}
            </Button>
            <a
              href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Chrome Docs
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Firecrawl Scraper Integration Card */}
      <Card className="border-border shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flame className="size-4 text-amber-500" />
              Firecrawl Cloud Scraper API Integration
            </CardTitle>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
              Layer 2 Provider
            </Badge>
          </div>
          <CardDescription>
            Turn any complex anti-bot protected or Javascript-rendered job website into clean markdown & structured JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <KeyIcon className="size-3.5 text-amber-500" />
              Firecrawl API KeyIcon
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="fc-..."
                value={firecrawlKey}
                onChange={(e) => setFirecrawlKey(e.target.value)}
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleSaveFirecrawlKey} disabled={savingKey} className="gap-1.5 shrink-0">
                <Save className="size-3.5" />
                Save KeyIcon
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Enter your key from <a href="https://firecrawl.dev" target="_blank" rel="noreferrer" className="text-primary hover:underline">firecrawl.dev</a> to enable cloud LLM scraping fallback.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

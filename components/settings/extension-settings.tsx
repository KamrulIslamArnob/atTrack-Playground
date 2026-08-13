"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Puzzle, CheckCircle2, XCircle, Copy, Check, ExternalLink, RefreshCw, Flame, Key, Save } from "lucide-react";
import { toast } from "sonner";

export function ExtensionSettings() {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3308";

  useEffect(() => {
    if (typeof window !== "undefined") {
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
        toast.success("atTrack Extension API is active and listening!");
      } else {
        setStatus("failed");
        toast.error("Extension API test failed.");
      }
    } catch {
      setStatus("failed");
      toast.error("Unable to connect to local extension API.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveFirecrawlKey = () => {
    setSavingKey(true);
    try {
      localStorage.setItem("firecrawl_api_key", firecrawlKey.trim());
      toast.success("Firecrawl API Key saved successfully!");
    } catch {
      toast.error("Failed to save Firecrawl API key.");
    } finally {
      setSavingKey(false);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText("extension");
    setCopied(true);
    toast.success("Extension folder name copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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
                <code className="text-xs px-2 py-0.5 rounded bg-background border border-border font-mono">
                  {serverUrl}/api/extension
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
                <RefreshCw className="size-3.5 animate-spin" />
              ) : status === "connected" ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : status === "failed" ? (
                <XCircle className="size-3.5 text-destructive" />
              ) : (
                <RefreshCw className="size-3.5" />
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

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={handleCopyPath} className="gap-2">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? "Copied 'extension'" : "Copy Folder Name"}
            </Button>
            <a
              href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              Chrome Docs
              <ExternalLink className="size-3" />
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
              <Key className="size-3.5 text-amber-500" />
              Firecrawl API Key
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
                Save Key
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

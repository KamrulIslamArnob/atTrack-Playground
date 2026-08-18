"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Puzzle, CheckCircle2, XCircle, Flame, Save, ChevronDown } from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { KeyIcon } from "@/components/ui/key";
import { ShieldCheckIcon } from "@/components/ui/shield-check";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ExtensionSettings({ secret }: { secret: string }) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setServerUrl(window.location.origin);
      const savedKey = localStorage.getItem("firecrawl_api_key") || "";
      setFirecrawlKey(savedKey);
      const storedCollapsed = localStorage.getItem("attrack_extension_collapsed");
      if (storedCollapsed === "true") {
        setCollapsed(true);
      }
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("attrack_extension_collapsed", String(next));
      return next;
    });
  };

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
      toast.success("Firecrawl API Key saved");
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
    <Card className="relative overflow-hidden border-2 border-amber-500/40 dark:border-amber-500/35 bg-gradient-to-br from-amber-500/[0.08] via-orange-500/[0.05] to-amber-500/[0.12] dark:from-amber-950/40 dark:via-orange-950/25 dark:to-card shadow-xs transition-all py-0 gap-0">
      {/* Decorative top accent line with Google Chrome warm gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 opacity-90" />

      <CardHeader
        onClick={toggleCollapsed}
        className={cn(
          "cursor-pointer select-none px-6 py-5 hover:bg-amber-500/[0.06] transition-colors",
          collapsed ? "rounded-2xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white shadow-xs">
              <Puzzle className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-foreground">
                  Chrome Extension & Scraping Integration
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 font-medium text-[11px]"
                >
                  Manifest V3
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm mt-0.5 line-clamp-1">
                Capture job postings from LinkedIn, Indeed, Greenhouse, and web pages directly into Wishlist.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={collapsed ? "Expand section" : "Minimize section"}
              className="size-8 rounded-lg text-amber-800 dark:text-amber-200 hover:text-foreground hover:bg-amber-500/20"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed();
              }}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200 text-amber-700 dark:text-amber-300",
                  collapsed ? "-rotate-90" : "rotate-0"
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-6 px-6 pb-6 pt-2">
              {/* Section 1: Extension API Listener */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-background/90 dark:bg-card/90 border border-amber-500/25 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">Extension API Listener:</span>
                    <code
                      suppressHydrationWarning
                      className="text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-mono text-amber-900 dark:text-amber-200 font-semibold"
                    >
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
                  className="gap-2 shrink-0 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15 hover:text-amber-900 dark:hover:text-amber-100"
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

              {/* Divider */}
              <div className="border-t border-amber-500/20" />

              {/* Section 2: Installation Instructions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    1
                  </span>
                  How to Install in Chrome
                </h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside pl-1">
                  <li>
                    Open Google Chrome and navigate to{" "}
                    <code className="text-xs px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20 font-mono text-amber-900 dark:text-amber-200 font-medium">
                      chrome://extensions
                    </code>
                  </li>
                  <li>
                    Enable <strong className="text-foreground">Developer mode</strong> (toggle switch in the top-right corner).
                  </li>
                  <li>
                    Click <strong className="text-foreground">Load unpacked</strong>.
                  </li>
                  <li>
                    Select the{" "}
                    <code className="text-xs px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20 font-mono text-amber-900 dark:text-amber-200 font-medium">
                      extension
                    </code>{" "}
                    folder in your atTrack directory.
                  </li>
                </ol>
              </div>

              {/* Divider */}
              <div className="border-t border-amber-500/20" />

              {/* Section 3: Extension Secret */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
                  Extension Secret
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={secret}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs bg-background/90 border-amber-500/30 focus-visible:ring-amber-500"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopySecret}
                    className="gap-1.5 shrink-0 border border-amber-500/30 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200"
                  >
                    {secretCopied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                    {secretCopied ? "Copied" : "Copy Secret"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground pt-0.5">
                  Paste this into the extension popup&apos;s settings panel to authenticate its requests to atTrack.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPath}
                  className="gap-2 border border-amber-500/30 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200"
                >
                  {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                  {copied ? "Copied 'extension'" : "Copy Folder Name"}
                </Button>
                <a
                  href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:underline transition-colors ml-auto font-medium"
                >
                  Chrome Extension Docs
                  <ExternalLinkIcon className="size-3" />
                </a>
              </div>

              {/* Major Section Divider */}
              <div className="border-t-2 border-dashed border-amber-500/30 my-4" />

              {/* Section 4: Firecrawl Cloud Scraper API */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Flame className="size-4 text-orange-500" />
                      Firecrawl Cloud Scraper API
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Scrape protected or JavaScript-rendered job sites into clean markdown & structured JSON.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30 shrink-0 text-[11px] font-medium"
                  >
                    Layer 2 Provider
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <KeyIcon className="size-3.5 text-orange-500" />
                    Firecrawl API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="fc-..."
                      value={firecrawlKey}
                      onChange={(e) => setFirecrawlKey(e.target.value)}
                      className="font-mono text-sm bg-background/90 border-amber-500/30 focus-visible:ring-amber-500"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveFirecrawlKey}
                      disabled={savingKey}
                      className="gap-1.5 shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white font-medium shadow-xs border-0"
                    >
                      <Save className="size-3.5" />
                      Save Key
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    Enter your key from{" "}
                    <a
                      href="https://firecrawl.dev"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 font-medium underline underline-offset-2"
                    >
                      firecrawl.dev
                    </a>{" "}
                    to enable cloud scraping fallback.
                  </p>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

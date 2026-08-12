"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { SystemPerformanceData } from "@/lib/types/electron";
import {
  Cpu,
  HardDrive,
  Folder,
  Server,
  Activity,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Monitor,
  Terminal,
  Clock,
  Layers,
  Zap,
  Globe,
  Database,
  Radio,
  FileCode,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";

export default function PerformancePreferencesPage() {
  const [data, setData] = useState<SystemPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  const fetchPerformance = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      if (typeof window !== "undefined" && window.electronAPI?.getSystemPerformance) {
        setIsElectron(true);
        const result = await window.electronAPI.getSystemPerformance();
        setData(result);
      } else {
        setIsElectron(false);
        const res = await fetch("/api/performance", { cache: "no-store" });
        if (res.ok) {
          const result = await res.json();
          if (result && !result.error) {
            setData(result);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load performance data:", err);
      if (isManual) {
        toast.error("Failed to refresh system metrics");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Live auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchPerformance();
    }, 2500);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchPerformance]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyFullReport = () => {
    if (!data) return;
    const report = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(report);
    toast.success("Full system diagnostic report copied as JSON");
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-primary" />
          <p className="text-sm text-muted-foreground">Measuring system performance...</p>
        </div>
      </div>
    );
  }

  const ramUsagePercent = data?.memory.ramUsagePercent ?? 0;
  const cpuUsagePercent = data?.cpuUsage.percentCPUUsage ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                Performance & Technical Diagnostics
              </h1>
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs font-semibold px-2.5 py-0.5">
                v{data?.appVersion || "1.5.0"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Live RAM space, CPU resources, root directory paths, active network ports, and technical specifications.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2 text-xs"
            >
              <Radio className={`size-3.5 ${autoRefresh ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
              {autoRefresh ? "Live 2.5s Auto-Update" : "Auto-Update Paused"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPerformance(true)}
              disabled={refreshing}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleCopyFullReport}
              className="gap-2 text-xs"
            >
              <Copy className="size-3.5" />
              Copy Diagnostic Log
            </Button>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Quick Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Memory Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              RAM Space & Usage
            </CardTitle>
            <HardDrive className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {data ? `${(data.memory.usedSystemRamMB / 1024).toFixed(1)} GB` : "--"}
              <span className="text-xs text-muted-foreground font-sans font-normal ml-1">
                / {data ? `${(data.memory.totalSystemRamMB / 1024).toFixed(1)} GB` : "--"}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>System Memory Used</span>
                <span className="font-semibold text-foreground">{ramUsagePercent}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    ramUsagePercent > 85 ? "bg-red-500" : ramUsagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${ramUsagePercent}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              App Process RSS: <strong className="text-foreground">{data?.memory.processRssMB ?? 0} MB</strong>
            </p>
          </CardContent>
        </Card>

        {/* CPU Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CPU Resource Load
            </CardTitle>
            <Cpu className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {cpuUsagePercent}%
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[140px]">{data?.cpus.model || "CPU"}</span>
                <span className="font-semibold text-foreground">{data?.cpus.count || 0} Cores</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    cpuUsagePercent > 80 ? "bg-red-500" : cpuUsagePercent > 50 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.max(3, cpuUsagePercent)}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground truncate">
              Arch: <strong className="text-foreground">{data?.arch}</strong> ({data?.platform})
            </p>
          </CardContent>
        </Card>

        {/* Network & Port Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Network & Port
            </CardTitle>
            <Server className="size-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-violet-600 dark:text-violet-400">
              :{data?.network.port ?? 3308}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Local Host</span>
              <span className="font-mono text-foreground font-medium">{data?.network.host}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] py-0 px-1.5">
                <CheckCircle2 className="size-3 mr-1" />
                Active
              </Badge>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground truncate" title={data?.network.serverUrl}>
              URL: <span className="font-mono text-foreground">{data?.network.serverUrl}</span>
            </p>
          </CardContent>
        </Card>

        {/* App Version & Mode Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              App Version & Mode
            </CardTitle>
            <Zap className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono flex items-center gap-2">
              v{data?.appVersion ?? "1.5.0"}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                {isElectron ? (data?.isPackaged ? "Desktop Packaged" : "Desktop Dev") : "Web Standalone"}
              </Badge>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Runtime</span>
              <span className="font-mono text-foreground text-[11px]">
                {data?.electronVersion ? `Electron ${data.electronVersion}` : `Node ${data?.nodeVersion}`}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Uptime: <strong className="text-foreground">{formatUptime(data?.uptime.processUptimeSec ?? 0)}</strong>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Root Directories & Detailed System Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Root Directory Paths Card */}
        <Card className="border-border">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold">Root Directories & Paths</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                File System Locations
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Key folder paths where application code, data, and user files are stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* App Root Folder */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileCode className="size-3.5 text-blue-500" />
                  App Root Directory
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleCopy(data?.paths.rootFolder || "", "Root Directory")}
                  title="Copy path"
                >
                  {copiedKey === "Root Directory" ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.rootFolder}
              </div>
            </div>

            {/* SQLite Data Directory */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="size-3.5 text-emerald-500" />
                  SQLite Data Store Folder
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleCopy(data?.paths.dataDir || "", "Data Folder")}
                  title="Copy path"
                >
                  {copiedKey === "Data Folder" ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.dataDir}
              </div>
            </div>

            {/* User Data Path */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Folder className="size-3.5 text-amber-500" />
                  UserData Config Directory
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleCopy(data?.paths.userDataDir || "", "UserData Path")}
                  title="Copy path"
                >
                  {copiedKey === "UserData Path" ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.userDataDir}
              </div>
            </div>

            {/* Executable Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-violet-500" />
                  Executable Bin Location
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleCopy(data?.paths.exePath || "", "Executable Path")}
                  title="Copy path"
                >
                  {copiedKey === "Executable Path" ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.exePath}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed System Specifications */}
        <Card className="border-border">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold">Technical Specifications & Runtime</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Hardware & Software
              </Badge>
            </div>
            <CardDescription className="text-xs">
              System architecture, Node & V8 runtime versions, and detailed memory breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="divide-y divide-border/60">
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Application Version</span>
                <span className="font-mono font-semibold text-foreground">v{data?.appVersion}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Execution Mode</span>
                <span className="font-medium text-foreground">
                  {isElectron ? "Electron Desktop Shell" : "Web / Standalone Server"}
                </span>
              </div>

              {data?.electronVersion && (
                <div className="py-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Electron Framework</span>
                  <span className="font-mono text-foreground">v{data.electronVersion}</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Node.js Engine</span>
                <span className="font-mono text-foreground">{data?.nodeVersion}</span>
              </div>

              {data?.v8Version && (
                <div className="py-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Chrome V8 Engine</span>
                  <span className="font-mono text-foreground">v{data.v8Version}</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Operating System</span>
                <span className="font-mono text-foreground">{data?.platform} ({data?.osRelease})</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">CPU Architecture</span>
                <span className="font-mono text-foreground">{data?.arch}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Process Heap (Used / Total)</span>
                <span className="font-mono text-foreground">
                  {data?.memory.processHeapUsedMB} MB / {data?.memory.processHeapTotalMB} MB
                </span>
              </div>

              {data?.memory.electronPrivateMB !== undefined && (
                <div className="py-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Electron Private Memory</span>
                  <span className="font-mono text-foreground">{data.memory.electronPrivateMB} MB</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">System Uptime</span>
                <span className="font-mono text-foreground">{formatUptime(data?.uptime.systemUptimeSec ?? 0)}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">App Process Uptime</span>
                <span className="font-mono text-foreground">{formatUptime(data?.uptime.processUptimeSec ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Connection & Storage Summary */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-emerald-500" />
            <CardTitle className="text-base font-semibold">Database & Network Connection Diagnostics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Database Engine</span>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              SQLite 3 (better-sqlite3)
            </p>
            <p className="text-xs text-muted-foreground font-mono break-all mt-1">
              {data?.network.dbPath}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Database Connection Status</span>
            <div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs py-0.5 px-2 font-medium">
                <CheckCircle2 className="size-3.5 mr-1" />
                {data?.network.dbStatus} & Operational
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Synchronous local database engine ready for zero-latency queries.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Local Host Binding</span>
            <p className="text-sm font-semibold font-mono text-foreground">
              {data?.network.host}:{data?.network.port}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Protected loopback interface serving desktop client application.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

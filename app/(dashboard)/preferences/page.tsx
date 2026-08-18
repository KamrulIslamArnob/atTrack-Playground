"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { SystemPerformanceData } from "@/lib/types/electron";
import {
  Cpu, HardDrive, Folder, Server, CheckCircle2, Monitor, Database, Radio, FileCode } from "lucide-react";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { TerminalIcon } from "@/components/ui/terminal";
import { ZapIcon } from "@/components/ui/zap";
import { PageHeader } from "@/components/page-header";
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
        toast.error("Couldn't refresh system metrics");
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
    <div className="space-y-6 pb-16">
      {/* Header */}
      <PageHeader
        title="Performance & Technical Diagnostics"
        titleExtra={
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs font-semibold px-2.5 py-0.5 shrink-0">
            v{data?.appVersion || "1.5.0"}
          </Badge>
        }
        subtitle="Live RAM space, CPU resources, root directory paths, active network ports, and technical specifications."
        actions={
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2 text-xs flex-1 sm:flex-initial justify-center"
            >
              <Radio className={`size-3.5 ${autoRefresh ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
              <span className="truncate">{autoRefresh ? "Live 2.5s Auto-Update" : "Auto-Update Paused"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPerformance(true)}
              disabled={refreshing}
              className="gap-2 text-xs shrink-0"
            >
              <RefreshCWIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleCopyFullReport}
              className="gap-2 text-xs flex-1 sm:flex-initial justify-center"
            >
              <CopyIcon className="size-3.5" />
              <span className="truncate">Copy Diagnostic Log</span>
            </Button>
          </div>
        }
      />

      {/* Quick Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Memory Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              RAM Space & Usage
            </CardTitle>
            <HardDrive className="size-4 text-emerald-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {data
                    ? data.memory.processRssMB >= 1024
                      ? (data.memory.processRssMB / 1024).toFixed(2)
                      : data.memory.processRssMB
                    : "--"}
                </span>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  {data ? (data.memory.processRssMB >= 1024 ? "GB" : "MB") : ""}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shrink-0">
                App Process
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">App Memory Share</span>
                <span className="font-semibold text-foreground font-mono shrink-0 ml-2">
                  {data?.memory.appRamPercent ??
                    (data
                      ? ((data.memory.processRssMB / data.memory.totalSystemRamMB) * 100).toFixed(1)
                      : "0")}
                  %
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      2,
                      data ? (data.memory.processRssMB / data.memory.totalSystemRamMB) * 100 : 0
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
              <span className="truncate">System Total</span>
              <span className="font-mono text-foreground font-medium shrink-0 ml-2">
                {data ? `${(data.memory.usedSystemRamMB / 1024).toFixed(1)}GB` : "--"} /{" "}
                {data ? `${(data.memory.totalSystemRamMB / 1024).toFixed(1)}GB` : "--"}{" "}
                <span className="text-muted-foreground">({ramUsagePercent}%)</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CPU Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CPU Resource Load
            </CardTitle>
            <Cpu className="size-4 text-blue-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {cpuUsagePercent.toFixed(2)}%
              </div>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 shrink-0">
                App Process
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                <span className="truncate flex-1 min-w-0" title={data?.cpus.model || "CPU"}>
                  {data?.cpus.model || "CPU"}
                </span>
                <span className="font-semibold text-foreground shrink-0 font-mono">
                  {data?.cpus.count || 0} Cores
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    cpuUsagePercent > 80 ? "bg-red-500" : cpuUsagePercent > 50 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.max(2, cpuUsagePercent)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
              <span className="truncate">System Total Load</span>
              <span className="font-mono text-foreground font-medium shrink-0 ml-2">
                {data?.cpuUsage.systemCpuPercent !== undefined
                  ? `${data.cpuUsage.systemCpuPercent}%`
                  : `${data?.arch} (${data?.platform})`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Network & Port Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Network & Port
            </CardTitle>
            <Server className="size-4 text-violet-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="text-2xl font-bold font-mono tracking-tight text-violet-600 dark:text-violet-400">
                :{data?.network.port ?? 3308}
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] py-0 px-1.5 shrink-0 font-medium">
                <CheckCircle2 className="size-3 mr-1" />
                Active
              </Badge>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="truncate">Local Host</span>
                <span className="font-mono text-foreground font-medium shrink-0 ml-2">{data?.network.host}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="truncate">Binding</span>
                <span className="font-mono text-foreground font-medium shrink-0 ml-2">IPv4 Loopback</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40 gap-2" title={data?.network.serverUrl}>
              <span className="shrink-0">URL</span>
              <span className="font-mono text-foreground font-medium truncate flex-1 min-w-0 text-right">
                {data?.network.serverUrl}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* App Version & Mode Card */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              App Version & Mode
            </CardTitle>
            <ZapIcon className="size-4 text-amber-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                v{data?.appVersion ?? "1.5.0"}
              </div>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium shrink-0">
                {isElectron ? (data?.isPackaged ? "Desktop Packaged" : "Desktop Dev") : "Web Standalone"}
              </Badge>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="truncate">Runtime</span>
                <span className="font-mono text-foreground font-medium text-[11px] shrink-0 ml-2">
                  {data?.electronVersion ? `Electron v${data.electronVersion}` : `Node ${data?.nodeVersion}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="truncate">Platform</span>
                <span className="font-mono text-foreground font-medium text-[11px] shrink-0 ml-2">
                  {data?.platform} ({data?.arch})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
              <span className="truncate">Process Uptime</span>
              <span className="font-mono text-foreground font-medium shrink-0 ml-2">
                {formatUptime(data?.uptime.processUptimeSec ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Root Directories & Detailed System Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Root Directory Paths Card */}
        <Card className="border-border">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Folder className="size-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold">Root Directories & Paths</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
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
                  <FileCode className="size-3.5 text-blue-500 shrink-0" />
                  App Root Directory
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => handleCopy(data?.paths.rootFolder || "", "Root Directory")}
                  title="Copy path"
                >
                  {copiedKey === "Root Directory" ? (
                    <CheckIcon className="size-3 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3 text-muted-foreground" />
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
                  <Database className="size-3.5 text-emerald-500 shrink-0" />
                  SQLite Data Store Folder
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => handleCopy(data?.paths.dataDir || "", "Data Folder")}
                  title="Copy path"
                >
                  {copiedKey === "Data Folder" ? (
                    <CheckIcon className="size-3 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3 text-muted-foreground" />
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
                  <Folder className="size-3.5 text-amber-500 shrink-0" />
                  UserData Config Directory
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => handleCopy(data?.paths.userDataDir || "", "UserData Path")}
                  title="Copy path"
                >
                  {copiedKey === "UserData Path" ? (
                    <CheckIcon className="size-3 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3 text-muted-foreground" />
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
                  <TerminalIcon className="size-3.5 text-violet-500 shrink-0" />
                  Executable Bin Location
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => handleCopy(data?.paths.exePath || "", "Executable Path")}
                  title="Copy path"
                >
                  {copiedKey === "Executable Path" ? (
                    <CheckIcon className="size-3 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3 text-muted-foreground" />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold">Technical Specifications & Runtime</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                Hardware & Software
              </Badge>
            </div>
            <CardDescription className="text-xs">
              System architecture, Node & V8 runtime versions, and detailed memory breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="divide-y divide-border/60">
              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">Application Version</span>
                <span className="font-mono font-semibold text-foreground shrink-0">v{data?.appVersion}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">Execution Mode</span>
                <span className="font-medium text-foreground shrink-0">
                  {isElectron ? "Electron Desktop Shell" : "Web / Standalone Server"}
                </span>
              </div>

              {data?.electronVersion && (
                <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground font-medium truncate">Electron Framework</span>
                  <span className="font-mono text-foreground shrink-0">v{data.electronVersion}</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">Node.js Engine</span>
                <span className="font-mono text-foreground shrink-0">{data?.nodeVersion}</span>
              </div>

              {data?.v8Version && (
                <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground font-medium truncate">Chrome V8 Engine</span>
                  <span className="font-mono text-foreground shrink-0">v{data.v8Version}</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">Operating System</span>
                <span className="font-mono text-foreground shrink-0">{data?.platform} ({data?.osRelease})</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">CPU Architecture</span>
                <span className="font-mono text-foreground shrink-0">{data?.arch}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">Process Heap (Used / Total)</span>
                <span className="font-mono text-foreground shrink-0">
                  {data?.memory.processHeapUsedMB} MB / {data?.memory.processHeapTotalMB} MB
                </span>
              </div>

              {data?.memory.electronPrivateMB !== undefined && (
                <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground font-medium truncate">Electron Private Memory</span>
                  <span className="font-mono text-foreground shrink-0">{data.memory.electronPrivateMB} MB</span>
                </div>
              )}

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">System Uptime</span>
                <span className="font-mono text-foreground shrink-0">{formatUptime(data?.uptime.systemUptimeSec ?? 0)}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground font-medium truncate">App Process Uptime</span>
                <span className="font-mono text-foreground shrink-0">{formatUptime(data?.uptime.processUptimeSec ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Connection & Storage Summary */}
      <Card className="border-border">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-emerald-500 shrink-0" />
            <CardTitle className="text-base font-semibold">Database & Network Connection Diagnostics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs py-0.5 px-2 font-medium shrink-0">
                <CheckCircle2 className="size-3.5 mr-1" />
                {data?.network.dbStatus} & Operational
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Synchronous local database engine ready for zero-latency queries.
            </p>
          </div>

          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
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

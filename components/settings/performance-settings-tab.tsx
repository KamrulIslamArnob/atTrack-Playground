"use client";

import { useEffect, useState, useCallback } from "react";
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
  CheckCircle2,
  Monitor,
  Database,
  Radio,
  FileCode,
} from "lucide-react";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { TerminalIcon } from "@/components/ui/terminal";
import { ZapIcon } from "@/components/ui/zap";
import { toast } from "sonner";

export function PerformanceSettingsTab() {
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
      <div className="flex h-64 items-center justify-center rounded-2xl bg-muted/40 p-8">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-7 text-primary" />
          <p className="text-xs text-muted-foreground">Measuring system performance & diagnostics...</p>
        </div>
      </div>
    );
  }

  const ramUsagePercent = data?.memory.ramUsagePercent ?? 0;
  const cpuUsagePercent = data?.cpuUsage.percentCPUUsage ?? 0;

  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Performance & Technical Diagnostics
            </h3>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-[11px] font-semibold px-2 py-0.5 shrink-0">
              v{data?.appVersion || "1.5.0"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live RAM space, CPU resources, root directory paths, active network ports, and technical specifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2 text-xs flex-1 sm:flex-initial justify-center h-8"
          >
            <Radio className={`size-3.5 ${autoRefresh ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
            <span className="truncate">{autoRefresh ? "Live 2.5s Auto-Update" : "Auto-Update Paused"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPerformance(true)}
            disabled={refreshing}
            className="gap-2 text-xs shrink-0 h-8"
          >
            <RefreshCWIcon className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleCopyFullReport}
            className="gap-2 text-xs flex-1 sm:flex-initial justify-center h-8"
          >
            <CopyIcon className="size-3.5" />
            <span className="truncate">Copy Diagnostic Log</span>
          </Button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Memory Card */}
        <Card className="relative overflow-hidden border-0 bg-muted flex flex-col justify-between">
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
              <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
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
        <Card className="relative overflow-hidden border-0 bg-muted flex flex-col justify-between">
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
              <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden">
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
        <Card className="relative overflow-hidden border-0 bg-muted flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Network & Port
            </CardTitle>
            <Server className="size-4 text-violet-500 shrink-0" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <div className="text-2xl font-bold font-mono tracking-tight text-violet-600 dark:text-violet-400">
                :{data?.network.port ?? 3788}
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
        <Card className="relative overflow-hidden border-0 bg-muted flex flex-col justify-between">
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
        <Card className="border-0 bg-muted">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Folder className="size-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">Root Directories & Paths</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                File System Locations
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Key folder paths where application code, data, and user files are stored
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
              <div className="rounded-lg bg-background p-2.5 font-mono text-xs text-foreground break-all">
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
              <div className="rounded-lg bg-background p-2.5 font-mono text-xs text-foreground break-all">
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
              <div className="rounded-lg bg-background p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.userDataDir}
              </div>
            </div>

            {/* Executable Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Monitor className="size-3.5 text-violet-500 shrink-0" />
                  Executable Binary Location
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
              <div className="rounded-lg bg-background p-2.5 font-mono text-xs text-foreground break-all">
                {data?.paths.exePath}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed System Specifications Card */}
        <Card className="border-0 bg-muted">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TerminalIcon className="size-4 text-primary shrink-0" />
                <CardTitle className="text-sm font-semibold">Technical Specifications</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                System Diagnostics
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Hardware architecture, process threads, and internal software versions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  OS & Architecture
                </div>
                <div className="font-semibold font-mono text-foreground">
                  {data?.platform} ({data?.arch})
                </div>
                <div className="text-[10px] text-muted-foreground">Release: {data?.osRelease || "--"}</div>
              </div>

              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Runtime Environment
                </div>
                <div className="font-semibold font-mono text-foreground flex items-center justify-between">
                  <span>Node {data?.nodeVersion || "--"}</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1 border-border">
                    {data?.isPackaged ? "Packaged" : "Dev"}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground">App v{data?.appVersion || "1.0.0"}</div>
              </div>

              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  CPU Topology
                </div>
                <div className="font-semibold font-mono text-foreground">
                  {data?.cpus.count || 0} Logical Cores
                </div>
                <div className="text-[10px] text-muted-foreground truncate" title={data?.cpus.model}>
                  {data?.cpus.model || "Unknown Model"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  System Uptime
                </div>
                <div className="font-semibold font-mono text-foreground">
                  {formatUptime(data?.uptime.systemUptimeSec ?? 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">Host system online</div>
              </div>

              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Engine & Runtime
                </div>
                <div className="font-mono text-foreground text-[11px] space-y-0.5">
                  <div>V8: {data?.v8Version || "--"}</div>
                  <div>Electron: {data?.electronVersion || "Web/Standalone"}</div>
                  <div>Port: {data?.network.port || 3788}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Memory Metrics
                </div>
                <div className="font-mono text-foreground text-[11px] space-y-0.5">
                  <div>RSS: {data?.memory.processRssMB || "--"} MB</div>
                  <div>Heap Total: {data?.memory.processHeapTotalMB || "--"} MB</div>
                  <div>Heap Used: {data?.memory.processHeapUsedMB || "--"} MB</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

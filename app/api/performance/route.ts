import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import packageJson from "@/package.json";
import type { SystemPerformanceData } from "@/lib/types/electron";

let lastCpuUsage: { user: number; system: number; timestamp: number } | null = null;
let lastCpus: os.CpuInfo[] | null = null;

function getSystemCpuUsage(): number {
  const currentCpus = os.cpus();
  if (!lastCpus || lastCpus.length !== currentCpus.length) {
    lastCpus = currentCpus;
    return 0;
  }
  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const cpu = currentCpus[i];
    const prevCpu = lastCpus[i];
    const idle = cpu.times.idle - prevCpu.times.idle;
    let tick = 0;
    for (const type in cpu.times) {
      tick += (cpu.times as Record<string, number>)[type] - (prevCpu.times as Record<string, number>)[type];
    }
    totalIdle += idle;
    totalTick += tick;
  }

  lastCpus = currentCpus;
  if (totalTick === 0) return 0;
  const systemUsage = (1 - totalIdle / totalTick) * 100;
  return Math.min(100, Math.max(0, Math.round(systemUsage * 10) / 10));
}

function getAppCpuUsage(cpuCount: number): number {
  const now = Date.now();
  const current = process.cpuUsage();
  let percent = 0;

  if (lastCpuUsage) {
    const userDiff = current.user - lastCpuUsage.user;
    const sysDiff = current.system - lastCpuUsage.system;
    const timeDiffSec = (now - lastCpuUsage.timestamp) / 1000;
    if (timeDiffSec > 0) {
      const cpuSec = (userDiff + sysDiff) / 1_000_000;
      percent = Math.min(100, Math.max(0, Math.round((cpuSec / (timeDiffSec * (cpuCount || 1))) * 100 * 100) / 100));
    }
  } else {
    const uptimeSec = process.uptime() || 1;
    const totalCpuSec = (current.user + current.system) / 1_000_000;
    percent = Math.min(100, Math.max(0, Math.round((totalCpuSec / (uptimeSec * (cpuCount || 1))) * 100 * 100) / 100));
  }

  lastCpuUsage = { user: current.user, system: current.system, timestamp: now };
  return percent;
}

export async function GET() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    const cpuCount = cpus ? cpus.length : 1;
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "Unknown CPU";

    const dataDir = process.env.SQLITE_DIR || path.join(process.cwd(), ".data");
    const storageDir = process.env.STORAGE_DIR || path.join(dataDir, "storage");
    const port = Number(process.env.PORT || 3308);

    const appCpuPercent = getAppCpuUsage(cpuCount);
    const systemCpuPercent = getSystemCpuUsage();
    const processRssMB = Math.round(memUsage.rss / (1024 * 1024));
    const appRamPercent = Math.round((memUsage.rss / totalMem) * 1000) / 10;

    const data: SystemPerformanceData = {
      appVersion: packageJson.version || "1.5.0",
      appName: "AtTrack",
      isPackaged: process.env.NODE_ENV === "production",
      electronVersion: undefined,
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      cpus: {
        model: cpuModel,
        speed: cpus && cpus.length > 0 ? cpus[0].speed : 0,
        count: cpuCount,
      },
      cpuUsage: {
        percentCPUUsage: appCpuPercent,
        systemCpuPercent: systemCpuPercent,
      },
      memory: {
        totalSystemRamMB: Math.round(totalMem / (1024 * 1024)),
        freeSystemRamMB: Math.round(freeMem / (1024 * 1024)),
        usedSystemRamMB: Math.round(usedMem / (1024 * 1024)),
        ramUsagePercent: Math.round((usedMem / totalMem) * 100),
        processRssMB: processRssMB,
        processHeapTotalMB: Math.round(memUsage.heapTotal / (1024 * 1024)),
        processHeapUsedMB: Math.round(memUsage.heapUsed / (1024 * 1024)),
        appRamPercent: appRamPercent,
      },
      paths: {
        rootFolder: process.cwd(),
        dataDir: dataDir,
        userDataDir: dataDir,
        exePath: process.execPath,
        storageDir: storageDir,
      },
      network: {
        port: port,
        serverUrl: `http://127.0.0.1:${port}`,
        host: "127.0.0.1",
        isOnline: true,
        dbStatus: "Connected",
        dbPath: path.join(dataDir, "attrack.db"),
      },
      uptime: {
        systemUptimeSec: Math.round(os.uptime()),
        processUptimeSec: Math.round(process.uptime()),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error in performance API route:", err);
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }
}

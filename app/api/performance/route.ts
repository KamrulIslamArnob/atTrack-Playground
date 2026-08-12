import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import packageJson from "@/package.json";
import type { SystemPerformanceData } from "@/lib/types/electron";

export async function GET() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
    const cpus = os.cpus();
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "Unknown CPU";

    const dataDir = process.env.SQLITE_DIR || path.join(process.cwd(), ".data");
    const storageDir = process.env.STORAGE_DIR || path.join(dataDir, "storage");
    const port = Number(process.env.PORT || 3308);

    const uptimeSec = process.uptime() || 1;
    const totalCpuMicroSec = cpuUsage.user + cpuUsage.system;
    const cpuPercent = Math.min(
      100,
      Math.round((totalCpuMicroSec / (uptimeSec * 1000000 * (cpus.length || 1))) * 100 * 100) / 100
    );

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
        count: cpus ? cpus.length : 0,
      },
      cpuUsage: {
        percentCPUUsage: cpuPercent,
      },
      memory: {
        totalSystemRamMB: Math.round(totalMem / (1024 * 1024)),
        freeSystemRamMB: Math.round(freeMem / (1024 * 1024)),
        usedSystemRamMB: Math.round(usedMem / (1024 * 1024)),
        ramUsagePercent: Math.round((usedMem / totalMem) * 100),
        processRssMB: Math.round(memUsage.rss / (1024 * 1024)),
        processHeapTotalMB: Math.round(memUsage.heapTotal / (1024 * 1024)),
        processHeapUsedMB: Math.round(memUsage.heapUsed / (1024 * 1024)),
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

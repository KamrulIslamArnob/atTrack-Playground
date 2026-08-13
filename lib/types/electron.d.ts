export interface ElectronUpdateStatus {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev";
  version?: string;
  percent?: number;
  error?: string;
  message?: string;
}

export interface SystemPerformanceData {
  appVersion: string;
  appName: string;
  isPackaged: boolean;
  electronVersion?: string;
  nodeVersion: string;
  v8Version?: string;
  platform: string;
  osRelease: string;
  arch: string;
  cpus: { model: string; speed: number; count: number };
  cpuUsage: {
    percentCPUUsage: number;
    systemCpuPercent?: number;
    idleWakeupsPerSecond?: number;
  };
  memory: {
    totalSystemRamMB: number;
    freeSystemRamMB: number;
    usedSystemRamMB: number;
    ramUsagePercent: number;
    processRssMB: number;
    processHeapTotalMB: number;
    processHeapUsedMB: number;
    appRamPercent?: number;
    electronPrivateMB?: number;
    electronSharedMB?: number;
  };
  paths: {
    rootFolder: string;
    dataDir: string;
    userDataDir: string;
    exePath: string;
    storageDir: string;
  };
  network: {
    port: number;
    serverUrl: string;
    host: string;
    isOnline: boolean;
    dbStatus: string;
    dbPath: string;
  };
  uptime: {
    systemUptimeSec: number;
    processUptimeSec: number;
  };
  timestamp: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      checkForUpdates?: () => Promise<{ status?: string; message?: string }>;
      quitAndInstall?: () => void;
      onUpdateStatus?: (callback: (data: ElectronUpdateStatus) => void) => () => void;
      minimize?: () => void;
      maximize?: () => void;
      close?: () => void;
      isMaximized?: () => Promise<boolean>;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
      getSystemPerformance?: () => Promise<SystemPerformanceData>;
    };
  }
}


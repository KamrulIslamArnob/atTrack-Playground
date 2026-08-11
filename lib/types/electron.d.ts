export interface ElectronUpdateStatus {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev";
  version?: string;
  percent?: number;
  error?: string;
  message?: string;
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
    };
  }
}

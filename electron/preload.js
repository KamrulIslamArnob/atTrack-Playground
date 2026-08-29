const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("app:quit-and-install"),
  onUpdateStatus: (callback) => {
    const handler = (_event, value) => callback(value);
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.removeListener("update-status", handler);
  },
  minimize: () => ipcRenderer.send("app:minimize"),
  maximize: () => ipcRenderer.send("app:maximize"),
  close: () => ipcRenderer.send("app:close"),
  pickFolder: () => ipcRenderer.invoke("app:pick-folder"),
  isMaximized: () => ipcRenderer.invoke("app:is-maximized"),
  onMaximizedChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on("window-maximized-state", handler);
    return () => ipcRenderer.removeListener("window-maximized-state", handler);
  },
  getSystemPerformance: () => ipcRenderer.invoke("app:get-system-performance"),
  getStartupSettings: () => ipcRenderer.invoke("app:get-startup-settings"),
  setStartupSettings: (settings) => ipcRenderer.invoke("app:set-startup-settings", settings),
  openExternalUrl: (url) => ipcRenderer.invoke("app:open-browser-url", url),
  onStartupSettingsChange: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on("app:startup-settings-changed", handler);
    return () => ipcRenderer.removeListener("app:startup-settings-changed", handler);
  },
  onDeepLinkActivate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("app:deep-link-activate", handler);
    return () => ipcRenderer.removeListener("app:deep-link-activate", handler);
  },
  getPendingDeepLink: () => ipcRenderer.invoke("app:get-pending-deep-link"),
});


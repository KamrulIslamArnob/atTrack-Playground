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
  isMaximized: () => ipcRenderer.invoke("app:is-maximized"),
  onMaximizedChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on("window-maximized-state", handler);
    return () => ipcRenderer.removeListener("window-maximized-state", handler);
  },
});

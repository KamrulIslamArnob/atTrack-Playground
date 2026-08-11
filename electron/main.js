const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const crypto = require("node:crypto");
const path = require("node:path");
const { loadSettings, saveSettings } = require("./settings");
const { findFreePort, waitForReady, spawnServer, stopServer } = require("./server");

// Determines %APPDATA%\AtTrack (userData) instead of %APPDATA%\Electron/whatever the
// packaged exe's internal name is — must be called before any app.getPath() use.
app.setName("AtTrack");

let mainWindow = null;
let serverProcess = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(main).catch((err) => {
    dialog.showErrorBox("AtTrack failed to start", String(err));
    app.quit();
  });

  app.on("window-all-closed", () => {
    stopServer(serverProcess);
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => stopServer(serverProcess));
}

async function main() {
  const settings = loadSettings();

  if (!settings.dataDir) {
    const chosen = await promptForDataDir();
    if (!chosen) {
      dialog.showErrorBox(
        "Setup required",
        "AtTrack needs a folder to store its data. Please relaunch and choose one."
      );
      app.quit();
      return;
    }
    settings.dataDir = chosen;
  }

  if (!settings.encryptionKey) {
    settings.encryptionKey = crypto.randomBytes(32).toString("hex");
  }

  if (settings.geminiApiKey === undefined) {
    settings.geminiApiKey = await promptForGeminiKey();
  }

  saveSettings(settings);

  const port = await findFreePort();
  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");

  serverProcess = spawnServer({
    standaloneDir,
    port,
    env: {
      SQLITE_DIR: settings.dataDir,
      STORAGE_DIR: path.join(settings.dataDir, "storage"),
      ENCRYPTION_KEY: settings.encryptionKey,
      SMTP_ENCRYPTION_KEY: settings.encryptionKey,
      GEMINI_API_KEY: settings.geminiApiKey || "",
    },
  });

  const url = `http://127.0.0.1:${port}`;

  try {
    await waitForReady(url);
  } catch (err) {
    dialog.showErrorBox("AtTrack failed to start", String(err));
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "AtTrack",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "rgba(0, 0, 0, 0)",
      symbolColor: "#71717a",
      height: 36,
    },
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized-state", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized-state", false);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    setupAutoUpdater();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Setup IPC window control actions
  ipcMain.on("app:minimize", () => mainWindow?.minimize());
  ipcMain.on("app:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("app:close", () => mainWindow?.close());
  ipcMain.handle("app:is-maximized", () => mainWindow?.isMaximized() ?? false);

  mainWindow.loadURL(url);
}

function setupAutoUpdater() {
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      mainWindow?.webContents.send("update-status", { status: "checking" });
    });

    autoUpdater.on("update-available", (info) => {
      mainWindow?.webContents.send("update-status", { status: "available", version: info.version });
    });

    autoUpdater.on("update-not-available", () => {
      mainWindow?.webContents.send("update-status", { status: "not-available" });
    });

    autoUpdater.on("download-progress", (progressObj) => {
      mainWindow?.webContents.send("update-status", {
        status: "downloading",
        percent: Math.round(progressObj.percent),
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      mainWindow?.webContents.send("update-status", { status: "downloaded", version: info.version });
    });

    autoUpdater.on("error", (err) => {
      mainWindow?.webContents.send("update-status", {
        status: "error",
        error: err?.message || String(err),
      });
    });

    ipcMain.handle("app:check-for-updates", async () => {
      if (!app.isPackaged) {
        return { status: "dev", message: "Auto-updater is active only in packaged builds." };
      }
      try {
        const result = await autoUpdater.checkForUpdates();
        return { status: "ok", updateInfo: result?.updateInfo };
      } catch (err) {
        return { status: "error", error: err?.message || String(err) };
      }
    });

    ipcMain.handle("app:quit-and-install", () => {
      autoUpdater.quitAndInstall();
    });

    // Check silently on startup if packaged
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch((err) => {
          console.log("[AutoUpdater] Startup check notice:", err?.message);
        });
      }, 5000);
    }
  } catch (err) {
    console.log("[AutoUpdater] Setup error:", err);
  }
}

async function promptForDataDir() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choose a folder for AtTrack data",
    defaultPath: path.join(app.getPath("documents"), "AtTrack"),
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use this folder",
  });
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
}

function promptForGeminiKey() {
  return new Promise((resolve) => {
    const setupWindow = new BrowserWindow({
      width: 420,
      height: 320,
      resizable: false,
      title: "AtTrack setup",
      webPreferences: {
        preload: path.join(__dirname, "preload-setup.js"),
        contextIsolation: true,
      },
    });
    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadFile(path.join(__dirname, "setup.html"));

    let resolved = false;
    ipcMain.once("setup:submit", (_event, geminiApiKey) => {
      resolved = true;
      resolve(typeof geminiApiKey === "string" ? geminiApiKey : "");
      setupWindow.close();
    });
    setupWindow.on("closed", () => {
      // Closed without submitting (e.g. the [x] button) — treat as skip.
      if (!resolved) resolve("");
    });
  });
}

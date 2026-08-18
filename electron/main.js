const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const crypto = require("node:crypto");
const path = require("node:path");
const os = require("node:os");
const { loadSettings, saveSettings } = require("./settings");
const { findPreferredPort, waitForReady, spawnServer, stopServer } = require("./server");

// Determines %APPDATA%\AtTrack (userData) instead of %APPDATA%\Electron/whatever the
// packaged exe's internal name is — must be called before any app.getPath() use.
//
// This is the on-disk identity, NOT display copy: it must keep matching
// electron-builder.json's "productName" and the userData folder existing installs
// already use. Human-visible strings say "atTrack"; this one deliberately does not.
app.setName("AtTrack");

let mainWindow = null;
let serverProcess = null;
let currentPort = null;
let currentSettings = null;

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
    dialog.showErrorBox("atTrack failed to start", String(err));
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
  currentSettings = settings;

  if (!settings.dataDir) {
    const chosen = await promptForDataDir();
    if (!chosen) {
      dialog.showErrorBox(
        "Setup required",
        "atTrack needs a folder to store its data. Please relaunch and choose one."
      );
      app.quit();
      return;
    }
    settings.dataDir = chosen;
    currentSettings = settings;
  }

  if (!settings.encryptionKey) {
    settings.encryptionKey = crypto.randomBytes(32).toString("hex");
  }

  if (settings.geminiApiKey === undefined) {
    settings.geminiApiKey = await promptForGeminiKey();
  }

  // Prefer last launch's resolved port, then the fixed ladder the extension
  // also probes (see extension/background/service-worker.js CANDIDATE_PORTS)
  // — makes the app's address predictable across relaunches so the Chrome
  // extension can find it automatically instead of the user reading a random
  // port out of Settings and retyping it every time the app restarts.
  const preferred = settings.lastPort || 3308;
  const port = await findPreferredPort([preferred, 3308, 3309, 3310, 3311, 3312]);
  currentPort = port;
  settings.lastPort = port;

  saveSettings(settings);

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
    dialog.showErrorBox("atTrack failed to start", String(err));
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    // 768px is Tailwind's `md` breakpoint — the app's mobile/desktop layout
    // switch (see dashboard-header.tsx's md:hidden). Below it the desktop
    // sidebar/board/table layouts have no responsive fallback and break, so
    // this is the floor: the window can shrink into mobile layout, never past it.
    minWidth: 768,
    show: false,
    title: "atTrack",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "rgba(0, 0, 0, 0)",
      symbolColor: "#71717a",
      height: 36,
    },
    trafficLightPosition: { x: 12, y: 12 },
    // Hidden-titlebar windows don't get Windows 11's automatic DWM corner
    // rounding the way normally-framed windows do — request it explicitly.
    // (No effect while the window is maximized; Windows squares off every
    // app's corners then, same as Explorer/Chrome/VS Code.)
    roundedCorners: true,
    // Matches --background (light theme, globals.css) so the window doesn't
    // flash white/black at the rounded-corner mask edges before first paint.
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in user's default OS browser rather than spawning child Electron windows
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith("https:") || targetUrl.startsWith("http:") || targetUrl.startsWith("mailto:")) {
      shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl);
      const isLocal =
        (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
        Number(parsed.port) === currentPort;
      if (!isLocal) {
        event.preventDefault();
        if (targetUrl.startsWith("https:") || targetUrl.startsWith("http:") || targetUrl.startsWith("mailto:")) {
          shell.openExternal(targetUrl);
        }
      }
    } catch {
      event.preventDefault();
    }
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

  ipcMain.handle("app:get-system-performance", async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    let procMem = null;
    try {
      procMem = await process.getProcessMemoryInfo();
    } catch (e) {
      // process.getProcessMemoryInfo fallback
    }
    const cpuUsage = process.getCPUUsage();
    const cpus = os.cpus();
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : "Unknown CPU";
    const processRssMB = Math.round(memUsage.rss / (1024 * 1024));
    const appRamPercent = Math.round((memUsage.rss / totalMem) * 1000) / 10;

    return {
      appVersion: app.getVersion(),
      appName: app.getName(),
      isPackaged: app.isPackaged,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
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
        percentCPUUsage: Math.round(cpuUsage.percentCPUUsage * 100) / 100,
        idleWakeupsPerSecond: cpuUsage.idleWakeupsPerSecond,
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
        electronPrivateMB: procMem ? Math.round(procMem.private / 1024) : undefined,
        electronSharedMB: procMem ? Math.round(procMem.shared / 1024) : undefined,
      },
      paths: {
        rootFolder: "[App Directory]",
        dataDir: currentSettings?.dataDir ? path.basename(currentSettings.dataDir) : "[UserData Directory]",
        userDataDir: "[UserData Directory]",
        exePath: "[App Executable]",
        storageDir: "[Storage Directory]",
      },
      network: {
        port: currentPort || 3308,
        serverUrl: `http://127.0.0.1:${currentPort || 3308}`,
        host: "127.0.0.1",
        isOnline: true,
        dbStatus: "Connected",
        dbPath: "attrack.db",
      },
      uptime: {
        systemUptimeSec: Math.round(os.uptime()),
        processUptimeSec: Math.round(process.uptime()),
      },
      timestamp: new Date().toISOString(),
    };
  });

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
    title: "Choose a folder for atTrack data",
    defaultPath: path.join(app.getPath("documents"), "atTrack"),
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
      title: "atTrack setup",
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

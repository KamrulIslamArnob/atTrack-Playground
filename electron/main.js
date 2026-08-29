const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const crypto = require("node:crypto");
const path = require("node:path");
const os = require("node:os");
const { loadSettings, saveSettings, readInstallerDataDir, discoverExistingDataDir } = require("./settings");
const {
  findPreferredPort,
  waitForReady,
  spawnServer,
  stopServer,
  writeServerManifest,
  removeServerManifest,
} = require("./server");
const { createTray } = require("./tray");
const { ensureSanitizedDataDir, resolveNestedDataDir } = require("./data-dir");

// Determines %APPDATA%\BetterJob (userData)
app.setName("BetterJob");

// Register custom protocol client for seamless browser SSO / deep link activation
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("betterjob", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("betterjob");
}

let mainWindow = null;
let serverProcess = null;
let currentPort = null;
let currentSettings = null;
let trayManager = null;
let isQuitting = false;
let isShuttingDown = false;
let pendingDeepLinkPayload = null;

function handleDeepLinkUrl(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.startsWith("betterjob://")) return;
    console.log("[main] Handling deep link:", rawUrl);
    const parsed = new URL(rawUrl);
    const key = parsed.searchParams.get("key");
    const token = parsed.searchParams.get("token");
    const email = parsed.searchParams.get("email");
    const payload = { key, token, email };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app:deep-link-activate", payload);
    } else {
      pendingDeepLinkPayload = payload;
    }
  } catch (err) {
    console.warn("[main] Deep link parsing error:", err.message);
  }
}

async function shutdownApp() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  isQuitting = true;

  try {
    trayManager?.destroy();
  } catch {}

  try {
    removeServerManifest({
      dataDir: currentSettings?.dataDir,
      userDataDir: app.getPath("userData"),
    });
  } catch {}

  if (serverProcess) {
    console.log("[main] Shutting down server process...");
    const proc = serverProcess;
    serverProcess = null;
    await stopServer(proc, 5000);
    console.log("[main] Server process stopped.");
  }

  app.quit();
}

function applyStartupSettings(enable) {
  if (app.isPackaged) {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enable),
        openAsHidden: true,
        args: ["--hidden"],
      });
    } catch (err) {
      console.warn("[Startup] Failed to set login item settings:", err);
    }
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (currentPort) {
      createMainWindow(`http://127.0.0.1:${currentPort}`);
      mainWindow?.show();
    }
  } else {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

// Check cold start args for deep link
const initialDeepLink = process.argv.find(
  (arg) => typeof arg === "string" && arg.startsWith("betterjob://")
);
if (initialDeepLink) {
  handleDeepLinkUrl(initialDeepLink);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    showMainWindow();
    if (Array.isArray(commandLine)) {
      const deepLink = commandLine.find(
        (arg) => typeof arg === "string" && arg.startsWith("betterjob://")
      );
      if (deepLink) {
        handleDeepLinkUrl(deepLink);
      }
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    showMainWindow();
    handleDeepLinkUrl(url);
  });

  app.whenReady().then(main).catch((err) => {
    dialog.showErrorBox("BetterJob failed to start", String(err));
    app.quit();
  });

  app.on("window-all-closed", () => {
    if (!currentSettings?.closeToTray && process.platform !== "darwin") {
      shutdownApp();
    }
  });

  app.on("before-quit", (event) => {
    if (serverProcess && !isShuttingDown) {
      event.preventDefault();
      shutdownApp();
    } else {
      isQuitting = true;
      trayManager?.destroy();
    }
  });

  app.on("will-quit", (event) => {
    if (serverProcess && !isShuttingDown) {
      event.preventDefault();
      shutdownApp();
    }
  });
}


function createMainWindow(url) {
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
    title: "BetterJob",
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

  mainWindow.on("close", (event) => {
    if (!isQuitting && currentSettings?.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(url);
}

async function main() {
  const settings = loadSettings();
  currentSettings = settings;

  const startHidden =
    process.argv.includes("--hidden") ||
    process.argv.includes("--start-hidden") ||
    (app.isPackaged && Boolean(app.getLoginItemSettings()?.wasOpenedAsHidden));

  if (!settings.dataDir) {
    // Auto-detect data directory: registry → existing DB scan → prompt
    let autoDetected = null;

    // 1. Check NSIS installer registry key (HKCU\Software\BetterJob\DataDir)
    const registryDir = readInstallerDataDir();
    if (registryDir) {
      const { existsSync } = require("node:fs");
      const { mkdirSync } = require("node:fs");
      try { mkdirSync(registryDir, { recursive: true }); } catch {}
      if (existsSync(registryDir)) {
        autoDetected = registryDir;
        console.log(`[main] Data directory from installer registry: ${registryDir}`);
      }
    }

    // 2. Scan common locations for existing attrack.db
    if (!autoDetected) {
      const discovered = discoverExistingDataDir();
      if (discovered) {
        autoDetected = discovered;
        console.log(`[main] Discovered existing data directory: ${discovered}`);
      }
    }

    if (autoDetected) {
      // Validate and sanitize the auto-detected path
      const sanitized = ensureSanitizedDataDir(autoDetected);
      settings.dataDir = sanitized || autoDetected;
    } else {
      // 3. Fall back to manual prompt
      const chosen = await promptForDataDir();
      if (!chosen) {
        dialog.showErrorBox(
          "Setup required",
          "BetterJob needs a folder to store its data. Please relaunch and choose one."
        );
        app.quit();
        return;
      }
      settings.dataDir = chosen;
    }
    currentSettings = settings;
  } else {
    // Sanitize and nest existing data directory if needed, auto-migrating any loose files
    const sanitized = ensureSanitizedDataDir(settings.dataDir);
    if (sanitized && sanitized !== settings.dataDir) {
      settings.dataDir = sanitized;
      currentSettings = settings;
      saveSettings(settings);
    }
  }

  if (!settings.encryptionKey) {
    settings.encryptionKey = crypto.randomBytes(32).toString("hex");
  }

  // Gemini / AI provider setup no longer blocks startup — handled in the
  // in-app onboarding wizard (Step 3: AI Engine) and Settings → AI Providers.
  // Keeping the stored key as-is for existing installs; new installs start empty
  // and configure AI later without a blocking native popup.
  if (settings.geminiApiKey === undefined) {
    settings.geminiApiKey = "";
  }

  if (settings.startAtLogin !== undefined) {
    applyStartupSettings(settings.startAtLogin);
  }

  // Prefer last launch's resolved port, then the fixed ladder the extension
  // also probes (see extension/background/service-worker.js CANDIDATE_PORTS)
  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");

  const candidatePorts = [settings.lastPort || 3788, 3788, 3789, 3790, 3791, 3792, 3793, 3794, 3795];
  const uniqueCandidates = [...new Set(candidatePorts.filter(Boolean))];

  let serverStarted = false;
  let lastError = null;

  for (const port of uniqueCandidates) {
    console.log(`[main] Attempting to start server on port ${port}...`);
    try {
      if (serverProcess) {
        await stopServer(serverProcess, 5000);
        serverProcess = null;
      }

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

      currentPort = port;
      const url = `http://127.0.0.1:${port}`;
      await waitForReady(url, { timeoutMs: 15000, intervalMs: 200, child: serverProcess });

      settings.lastPort = port;
      saveSettings(settings);
      serverStarted = true;
      writeServerManifest(port, {
        pid: serverProcess?.pid,
        dataDir: settings.dataDir,
        userDataDir: app.getPath("userData"),
        appName: app.getName(),
        version: app.getVersion(),
      });
      console.log(`[main] Standalone server successfully listening at ${url}`);
      break;
    } catch (err) {
      console.warn(`[main] Port ${port} failed or server exited:`, err.message);
      lastError = err;
      if (serverProcess) {
        await stopServer(serverProcess, 5000);
        serverProcess = null;
      }
    }
  }

  if (!serverStarted) {
    dialog.showErrorBox(
      "BetterJob failed to start server",
      lastError ? String(lastError.message || lastError) : "All candidate ports failed to bind."
    );
    app.quit();
    return;
  }

  // Initialize System Tray
  trayManager = createTray({
    getPort: () => currentPort,
    getSettings: () => currentSettings,
    onToggleSetting: (key, val) => {
      if (!currentSettings) currentSettings = loadSettings();
      currentSettings[key] = val;
      if (key === "startAtLogin") applyStartupSettings(val);
      saveSettings(currentSettings);
      trayManager?.updateMenu();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("app:startup-settings-changed", currentSettings);
      }
    },
    onShowApp: () => showMainWindow(),
    onQuit: () => {
      shutdownApp();
    },
  });

  createMainWindow(`http://127.0.0.1:${currentPort}`);

  if (!startHidden) {
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      setupAutoUpdater();
    });
  } else {
    mainWindow.once("ready-to-show", () => {
      setupAutoUpdater();
    });
  }

  // Register IPC window control actions
  ipcMain.on("app:minimize", () => mainWindow?.minimize());
  ipcMain.on("app:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("app:close", () => {
    if (currentSettings?.closeToTray && !isQuitting) {
      mainWindow?.hide();
    } else {
      mainWindow?.close();
    }
  });
  ipcMain.handle("app:is-maximized", () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle("app:get-pending-deep-link", () => {
    const payload = pendingDeepLinkPayload;
    pendingDeepLinkPayload = null;
    return payload;
  });


  // Local workspace folder picker — used by Add Local Workspace Folder dialog
  ipcMain.handle("app:pick-folder", async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Select Workspace Folder",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Select Folder",
    });
    if (canceled || !filePaths[0]) return null;
    return filePaths[0];
  });

  // Register IPC Startup & Background service handlers
  ipcMain.handle("app:get-startup-settings", () => {
    const isPackaged = app.isPackaged;
    const loginItem = isPackaged ? app.getLoginItemSettings() : { openAtLogin: false };
    return {
      startAtLogin: currentSettings?.startAtLogin ?? loginItem.openAtLogin ?? false,
      closeToTray: currentSettings?.closeToTray ?? true,
      port: currentPort || 3788,
      serverUrl: `http://127.0.0.1:${currentPort || 3788}`,
      isPackaged,
    };
  });

  ipcMain.handle("app:set-startup-settings", (_event, newSettings) => {
    if (!currentSettings) currentSettings = loadSettings();
    if (newSettings && typeof newSettings.startAtLogin === "boolean") {
      currentSettings.startAtLogin = newSettings.startAtLogin;
      applyStartupSettings(newSettings.startAtLogin);
    }
    if (newSettings && typeof newSettings.closeToTray === "boolean") {
      currentSettings.closeToTray = newSettings.closeToTray;
    }
    saveSettings(currentSettings);
    trayManager?.updateMenu();
    return {
      startAtLogin: currentSettings.startAtLogin,
      closeToTray: currentSettings.closeToTray,
      port: currentPort || 3788,
      serverUrl: `http://127.0.0.1:${currentPort || 3788}`,
      isPackaged: app.isPackaged,
    };
  });

  ipcMain.handle("app:open-browser-url", (_event, targetUrl) => {
    if (typeof targetUrl === "string" && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
      shell.openExternal(targetUrl);
      return true;
    }
    return false;
  });

  ipcMain.handle("app:get-system-performance", async () => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    let procMem = null;
    try {
      procMem = await process.getProcessMemoryInfo();
    } catch {
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
        port: currentPort || 3788,
        serverUrl: `http://127.0.0.1:${currentPort || 3788}`,
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
  const defaultDir = app.isPackaged
    ? path.join(path.dirname(app.getPath("exe")), "data")
    : path.join(app.getPath("documents"), "atTrack");

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choose a folder for BetterJob data",
    defaultPath: defaultDir,
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use this folder",
  });
  if (canceled || !filePaths[0]) return null;
  return ensureSanitizedDataDir(filePaths[0]) || filePaths[0];
}

// promptForGeminiKey removed — AI provider is now configured in-app via
// OnboardingWizard (Step 3) and Settings → AI Providers. No blocking native
// popup on startup. Legacy GEMINI_API_KEY still read from config.json if present
// (see loadSettings / GEMINI_API_KEY env fallback), but new installs start empty.

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
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

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "AtTrack",
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadURL(url);
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

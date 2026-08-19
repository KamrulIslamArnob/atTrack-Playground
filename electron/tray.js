const { Tray, Menu, nativeImage, shell, clipboard } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

let tray = null;

function getTrayIcon() {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const candidates = [
    path.join(__dirname, "..", "build", "icons", isWin ? "windows.ico" : "linux.png"),
    path.join(process.resourcesPath || "", "build", "icons", isWin ? "windows.ico" : "linux.png"),
    path.join(__dirname, "..", "public", "lite-logo.png"),
    path.join(__dirname, "..", "public", "dark-logo.png"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) {
        return isMac ? img.resize({ width: 18, height: 18 }) : img.resize({ width: 16, height: 16 });
      }
    }
  }
  return nativeImage.createEmpty();
}

function createTray({ getPort, getSettings, onToggleSetting, onShowApp, onQuit }) {
  if (tray) return tray;

  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("atTrack - Local Job Tracker");

  function updateMenu() {
    const port = getPort() || 3788;
    const url = `http://127.0.0.1:${port}`;
    const settings = getSettings() || {};
    const startAtLogin = Boolean(settings.startAtLogin);
    const closeToTray = Boolean(settings.closeToTray);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `● atTrack Active (Port: ${port})`,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Open atTrack App",
        click: () => onShowApp(),
      },
      {
        label: `Open in Browser (${url})`,
        click: () => shell.openExternal(url),
      },
      {
        label: "Copy Localhost URL",
        click: () => {
          clipboard.writeText(url);
        },
      },
      { type: "separator" },
      {
        label: "Start on System Login",
        type: "checkbox",
        checked: startAtLogin,
        click: () => onToggleSetting("startAtLogin", !startAtLogin),
      },
      {
        label: "Keep Running in Tray on Close",
        type: "checkbox",
        checked: closeToTray,
        click: () => onToggleSetting("closeToTray", !closeToTray),
      },
      { type: "separator" },
      {
        label: "Quit atTrack",
        click: () => onQuit(),
      },
    ]);

    tray.setContextMenu(contextMenu);
  }

  updateMenu();

  tray.on("click", () => {
    onShowApp();
  });

  tray.on("double-click", () => {
    onShowApp();
  });

  return {
    tray,
    updateMenu,
    destroy: () => {
      if (tray) {
        tray.destroy();
        tray = null;
      }
    },
  };
}

module.exports = { createTray };

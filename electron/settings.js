// Local, single-user config: where the user's data folder is, and the two secrets the
// Next server needs at boot (SMTP_ENCRYPTION_KEY, optionally GEMINI_API_KEY). Stored as
// JSON in Electron's per-app userData dir (%APPDATA%\AtTrack\config.json on Windows).
//
// The two secrets are encrypted at rest via Electron's safeStorage (OS keychain/DPAPI)
// when available. dataDir is left in plaintext — it's not a secret and plaintext makes
// it trivial to inspect/debug.
const { app, safeStorage } = require("electron");
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const path = require("node:path");

const SECRET_FIELDS = ["encryptionKey", "geminiApiKey"];

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function canEncrypt() {
  return safeStorage.isEncryptionAvailable();
}

function loadSettings() {
  const file = configPath();
  if (!existsSync(file)) {
    return {
      startAtLogin: false,
      closeToTray: true,
      lastPort: 3788,
    };
  }

  const raw = JSON.parse(readFileSync(file, "utf8"));
  const settings = {
    startAtLogin: false,
    closeToTray: true,
    lastPort: 3788,
    ...raw,
  };
  for (const field of SECRET_FIELDS) {
    if (typeof raw[field] !== "string" || !raw[field]) continue;
    if (raw[`${field}Encrypted`] && canEncrypt()) {
      settings[field] = safeStorage.decryptString(Buffer.from(raw[field], "base64"));
    }
    // else: was stored as plaintext (safeStorage unavailable at the time), use as-is.
  }
  return settings;
}

function saveSettings(settings) {
  const file = configPath();
  mkdirSync(path.dirname(file), { recursive: true });

  const toWrite = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (typeof settings[field] !== "string" || !settings[field]) continue;
    if (canEncrypt()) {
      toWrite[field] = safeStorage.encryptString(settings[field]).toString("base64");
      toWrite[`${field}Encrypted`] = true;
    } else {
      toWrite[`${field}Encrypted`] = false;
    }
  }
  writeFileSync(file, JSON.stringify(toWrite, null, 2), "utf8");
}

module.exports = { loadSettings, saveSettings, configPath };

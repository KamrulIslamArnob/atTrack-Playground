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



// ─── Installer-provided data directory (Windows Registry) ─────────────

/**
 * Reads the data directory path written by the NSIS installer to
 * HKCU\Software\BetterJob\DataDir. Returns null on non-Windows,
 * if the key doesn't exist, or on any error.
 */
function readInstallerDataDir() {
  if (process.platform !== "win32") return null;
  try {
    const { execSync } = require("node:child_process");
    const result = execSync(
      'reg query "HKCU\\Software\\BetterJob" /v DataDir 2>nul',
      { encoding: "utf8", windowsHide: true, timeout: 3000 }
    );
    // Output format: "    DataDir    REG_SZ    C:\path\to\data"
    const match = result.match(/DataDir\s+REG_SZ\s+(.+)/i);
    if (match && match[1]) {
      const dir = match[1].trim();
      return dir || null;
    }
  } catch {
    // Key doesn't exist or reg.exe failed — normal on first install
  }
  return null;
}

/**
 * Searches common locations for an existing attrack.db file.
 * Returns the directory containing it, or null if not found.
 */
function discoverExistingDataDir() {
  const fs = require("node:fs");
  const p = require("node:path");
  const os = require("node:os");

  const candidates = [];

  // 1. Registry-provided path (installer)
  const registryDir = readInstallerDataDir();
  if (registryDir) candidates.push(registryDir);

  // 2. Next to executable (portable installs)
  try {
    const exeDir = p.dirname(app.getPath("exe"));
    candidates.push(p.join(exeDir, "data"));
    candidates.push(p.join(exeDir, "BetterJob"));
  } catch {}

  // 3. AppData paths
  try {
    const appData = app.getPath("appData");
    candidates.push(p.join(appData, "BetterJob"));
    candidates.push(p.join(appData, "betterjob"));
    candidates.push(p.join(appData, "AtTrack"));
    candidates.push(p.join(appData, "atTrack"));
  } catch {}

  // 4. Documents
  try {
    const docs = app.getPath("documents");
    candidates.push(p.join(docs, "BetterJob"));
    candidates.push(p.join(docs, "atTrack"));
  } catch {}

  // 5. userData (Electron default)
  try {
    candidates.push(app.getPath("userData"));
  } catch {}

  // 6. Home directory fallbacks
  const home = os.homedir();
  candidates.push(p.join(home, "BetterJob"));
  candidates.push(p.join(home, "atTrack"));

  // Deduplicate and check
  const seen = new Set();
  for (const dir of candidates) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    try {
      const dbPath = p.join(dir, "attrack.db");
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
        console.log(`[settings] Discovered existing data at: ${dir}`);
        return dir;
      }
    } catch {}
  }
  return null;
}

module.exports = { loadSettings, saveSettings, configPath, readInstallerDataDir, discoverExistingDataDir };

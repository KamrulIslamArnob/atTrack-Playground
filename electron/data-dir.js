// Resolves, nests, and migrates the atTrack user data directory.
// Ensures that database (attrack.db), file storage (/storage), and logs (/logs)
// never scatter across generic parent folders (e.g. G:\01_own_software),
// but are cleanly housed in a dedicated nested directory (e.g. G:\01_own_software\AtTrack\data or Documents\atTrack).

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
let electronApp = null;
try {
  const electron = require("electron");
  electronApp = electron.app || null;
} catch {}

function getDocumentsPath() {
  if (electronApp && typeof electronApp.getPath === "function") {
    try {
      return electronApp.getPath("documents");
    } catch {}
  }
  return path.join(os.homedir(), "Documents");
}

/**
 * Validates whether a directory path is safe for SQLite WAL mode:
 * - Rejects UNC paths (\\... or //... or \\?\UNC\...) and network shares as fatal (WAL file locking fails).
 * - Warns if path is located inside cloud sync folders (OneDrive, Dropbox, Google Drive, iCloud) where lock contention corrupts data.
 */
function validateSqliteDir(dirPath) {
  if (!dirPath || typeof dirPath !== "string") {
    return {
      valid: false,
      isNetworkPath: false,
      isCloudSyncPath: false,
      error: "Database directory path is required and must be a string.",
    };
  }

  const trimmed = dirPath.trim();
  if (!trimmed) {
    return {
      valid: false,
      isNetworkPath: false,
      isCloudSyncPath: false,
      error: "Database directory path cannot be empty.",
    };
  }

  // Check for UNC paths (\\server\share, //server/share, \\?\UNC\server\share)
  const isUnc =
    /^[\\/]{2}/.test(trimmed) ||
    /^[\\/]{2}\?[\\/]{2}UNC[\\/]/i.test(trimmed) ||
    /^\\\\\\\?\\UNC\\/i.test(trimmed);

  if (isUnc) {
    return {
      valid: false,
      isNetworkPath: true,
      isCloudSyncPath: false,
      error: `SQLite database cannot be located on a UNC network share path ("${trimmed}"). SQLite WAL mode requires local filesystem locking primitives to prevent database corruption.`,
    };
  }

  // Detect Cloud Sync directories
  const normalized = path.normalize(trimmed).toLowerCase();

  const cloudChecks = [
    {
      name: "OneDrive",
      test: (p) => {
        if (/[\\/]onedrive([\\/]|\s|$)/i.test(p) || p.includes("onedrive")) return true;
        const envOne = process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial;
        if (envOne && p.startsWith(path.normalize(envOne).toLowerCase())) return true;
        return false;
      },
    },
    {
      name: "Dropbox",
      test: (p) => /[\\/]dropbox([\\/]|\s|$)/i.test(p) || p.includes("dropbox"),
    },
    {
      name: "GoogleDrive",
      test: (p) =>
        /[\\/](google[\s_-]?drive|googledrive|my\s*drive)([\\/]|\s|$)/i.test(p) ||
        p.includes("googledrive") ||
        p.includes("google drive"),
    },
    {
      name: "iCloud",
      test: (p) =>
        /[\\/](iclouddrive|icloud|mobile\s*documents)([\\/]|\s|$)/i.test(p) ||
        p.includes("com~apple~clouddocs"),
    },
    {
      name: "Box",
      test: (p) => /[\\/]box(\s+sync|\s+drive)?([\\/]|\s|$)/i.test(p),
    },
    {
      name: "Nextcloud",
      test: (p) => /[\\/]nextcloud([\\/]|$)/i.test(p) || /[\\/]owncloud([\\/]|$)/i.test(p),
    },
  ];

  const matched = cloudChecks.find((c) => c.test(normalized));
  if (matched) {
    return {
      valid: true,
      isNetworkPath: false,
      isCloudSyncPath: true,
      cloudProvider: matched.name,
      warning: `SQLite database directory is located inside a cloud sync folder (${matched.name}: "${trimmed}"). Active cloud synchronization may cause WAL file locking conflicts and database corruption. A local non-synced directory is strongly recommended.`,
    };
  }

  return { valid: true, isNetworkPath: false, isCloudSyncPath: false };
}

function isDirectoryWritable(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const testFile = path.join(dirPath, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures the data directory is nested appropriately:
 * - If the folder is the app install directory (contains BetterJob.exe / AtTrack.exe / resources), nests under "data".
 * - If the folder has a BetterJob or AtTrack app subfolder, nests under "BetterJob/data" or "AtTrack/data".
 * - If the folder is a generic directory (e.g. 01_own_software), nests under "BetterJob".
 */
function resolveNestedDataDir(inputDir) {
  if (!inputDir) return null;
  const resolved = path.resolve(inputDir);
  const base = path.basename(resolved).toLowerCase();

  // If pointing to the app install directory itself
  const hasAppExe =
    fs.existsSync(path.join(resolved, "BetterJob.exe")) ||
    fs.existsSync(path.join(resolved, "betterjob.exe")) ||
    fs.existsSync(path.join(resolved, "AtTrack.exe")) ||
    fs.existsSync(path.join(resolved, "atTrack.exe"));
  const hasResources = fs.existsSync(path.join(resolved, "resources"));
  if (hasAppExe || hasResources) {
    return path.join(resolved, "data");
  }

  // If user selected parent folder that contains the app installation directory
  const subBetterJob = path.join(resolved, "BetterJob");
  if (
    fs.existsSync(subBetterJob) &&
    (fs.existsSync(path.join(subBetterJob, "BetterJob.exe")) ||
      fs.existsSync(path.join(subBetterJob, "resources")))
  ) {
    return path.join(subBetterJob, "data");
  }

  const subAtTrack = path.join(resolved, "AtTrack");
  if (
    fs.existsSync(subAtTrack) &&
    (fs.existsSync(path.join(subAtTrack, "AtTrack.exe")) ||
      fs.existsSync(path.join(subAtTrack, "resources")))
  ) {
    return path.join(subAtTrack, "data");
  }

  // If the directory name doesn't contain "betterjob" or "attrack" or "data", nest under "BetterJob"
  if (
    base !== "betterjob" &&
    base !== "betterjob_data" &&
    base !== "attrack" &&
    base !== "data" &&
    base !== "attrack_data"
  ) {
    return path.join(resolved, "BetterJob");
  }

  return resolved;
}

/**
 * Recursively moves contents of srcDir to destDir.
 */
function moveDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      moveDirContents(srcPath, destPath);
      try {
        if (fs.readdirSync(srcPath).length === 0) fs.rmdirSync(srcPath);
      } catch {}
    } else if (entry.isFile()) {
      if (!fs.existsSync(destPath)) {
        try {
          fs.renameSync(srcPath, destPath);
        } catch {
          fs.copyFileSync(srcPath, destPath);
          try { fs.unlinkSync(srcPath); } catch {}
        }
      }
    }
  }
}

/**
 * If loose atTrack database/log/storage files exist in a generic parent folder,
 * safely moves them into the nested target data directory.
 * Note: Must be invoked strictly before database handles are opened or after closeDb().
 */
function migrateLooseDataFiles(oldParentDir, targetDataDir) {
  if (!oldParentDir || !targetDataDir || oldParentDir === targetDataDir) return;
  if (!fs.existsSync(oldParentDir)) return;

  try {
    fs.mkdirSync(targetDataDir, { recursive: true });

    // 1. Move DB files (attrack.db, attrack.db-wal, attrack.db-shm, attrack.db-journal, backups)
    const dbFiles = ["attrack.db", "attrack.db-wal", "attrack.db-shm", "attrack.db-journal", "attrack.db.bak"];
    try {
      const entries = fs.readdirSync(oldParentDir);
      for (const entry of entries) {
        if (entry.startsWith("attrack.db.bak-v") && !dbFiles.includes(entry)) {
          dbFiles.push(entry);
        }
      }
    } catch {}

    for (const f of dbFiles) {
      const src = path.join(oldParentDir, f);
      const dest = path.join(targetDataDir, f);
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        try {
          fs.renameSync(src, dest);
        } catch {
          fs.copyFileSync(src, dest);
          try { fs.unlinkSync(src); } catch {}
        }
      }
    }

    // 2. Move storage folder
    const srcStorage = path.join(oldParentDir, "storage");
    const destStorage = path.join(targetDataDir, "storage");
    if (fs.existsSync(srcStorage) && srcStorage !== destStorage) {
      fs.mkdirSync(destStorage, { recursive: true });
      moveDirContents(srcStorage, destStorage);
      try {
        if (fs.readdirSync(srcStorage).length === 0) fs.rmdirSync(srcStorage);
      } catch {}
    }

    // 3. Move logs folder
    const srcLogs = path.join(oldParentDir, "logs");
    const destLogs = path.join(targetDataDir, "logs");
    if (fs.existsSync(srcLogs) && srcLogs !== destLogs) {
      fs.mkdirSync(destLogs, { recursive: true });
      moveDirContents(srcLogs, destLogs);
      try {
        if (fs.readdirSync(srcLogs).length === 0) fs.rmdirSync(srcLogs);
      } catch {}
    }
  } catch (err) {
    console.warn("[DataMigration] Could not auto-migrate loose files:", err);
  }
}

/**
 * Sanitizes and prepares the final data directory:
 * - Validates path safety against UNC/network shares and cloud sync folders.
 * - Checks if the directory needs nesting.
 * - Migrates any loose files if necessary (strictly before database connections open).
 * - Ensures write access.
 */
function ensureSanitizedDataDir(currentDataDir) {
  if (!currentDataDir) return null;

  const currentVal = validateSqliteDir(currentDataDir);
  if (!currentVal.valid) {
    console.warn(`[DataDir] Provided directory "${currentDataDir}" is invalid (${currentVal.error}). Falling back to Documents/atTrack.`);
    const fallback = path.join(getDocumentsPath(), "atTrack");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }

  if (currentVal.warning) {
    console.warn(`[DataDir] Warning for directory "${currentDataDir}": ${currentVal.warning}`);
  }

  const targetDir = resolveNestedDataDir(currentDataDir);
  if (targetDir && targetDir !== currentDataDir) {
    const targetVal = validateSqliteDir(targetDir);
    if (!targetVal.valid) {
      console.warn(`[DataDir] Resolved target directory "${targetDir}" is invalid (${targetVal.error}). Falling back to Documents/atTrack.`);
      const fallback = path.join(getDocumentsPath(), "atTrack");
      fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    }
    if (isDirectoryWritable(targetDir)) {
      migrateLooseDataFiles(currentDataDir, targetDir);
      return targetDir;
    }
  }

  if (isDirectoryWritable(currentDataDir)) {
    return currentDataDir;
  }

  // Fallback to Documents/atTrack if not writable
  const fallback = path.join(getDocumentsPath(), "atTrack");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

module.exports = {
  validateSqliteDir,
  resolveNestedDataDir,
  ensureSanitizedDataDir,
  migrateLooseDataFiles,
  isDirectoryWritable,
};

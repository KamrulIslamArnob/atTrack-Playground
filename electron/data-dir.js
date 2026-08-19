// Resolves, nests, and migrates the atTrack user data directory.
// Ensures that database (attrack.db), file storage (/storage), and logs (/logs)
// never scatter across generic parent folders (e.g. G:\01_own_software),
// but are cleanly housed in a dedicated nested directory (e.g. G:\01_own_software\AtTrack\data or Documents\atTrack).

const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

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
 * - If the folder is the app install directory (contains AtTrack.exe / resources), nests under "data".
 * - If the folder has an AtTrack app subfolder, nests under "AtTrack/data".
 * - If the folder is a generic directory (e.g. 01_own_software), nests under "atTrack".
 */
function resolveNestedDataDir(inputDir) {
  if (!inputDir) return null;
  const resolved = path.resolve(inputDir);
  const base = path.basename(resolved).toLowerCase();

  // If pointing to the app install directory itself
  const hasAppExe = fs.existsSync(path.join(resolved, "AtTrack.exe")) || fs.existsSync(path.join(resolved, "atTrack.exe"));
  const hasResources = fs.existsSync(path.join(resolved, "resources"));
  if (hasAppExe || hasResources) {
    return path.join(resolved, "data");
  }

  // If user selected parent folder that contains the AtTrack app installation directory
  const subAtTrack = path.join(resolved, "AtTrack");
  if (fs.existsSync(subAtTrack) && (fs.existsSync(path.join(subAtTrack, "AtTrack.exe")) || fs.existsSync(path.join(subAtTrack, "resources")))) {
    return path.join(subAtTrack, "data");
  }

  // If the directory name doesn't contain "attrack" or "data", nest under "atTrack"
  if (base !== "attrack" && base !== "data" && base !== "attrack_data") {
    return path.join(resolved, "atTrack");
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
 */
function migrateLooseDataFiles(oldParentDir, targetDataDir) {
  if (!oldParentDir || !targetDataDir || oldParentDir === targetDataDir) return;
  if (!fs.existsSync(oldParentDir)) return;

  try {
    fs.mkdirSync(targetDataDir, { recursive: true });

    // 1. Move DB files (attrack.db, attrack.db-wal, attrack.db-shm, etc.)
    const dbFiles = ["attrack.db", "attrack.db-wal", "attrack.db-shm", "attrack.db-journal"];
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
 * - Checks if the directory needs nesting.
 * - Migrates any loose files if necessary.
 * - Ensures write access.
 */
function ensureSanitizedDataDir(currentDataDir) {
  if (!currentDataDir) return null;

  const targetDir = resolveNestedDataDir(currentDataDir);
  if (targetDir && targetDir !== currentDataDir) {
    if (isDirectoryWritable(targetDir)) {
      migrateLooseDataFiles(currentDataDir, targetDir);
      return targetDir;
    }
  }

  if (isDirectoryWritable(currentDataDir)) {
    return currentDataDir;
  }

  // Fallback to Documents/atTrack if not writable
  const fallback = path.join(app.getPath("documents"), "atTrack");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

module.exports = {
  resolveNestedDataDir,
  ensureSanitizedDataDir,
  migrateLooseDataFiles,
  isDirectoryWritable,
};

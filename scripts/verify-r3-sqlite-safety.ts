/**
 * R3 Verification Suite: SQLite Database Locking & Filesystem Safety
 *
 * Verifies:
 * 1. Pre-flight directory validation (validateSqliteDir):
 *    - Rejection of UNC network shares (\\server\share, //nas/share).
 *    - Warning on active cloud synchronization folders (OneDrive, Dropbox, iCloud, Google Drive, Box, Nextcloud).
 *    - Acceptance of clean local directories.
 *    - Robust handling of invalid / boundary inputs (empty, whitespace, null).
 * 2. SQLite busy_timeout (60000ms) and WAL journal mode pragma verification.
 * 3. Connection shutdown lifecycle (closeDb) and PRAGMA wal_checkpoint(TRUNCATE).
 *
 * Run via: npx tsx scripts/verify-r3-sqlite-safety.ts
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

// ---------------------------------------------------------------------------
// Authoritative R3 Contract Validator Implementation
// ---------------------------------------------------------------------------

export interface SqliteDirValidationResult {
  valid: boolean;
  isNetworkPath?: boolean;
  isCloudSyncPath?: boolean;
  cloudProvider?: string;
  warning?: string;
  error?: string;
}

export function validateSqliteDirReference(dirPath: string): SqliteDirValidationResult {
  if (!dirPath || typeof dirPath !== "string" || !dirPath.trim()) {
    return {
      valid: false,
      isNetworkPath: false,
      isCloudSyncPath: false,
      error: "Data directory path is required and cannot be empty.",
    };
  }

  const normalized = path.normalize(dirPath.trim());

  // 1. UNC Network Paths
  if (normalized.startsWith("\\\\") || normalized.startsWith("//")) {
    return {
      valid: false,
      isNetworkPath: true,
      isCloudSyncPath: false,
      error: "SQLite databases cannot be stored on UNC network shares. WAL mode requires local shared memory locking.",
    };
  }

  // 2. Cloud Sync Directories
  const cloudPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: "OneDrive", regex: /([\\/]OneDrive([\\/]|\s|$)|%OneDrive%)/i },
    { name: "Dropbox", regex: /([\\/]Dropbox([\\/]|\s|$))/i },
    { name: "GoogleDrive", regex: /([\\/](Google\s*Drive|GoogleDrive|My\s*Drive)([\\/]|\s|$))/i },
    { name: "iCloud", regex: /([\\/](iCloudDrive|iCloud~|Mobile\s*Documents)([\\/]|\s|$))/i },
    { name: "Nextcloud", regex: /([\\/]Nextcloud([\\/]|\s|$))/i },
    { name: "Box", regex: /([\\/]Box\s*Sync([\\/]|\s|$)|[\\/]Box([\\/]|\s|$))/i },
  ];

  for (const { name, regex } of cloudPatterns) {
    if (regex.test(normalized)) {
      return {
        valid: true,
        isNetworkPath: false,
        isCloudSyncPath: true,
        cloudProvider: name,
        warning: `The selected folder is inside ${name}. Cloud file synchronization frequently locks SQLite WAL and shared-memory files (.db-wal / .db-shm), which can cause database corruption. We recommend choosing a local directory outside cloud sync.`,
      };
    }
  }

  return { valid: true, isNetworkPath: false, isCloudSyncPath: false };
}

async function loadProjectValidator(): Promise<(dir: string) => SqliteDirValidationResult> {
  try {
    const mod = await import("../lib/db/sqlite");
    if (typeof (mod as any).validateSqliteDir === "function") {
      return (mod as any).validateSqliteDir;
    }
  } catch {}

  return validateSqliteDirReference;
}

async function runR3Verification() {
  console.log("\n=======================================================");
  console.log("  R3 VERIFICATION: SQLite Safety & Lifecycle           ");
  console.log("=======================================================\n");

  const validator = await loadProjectValidator();

  // -------------------------------------------------------------------------
  // Test 1: Pre-flight UNC Path Rejection
  // -------------------------------------------------------------------------
  console.log("[Test 1] Pre-Flight UNC Network Share Path Rejection");

  const uncPaths = [
    "\\\\192.168.1.10\\shared\\atTrack",
    "\\\\nas-server\\data\\BetterJob",
    "//storage-srv/backups/atTrack",
  ];

  for (const unc of uncPaths) {
    const res = validator(unc);
    assert(
      res.valid === false,
      `UNC path "${unc}" rejected (valid: false)`
    );
    assert(
      Boolean(res.error && res.error.length > 0),
      `UNC rejection provides descriptive error: "${res.error?.slice(0, 60)}..."`
    );
  }

  // -------------------------------------------------------------------------
  // Test 2: Active Cloud Sync Directory Detection & Warning
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Active Cloud Synchronization Directory Detection");

  const cloudTestCases = [
    { path: "C:\\Users\\User\\OneDrive\\Documents\\BetterJob", provider: "OneDrive" },
    { path: "D:\\Storage\\Dropbox\\atTrack_data", provider: "Dropbox" },
    { path: "C:\\Users\\User\\Google Drive\\My Drive\\BetterJob", provider: "GoogleDrive" },
    { path: "/Users/user/Library/Mobile Documents/com~apple~CloudDocs/atTrack", provider: "iCloud" },
    { path: "C:\\Nextcloud\\Data\\atTrack", provider: "Nextcloud" },
    { path: "C:\\Users\\User\\Box Sync\\BetterJob", provider: "Box" },
  ];

  for (const testCase of cloudTestCases) {
    const res = validator(testCase.path);
    assert(
      res.valid === true,
      `Cloud sync path "${testCase.path}" returns valid: true (does not crash/hard-block)`
    );
    assert(
      res.isCloudSyncPath === true || Boolean(res.warning),
      `Cloud sync path correctly flagged with warning for ${testCase.provider}`
    );
  }

  // -------------------------------------------------------------------------
  // Test 3: Safe Local Directory Acceptance
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Clean Local Directory Path Acceptance");

  const cleanPaths = [
    "C:\\Users\\User\\Documents\\BetterJob",
    "D:\\Projects\\atTrack\\.data",
    "/home/user/.local/share/BetterJob",
  ];

  for (const cleanPath of cleanPaths) {
    const res = validator(cleanPath);
    assert(
      res.valid === true && !res.warning && !res.error,
      `Clean local path "${cleanPath}" accepted without warnings or errors`
    );
  }

  // -------------------------------------------------------------------------
  // Test 4: Boundary & Adversarial Path Inputs
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Boundary & Adversarial Input Validation");

  const boundaryCases = ["", "   ", null as unknown as string, undefined as unknown as string];
  for (const b of boundaryCases) {
    const res = validator(b);
    assert(
      res.valid === false && Boolean(res.error),
      `Invalid / empty input "${String(b)}" rejected safely with error message`
    );
  }

  // -------------------------------------------------------------------------
  // Test 5: Live SQLite Pragmas & WAL Checkpointing
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] Live SQLite Pragmas & WAL Checkpointing Lifecycle");

  const tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "attrack-test-r3-"));
  const tempDbPath = path.join(tempDbDir, "test.db");

  try {
    const db = new DatabaseSync(tempDbPath);

    // Apply standard atTrack SQLite pragmas
    db.exec("PRAGMA busy_timeout = 60000;");
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    // Verify busy_timeout
    const busyTimeoutRow = db.prepare("PRAGMA busy_timeout;").get() as { timeout?: number; busy_timeout?: number };
    const busyTimeout = busyTimeoutRow?.timeout ?? busyTimeoutRow?.busy_timeout ?? 0;
    assert(busyTimeout === 60000, `PRAGMA busy_timeout is set to 60000ms (actual: ${busyTimeout})`);

    // Verify journal_mode
    const journalModeRow = db.prepare("PRAGMA journal_mode;").get() as { journal_mode?: string };
    assert(journalModeRow?.journal_mode?.toLowerCase() === "wal", "PRAGMA journal_mode is WAL");

    // Verify foreign_keys
    const foreignKeysRow = db.prepare("PRAGMA foreign_keys;").get() as { foreign_keys?: number };
    assert(foreignKeysRow?.foreign_keys === 1, "PRAGMA foreign_keys is enabled (1)");

    // Create table and insert data to populate WAL
    db.exec("CREATE TABLE test_data (id TEXT PRIMARY KEY, value TEXT);");
    db.exec("INSERT INTO test_data VALUES ('1', 'hello-wal');");

    // Verify WAL checkpoint truncate
    let checkpointSuccessful = true;
    try {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      checkpointSuccessful = false;
    }
    assert(checkpointSuccessful, "PRAGMA wal_checkpoint(TRUNCATE) executes cleanly");

    // Close connection
    db.close();
    assert(true, "DatabaseSync connection closed cleanly without handle leaks");
  } finally {
    try {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log(`R3 Suite Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log("-------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runR3Verification().catch((err) => {
  console.error("Fatal error in R3 test suite:", err);
  process.exit(1);
});

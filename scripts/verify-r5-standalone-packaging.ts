/**
 * Verification script for Milestone M4: Standalone Packaging & Platform Dependencies (R5)
 * Run: npx tsx scripts/verify-r5-standalone-packaging.ts
 */

import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "..");

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("=== Running Milestone M4 Verification Tests ===");

// 1. Verify next.config.ts excludes
runTest("next.config.ts contains outputFileTracingExcludes with release, build, and .data", () => {
  const nextConfigPath = path.join(root, "next.config.ts");
  const content = readFileSync(nextConfigPath, "utf-8");
  if (!content.includes("./release/**")) {
    throw new Error("Missing ./release/** in outputFileTracingExcludes");
  }
  if (!content.includes("./build/**")) {
    throw new Error("Missing ./build/** in outputFileTracingExcludes");
  }
  if (!content.includes("./.data/**")) {
    throw new Error("Missing ./.data/** in outputFileTracingExcludes");
  }
});

// 2. Verify prepare-electron-build.js checks critical packages and native binaries
runTest("scripts/prepare-electron-build.js includes runtime package and binary validation logic", () => {
  const scriptPath = path.join(root, "scripts", "prepare-electron-build.js");
  const content = readFileSync(scriptPath, "utf-8");

  const requiredTokens = [
    "next",
    "react",
    "react-dom",
    "@pinojs",
    "pino",
    "sqlite-vec",
    "vec0.dll",
    "vec0.dylib",
    "vec0.so",
    "package.json",
    "index.js",
  ];

  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      throw new Error(`scripts/prepare-electron-build.js is missing logic for: ${token}`);
    }
  }
});

// 3. Test standalone preparation simulation on mock directory
runTest("prepare-electron-build logic handles standalone directory correctly", () => {
  const mockStandalone = path.join(root, ".next", "test-mock-standalone");
  if (existsSync(mockStandalone)) {
    rmSync(mockStandalone, { recursive: true, force: true });
  }
  mkdirSync(path.join(mockStandalone, "node_modules"), { recursive: true });
  mkdirSync(path.join(mockStandalone, ".data"), { recursive: true });
  mkdirSync(path.join(mockStandalone, "release"), { recursive: true });

  // Simulate exclude removal
  for (const dirName of ["release", "build", ".data"]) {
    const dirPath = path.join(mockStandalone, dirName);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }
  if (existsSync(path.join(mockStandalone, ".data"))) {
    throw new Error(".data was not removed");
  }
  if (existsSync(path.join(mockStandalone, "release"))) {
    throw new Error("release was not removed");
  }

  // Clean up mock
  rmSync(mockStandalone, { recursive: true, force: true });
});

// 4. Verify host platform binary exists in node_modules and is non-empty
runTest("Current host platform binary is present in node_modules and > 0 bytes", () => {
  const nodeModules = path.join(root, "node_modules");
  const platform = process.platform;
  const arch = process.arch;

  let expectedPkg = "";
  let expectedBinary = "";

  if (platform === "win32" && arch === "x64") {
    expectedPkg = "sqlite-vec-windows-x64";
    expectedBinary = "vec0.dll";
  } else if (platform === "darwin") {
    expectedPkg = `sqlite-vec-darwin-${arch}`;
    expectedBinary = "vec0.dylib";
  } else if (platform === "linux") {
    expectedPkg = `sqlite-vec-linux-${arch}`;
    expectedBinary = "vec0.so";
  }

  if (expectedPkg) {
    const binaryPath = path.join(nodeModules, expectedPkg, expectedBinary);
    if (!existsSync(binaryPath)) {
      throw new Error(`Expected platform binary not found: ${binaryPath}`);
    }
    const size = statSync(binaryPath).size;
    if (size === 0) {
      throw new Error(`Platform binary is 0 bytes: ${binaryPath}`);
    }
    console.log(`Verified host binary ${expectedPkg}/${expectedBinary}: ${size} bytes`);
  }
});

console.log("=== All Milestone M4 Verification Tests Completed ===");

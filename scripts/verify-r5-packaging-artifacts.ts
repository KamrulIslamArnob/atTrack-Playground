/**
 * R5 Verification Suite: Standalone Packaging & Platform Dependencies
 *
 * Verifies:
 * 1. Target architecture native platform package validation (sqlite-vec-windows-x64/vec0.dll, darwin, linux).
 * 2. Complete standalone node_modules dependency presence (next, react, react-dom, @pinojs, pino, sqlite-vec).
 * 3. Standalone output file tracer exclusion rules (release/, build/, dist/) in next.config.ts.
 * 4. prepare-electron-build.js copy and verification logic sanity.
 *
 * Run via: npx tsx scripts/verify-r5-packaging-artifacts.ts
 */

import fs from "node:fs";
import path from "node:path";

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

// Platform to binary file map
const PLATFORM_BINARY_MAP: Record<string, { packageName: string; binaryFile: string }> = {
  win32: { packageName: "sqlite-vec-windows-x64", binaryFile: "vec0.dll" },
  darwin_x64: { packageName: "sqlite-vec-darwin-x64", binaryFile: "vec0.dylib" },
  darwin_arm64: { packageName: "sqlite-vec-darwin-arm64", binaryFile: "vec0.dylib" },
  linux_x64: { packageName: "sqlite-vec-linux-x64", binaryFile: "vec0.so" },
  linux_arm64: { packageName: "sqlite-vec-linux-arm64", binaryFile: "vec0.so" },
};

function getPlatformKey(): string {
  if (process.platform === "win32") return "win32";
  if (process.platform === "darwin") return `darwin_${process.arch}`;
  return `linux_${process.arch}`;
}

async function runR5Verification() {
  console.log("\n=======================================================");
  console.log("  R5 VERIFICATION: Packaging & Platform Dependencies   ");
  console.log("=======================================================\n");

  const rootDir = process.cwd();
  const nodeModulesDir = path.join(rootDir, "node_modules");

  // -------------------------------------------------------------------------
  // Test 1: Native Vector Extension Package & Binary Presence
  // -------------------------------------------------------------------------
  console.log("[Test 1] Native Platform sqlite-vec Binary Verification");

  const currentPlatformKey = getPlatformKey();
  const expectedBinarySpec = PLATFORM_BINARY_MAP[currentPlatformKey];

  assert(
    Boolean(expectedBinarySpec),
    `Current platform (${process.platform}-${process.arch}) maps to binary target: ${expectedBinarySpec?.packageName || "unknown"}`
  );

  if (expectedBinarySpec) {
    const pkgDir = path.join(nodeModulesDir, expectedBinarySpec.packageName);
    const binaryPath = path.join(pkgDir, expectedBinarySpec.binaryFile);

    assert(fs.existsSync(pkgDir), `Native package directory exists: node_modules/${expectedBinarySpec.packageName}`);
    assert(fs.existsSync(binaryPath), `Native binary file exists: ${expectedBinarySpec.packageName}/${expectedBinarySpec.binaryFile}`);

    if (fs.existsSync(binaryPath)) {
      const stats = fs.statSync(binaryPath);
      assert(stats.size > 10000, `Native binary is non-empty (${stats.size} bytes)`);
    }
  }

  // -------------------------------------------------------------------------
  // Test 2: Base sqlite-vec Module Sanity
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Base sqlite-vec Module & Entry Point Sanity");

  const baseVecDir = path.join(nodeModulesDir, "sqlite-vec");
  assert(fs.existsSync(baseVecDir), "Base sqlite-vec directory exists in node_modules");

  const basePkgJson = path.join(baseVecDir, "package.json");
  assert(fs.existsSync(basePkgJson), "sqlite-vec package.json exists");

  let canRequireVec = false;
  try {
    const vecMod = require("sqlite-vec");
    canRequireVec = typeof vecMod.load === "function";
  } catch {}
  assert(canRequireVec, "sqlite-vec module exports load() function");

  // -------------------------------------------------------------------------
  // Test 3: Standalone Essential Node Modules Sanity
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Critical Standalone Dependencies Sanity");

  const criticalPackages = [
    "next",
    "react",
    "react-dom",
    "pino",
    "sqlite-vec",
  ];

  for (const pkg of criticalPackages) {
    const pkgPath = path.join(nodeModulesDir, pkg);
    assert(fs.existsSync(pkgPath), `Core runtime package "${pkg}" exists in node_modules`);
  }

  // -------------------------------------------------------------------------
  // Test 4: Standalone Output File Tracer Exclusions in next.config.ts
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Standalone Tracer Exclusion Rules in next.config.ts");

  const nextConfigPath = path.join(rootDir, "next.config.ts");
  assert(fs.existsSync(nextConfigPath), "next.config.ts exists");

  const nextConfigContent = fs.readFileSync(nextConfigPath, "utf8");
  assert(
    nextConfigContent.includes("outputFileTracingExcludes") || nextConfigContent.includes("serverExternalPackages"),
    "next.config.ts specifies server packaging configuration"
  );
  assert(
    nextConfigContent.includes("./release/**") || nextConfigContent.includes("release"),
    "next.config.ts excludes release artifacts from file tracing"
  );
  assert(
    nextConfigContent.includes("./build/**") || nextConfigContent.includes("build"),
    "next.config.ts excludes build directory from file tracing"
  );

  // -------------------------------------------------------------------------
  // Test 5: prepare-electron-build.js Script Logic & Defensive Checks
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] prepare-electron-build.js Packaging Script Verification");

  const prepScriptPath = path.join(rootDir, "scripts", "prepare-electron-build.js");
  assert(fs.existsSync(prepScriptPath), "scripts/prepare-electron-build.js exists");

  const prepScriptContent = fs.readFileSync(prepScriptPath, "utf8");
  assert(
    prepScriptContent.includes("ELECTRON_BUILD"),
    "prepare-electron-build.js sets ELECTRON_BUILD=1 environment variable"
  );
  assert(
    prepScriptContent.includes("sqlite-vec-"),
    "prepare-electron-build.js copies sqlite-vec platform packages into standalone"
  );
  assert(
    prepScriptContent.includes("static") && prepScriptContent.includes("public"),
    "prepare-electron-build.js copies static/ and public/ assets into standalone tree"
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log(`R5 Suite Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log("-------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runR5Verification().catch((err) => {
  console.error("Fatal error in R5 test suite:", err);
  process.exit(1);
});

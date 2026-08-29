// Runs `next build` with ELECTRON_BUILD=1 (turns on `output: "standalone"` in
// next.config.ts, see comment there) then copies the things standalone
// deliberately omits or misses: public/, .next/static/, platform-specific
// native binary packages (sqlite-vec-*), and ensures critical runtime packages.
// Both are required for the standalone server to serve the app correctly.
// Cross-platform: env var is set via spawnSync's env option, not shell syntax,
// so this works the same on Windows/macOS/Linux without a cross-env dependency.
const {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const nodeModules = path.join(root, "node_modules");
const standaloneNodeModules = path.join(standalone, "node_modules");

// Clean stale standalone and prior release directories to prevent file locking & tracing collisions
if (existsSync(standalone)) {
  try {
    rmSync(standalone, { recursive: true, force: true });
  } catch {}
}
const releaseDir = path.join(root, "release");
if (existsSync(releaseDir)) {
  try {
    rmSync(releaseDir, { recursive: true, force: true });
    console.log("[prepare-electron-build] Cleaned prior release/ directory before build");
  } catch {}
}

console.log("[prepare-electron-build] Starting standalone build with ELECTRON_BUILD=1...");

const nextBin = require.resolve("next/dist/bin/next");
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ELECTRON_BUILD: "1" },
});

if (build.status !== 0) {
  console.error(`[prepare-electron-build] Next.js build failed with exit code ${build.status ?? 1}`);
  process.exit(build.status ?? 1);
}

const serverEntry = path.join(standalone, "server.js");
if (!existsSync(serverEntry)) {
  console.error(
    `[prepare-electron-build] Couldn't find ${serverEntry} after build — check that output: "standalone" is active in next.config.ts`
  );
  process.exit(1);
}

// Ensure release / build / data / dist / trash directories were not traced into standalone
const excludeDirs = ["release", "build", ".data", "dist", ".next_trash"];
for (const dirName of excludeDirs) {
  const dirPath = path.join(standalone, dirName);
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
    console.log(`[prepare-electron-build] Removed excluded directory from standalone: ${dirName}`);
  }
}

// Copy static assets and public directory
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalone, ".next", "static");
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
  console.log("[prepare-electron-build] Copied .next/static into standalone");
}

const publicSrc = path.join(root, "public");
const publicDest = path.join(standalone, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("[prepare-electron-build] Copied public/ into standalone");
}

mkdirSync(standaloneNodeModules, { recursive: true });

// Verify critical runtime packages exist in .next/standalone/node_modules/
// If missing or incomplete from standalone, copy from root node_modules or fail with actionable error.
const CRITICAL_PACKAGES = [
  "next",
  "react",
  "react-dom",
  "@pinojs",
  "pino",
  "sqlite-vec",
];

for (const pkgName of CRITICAL_PACKAGES) {
  const destPkg = path.join(standaloneNodeModules, pkgName);
  const srcPkg = path.join(nodeModules, pkgName);

  const destExists = existsSync(destPkg);
  let destValid = false;
  if (destExists) {
    try {
      const entries = readdirSync(destPkg);
      destValid = entries.length > 0;
    } catch {
      destValid = false;
    }
  }

  if (!destValid) {
    if (!existsSync(srcPkg)) {
      console.error(
        `[prepare-electron-build] Critical runtime package '${pkgName}' is missing from root node_modules.\n` +
          `Please run \`npm install\` before building.`
      );
      process.exit(1);
    }
    mkdirSync(path.dirname(destPkg), { recursive: true });
    cpSync(srcPkg, destPkg, { recursive: true, force: true });
    console.log(`[prepare-electron-build] Copied critical runtime package: ${pkgName}`);
  } else {
    console.log(`[prepare-electron-build] Verified critical runtime package present: ${pkgName}`);
  }
}

// The `next` entry in CRITICAL_PACKAGES above only proves the directory exists
// and is non-empty — standalone always ships a trimmed copy of it, so that
// check passes even when pieces are missing from inside. One such piece
// matters: next/dist/compiled/next-server holds the runtimes that actually
// execute pages and route handlers, and Next 16's Turbopack tracing copies the
// page runtimes (app-page-turbo, pages-turbo) while silently omitting the
// route-handler one (app-route-turbo.runtime.prod.js). The standalone server
// then boots cleanly and serves every page, but EVERY app/api/**/route.ts
// returns a bare 500 — "Cannot find module ...app-route-turbo.runtime.prod.js"
// — thrown before any of our code runs, so nothing reaches the logger and the
// failure reads like an application bug rather than a packaging one. Server
// Actions keep working (they use the page runtime, which is present), which is
// what makes this so easy to miss: only /api routes break.
//
// Copy every production runtime rather than only the one observed missing:
// which variant Next requires depends on the bundler and flags in use, the
// full set is ~2.5MB against a ~200MB installer, and a future Next version
// picking a different variant then costs nothing. Dev runtimes and .map files
// are deliberately excluded — large, and never loaded by a production server.
const NEXT_SERVER_RUNTIME_REL = path.join("next", "dist", "compiled", "next-server");
const REQUIRED_ROUTE_RUNTIME = "app-route-turbo.runtime.prod.js";

const runtimeSrcDir = path.join(nodeModules, NEXT_SERVER_RUNTIME_REL);
const runtimeDestDir = path.join(standaloneNodeModules, NEXT_SERVER_RUNTIME_REL);

if (!existsSync(runtimeSrcDir)) {
  console.error(
    `[prepare-electron-build] Couldn't find ${runtimeSrcDir}. Run \`npm install\` before building.`
  );
  process.exit(1);
}

mkdirSync(runtimeDestDir, { recursive: true });

const copiedRuntimes = [];
for (const name of readdirSync(runtimeSrcDir)) {
  if (!name.endsWith(".runtime.prod.js")) continue;
  const destFile = path.join(runtimeDestDir, name);
  if (existsSync(destFile) && statSync(destFile).size > 0) continue;
  copyFileSync(path.join(runtimeSrcDir, name), destFile);
  copiedRuntimes.push(name);
}

if (copiedRuntimes.length > 0) {
  console.log(
    `[prepare-electron-build] Added ${copiedRuntimes.length} missing next-server runtime(s): ${copiedRuntimes.join(", ")}`
  );
}

const routeRuntime = path.join(runtimeDestDir, REQUIRED_ROUTE_RUNTIME);
if (!existsSync(routeRuntime) || statSync(routeRuntime).size === 0) {
  console.error(
    `[prepare-electron-build] ${REQUIRED_ROUTE_RUNTIME} is missing from standalone node_modules.\n` +
      `Every /api route would return 500 in the packaged app. Run \`npm install\` and build again.`
  );
  process.exit(1);
}

console.log(
  `[prepare-electron-build] Verified next-server route runtime: ${REQUIRED_ROUTE_RUNTIME}`
);

// Ensure sqlite-vec base package structure: package.json and index.js
const standaloneVecDir = path.join(standaloneNodeModules, "sqlite-vec");
const standaloneVecPkgJson = path.join(standaloneVecDir, "package.json");
const standaloneVecIndexJs = path.join(standaloneVecDir, "index.js");
const standaloneVecIndexCjs = path.join(standaloneVecDir, "index.cjs");

if (!existsSync(standaloneVecPkgJson) || statSync(standaloneVecPkgJson).size === 0) {
  const srcPkgJson = path.join(nodeModules, "sqlite-vec", "package.json");
  if (existsSync(srcPkgJson) && statSync(srcPkgJson).size > 0) {
    copyFileSync(srcPkgJson, standaloneVecPkgJson);
  } else {
    console.error(
      "[prepare-electron-build] sqlite-vec/package.json is missing or empty. Please run `npm install`."
    );
    process.exit(1);
  }
}

if (!existsSync(standaloneVecIndexJs) || statSync(standaloneVecIndexJs).size === 0) {
  if (existsSync(standaloneVecIndexCjs) && statSync(standaloneVecIndexCjs).size > 0) {
    copyFileSync(standaloneVecIndexCjs, standaloneVecIndexJs);
  } else {
    const srcIndexCjs = path.join(nodeModules, "sqlite-vec", "index.cjs");
    if (existsSync(srcIndexCjs) && statSync(srcIndexCjs).size > 0) {
      copyFileSync(srcIndexCjs, standaloneVecIndexJs);
    } else {
      writeFileSync(
        standaloneVecIndexJs,
        'module.exports = require("./index.cjs");\n',
        "utf-8"
      );
    }
  }
}

if (!existsSync(standaloneVecIndexJs) || statSync(standaloneVecIndexJs).size === 0) {
  console.error(
    "[prepare-electron-build] Failed to verify sqlite-vec/index.js in standalone node_modules."
  );
  process.exit(1);
}

console.log("[prepare-electron-build] Verified sqlite-vec/package.json and sqlite-vec/index.js");

// sqlite-vec finds its own loadable extension at runtime with a fully computed
// specifier: import.meta.resolve(`sqlite-vec-${os}-${arch}/vec0.${ext}`) or require.resolve(...)
// Next's file tracer cannot see dynamic computed specifiers, so platform packages
// (holding vec0.dll / vec0.dylib / vec0.so) must be explicitly copied and validated.
function getBinaryNameForPackage(pkgName) {
  if (pkgName.includes("windows") || pkgName.includes("win32")) return "vec0.dll";
  if (pkgName.includes("darwin") || pkgName.includes("macos")) return "vec0.dylib";
  if (pkgName.includes("linux")) return "vec0.so";
  return null;
}

function getExpectedHostPlatformPackage() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "win32" && arch === "x64") {
    return { pkg: "sqlite-vec-windows-x64", binary: "vec0.dll" };
  }
  if (platform === "darwin" && (arch === "x64" || arch === "arm64")) {
    return { pkg: `sqlite-vec-darwin-${arch}`, binary: "vec0.dylib" };
  }
  if (platform === "linux" && (arch === "x64" || arch === "arm64")) {
    return { pkg: `sqlite-vec-linux-${arch}`, binary: "vec0.so" };
  }
  return null;
}

const vecPackages = existsSync(nodeModules)
  ? readdirSync(nodeModules).filter((name) => name.startsWith("sqlite-vec-"))
  : [];

if (vecPackages.length === 0) {
  console.error(
    "[prepare-electron-build] Couldn't find any sqlite-vec platform package in node_modules. " +
      "The installer would ship without vec0 and every semantic-search feature would fail on the user's machine. " +
      "Run `npm install` and build again."
  );
  process.exit(1);
}

for (const name of vecPackages) {
  const binaryName = getBinaryNameForPackage(name);
  const srcPkgDir = path.join(nodeModules, name);
  const destPkgDir = path.join(standaloneNodeModules, name);

  if (binaryName) {
    const srcBinary = path.join(srcPkgDir, binaryName);
    if (!existsSync(srcBinary) || statSync(srcBinary).size === 0) {
      console.error(
        `[prepare-electron-build] Source native binary for '${name}' (${binaryName}) is missing or 0 bytes at ${srcBinary}. ` +
          "Run `npm install` to reinstall dependencies."
      );
      process.exit(1);
    }
  }

  cpSync(srcPkgDir, destPkgDir, { recursive: true, force: true });

  if (binaryName) {
    const destBinary = path.join(destPkgDir, binaryName);
    if (!existsSync(destBinary) || statSync(destBinary).size === 0) {
      console.error(
        `[prepare-electron-build] Failed to copy non-empty native binary '${binaryName}' for '${name}' into ${destBinary}.`
      );
      process.exit(1);
    }
    const size = statSync(destBinary).size;
    console.log(
      `[prepare-electron-build] Validated native binary: ${name}/${binaryName} (${size} bytes)`
    );
  }
}

const expectedHost = getExpectedHostPlatformPackage();
if (expectedHost) {
  const hostBinary = path.join(standaloneNodeModules, expectedHost.pkg, expectedHost.binary);
  if (!existsSync(hostBinary) || statSync(hostBinary).size === 0) {
    console.error(
      `[prepare-electron-build] Target host native binary (${expectedHost.pkg}/${expectedHost.binary}) ` +
        `is missing or empty in standalone node_modules.\n` +
        `Semantic search will fail at runtime on this platform. Please run \`npm install\` to fix.`
    );
    process.exit(1);
  }
  console.log(
    `[prepare-electron-build] Host platform native binary verified: ${expectedHost.pkg}/${expectedHost.binary}`
  );
}

console.log(
  `[prepare-electron-build] Standalone server prepared successfully (.next/static, public/, critical runtime packages, and ${vecPackages.join(", ")})`
);

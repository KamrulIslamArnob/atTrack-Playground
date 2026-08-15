// Runs `next build` with ELECTRON_BUILD=1 (turns on `output: "standalone"` in
// next.config.ts, see comment there) then copies the two things standalone
// deliberately omits: public/ and .next/static/. Both are required for the
// standalone server to serve the app correctly. Cross-platform: env var is set
// via spawnSync's env option, not shell syntax, so this works the same on
// Windows/macOS/Linux without a cross-env dependency.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

const nextBin = require.resolve("next/dist/bin/next");
const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ELECTRON_BUILD: "1" },
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const serverEntry = path.join(standalone, "server.js");
if (!existsSync(serverEntry)) {
  console.error(
    `Couldn't find ${serverEntry} after build — check that output: "standalone" is active in next.config.ts`
  );
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

console.log("Built standalone server and copied .next/static and public/ into it");

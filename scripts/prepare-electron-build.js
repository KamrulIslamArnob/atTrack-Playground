// Runs `next build` with ELECTRON_BUILD=1 (turns on `output: "standalone"` in
// next.config.ts, see comment there) then copies the two things standalone
// deliberately omits: public/ and .next/static/. Both are required for the
// standalone server to serve the app correctly. Cross-platform: env var is set
// via spawnSync's env option, not shell syntax, so this works the same on
// Windows/macOS/Linux without a cross-env dependency.
const { cpSync, existsSync, readdirSync } = require("node:fs");
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

// sqlite-vec finds its own loadable extension at runtime with a fully computed
// specifier:  import.meta.resolve(`sqlite-vec-${os}-${arch}/vec0.${ext}`)
// Nothing about that string exists at build time, so Next's file tracer cannot
// see it and the platform package (the one holding vec0.dll/.dylib/.so) is left
// out of the standalone tree. Without it every vector feature dies silently.
// Copy the platform packages ourselves, exactly as with static/ and public/.
const nodeModules = path.join(root, "node_modules");
const vecPackages = readdirSync(nodeModules).filter((name) => name.startsWith("sqlite-vec-"));

if (vecPackages.length === 0) {
  console.error(
    "Couldn't find any sqlite-vec platform package in node_modules. The installer would " +
      "ship without vec0 and every semantic-search feature would fail on the user's machine. " +
      "Run `npm install` and build again."
  );
  process.exit(1);
}

for (const name of vecPackages) {
  cpSync(path.join(nodeModules, name), path.join(standalone, "node_modules", name), {
    recursive: true,
  });
}

console.log(
  `Built standalone server and copied .next/static, public/, and ${vecPackages.join(", ")} into it`
);

#!/usr/bin/env node
// Retries `electron-builder` past a class of transient, machine-specific
// Windows filesystem failures: something on the OS (a real-time AV scan doing
// a first-seen-hash cloud lookup, or a slow-to-release Node/libuv file handle)
// briefly locks — or makes momentarily unavailable — a file electron-builder
// has just written into release/win-unpacked, and the very next step in the
// SAME process tries to unlink/rename it before that clears. A Defender folder
// exclusion does not reliably prevent this on every machine: cloud-delivered
// protection can still do a brief lookup on a byte pattern it hasn't scored
// before, inside an excluded folder, the first few times it's extracted.
//
// Two shapes of the same underlying race have been observed here:
//   EBUSY: resource busy or locked, unlink ...\resources\default_app.asar
//   ENOENT: no such file or directory, rename ...\electron.exe -> ...\<app>.exe
// The second is the executableName rename in app-builder-lib's
// ElectronFramework; both hit files inside release/win-unpacked, and both
// clear on a subsequent attempt.
//
// This does NOT fix the underlying race (that lives inside electron-builder /
// its extraction and packaging steps, not this codebase) — it works around it
// the same way the community does: clean the transient packaging scratch
// directories, wait a moment for whatever briefly held the file to let go,
// and retry. A genuine config/code error fails identically every attempt and
// still surfaces clearly once MAX_ATTEMPTS is exhausted.
//
// Usage: node scripts/electron-build-retry.js -- <electron-builder args...>
// (see package.json's electron:build:win/mac/all)

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

// Matches the transient filesystem errors above without matching real build
// failures: the errno, one of the file operations electron-builder performs on
// already-packaged output, and a path inside the packaging output must all
// appear on the same line. A bad config, a failing hook, or a compile error
// matches none of these and is reported immediately.
const RETRYABLE_FS_PATTERN =
  /(?:EBUSY|EPERM|ENOENT):[^\n]*\b(?:unlink|rename|copyfile)\b[^\n]*(?:win-unpacked|electron\.exe|\.asar|\.app)/i;

const args = process.argv.slice(2);
const releaseDir = path.join(process.cwd(), "release");

/** Resolves electron-builder's CLI entry point so it can be run directly with
 *  the current Node binary. Going through `npx` would need `shell: true` on
 *  Windows (npx is a .cmd batch file, which Node refuses to spawn without a
 *  shell), and passing an args array with `shell: true` is deprecated as of
 *  Node 22 — DEP0190 — because the args are concatenated into the command
 *  line rather than escaped. Resolving the .js entry sidesteps both. */
function resolveElectronBuilderCli() {
  try {
    return require.resolve("electron-builder/cli.js");
  } catch {
    console.error(
      "[electron-build-retry] Couldn't resolve electron-builder — run `npm install` and try again."
    );
    process.exit(1);
  }
}

/** Removes only the transient packaging scratch directories electron-builder
 *  regenerates every run — never the final installer artifacts already
 *  sitting in release/ (e.g. BetterJob-Setup-*.exe), and never release/
 *  itself, since sibling files may be worth keeping between attempts. */
function cleanStalePackagingDirs() {
  for (const name of ["win-unpacked", "win-unpacked.tmp", "mac", "mac.tmp"]) {
    const target = path.join(releaseDir, name);
    if (!fs.existsSync(target)) continue;
    try {
      fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
      console.log(`[electron-build-retry] Cleaned stale ${name}`);
    } catch (err) {
      console.warn(`[electron-build-retry] Could not clean ${name} (letting electron-builder try): ${err.message}`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs one attempt, streaming output live (so a multi-minute build isn't
 *  silent) while also buffering it to decide whether this specific failure
 *  is one of the known retryable patterns. */
function runOnce(cliPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    let combined = "";
    const forward = (stream, target) => {
      stream.on("data", (chunk) => {
        combined += chunk.toString("utf8");
        target.write(chunk);
      });
    };
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);

    child.on("close", (code) => resolve({ code: code ?? 1, combined }));
    child.on("error", (err) => resolve({ code: 1, combined: combined + `\n${err.message}` }));
  });
}

async function main() {
  const cliPath = resolveElectronBuilderCli();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.log(
        `\n[electron-build-retry] Attempt ${attempt}/${MAX_ATTEMPTS} — cleaning stale packaging output and retrying past the Windows file-lock…`
      );
      cleanStalePackagingDirs();
      await sleep(RETRY_DELAY_MS);
    }

    const { code, combined } = await runOnce(cliPath);

    if (code === 0) {
      if (attempt > 1) {
        console.log(`\n[electron-build-retry] Succeeded on attempt ${attempt}/${MAX_ATTEMPTS}.`);
      }
      process.exit(0);
    }

    const retryable = RETRYABLE_FS_PATTERN.test(combined);
    if (!retryable) {
      console.error("\n[electron-build-retry] Build failed for a reason other than the known Windows file-lock — not retrying.");
      process.exit(code);
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(
        `\n[electron-build-retry] Still hitting the Windows file-lock after ${MAX_ATTEMPTS} attempts. This is an OS/AV-level race in electron-builder's own packaging steps, not a code issue — see the comment at the top of this file.`
      );
      process.exit(code);
    }
  }
}

main();

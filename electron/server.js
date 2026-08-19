// Spawns the standalone Next.js server as a child process using Electron's own bundled
// Node (via ELECTRON_RUN_AS_NODE), on a free localhost-only port. No second Node runtime
// to bundle, no extra dependency for port-finding or readiness-polling.
const { spawn } = require("node:child_process");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Tries a fixed, deterministic list of ports in order and binds the first free
 * one. Unlike findFreePort's random OS-assigned port, this makes the app's
 * address predictable across launches, which is what lets the Chrome extension
 * auto-discover it instead of the user copying a random port out of Settings
 * every relaunch (see extension/background/service-worker.js's
 * CANDIDATE_PORTS, which probes this same list). Falls back to a fully random
 * port only if every candidate is already taken.
 * @param {number[]} candidates
 */
async function findPreferredPort(candidates) {
  for (const port of candidates) {
    if (await isPortFree(port)) return port;
  }
  return findFreePort();
}

function waitForReady(url, { timeoutMs = 30000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume(); // drain, don't care about the body
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Server did not become ready within ${timeoutMs}ms: ${url}`));
        } else {
          setTimeout(attempt, intervalMs);
        }
      });
    };
    attempt();
  });
}

/**
 * @param {object} opts
 * @param {string} opts.standaloneDir - directory containing the standalone server.js
 * @param {number} opts.port
 * @param {Record<string, string>} opts.env - extra env vars for the server process
 */
function spawnServer({ standaloneDir, port, env }) {
  const child = spawn(process.execPath, [path.join(standaloneDir, "server.js")], {
    cwd: standaloneDir, // must match where schema.sql was traced to (see next.config.ts)
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      ...env,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Forward the server's output, but NEVER let a slow/full console
  // backpressure the child: if Electron's own stdout is not being drained
  // (packaged GUI launches have no console), naively piping these streams
  // fills the OS pipe buffers and the Next server blocks on its first write
  // to stdout — wedging the whole app. Drop chunks instead of blocking.
  const forward = (stream, label) => {
    let blocked = false;
    stream.on("data", (chunk) => {
      if (blocked) return;
      blocked = !process.stdout.write(`${label} ${chunk}`);
    });
    process.stdout.on("drain", () => {
      blocked = false;
    });
  };
  forward(child.stdout, "[server]");
  forward(child.stderr, "[server-err]");

  return child;
}

function stopServer(child) {
  if (child && !child.killed) child.kill();
}

module.exports = { findFreePort, findPreferredPort, waitForReady, spawnServer, stopServer };

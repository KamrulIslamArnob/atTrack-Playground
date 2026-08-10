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

  child.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));

  return child;
}

function stopServer(child) {
  if (child && !child.killed) child.kill();
}

module.exports = { findFreePort, waitForReady, spawnServer, stopServer };

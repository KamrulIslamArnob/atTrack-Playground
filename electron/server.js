const { spawn } = require("node:child_process");
const net = require("node:net");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_PORT_LADDER = [3788, 3789, 3790, 3791, 3792, 3793, 3794, 3795];

/**
 * Finds a random available ephemeral port using exclusive binding on loopback.
 * @returns {Promise<number>}
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    let settled = false;
    const cleanupAndReject = (err) => {
      if (settled) return;
      settled = true;
      try {
        server.removeAllListeners();
        server.close();
      } catch {}
      reject(err);
    };

    server.once("error", cleanupAndReject);

    try {
      server.listen({ port: 0, host: "127.0.0.1", exclusive: true }, () => {
        if (settled) return;
        settled = true;
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        try {
          server.removeAllListeners();
          server.close((err) => {
            if (err) reject(err);
            else resolve(port);
          });
        } catch (err) {
          resolve(port);
        }
      });
    } catch (err) {
      cleanupAndReject(err);
    }
  });
}

/**
 * Checks if a specific port is free to bind exclusively on 127.0.0.1.
 * Sockets are cleanly unreferenced and closed on completion or error.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    if (!port || typeof port !== "number" || port <= 0 || port > 65535) {
      return resolve(false);
    }

    const server = net.createServer();
    server.unref();

    let settled = false;
    const cleanupAndResolve = (result) => {
      if (settled) return;
      settled = true;
      try {
        server.removeAllListeners();
        server.close(() => resolve(result));
      } catch {
        resolve(result);
      }
    };

    server.once("error", () => {
      cleanupAndResolve(false);
    });

    try {
      server.listen({ port, host: "127.0.0.1", exclusive: true }, () => {
        cleanupAndResolve(true);
      });
    } catch {
      cleanupAndResolve(false);
    }
  });
}

/**
 * Tries candidate ports in order and returns the first free one,
 * falling back to an ephemeral free port if all candidates are occupied.
 * @param {number[]} [candidates]
 * @returns {Promise<number>}
 */
async function findPreferredPort(candidates = DEFAULT_PORT_LADDER) {
  const list = Array.isArray(candidates) ? candidates : DEFAULT_PORT_LADDER;
  const unique = [...new Set(list.filter((p) => typeof p === "number" && p > 0))];
  for (const port of unique) {
    if (await isPortFree(port)) return port;
  }
  return findFreePort();
}

/**
 * Polls readiness while actively monitoring child process exit.
 * Fast-fails immediately if the child process terminates prematurely,
 * returning actionable diagnostics from captured logs.
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=25000]
 * @param {number} [opts.intervalMs=200]
 * @param {import("node:child_process").ChildProcess} [opts.child]
 * @returns {Promise<void>}
 */
function waitForReady(url, { timeoutMs = 25000, intervalMs = 200, child } = {}) {
  return new Promise((resolve, reject) => {
    let timer = null;
    let settled = false;
    let currentReq = null;
    const deadline = Date.now() + timeoutMs;

    const cleanup = () => {
      settled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (currentReq) {
        try {
          currentReq.destroy();
        } catch {}
        currentReq = null;
      }
      if (child && typeof child.removeListener === "function") {
        child.removeListener("exit", onChildExit);
      }
    };

    const formatExitDiagnostics = (code, signal) => {
      const logs = (child?.recentLogs || []).slice(-20).join("\n").trim();
      const stderrLogs = (child?.recentLogs || [])
        .filter((l) => l.startsWith("[server-err]") || l.startsWith("[error]"))
        .slice(-10)
        .join("\n")
        .trim();

      let diag = `Server process exited prematurely with code ${code ?? 0} (signal: ${signal || "none"}).`;
      if (stderrLogs) {
        diag += `\nStderr output:\n${stderrLogs}`;
      } else if (logs) {
        diag += `\nCaptured output:\n${logs}`;
      } else {
        diag += `\nNo output logs captured.`;
      }
      return diag;
    };

    const onChildExit = (code, signal) => {
      if (settled) return;
      cleanup();
      reject(new Error(formatExitDiagnostics(code, signal)));
    };

    if (child) {
      if (child.isDead || child.exitCode !== null) {
        return reject(new Error(formatExitDiagnostics(child.exitCode, child.exitSignal)));
      }
      child.once("exit", onChildExit);
    }

    const attempt = () => {
      if (settled) return;

      if (child && (child.isDead || child.exitCode !== null)) {
        cleanup();
        return reject(new Error(formatExitDiagnostics(child.exitCode, child.exitSignal)));
      }

      currentReq = http.get(url, (res) => {
        currentReq = null;
        res.resume(); // drain
        cleanup();
        resolve();
      });

      currentReq.on("error", () => {
        currentReq = null;
        if (settled) return;

        if (child && (child.isDead || child.exitCode !== null)) {
          cleanup();
          return reject(new Error(formatExitDiagnostics(child.exitCode, child.exitSignal)));
        }

        if (Date.now() > deadline) {
          cleanup();
          const logs = (child?.recentLogs || []).slice(-15).join("\n").trim();
          reject(
            new Error(
              `Server did not respond within ${Math.round(timeoutMs / 1000)}s on ${url}.\n${
                logs ? `Recent logs:\n${logs}` : "No output logs captured."
              }`
            )
          );
        } else {
          timer = setTimeout(attempt, intervalMs);
        }
      });
    };

    attempt();
  });
}

/**
 * Spawns the standalone Next.js server child process with memory limits and stream buffering.
 * @param {object} opts
 * @param {string} opts.standaloneDir - directory containing the standalone server.js
 * @param {number} opts.port
 * @param {Record<string, string>} opts.env - extra env vars for the server process
 * @returns {import("node:child_process").ChildProcess}
 */
function spawnServer({ standaloneDir, port, env }) {
  const serverEntry = path.join(standaloneDir, "server.js");
  if (!fs.existsSync(serverEntry)) {
    const errorMsg = `Standalone server entry not found at: ${serverEntry}`;
    console.error(`[server-error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const child = spawn(process.execPath, ["--max-old-space-size=4096", serverEntry], {
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

  child.isDead = false;
  child.exitCode = null;
  child.exitSignal = null;
  child.recentLogs = [];

  child.on("error", (err) => {
    console.error("[server-process-error]", err);
    child.recentLogs.push(`[error] ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    child.isDead = true;
    child.exitCode = code;
    child.exitSignal = signal;
    console.log(`[server-exit] process exited with code ${code}, signal ${signal}`);
  });

  const recordLog = (label, line) => {
    if (!line || !line.trim()) return;
    child.recentLogs.push(`${label} ${line.trim()}`);
    if (child.recentLogs.length > 200) {
      child.recentLogs.shift();
    }
  };

  // Forward streams losslessly without dropping lines under backpressure
  const forward = (stream, label, targetStream = process.stdout) => {
    if (!stream) return;
    let lineBuffer = "";

    stream.on("data", (chunk) => {
      try {
        const text = chunk.toString("utf8");
        lineBuffer += text;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";
        for (const line of lines) {
          recordLog(label, line);
        }

        const formatted = `${label} ${text}`;
        const canContinue = targetStream.write(formatted);
        if (!canContinue) {
          stream.pause();
          targetStream.once("drain", () => {
            try {
              stream.resume();
            } catch {}
          });
        }
      } catch (err) {
        console.warn(`[forward-error] ${label}:`, err?.message);
      }
    });

    stream.on("end", () => {
      if (lineBuffer.trim()) {
        recordLog(label, lineBuffer);
        lineBuffer = "";
      }
    });
  };

  if (child.stdout) forward(child.stdout, "[server]", process.stdout);
  if (child.stderr) forward(child.stderr, "[server-err]", process.stderr);

  return child;
}

/**
 * Gracefully stops the child server process.
 * Sends SIGTERM, awaits process exit for up to timeoutMs (default 5000ms),
 * and escalates to SIGKILL if the process fails to exit.
 * @param {import("node:child_process").ChildProcess | null} child
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<void>}
 */
async function stopServer(child, timeoutMs = 5000) {
  if (!child || child.isDead || child.exitCode !== null) {
    return;
  }

  return new Promise((resolve) => {
    let resolved = false;
    let killTimer = null;
    let forceKillTimer = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (killTimer) clearTimeout(killTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (child && typeof child.removeListener === "function") {
        child.removeListener("exit", onExit);
      }
      child.isDead = true;
      resolve();
    };

    const onExit = () => {
      finish();
    };

    child.once("exit", onExit);

    try {
      child.kill("SIGTERM");
    } catch (err) {
      console.warn("[stopServer] Error sending SIGTERM:", err?.message);
    }

    // Escalate to SIGKILL if process does not exit in time
    killTimer = setTimeout(() => {
      if (resolved) return;
      console.warn(
        `[stopServer] Server process (pid ${child.pid}) did not exit within ${timeoutMs}ms. Escalating to SIGKILL.`
      );
      try {
        child.kill("SIGKILL");
      } catch (err) {
        console.warn("[stopServer] Error sending SIGKILL:", err?.message);
      }

      // Final fallback safety timeout
      forceKillTimer = setTimeout(() => {
        finish();
      }, 1000);
    }, timeoutMs);
  });
}

/**
 * Writes active server metadata manifest for companion extension and external discovery.
 * @param {number} port
 * @param {object} [opts]
 * @param {number} [opts.pid]
 * @param {string} [opts.dataDir]
 * @param {string} [opts.userDataDir]
 * @param {string} [opts.appName]
 * @param {string} [opts.version]
 */
function writeServerManifest(port, { pid, dataDir, userDataDir, appName = "BetterJob", version = "1.0.0" } = {}) {
  const manifest = {
    port,
    serverUrl: `http://127.0.0.1:${port}`,
    pid: pid || process.pid,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    appName,
    version,
  };

  const manifestLocations = [];
  if (userDataDir) {
    manifestLocations.push(path.join(userDataDir, "server-manifest.json"));
  }
  if (dataDir && dataDir !== userDataDir) {
    manifestLocations.push(path.join(dataDir, "server-manifest.json"));
  }

  for (const loc of manifestLocations) {
    try {
      fs.mkdirSync(path.dirname(loc), { recursive: true });
      fs.writeFileSync(loc, JSON.stringify(manifest, null, 2), "utf8");
      console.log(`[server] Manifest written to ${loc}`);
    } catch (err) {
      console.warn(`[server] Failed to write manifest to ${loc}:`, err?.message);
    }
  }
}

/**
 * Removes active server metadata manifest on shutdown.
 * @param {object} [opts]
 * @param {string} [opts.dataDir]
 * @param {string} [opts.userDataDir]
 */
function removeServerManifest({ dataDir, userDataDir } = {}) {
  const manifestLocations = [];
  if (userDataDir) {
    manifestLocations.push(path.join(userDataDir, "server-manifest.json"));
  }
  if (dataDir && dataDir !== userDataDir) {
    manifestLocations.push(path.join(dataDir, "server-manifest.json"));
  }

  for (const loc of manifestLocations) {
    try {
      if (fs.existsSync(loc)) {
        fs.unlinkSync(loc);
        console.log(`[server] Manifest removed from ${loc}`);
      }
    } catch (err) {
      console.warn(`[server] Failed to remove manifest from ${loc}:`, err?.message);
    }
  }
}

module.exports = {
  DEFAULT_PORT_LADDER,
  findFreePort,
  isPortFree,
  findPreferredPort,
  waitForReady,
  spawnServer,
  stopServer,
  writeServerManifest,
  removeServerManifest,
};

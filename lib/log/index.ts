// Structured logging for every server-side path in atTrack.
//
// One pino instance, two sinks: stdout (human-readable in dev, NDJSON in
// production) and a dated NDJSON file under the same data directory the
// SQLite database lives in. The file is what an optional log drain ships —
// see lib/log/drain.ts. Nothing here ever reaches into the network, so a
// logging call can never stall or fail a request.
//
// NEVER import this from a client component. It pulls node:fs.

import fs from "node:fs";
import path from "node:path";
// pino ships as `export = pino`, so the callable and its namespace helpers
// (destination, multistream) only both exist on the default import.
import pino from "pino";

export type Logger = pino.Logger;

/** Mirrors lib/db/sqlite.ts so a packaged Electron install (which sets
 *  SQLITE_DIR to the user's chosen folder) keeps logs beside its database
 *  instead of next to the read-only app bundle. */
function resolveLogDataDir(): string {
  if (process.env.SQLITE_DIR) {
    return process.env.SQLITE_DIR;
  }
  const localDb = path.join(process.cwd(), ".data", "attrack.db");
  if (fs.existsSync(localDb)) {
    return path.join(process.cwd(), ".data");
  }
  if (process.platform === "win32") {
    if (process.env.APPDATA) {
      for (const appName of ["BetterJob", "betterjob", "AtTrack", "atTrack"]) {
        const cfg = path.join(process.env.APPDATA, appName, "config.json");
        try {
          if (fs.existsSync(cfg)) {
            const parsed = JSON.parse(fs.readFileSync(cfg, "utf8"));
            if (parsed.dataDir) {
              return parsed.dataDir;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }
  return path.join(process.cwd(), ".data");
}

const DATA_DIR = resolveLogDataDir();
export const LOG_DIR = process.env.ATTRACK_LOG_DIR ?? path.join(DATA_DIR, "logs");

const IS_DEV = process.env.NODE_ENV !== "production";
const LEVEL = process.env.ATTRACK_LOG_LEVEL ?? (IS_DEV ? "debug" : "info");

/** Secrets that reach a log as free text rather than as a named field —
 *  overwhelmingly inside a provider's error message, which often echoes the
 *  request URL. The `redact` paths below cannot see into a string, so this
 *  is the second net. */
const SECRET_RE =
  /(sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._-]{16,})/g;

export function scrubSecrets(value: string): string {
  return value.replace(SECRET_RE, "[redacted]");
}

export function logFilePath(date = new Date()): string {
  return path.join(LOG_DIR, `attrack-${date.toISOString().slice(0, 10)}.log`);
}

/** Dev terminal formatting without pino-pretty: that ships its own worker
 *  thread (thread-stream), which is exactly the shape Turbopack cannot
 *  bundle. Twelve lines here buy the same readability with no dependency and
 *  no bundler risk. */
function devStream(): { write(line: string): void } {
  const LEVEL_NAME: Record<number, string> = {
    10: "trace", 20: "debug", 30: "info", 40: "warn", 50: "error", 60: "fatal",
  };
  return {
    write(line: string) {
      try {
        const { level, time, msg, event, err, ...rest } = JSON.parse(line);
        const stamp = new Date(time).toISOString().slice(11, 23);
        const head = `${stamp} ${(LEVEL_NAME[level] ?? level).toUpperCase().padEnd(5)}`;
        const label = event ? ` ${event}` : "";
        const body = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
        const error = err ? ` ${err.type ?? "Error"}: ${err.message}` : "";
        process.stdout.write(`${head}${label} ${msg ?? ""}${body}${error}\n`);
      } catch {
        process.stdout.write(line);
      }
    },
  };
}

function buildLogger(): Logger {
  const streams: { stream: NodeJS.WritableStream | { write(s: string): void } }[] = [];

  // stdout is a dev/terminal-only sink. Pino writes to multistream targets
  // synchronously, and on Windows a pipe write to process.stdout BLOCKS when
  // the pipe buffer is full. A packaged Electron app is a GUI process with no
  // console draining its stdout, so once the buffer filled (every HTTP request
  // emits one line) the next log write froze the entire server event loop —
  // requests hung forever, which surfaced as "avatar upload never completes".
  // The dated file sink below is the production log home; stdout only joins
  // when something is actually there to read it (dev, or `next start` in a
  // terminal).
  if (IS_DEV || process.stdout.isTTY) {
    streams.push({ stream: IS_DEV ? devStream() : process.stdout });
  }

  // A read-only or full disk must not take the app down with it. Losing the
  // file sink is survivable; losing the process is not.
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    streams.push({ stream: pino.destination({ dest: logFilePath(), sync: false, mkdir: true }) });
  } catch (err) {
    process.stderr.write(`[log] file sink disabled: ${(err as Error).message}\n`);
  }

  return pino(
    {
      level: LEVEL,
      base: { app: "attrack", env: process.env.NODE_ENV ?? "development" },
      redact: {
        paths: [
          "api_key", "apiKey", "encrypted_api_key", "authorization", "token", "password",
          "sourceConfig", "smtp", "cookie",
          "*.api_key", "*.apiKey", "*.encrypted_api_key", "*.authorization", "*.token",
          "*.password", "*.sourceConfig", "*.smtp", "*.cookie",
          "headers.authorization", "*.headers.authorization",
        ],
        censor: "[redacted]",
      },
      serializers: {
        err(value: unknown) {
          if (!(value instanceof Error)) return { message: scrubSecrets(String(value)) };
          return {
            type: value.name,
            message: scrubSecrets(value.message),
            stack: value.stack ? scrubSecrets(value.stack) : undefined,
          };
        },
      },
    },
    pino.multistream(streams as never)
  );
}

export const log: Logger = buildLogger();

/** Child logger for one subsystem. `log.child({ mod: "ai" })` shorthand so
 *  every call site does not repeat the field name. */
export function moduleLogger(mod: string): Logger {
  return log.child({ mod });
}

/** Deletes files older than the retention window. Called once at boot from
 *  instrumentation.ts — a desktop install runs for months and nobody is
 *  going to rotate these by hand. */
export function pruneLogs(retentionDays = Number(process.env.ATTRACK_LOG_RETENTION_DAYS ?? 7)): void {
  try {
    const cutoff = Date.now() - retentionDays * 86_400_000;
    for (const name of fs.readdirSync(LOG_DIR)) {
      if (!name.startsWith("attrack-") || !name.endsWith(".log")) continue;
      const full = path.join(LOG_DIR, name);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    // Pruning is housekeeping. A failure here is not worth a log line that
    // itself needs pruning.
  }
}

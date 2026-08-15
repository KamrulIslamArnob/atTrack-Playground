// Optional log drain: tails the dated NDJSON log file and POSTs batches to an
// HTTP log endpoint (Axiom, Better Stack, Datadog, a Vector/OTel collector).
//
// OFF unless ATTRACK_LOG_DRAIN_URL is set. atTrack is local-first and the log
// file is the user's own job-search activity, so shipping it anywhere is an
// explicit opt-in: with no URL configured this module starts no timer, opens
// no file and makes no network call.
//
// Deliberately NOT a pino transport and NOT an inline stream. It reads the
// file from disk on a timer, entirely outside the request path, so a drain
// that is failing — network down, endpoint 500ing, token expired — cannot
// stall a request, break a stream or lose a line. The cursor simply stops
// advancing until the endpoint comes back.
//
// THE TRAP: the drain writes into the very file the drain reads. Three guards
// close that loop; see FEEDBACK LOOP below. Do not remove any of them.

import fs from "node:fs";
import path from "node:path";

import { LOG_DIR, logFilePath, moduleLogger } from "@/lib/log";

const drainLog = moduleLogger("drain");

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const DRAIN_URL = process.env.ATTRACK_LOG_DRAIN_URL;
const TOKEN = process.env.ATTRACK_LOG_DRAIN_TOKEN;
const NDJSON = process.env.ATTRACK_LOG_DRAIN_FORMAT !== "json-array";
const BATCH = num(process.env.ATTRACK_LOG_DRAIN_BATCH, 100);
const INTERVAL_MS = num(process.env.ATTRACK_LOG_DRAIN_INTERVAL_MS, 5_000);

/** Escape hatch for endpoints that do not speak bearer tokens: Datadog wants
 *  `DD-API-KEY`, Splunk HEC wants `Authorization: Splunk <token>`. A JSON
 *  object of extra headers, merged over the defaults. */
const EXTRA_HEADERS: Record<string, string> = (() => {
  try {
    return JSON.parse(process.env.ATTRACK_LOG_DRAIN_HEADERS ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
})();

const CURSOR_PATH = path.join(LOG_DIR, ".drain-cursor");
const MAX_BACKOFF_MS = 300_000; // 5 minutes — a dead endpoint must not spin.
const MAX_READ_BYTES = 1 << 20; // 1 MiB per tick; a backlog drains over several.
const POST_TIMEOUT_MS = 30_000;
const NEWLINE = 0x0a;

// ---------------------------------------------------------------------------
// FEEDBACK LOOP guard 1 of 3: the drain never ships its own log lines.
//
// If it did, one failing POST would append a line, which becomes new work,
// which fails, which appends another line — an endpoint that is down would
// grow the log file without bound and every batch would be more drain noise.
// Its own lines stay local, always. Substring test rather than a JSON.parse
// per line: pino serializes the `moduleLogger("drain")` child binding into
// every line verbatim as `"mod":"drain"`.
// ---------------------------------------------------------------------------
const SELF_BINDING = '"mod":"drain"';

function shippable(line: string): boolean {
  if (line.charCodeAt(0) !== 0x7b /* { */) return false;
  if (line.includes(SELF_BINDING)) return false;
  if (NDJSON) return true;
  // json-array only: one corrupt line (a torn write from a killed process)
  // would otherwise poison the entire request body.
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// FEEDBACK LOOP guard 2 of 3: a persistent fault logs once, not once per
// attempt. A three-day outage produces one line, not fifty thousand.
// ---------------------------------------------------------------------------
let lastFault = "";

function fault(reason: string, fields: Record<string, unknown> = {}): void {
  if (reason === lastFault) return;
  lastFault = reason;
  drainLog.warn({ event: "app.drain", reason, ...fields }, "Couldn't ship logs");
}

function recovered(): void {
  if (!lastFault) return;
  lastFault = "";
  drainLog.debug({ event: "app.drain", reason: "recovered" });
}

// FEEDBACK LOOP guard 3 of 3: every healthy-path line the drain writes is at
// `debug`, which is below the production log level, so the steady state
// produces no bytes at all. Never raise these to info/error.

type Cursor = { file: string; offset: number };

function readCursor(): Cursor {
  try {
    const c = JSON.parse(fs.readFileSync(CURSOR_PATH, "utf8")) as Cursor;
    if (typeof c.file === "string" && Number.isInteger(c.offset) && c.offset >= 0) return c;
  } catch {
    // First run, or a cursor we cannot trust. Start at the top of today: a
    // duplicate day is recoverable, a skipped one is not.
  }
  return { file: logFilePath(), offset: 0 };
}

function writeCursor(c: Cursor): void {
  // Write-then-rename so a crash mid-write cannot leave a half-written cursor
  // that reads back as "start the day over".
  const tmp = `${CURSOR_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(c));
  fs.renameSync(tmp, CURSOR_PATH);
}

/** At midnight the logger opens a new dated file. Finish the old one to EOF
 *  before following it, or the last minutes of every day are never shipped. */
function pickFile(c: Cursor): Cursor {
  const today = logFilePath();
  if (c.file === today) return c;
  try {
    if (fs.statSync(c.file).size > c.offset) return c; // yesterday still has a tail
  } catch {
    // Pruned, or never existed.
  }
  return { file: today, offset: 0 };
}

async function post(lines: string[]): Promise<Response> {
  // Bare fetch, never lib/log/fetch.ts: fetchWithLog emits a `net.call` line
  // per call, and a failing POST would emit it at warn — straight back into
  // the file this drain reads. That is the feedback loop wearing a disguise.
  return fetch(DRAIN_URL as string, {
    method: "POST",
    headers: {
      "content-type": NDJSON ? "application/x-ndjson" : "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...EXTRA_HEADERS,
    },
    // Each line is already valid JSON, so json-array needs a join, not a
    // parse-and-restringify round trip.
    body: NDJSON ? lines.join("\n") : `[${lines.join(",")}]`,
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
}

let cursor: Cursor = { file: "", offset: 0 };
let failures = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;

async function tick(): Promise<void> {
  cursor = pickFile(cursor);

  let size: number;
  try {
    size = fs.statSync(cursor.file).size;
  } catch {
    return; // No log file for today yet.
  }

  if (size < cursor.offset) {
    // Truncated or rotated under us. Re-reading from the top duplicates lines,
    // which beats silently skipping whatever replaced those bytes.
    fault("truncated", { file: path.basename(cursor.file), size, offset: cursor.offset });
    cursor = { ...cursor, offset: 0 };
  }
  if (size === cursor.offset) {
    recovered();
    failures = 0;
    return;
  }

  // Zero-filled, not allocUnsafe: this buffer's contents get POSTed to a third
  // party, so a bounds slip must not be able to ship uninitialized heap.
  const buf = Buffer.alloc(Math.min(size - cursor.offset, MAX_READ_BYTES));
  const fd = fs.openSync(cursor.file, "r");
  let read: number;
  try {
    read = fs.readSync(fd, buf, 0, buf.length, cursor.offset);
  } finally {
    fs.closeSync(fd);
  }
  if (read <= 0) return;

  // Whole lines only. A trailing fragment is a write in progress and will be
  // complete on the next tick.
  const lastNewline = buf.lastIndexOf(NEWLINE, read - 1);
  if (lastNewline < 0) return;
  const consumed = lastNewline + 1;

  const lines = buf.toString("utf8", 0, consumed).split("\n").filter(shippable);

  for (let i = 0; i < lines.length; i += BATCH) {
    const res = await post(lines.slice(i, i + BATCH));
    if (!res.ok) {
      // Cursor stays put. A 401 or 400 never recovers on its own, so we back
      // off to the cap and keep retrying: the user fixes the token and the
      // backlog ships. Retention pruning bounds how much can pile up.
      failures += 1;
      fault("status", { status: res.status });
      return;
    }
  }

  // ponytail: the cursor advances once per tick, so a POST that fails midway
  // re-ships the batches before it (bounded by MAX_READ_BYTES). Per-batch
  // cursor accounting only pays off if duplicates start costing real money.
  cursor = { ...cursor, offset: cursor.offset + consumed };
  writeCursor(cursor);
  recovered();
  failures = 0;
}

function schedule(ms: number): void {
  if (!running) return;
  timer = setTimeout(run, ms);
  // Telemetry must never be the reason a process refuses to exit.
  (timer as { unref?: () => void }).unref?.();
}

async function run(): Promise<void> {
  try {
    await tick();
  } catch (err) {
    // Nothing escapes the loop. A drain bug is not an app outage.
    failures += 1;
    fault("tick", { message: (err as Error)?.message });
  }
  schedule(failures ? Math.min(INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS) : INTERVAL_MS);
}

function stop(): void {
  running = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}

/** Starts the tail-and-ship loop. Returns a stop function.
 *
 *  A no-op returning a no-op when ATTRACK_LOG_DRAIN_URL is unset, which is the
 *  default. Safe to call more than once — Next dev re-runs instrumentation on
 *  reload, and two loops racing the same cursor would double-ship. */
export function startDrain(): () => void {
  if (!DRAIN_URL || running) return stop;

  running = true;
  cursor = readCursor();
  drainLog.debug(
    {
      event: "app.drain",
      reason: "started",
      format: NDJSON ? "ndjson" : "json-array",
      batch: BATCH,
      intervalMs: INTERVAL_MS,
    },
    "Log drain enabled"
  );
  schedule(INTERVAL_MS);
  return stop;
}

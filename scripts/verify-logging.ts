// Verifies the structured log is safe to ship and complete enough to be useful.
//
// Run after exercising the app (a chat turn with tools, a job import, a resume
// score):  node scripts/verify-logging.ts
//
// Reads the NDJSON log directly — no server needed, no rows written.
//
// The check that actually matters is SECRETS. Everything else here catches a
// missing field; that one catches shipping a user's API key to a third party.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SQLITE_DIR ?? path.join(process.cwd(), ".data");
const LOG_DIR = process.env.ATTRACK_LOG_DIR ?? path.join(DATA_DIR, "logs");

interface Report { name: string; passed: boolean; error?: string }
const reports: Report[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  try {
    fn();
    reports.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    reports.push({ name, passed: false, error });
    console.log(`  [FAIL] ${name}: ${error}`);
  }
}

/** Every log line from every retained day, parsed. A malformed line is itself
 *  a finding — the drain ships this file verbatim. */
function loadLines(): { lines: Record<string, unknown>[]; raw: string[]; malformed: number } {
  const raw: string[] = [];
  let malformed = 0;
  const lines: Record<string, unknown>[] = [];

  const files = fs.existsSync(LOG_DIR)
    ? fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("attrack-") && f.endsWith(".log"))
    : [];

  for (const file of files) {
    for (const line of fs.readFileSync(path.join(LOG_DIR, file), "utf8").split("\n")) {
      if (!line.trim()) continue;
      raw.push(line);
      try {
        lines.push(JSON.parse(line));
      } catch {
        malformed++;
      }
    }
  }
  return { lines, raw, malformed };
}

const { lines, raw, malformed } = loadLines();
const byEvent = (name: string) => lines.filter((l) => l.event === name);

console.log(`Log verification against ${LOG_DIR}`);
console.log(`  ${raw.length} lines across ${fs.existsSync(LOG_DIR) ? fs.readdirSync(LOG_DIR).length : 0} files\n`);

// ---------------------------------------------------------------- secrets

/** Live credential shapes for every provider atTrack talks to. A hit here is a
 *  release blocker, not a warning. */
const SECRET_PATTERNS: [string, RegExp][] = [
  ["OpenAI key", /sk-[A-Za-z0-9_-]{12,}/],
  ["Google key", /AIza[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Bearer header", /"[Aa]uthorization"\s*:\s*"Bearer\s+[A-Za-z0-9._-]{16,}"/],
];

runTest("no credentials appear anywhere in the log", () => {
  const hits: string[] = [];
  for (const line of raw) {
    for (const [label, re] of SECRET_PATTERNS) {
      if (re.test(line)) hits.push(`${label} in: ${line.slice(0, 120)}`);
    }
  }
  assert(hits.length === 0, `${hits.length} credential leak(s):\n    ${hits.slice(0, 5).join("\n    ")}`);
});

runTest("sourceConfig is never emitted unredacted", () => {
  const leaked = raw.filter((l) => l.includes('"sourceConfig"') && !l.includes('"sourceConfig":"[redacted]"'));
  assert(leaked.length === 0, `${leaked.length} line(s) carry a raw sourceConfig (holds a GitHub token)`);
});

/** Field names that would mean a prompt, a message body or a row of user data
 *  reached the log. Shapes are fine; text is not. */
const CONTENT_FIELDS = ["prompt", "userPrompt", "systemPrompt", "content", "messages", "sql", "body", "text", "answer", "recipients", "to"];

runTest("no user content fields are logged", () => {
  const hits = new Set<string>();
  for (const line of lines) {
    for (const key of Object.keys(line)) {
      if (CONTENT_FIELDS.includes(key)) hits.add(`${String(line.event ?? "?")}.${key}`);
    }
  }
  assert(hits.size === 0, `content-bearing field(s): ${[...hits].join(", ")}`);
});

// ------------------------------------------------------------------ shape

runTest("every line is valid NDJSON", () => {
  assert(malformed === 0, `${malformed} malformed line(s) — the drain ships this file verbatim`);
});

runTest("log is not empty", () => {
  assert(lines.length > 0, `no lines found under ${LOG_DIR}; exercise the app first`);
});

// -------------------------------------------------------------- AI traces

runTest("every ai.request.start has a matching ai.request.end", () => {
  const starts = new Set(byEvent("ai.request.start").map((l) => l.traceId as string));
  const ends = new Set(byEvent("ai.request.end").map((l) => l.traceId as string));
  if (starts.size === 0) {
    console.log("       (skipped: no AI requests in this log)");
    return;
  }
  const orphans = [...starts].filter((id) => !ends.has(id));
  assert(orphans.length === 0, `${orphans.length} trace(s) started and never ended: ${orphans.slice(0, 3).join(", ")}`);
});

runTest("every AI event carries a traceId", () => {
  const bad = lines.filter((l) => typeof l.event === "string" && (l.event as string).startsWith("ai.") && !l.traceId);
  assert(bad.length === 0, `${bad.length} ai.* line(s) with no traceId`);
});

runTest("routing decisions record WHY, not just what", () => {
  const models = byEvent("ai.route.model");
  const providers = byEvent("ai.route.provider");
  if (models.length === 0 && providers.length === 0) {
    console.log("       (skipped: no routing events in this log)");
    return;
  }
  assert(models.every((l) => typeof l.rule === "string"), "ai.route.model missing `rule`");
  assert(providers.every((l) => typeof l.reason === "string"), "ai.route.provider missing `reason`");
});

// ------------------------------------------------------------------- cost

runTest("ai.usage reports a real cost, never a silent zero", () => {
  const usage = byEvent("ai.usage");
  if (usage.length === 0) {
    console.log("       (skipped: no usage events in this log)");
    return;
  }
  assert(usage.every((l) => l.pricing === "known" || l.pricing === "unknown"), "ai.usage missing `pricing`");

  // The bug this feature exists to fix: a priced model recorded as $0.
  const bogus = usage.filter(
    (l) => l.pricing === "known" && l.costUsd === 0 && ((l.inputTokens as number) > 0 || (l.outputTokens as number) > 0)
  );
  assert(bogus.length === 0, `${bogus.length} priced call(s) recorded as $0 despite non-zero tokens`);

  const unpriced = usage.filter((l) => l.pricing === "unknown");
  if (unpriced.length > 0) {
    const models = [...new Set(unpriced.map((l) => String(l.model)))];
    console.log(`       (note: ${unpriced.length} call(s) on unpriced model(s): ${models.join(", ")} — add to lib/ai/pricing.ts)`);
  }
});

runTest("provider hops record time-to-first-token", () => {
  const hops = byEvent("ai.provider.hop").filter((l) => l.ok === true && l.streaming !== false);
  if (hops.length === 0) {
    console.log("       (skipped: no successful streaming hops in this log)");
    return;
  }
  assert(hops.some((l) => typeof l.ttftMs === "number"), "no hop reported ttftMs");
});

// ------------------------------------------------------------------ totals

const passed = reports.filter((r) => r.passed).length;
const failed = reports.length - passed;
console.log(`\nTOTAL: ${reports.length} | PASSED: ${passed} | FAILED: ${failed}`);
if (failed > 0) process.exitCode = 1;

// Verifies that SQLite is the single authority for chat history.
//
// Run with the dev server up:  node scripts/verify-chat-persistence.ts
// Every row it creates is prefixed `verify_` and removed at the end.

import { DatabaseSync } from "node:sqlite";

const BASE = process.env.ATTRACK_URL ?? "http://localhost:3308";
const DB = process.env.SQLITE_PATH ?? ".data/attrack.db";
const SID = "verify_sess_1";

interface Report { name: string; passed: boolean; error?: string }
const reports: Report[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    reports.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    reports.push({ name, passed: false, error });
    console.log(`  [FAIL] ${name}: ${error}`);
  }
}

function dbRows(sql: string, ...args: unknown[]): Record<string, unknown>[] {
  const db = new DatabaseSync(DB, { readOnly: true });
  try {
    return db.prepare(sql).all(...(args as never[])) as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

function session(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: SID,
    title: "Verify session",
    createdAt: now,
    updatedAt: now,
    model: "verify-model",
    personaId: "general",
    isPinned: false,
    connectedSourceIds: ["jobs", "resumes"],
    messages: [
      { id: "verify_m1", role: "user", content: "ping", createdAt: now },
      { id: "verify_m2", role: "assistant", content: "pong", createdAt: now },
    ],
    ...overrides,
  };
}

async function put(body: unknown): Promise<Response> {
  return fetch(`${BASE}/api/chat/sessions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getSessions(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/api/chat/sessions`);
  assert(res.ok, `GET returned ${res.status}`);
  const payload = await res.json();
  return (payload?.sessions ?? []) as Record<string, unknown>[];
}

async function main(): Promise<void> {
  console.log(`Chat persistence verification against ${BASE}\n`);

  await runTest("A session and its messages round-trip through SQLite", async () => {
    const s = session();
    const res = await put({ session: s, messages: s.messages });
    assert(res.status === 200, `PUT returned ${res.status}`);

    const rows = dbRows("SELECT id FROM chat_messages WHERE session_id = ?", SID);
    assert(rows.length === 2, `expected 2 message rows, found ${rows.length}`);

    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    assert(Boolean(found), "session missing from GET");
    assert(
      (found!.messages as unknown[]).length === 2,
      `GET returned ${(found!.messages as unknown[]).length} messages, expected 2`
    );
  });

  await runTest("connectedSourceIds survives the round-trip", async () => {
    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    const ids = (found?.connectedSourceIds ?? []) as string[];
    assert(
      ids.includes("jobs") && ids.includes("resumes"),
      `connectedSourceIds came back as ${JSON.stringify(ids)}`
    );
  });

  await runTest("A rename persists and is what the database returns", async () => {
    const s = session({ title: "Renamed", updatedAt: new Date().toISOString() });
    const res = await put({ session: s, messages: s.messages });
    assert(res.status === 200, `PUT returned ${res.status}`);

    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    assert(found?.title === "Renamed", `title came back as ${String(found?.title)}`);
  });

  await runTest("Message order survives repeated saves", async () => {
    const t0 = new Date().toISOString();
    // Assistant messages carry no createdAt — exactly how use-chat.ts builds them.
    const turn1 = [
      { id: "verify_o1", role: "user", content: "first", createdAt: t0 },
      { id: "verify_o2", role: "assistant", content: "reply one" },
    ];
    const s1 = session({ messages: turn1 });
    assert((await put({ session: s1, messages: turn1 })).status === 200, "first PUT failed");

    // Second turn, saved later. Under the bug this re-stamps verify_o2 to now,
    // pushing it after verify_o3.
    const turn2 = [
      ...turn1,
      { id: "verify_o3", role: "user", content: "second", createdAt: new Date().toISOString() },
      { id: "verify_o4", role: "assistant", content: "reply two" },
    ];
    const s2 = session({ messages: turn2 });
    assert((await put({ session: s2, messages: turn2 })).status === 200, "second PUT failed");

    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    const ids = ((found?.messages ?? []) as { id: string }[]).map((m) => m.id);
    assert(
      JSON.stringify(ids) === JSON.stringify(["verify_o1", "verify_o2", "verify_o3", "verify_o4"]),
      `message order came back as ${JSON.stringify(ids)}`
    );
  });

  await runTest("A deleted session stays deleted", async () => {
    const res = await fetch(`${BASE}/api/chat/sessions?id=${SID}`, { method: "DELETE" });
    assert(res.status === 200, `DELETE returned ${res.status}`);

    const sessionRows = dbRows("SELECT id FROM chat_sessions WHERE id = ?", SID);
    assert(sessionRows.length === 0, "session row survived the delete");

    const messageRows = dbRows("SELECT id FROM chat_messages WHERE session_id = ?", SID);
    assert(messageRows.length === 0, `${messageRows.length} message rows survived the delete`);

    const all = await getSessions();
    assert(!all.some((x) => x.id === SID), "deleted session still returned by GET");
  });

  await runTest("A malformed save is reported as a failure", async () => {
    const res = await put({});
    assert(res.status >= 400, `malformed PUT returned ${res.status}, expected >= 400`);
  });

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.length - passed;
  console.log(`\nTOTAL: ${reports.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});

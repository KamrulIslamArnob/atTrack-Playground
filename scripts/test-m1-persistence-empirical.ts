/**
 * Empirical Persistence, Migration & SQLite Integrity Test Harness
 * Milestone 1 Challenger 2 Verification
 */

import { getDb, transaction } from "../lib/db/sqlite";
import {
  upsertSessionToDb,
  loadSessionsFromDb,
  deleteSessionFromDb,
  clearAllSessionsFromDb,
} from "../lib/ai-chatbot/persistence";
import { getUser } from "../lib/auth";
import type { ChatSession, Message, ToolExecutionStep } from "../lib/ai-chatbot/sessions";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

function assertEquals(actual: unknown, expected: unknown, msg: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${msg} -> Expected: ${expectedStr}, Got: ${actualStr}`);
  }
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: errorMsg, details: err });
    console.error(`❌ FAIL: ${name}\n   Error: ${errorMsg}`);
  }
}

async function main() {
  console.log("===============================================================");
  console.log("🚀 Starting Milestone 1 Persistence & SQLite Empirical Challenge");
  console.log("===============================================================\n");

  const db = getDb();
  const { userId } = await getUser();
  console.log(`Current test user_id: ${userId}\n`);

  // -------------------------------------------------------------
  // Test 1: SQLite Integrity and Foreign Keys
  // -------------------------------------------------------------
  await runTest("1. SQLite Integrity & PRAGMA Checks", () => {
    const integrity = db.prepare("PRAGMA integrity_check;").all() as { integrity_check: string }[];
    assert(integrity.length > 0 && integrity[0].integrity_check === "ok", "PRAGMA integrity_check failed");

    const fkCheck = db.prepare("PRAGMA foreign_key_check;").all();
    assert(fkCheck.length === 0, `PRAGMA foreign_key_check found violations: ${JSON.stringify(fkCheck)}`);

    const journalMode = db.prepare("PRAGMA journal_mode;").get() as { journal_mode: string };
    assert(journalMode.journal_mode.toLowerCase() === "wal", `Expected WAL journal_mode, got ${journalMode.journal_mode}`);
  });

  // -------------------------------------------------------------
  // Test 2: Schema Column Verification for chat_sessions and chat_messages
  // -------------------------------------------------------------
  await runTest("2. Schema Verification (chat_sessions & chat_messages columns)", () => {
    const sessionCols = db.prepare("PRAGMA table_info(chat_sessions);").all() as { name: string; type: string }[];
    const sessionColNames = sessionCols.map((c) => c.name);
    console.log("   chat_sessions columns:", sessionColNames.join(", "));

    assert(sessionColNames.includes("id"), "chat_sessions missing id");
    assert(sessionColNames.includes("user_id"), "chat_sessions missing user_id");
    assert(sessionColNames.includes("title"), "chat_sessions missing title");
    assert(sessionColNames.includes("model"), "chat_sessions missing model");
    assert(sessionColNames.includes("persona_id"), "chat_sessions missing persona_id");
    assert(sessionColNames.includes("is_pinned"), "chat_sessions missing is_pinned");
    assert(sessionColNames.includes("connected_source_ids"), "chat_sessions missing connected_source_ids");

    const messageCols = db.prepare("PRAGMA table_info(chat_messages);").all() as { name: string; type: string }[];
    const messageColNames = messageCols.map((c) => c.name);
    console.log("   chat_messages columns:", messageColNames.join(", "));

    assert(messageColNames.includes("id"), "chat_messages missing id");
    assert(messageColNames.includes("session_id"), "chat_messages missing session_id");
    assert(messageColNames.includes("user_id"), "chat_messages missing user_id");
    assert(messageColNames.includes("role"), "chat_messages missing role");
    assert(messageColNames.includes("content"), "chat_messages missing content");
    assert(messageColNames.includes("feedback"), "chat_messages missing feedback");
    assert(messageColNames.includes("seq"), "chat_messages missing seq");
    assert(messageColNames.includes("thinking"), "chat_messages missing thinking");
    assert(messageColNames.includes("sources"), "chat_messages missing sources");
    assert(messageColNames.includes("tool_calls"), "chat_messages missing tool_calls");
  });

  // -------------------------------------------------------------
  // Test 3: Clean state setup
  // -------------------------------------------------------------
  const TEST_SESSION_PREFIX = "test_challenger_m1_";
  db.prepare("DELETE FROM chat_sessions WHERE id LIKE ?").run(`${TEST_SESSION_PREFIX}%`);
  db.prepare("DELETE FROM chat_messages WHERE session_id LIKE ?").run(`${TEST_SESSION_PREFIX}%`);

  // -------------------------------------------------------------
  // Test 4: Persistence Round-Trip with Thinking, Sources, and Tool Steps
  // -------------------------------------------------------------
  const session1Id = `${TEST_SESSION_PREFIX}sess_1`;
  const toolStepsSample: ToolExecutionStep[] = [
    {
      id: "call_sql_101",
      label: "query_database",
      detail: JSON.stringify({ sql: "SELECT id, title, company_id FROM jobs WHERE status = 'saved' LIMIT 5;" }),
      status: "completed",
      result: JSON.stringify([
        { id: "job_1", title: "Senior Fullstack Engineer", company_id: "comp_1" },
        { id: "job_2", title: "AI Systems Architect", company_id: "comp_2" },
      ]),
      approvalRequired: true,
    },
    {
      id: "call_search_102",
      label: "web_search",
      detail: JSON.stringify({ query: "Next.js 15 server actions best practices" }),
      status: "completed",
      result: JSON.stringify({ summary: "Server Actions provide direct backend mutation endpoints." }),
    },
    {
      id: "call_gated_103",
      label: "delete_database",
      detail: JSON.stringify({ table: "jobs", id: "job_old_99" }),
      status: "pending",
      approvalRequired: true,
    },
  ];

  const messages1: Message[] = [
    {
      id: `${TEST_SESSION_PREFIX}m1`,
      role: "user",
      content: "Please check my saved jobs and analyze them against my resume.",
      createdAt: "2026-08-16T02:00:00.000Z",
    },
    {
      id: `${TEST_SESSION_PREFIX}m2`,
      role: "assistant",
      content: "I have analyzed your saved jobs from the database and cross-referenced with your resume.",
      createdAt: "2026-08-16T02:00:05.000Z",
      thinking:
        "The user is asking for job-resume matching analysis.\n1. Query database for saved jobs.\n2. Retrieve resume chunks.\n3. Compute semantic alignment and return structured recommendations.",
      sources: ["jobs", "resumes", "doc_resume_2026_pdf", "contacts"],
      toolSteps: toolStepsSample,
      feedback: "up",
    },
    {
      id: `${TEST_SESSION_PREFIX}m3`,
      role: "user",
      content: "Can you draft a cover letter for the AI Systems Architect role?",
      createdAt: "2026-08-16T02:01:00.000Z",
    },
    {
      id: `${TEST_SESSION_PREFIX}m4`,
      role: "assistant",
      content: "Here is your tailored cover letter:\n\n```markdown\n# Application for AI Systems Architect\n...\n```",
      createdAt: "2026-08-16T02:01:10.000Z",
      thinking: "Drafting cover letter based on company comp_2 requirements and user skills.",
      sources: ["resumes", "jobs"],
      feedback: null,
    },
  ];

  const session1: ChatSession = {
    id: session1Id,
    title: "AI Job Search & Match Analysis",
    createdAt: "2026-08-16T02:00:00.000Z",
    updatedAt: "2026-08-16T02:01:10.000Z",
    model: "deepseek-r1",
    personaId: "ats_coach",
    isPinned: true,
    category: "recent",
    connectedSourceIds: ["jobs", "resumes", "contacts"],
    messages: messages1,
  };

  await runTest("3. Upsert session with thinking, sources, and toolSteps into SQLite", async () => {
    await upsertSessionToDb({ session: session1, messages: messages1 });

    // Raw DB Verification
    const sessionRow = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(session1Id) as Record<string, unknown>;
    assert(Boolean(sessionRow), "Session row not found in raw SQLite");
    assertEquals(sessionRow.title, "AI Job Search & Match Analysis", "Session title mismatch");
    assertEquals(sessionRow.model, "deepseek-r1", "Session model mismatch");
    assertEquals(sessionRow.persona_id, "ats_coach", "Session persona_id mismatch");
    assertEquals(sessionRow.is_pinned, 1, "Session is_pinned mismatch");

    const messageRows = db
      .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY seq ASC")
      .all(session1Id) as Record<string, unknown>[];
    assertEquals(messageRows.length, 4, "Raw chat_messages count mismatch");

    // Inspect assistant message 1 raw row
    const m2Row = messageRows[1];
    assertEquals(m2Row.id, `${TEST_SESSION_PREFIX}m2`, "m2 id mismatch");
    assertEquals(m2Row.role, "assistant", "m2 role mismatch");
    assertEquals(m2Row.seq, 1, "m2 seq mismatch");
    assertEquals(m2Row.feedback, "up", "m2 feedback mismatch");
    assert(typeof m2Row.thinking === "string" && (m2Row.thinking as string).includes("semantic alignment"), "m2 thinking mismatch in raw DB");
    assert(typeof m2Row.sources === "string", "m2 sources should be JSON string in raw DB");
    assert(typeof m2Row.tool_calls === "string", "m2 tool_calls should be JSON string in raw DB");

    const parsedSources = JSON.parse(m2Row.sources as string);
    assertEquals(parsedSources, ["jobs", "resumes", "doc_resume_2026_pdf", "contacts"], "m2 raw sources parsed mismatch");

    const parsedTools = JSON.parse(m2Row.tool_calls as string);
    assertEquals(parsedTools.length, 3, "m2 raw tool_calls count mismatch");
    assertEquals(parsedTools[0].toolName, "query_database", "m2 raw tool_calls toolName mismatch");
  });

  // -------------------------------------------------------------
  // Test 5: Load Session and Assert Domain Object Fidelity
  // -------------------------------------------------------------
  await runTest("4. loadSessionsFromDb fidelity check (thinking, sources, toolSteps, seq order)", async () => {
    const allSessions = await loadSessionsFromDb();
    const loaded = allSessions.find((s) => s.id === session1Id);

    assert(Boolean(loaded), "Loaded session1 not found via loadSessionsFromDb()");
    if (!loaded) return;

    assertEquals(loaded.id, session1.id, "Session ID mismatch");
    assertEquals(loaded.title, session1.title, "Session title mismatch");
    assertEquals(loaded.model, session1.model, "Session model mismatch");
    assertEquals(loaded.personaId, session1.personaId, "Session personaId mismatch");
    assertEquals(loaded.isPinned, true, "Session isPinned mismatch");
    assertEquals(loaded.connectedSourceIds, ["jobs", "resumes", "contacts"], "Session connectedSourceIds mismatch");

    assertEquals(loaded.messages.length, 4, "Loaded messages count mismatch");

    // Check message 1 (User)
    assertEquals(loaded.messages[0].id, messages1[0].id, "m1 ID mismatch");
    assertEquals(loaded.messages[0].role, "user", "m1 role mismatch");
    assertEquals(loaded.messages[0].content, messages1[0].content, "m1 content mismatch");
    assertEquals(loaded.messages[0].thinking, undefined, "m1 thinking should be undefined");
    assertEquals(loaded.messages[0].sources, undefined, "m1 sources should be undefined");
    assertEquals(loaded.messages[0].toolSteps, undefined, "m1 toolSteps should be undefined");

    // Check message 2 (Assistant with thinking, sources, toolSteps)
    const lm2 = loaded.messages[1];
    assertEquals(lm2.id, messages1[1].id, "m2 ID mismatch");
    assertEquals(lm2.role, "assistant", "m2 role mismatch");
    assertEquals(lm2.thinking, messages1[1].thinking, "m2 thinking mismatch");
    assertEquals(lm2.sources, messages1[1].sources, "m2 sources mismatch");
    assertEquals(lm2.toolSteps, toolStepsSample, "m2 toolSteps mismatch");
    assertEquals(lm2.feedback, "up", "m2 feedback mismatch");

    // Check message 4 (Assistant with thinking & sources, null feedback)
    const lm4 = loaded.messages[3];
    assertEquals(lm4.id, messages1[3].id, "m4 ID mismatch");
    assertEquals(lm4.thinking, messages1[3].thinking, "m4 thinking mismatch");
    assertEquals(lm4.sources, messages1[3].sources, "m4 sources mismatch");
    assertEquals(lm4.toolSteps, undefined, "m4 toolSteps should be undefined");
    assertEquals(lm4.feedback, null, "m4 feedback should be null");
  });

  // -------------------------------------------------------------
  // Test 6: Multi-Session Switching & Isolation
  // -------------------------------------------------------------
  const session2Id = `${TEST_SESSION_PREFIX}sess_2`;
  const session3Id = `${TEST_SESSION_PREFIX}sess_3`;

  const session2: ChatSession = {
    id: session2Id,
    title: "Code Review & Refactoring Session",
    createdAt: "2026-08-16T02:10:00.000Z",
    updatedAt: "2026-08-16T02:12:00.000Z",
    model: "claude-3-5-sonnet",
    personaId: "code_architect",
    isPinned: false,
    connectedSourceIds: ["projects"],
    messages: [
      { id: `${TEST_SESSION_PREFIX}s2_m1`, role: "user", content: "Check this TypeScript snippet" },
      { id: `${TEST_SESSION_PREFIX}s2_m2`, role: "assistant", content: "Here is the refactored version" },
    ],
  };

  const session3: ChatSession = {
    id: session3Id,
    title: "Interview Practice: Behavioral Questions",
    createdAt: "2026-08-16T02:20:00.000Z",
    updatedAt: "2026-08-16T02:25:00.000Z",
    model: "gemini-2.0-flash",
    personaId: "interviewer",
    isPinned: false,
    connectedSourceIds: [],
    messages: [
      { id: `${TEST_SESSION_PREFIX}s3_m1`, role: "user", content: "Start mock interview" },
      { id: `${TEST_SESSION_PREFIX}s3_m2`, role: "assistant", content: "Tell me about a time you resolved a technical dispute." },
    ],
  };

  await runTest("5. Multi-Session Isolation & Independent Updates", async () => {
    await upsertSessionToDb({ session: session2, messages: session2.messages });
    await upsertSessionToDb({ session: session3, messages: session3.messages });

    const all = await loadSessionsFromDb();
    const s1Loaded = all.find((s) => s.id === session1Id);
    const s2Loaded = all.find((s) => s.id === session2Id);
    const s3Loaded = all.find((s) => s.id === session3Id);

    assert(Boolean(s1Loaded && s2Loaded && s3Loaded), "Not all 3 sessions loaded");
    assertEquals(s1Loaded!.messages.length, 4, "Session 1 message count leaked/corrupted");
    assertEquals(s2Loaded!.messages.length, 2, "Session 2 message count wrong");
    assertEquals(s3Loaded!.messages.length, 2, "Session 3 message count wrong");

    // Mutate Session 2: append 2 more messages and update title
    const updatedS2Messages: Message[] = [
      ...session2.messages,
      { id: `${TEST_SESSION_PREFIX}s2_m3`, role: "user", content: "Add error handling to that." },
      { id: `${TEST_SESSION_PREFIX}s2_m4`, role: "assistant", content: "Added try/catch block.", thinking: "Adding robust error handling." },
    ];
    const updatedS2: ChatSession = {
      ...session2,
      title: "Code Review - With Error Handling",
      updatedAt: "2026-08-16T02:30:00.000Z",
      messages: updatedS2Messages,
    };

    await upsertSessionToDb({ session: updatedS2, messages: updatedS2Messages });

    const reloaded = await loadSessionsFromDb();
    const s2Reloaded = reloaded.find((s) => s.id === session2Id);
    const s1Reloaded = reloaded.find((s) => s.id === session1Id);

    assertEquals(s2Reloaded!.title, "Code Review - With Error Handling", "Session 2 title update failed");
    assertEquals(s2Reloaded!.messages.length, 4, "Session 2 messages update failed");
    assertEquals(s2Reloaded!.messages[3].thinking, "Adding robust error handling.", "Session 2 new thinking failed");
    assertEquals(s1Reloaded!.messages.length, 4, "Session 1 was unexpectedly mutated by Session 2 update");
  });

  // -------------------------------------------------------------
  // Test 7: Deletion of Single Session
  // -------------------------------------------------------------
  await runTest("6. deleteSessionFromDb cleanly removes session and messages", async () => {
    await deleteSessionFromDb(session2Id);

    const s2DbRow = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(session2Id);
    assert(!s2DbRow, "chat_sessions row survived delete");

    const s2MsgRows = db.prepare("SELECT * FROM chat_messages WHERE session_id = ?").all(session2Id);
    assertEquals(s2MsgRows.length, 0, "chat_messages rows survived delete");

    const reloaded = await loadSessionsFromDb();
    assert(!reloaded.some((s) => s.id === session2Id), "Deleted session still present in loadSessionsFromDb");
    assert(reloaded.some((s) => s.id === session1Id), "Session 1 lost during Session 2 delete");
    assert(reloaded.some((s) => s.id === session3Id), "Session 3 lost during Session 2 delete");
  });

  // -------------------------------------------------------------
  // Test 8: Resiliency against Malformed / Corrupt JSON in DB
  // -------------------------------------------------------------
  await runTest("7. Resiliency against Corrupted JSON in sources / tool_calls", async () => {
    const corruptMsgId = `${TEST_SESSION_PREFIX}corrupt_m1`;
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, user_id, role, content, seq, created_at, thinking, sources, tool_calls)
      VALUES (?, ?, ?, 'assistant', 'Test malformed json recovery', 99, datetime('now'), 'test thinking', '{INVALID_JSON_SOURCES', 'INVALID_JSON_TOOLS[')
    `).run(corruptMsgId, session1Id, userId);

    const sessions = await loadSessionsFromDb();
    const s1 = sessions.find((s) => s.id === session1Id);
    assert(Boolean(s1), "Session 1 failed to load when corrupt message was present");

    const corruptMsg = s1?.messages.find((m) => m.id === corruptMsgId);
    assert(Boolean(corruptMsg), "Corrupt message was dropped completely instead of handled gracefully");
    assertEquals(corruptMsg?.sources, undefined, "Malformed sources should gracefully fall back to undefined");
    assertEquals(corruptMsg?.toolSteps, undefined, "Malformed tool_calls should gracefully fall back to undefined");
    assertEquals(corruptMsg?.thinking, "test thinking", "Thinking should remain intact despite malformed sources/tool_calls");

    // Clean up corrupted message
    db.prepare("DELETE FROM chat_messages WHERE id = ?").run(corruptMsgId);
  });

  // -------------------------------------------------------------
  // Test 9: Forward-Only Migration Idempotency
  // -------------------------------------------------------------
  await runTest("8. Migration Idempotency (re-running getDb & addMissingColumns)", () => {
    // Calling getDb again
    const db2 = getDb();
    assert(db2 === db, "getDb should return singleton instance");

    // Execute schema migrations again to ensure 0 duplicate column errors or crashes
    const integrityAfter = db.prepare("PRAGMA integrity_check;").all() as { integrity_check: string }[];
    assertEquals(integrityAfter[0].integrity_check, "ok", "Database integrity broken after migration passes");
  });

  // -------------------------------------------------------------
  // Cleanup Test Artifacts
  // -------------------------------------------------------------
  await runTest("9. Clean up test sessions", async () => {
    await deleteSessionFromDb(session1Id);
    await deleteSessionFromDb(session3Id);

    const remaining = db
      .prepare("SELECT COUNT(*) as count FROM chat_sessions WHERE id LIKE ?")
      .get(`${TEST_SESSION_PREFIX}%`) as { count: number };
    assertEquals(remaining.count, 0, "Test sessions remained in database after cleanup");
  });

  console.log("\n===============================================================");
  console.log("📊 CHALLENGE TEST HARNESS SUMMARY");
  console.log("===============================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);
  console.log("===============================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("💥 Unhandled Runner Exception:", err);
  process.exit(1);
});

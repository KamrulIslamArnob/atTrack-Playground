/**
 * scripts/test-queue-and-approval-stress.ts
 *
 * Empirical Challenger Stress Test Suite:
 * 1. Queue Drainage Integrity under Heavy Burst Load (30+ tasks, multi-session, mixed errors & mid-flight aborts)
 * 2. Strict Per-Session FIFO Execution & Multi-Session Parallelism Invariants
 * 3. Single-Use Token Anti-Replay Security & Concurrent Race Resistance
 * 4. Expiration Safety, Safe Deny, Cross-User Isolation & Temporal TTL Invalidation
 */

import { createDbClient } from "../lib/db/client";
import { getOrCreateLocalUser } from "../lib/db/local-user";
import {
  createPendingDbDelete,
  consumePendingDbDelete,
  executeApprovedDelete,
  type PendingDbDelete,
} from "../lib/ai-chatbot/db-approval";
import { handleDbApprovalRequest } from "../lib/ai-chatbot/db-approval-route";

interface TestReport {
  id: string;
  name: string;
  category: "QUEUE_BURST" | "FIFO_ORDERING" | "ANTI_REPLAY" | "EXPIRATION_SAFETY";
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

const reports: TestReport[] = [];
const db = createDbClient();
const userId = getOrCreateLocalUser().id;
const cleanupRows: { table: string; id: string }[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(
  id: string,
  category: TestReport["category"],
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    reports.push({ id, category, name, passed: true, durationMs });
    console.log(`  [PASS] [${id}] ${name} (${durationMs}ms)`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    reports.push({ id, category, name, passed: false, error: errorMsg, durationMs });
    console.error(`  [FAIL] [${id}] ${name} (${durationMs}ms) -> ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Implementation Exact Mirror (from lib/ai-chatbot/chat-queue-context.tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface MockTask {
  id: string;
  sessionId: string;
  userPrompt: string;
  status: "queued" | "streaming" | "paused_approval" | "completed" | "failed" | "cancelled";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

class StressQueueEngine {
  public queue: MockTask[] = [];
  public abortControllers = new Map<string, AbortController>();
  public executionLog: {
    event: "start" | "complete" | "cancel" | "fail";
    taskId: string;
    sessionId: string;
    timestamp: number;
  }[] = [];

  public drainQueue(
    worker: (task: MockTask, signal: AbortSignal) => Promise<void>
  ): void {
    const activeSessionIds = new Set(this.abortControllers.keys());
    const tasksToStart: MockTask[] = [];
    const candidateSessions = new Set<string>();

    for (const task of this.queue) {
      if (
        task.status === "queued" &&
        !activeSessionIds.has(task.sessionId) &&
        !candidateSessions.has(task.sessionId)
      ) {
        tasksToStart.push(task);
        candidateSessions.add(task.sessionId);
        activeSessionIds.add(task.sessionId);
      }
    }

    for (const task of tasksToStart) {
      void this.runWorker(task, worker);
    }
  }

  private async runWorker(
    task: MockTask,
    worker: (task: MockTask, signal: AbortSignal) => Promise<void>
  ): Promise<void> {
    const { id: taskId, sessionId } = task;
    task.status = "streaming";
    task.startedAt = Date.now();
    this.executionLog.push({
      event: "start",
      taskId,
      sessionId,
      timestamp: task.startedAt,
    });

    const controller = new AbortController();
    this.abortControllers.set(sessionId, controller);

    try {
      await worker(task, controller.signal);
      task.status = "completed";
      task.completedAt = Date.now();
      this.executionLog.push({
        event: "complete",
        taskId,
        sessionId,
        timestamp: task.completedAt,
      });
    } catch (err) {
      task.completedAt = Date.now();
      if ((err as Error).name === "AbortError" || controller.signal.aborted) {
        task.status = "cancelled";
        this.executionLog.push({
          event: "cancel",
          taskId,
          sessionId,
          timestamp: task.completedAt,
        });
      } else {
        task.status = "failed";
        task.error = (err as Error).message;
        this.executionLog.push({
          event: "fail",
          taskId,
          sessionId,
          timestamp: task.completedAt,
        });
      }
    } finally {
      this.abortControllers.delete(sessionId);
      this.queue = this.queue.filter((t) => t.id !== taskId);
      this.drainQueue(worker);
    }
  }

  public enqueue(
    sessionId: string,
    userPrompt: string,
    worker: (task: MockTask, signal: AbortSignal) => Promise<void>
  ): MockTask {
    const task: MockTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      userPrompt,
      status: "queued",
      createdAt: Date.now(),
    };
    this.queue.push(task);
    this.drainQueue(worker);
    return task;
  }

  public cancel(
    sessionId: string,
    worker: (task: MockTask, signal: AbortSignal) => Promise<void>
  ): void {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sessionId);
    }
    this.queue = this.queue.filter((t) => t.sessionId !== sessionId);
    this.drainQueue(worker);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Helper to read SSE responses from handleDbApprovalRequest
// ─────────────────────────────────────────────────────────────────────────────

async function readSseResponse(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
        if (delta) fullContent += delta;
      } catch {}
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(5).trim();
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
          if (delta) fullContent += delta;
        } catch {}
      }
    }
  }

  return fullContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("CHALLENGER 2: ADVERSARIAL STRESS TEST - QUEUE & DELETION SECURITY");
  console.log("=".repeat(70) + "\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: QUEUE DRAINAGE INTEGRITY UNDER HEAVY BURST LOAD
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("--- [SECTION 1: QUEUE BURST DRAINAGE] ---");

  await runTest(
    "Q1.1",
    "QUEUE_BURST",
    "Burst load of 30 tasks across 5 distinct sessions (6 turns each) drains completely",
    async () => {
      const engine = new StressQueueEngine();
      const numSessions = 5;
      const tasksPerSession = 6;
      const totalTasks = numSessions * tasksPerSession; // 30 tasks
      const createdTasks: MockTask[] = [];
      const executedPerSession: Record<string, number> = {};

      const worker = async (task: MockTask) => {
        const latency = 10 + Math.floor(Math.random() * 25);
        await new Promise((r) => setTimeout(r, latency));
        executedPerSession[task.sessionId] = (executedPerSession[task.sessionId] || 0) + 1;
      };

      for (let turn = 0; turn < tasksPerSession; turn++) {
        for (let s = 0; s < numSessions; s++) {
          const sessionId = `burst_session_${s}`;
          const t = engine.enqueue(sessionId, `Turn ${turn + 1} for ${sessionId}`, worker);
          createdTasks.push(t);
        }
      }

      const deadline = Date.now() + 8000;
      while (createdTasks.some((t) => t.status === "queued" || t.status === "streaming")) {
        if (Date.now() > deadline) {
          throw new Error(`Queue drainage timeout: ${engine.queue.length} tasks still in queue`);
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      assert(createdTasks.length === totalTasks, `Expected ${totalTasks} tasks, created ${createdTasks.length}`);
      assert(createdTasks.every((t) => t.status === "completed"), "Not all burst tasks reached 'completed' status");
      assert(engine.queue.length === 0, `Queue still contains ${engine.queue.length} tasks!`);
      assert(engine.abortControllers.size === 0, `Leaked abort controllers: ${engine.abortControllers.size}`);

      for (let s = 0; s < numSessions; s++) {
        const sessionId = `burst_session_${s}`;
        assert(
          executedPerSession[sessionId] === tasksPerSession,
          `Session ${sessionId} executed ${executedPerSession[sessionId]} tasks, expected ${tasksPerSession}`
        );
      }
    }
  );

  await runTest(
    "Q1.2",
    "QUEUE_BURST",
    "Queue drainage resilience under mixed task failures & network errors",
    async () => {
      const engine = new StressQueueEngine();
      const numSessions = 4;
      const tasksPerSession = 5;
      const createdTasks: MockTask[] = [];

      const worker = async (task: MockTask) => {
        await new Promise((r) => setTimeout(r, 15));
        if (task.userPrompt.includes("Turn 2 for fail_session_0") || task.userPrompt.includes("Turn 3 for fail_session_2")) {
          throw new Error("Simulated upstream network error");
        }
      };

      for (let turn = 1; turn <= tasksPerSession; turn++) {
        for (let s = 0; s < numSessions; s++) {
          const sessionId = `fail_session_${s}`;
          const t = engine.enqueue(sessionId, `Turn ${turn} for ${sessionId}`, worker);
          createdTasks.push(t);
        }
      }

      const deadline = Date.now() + 6000;
      while (createdTasks.some((t) => t.status === "queued" || t.status === "streaming")) {
        if (Date.now() > deadline) {
          throw new Error("Timeout waiting for mixed error queue drainage");
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      assert(engine.queue.length === 0, "Queue did not drain completely after errors");
      assert(engine.abortControllers.size === 0, "Abort controllers leaked after errors");

      const failedTasks = createdTasks.filter((t) => t.status === "failed");
      const completedTasks = createdTasks.filter((t) => t.status === "completed");

      assert(failedTasks.length === 2, `Expected exactly 2 failed tasks, got ${failedTasks.length}`);
      assert(completedTasks.length === 18, `Expected 18 completed tasks, got ${completedTasks.length}`);
    }
  );

  await runTest(
    "Q1.3",
    "QUEUE_BURST",
    "High-load burst (50 tasks across 10 sessions) with dynamic mid-flight cancellations",
    async () => {
      const engine = new StressQueueEngine();
      const numSessions = 10;
      const tasksPerSession = 5; // 50 tasks total
      const createdTasks: MockTask[] = [];

      const worker = async (task: MockTask, signal: AbortSignal) => {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 35);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          });
        });
      };

      for (let turn = 1; turn <= tasksPerSession; turn++) {
        for (let s = 0; s < numSessions; s++) {
          const sessionId = `cancel_stress_session_${s}`;
          const t = engine.enqueue(sessionId, `Turn ${turn} for ${sessionId}`, worker);
          createdTasks.push(t);
        }
      }

      // Let initial wave start
      await new Promise((r) => setTimeout(r, 25));

      // Cancel 3 sessions mid-flight (sessions 2, 5, 8)
      engine.cancel("cancel_stress_session_2", worker);
      engine.cancel("cancel_stress_session_5", worker);
      engine.cancel("cancel_stress_session_8", worker);

      const deadline = Date.now() + 8000;
      while (engine.queue.length > 0 || engine.abortControllers.size > 0) {
        if (Date.now() > deadline) {
          throw new Error("Timeout waiting for 50-task drainage with cancellations");
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      assert(engine.queue.length === 0, "Queue not drained after mid-flight cancellations");
      assert(engine.abortControllers.size === 0, "Controllers leaked after cancellations");

      // Verify uncancelled sessions completed all their tasks
      for (const s of [0, 1, 3, 4, 6, 7, 9]) {
        const sId = `cancel_stress_session_${s}`;
        const sessionTasks = createdTasks.filter((t) => t.sessionId === sId);
        assert(
          sessionTasks.every((t) => t.status === "completed"),
          `Uncancelled session ${sId} has uncompleted tasks: ${sessionTasks.map((t) => t.status).join(", ")}`
        );
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: STRICT FIFO EXECUTION ORDER WITHIN EACH SESSION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [SECTION 2: STRICT PER-SESSION FIFO ORDERING] ---");

  await runTest(
    "F2.1",
    "FIFO_ORDERING",
    "Strict FIFO execution sequence within single session: start(Ti) < complete(Ti) <= start(Ti+1)",
    async () => {
      const engine = new StressQueueEngine();
      const sessionId = "fifo_strict_session";
      const totalTurns = 8;
      const tasks: MockTask[] = [];

      const worker = async () => {
        const latency = 20 + Math.floor(Math.random() * 30);
        await new Promise((r) => setTimeout(r, latency));
      };

      for (let i = 0; i < totalTurns; i++) {
        tasks.push(engine.enqueue(sessionId, `Turn_${i}`, worker));
      }

      const deadline = Date.now() + 6000;
      while (tasks.some((t) => t.status !== "completed")) {
        if (Date.now() > deadline) {
          throw new Error("FIFO test timed out");
        }
        await new Promise((r) => setTimeout(r, 20));
      }

      const starts = engine.executionLog.filter((e) => e.sessionId === sessionId && e.event === "start");
      const completes = engine.executionLog.filter((e) => e.sessionId === sessionId && e.event === "complete");

      assert(starts.length === totalTurns, `Expected ${totalTurns} starts, got ${starts.length}`);
      assert(completes.length === totalTurns, `Expected ${totalTurns} completions, got ${completes.length}`);

      for (let i = 0; i < totalTurns; i++) {
        assert(starts[i].taskId === tasks[i].id, `Start order mismatch at index ${i}`);
        assert(completes[i].taskId === tasks[i].id, `Complete order mismatch at index ${i}`);
        assert(starts[i].timestamp <= completes[i].timestamp, `Task ${tasks[i].id} start time > complete time`);

        if (i > 0) {
          assert(
            completes[i - 1].timestamp <= starts[i].timestamp,
            `FIFO Invariant Violated: Task ${i} started at ${starts[i].timestamp} before Task ${i - 1} completed at ${completes[i - 1].timestamp}`
          );
        }
      }
    }
  );

  await runTest(
    "F2.2",
    "FIFO_ORDERING",
    "Concurrent inter-session parallelism alongside strict intra-session FIFO",
    async () => {
      const engine = new StressQueueEngine();
      const sessions = ["session_X", "session_Y", "session_Z"];
      const turnsPerSession = 4;
      const tasks: MockTask[] = [];

      const worker = async () => {
        await new Promise((r) => setTimeout(r, 60));
      };

      for (let t = 0; t < turnsPerSession; t++) {
        for (const s of sessions) {
          tasks.push(engine.enqueue(s, `Turn ${t} for ${s}`, worker));
        }
      }

      const deadline = Date.now() + 6000;
      while (tasks.some((t) => t.status !== "completed")) {
        if (Date.now() > deadline) throw new Error("Parallel FIFO test timed out");
        await new Promise((r) => setTimeout(r, 20));
      }

      const firstTurnTasks = sessions.map((s) => tasks.find((t) => t.sessionId === s && t.userPrompt.includes("Turn 0"))!);
      const minStart = Math.min(...firstTurnTasks.map((t) => t.startedAt!));
      const maxStart = Math.max(...firstTurnTasks.map((t) => t.startedAt!));
      assert(maxStart - minStart < 40, `Expected parallel dispatch across sessions (delta < 40ms), got ${maxStart - minStart}ms`);

      for (const s of sessions) {
        const sessionTasks = tasks.filter((t) => t.sessionId === s);
        for (let i = 1; i < sessionTasks.length; i++) {
          assert(
            sessionTasks[i - 1].completedAt! <= sessionTasks[i].startedAt!,
            `Session ${s} intra-session FIFO violated between turn ${i - 1} and ${i}`
          );
        }
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: SINGLE-USE TOKEN ANTI-REPLAY SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [SECTION 3: SINGLE-USE TOKEN ANTI-REPLAY] ---");

  await runTest(
    "A3.1",
    "ANTI_REPLAY",
    "Sequential replay attempt: Calling delete approval twice with same token must fail on second call",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_anti_replay_row",
          description: "Target row for anti-replay verification",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      // Call 1: Valid consumption
      const pending1 = consumePendingDbDelete(approvalId, userId);
      assert(pending1 !== null, "First consumePendingDbDelete call returned null!");
      const deleted1 = executeApprovedDelete(pending1!);
      assert(deleted1 === 1, `Expected 1 row deleted, got ${deleted1}`);

      // Verify row is gone
      const { data: check1 } = await db.from("ai_memories").select("id").eq("id", targetId);
      assert(check1.length === 0, "Row was not deleted from database on first approval!");

      // Call 2: Replay attempt with same token
      const pending2 = consumePendingDbDelete(approvalId, userId);
      assert(pending2 === null, "CRITICAL: Single-use token was consumable a SECOND time!");

      const deleted2 = pending2 ? executeApprovedDelete(pending2) : 0;
      assert(deleted2 === 0, "Replay execution occurred!");
    }
  );

  await runTest(
    "A3.2",
    "ANTI_REPLAY",
    "Concurrent race condition: 20 simultaneous consume calls on 1 token yields exactly 1 success",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_race_condition_row",
          description: "Target row for concurrent race condition testing",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      const raceResults = await Promise.all(
        Array.from({ length: 20 }, async () => {
          return consumePendingDbDelete(approvalId, userId);
        })
      );

      const successfulConsumes = raceResults.filter((r): r is PendingDbDelete => r !== null);
      const failedConsumes = raceResults.filter((r) => r === null);

      assert(
        successfulConsumes.length === 1,
        `RACE CONDITION VULNERABILITY: ${successfulConsumes.length} concurrent calls succeeded on single-use token!`
      );
      assert(
        failedConsumes.length === 19,
        `Expected 19 rejected replay attempts, got ${failedConsumes.length}`
      );

      const deleted = executeApprovedDelete(successfulConsumes[0]);
      assert(deleted === 1, `Expected 1 row deleted by winner, got ${deleted}`);

      const { data: check } = await db.from("ai_memories").select("id").eq("id", targetId);
      assert(check.length === 0, "Row was not deleted by winner");
    }
  );

  await runTest(
    "A3.3",
    "ANTI_REPLAY",
    "Route-level handleDbApprovalRequest rejects replayed Allow decision with safe error stream",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_route_replay_row",
          description: "Target row for route-level replay testing",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      const res1 = handleDbApprovalRequest(approvalId, "allow", userId);
      const text1 = await readSseResponse(res1);
      assert(
        text1.includes("Deleted 1 row(s)"),
        `Expected first response to report deletion, got: "${text1}"`
      );

      const res2 = handleDbApprovalRequest(approvalId, "allow", userId);
      const text2 = await readSseResponse(res2);
      assert(
        text2.includes("expired or was already handled"),
        `Expected rejection stream on replay, got: "${text2}"`
      );
    }
  );

  await runTest(
    "A3.4",
    "ANTI_REPLAY",
    "Random forged UUID approval token is rejected cleanly with zero DB operations",
    async () => {
      const forgedToken = "11111111-2222-3333-4444-555555555555";
      const pending = consumePendingDbDelete(forgedToken, userId);
      assert(pending === null, "Forged token unexpectedly returned pending delete!");

      const res = handleDbApprovalRequest(forgedToken, "allow", userId);
      const text = await readSseResponse(res);
      assert(
        text.includes("expired or was already handled"),
        `Expected rejection of forged token, got: "${text}"`
      );
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: EXPIRATION SAFETY & SECURITY BOUNDARIES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n--- [SECTION 4: EXPIRATION SAFETY & BOUNDARIES] ---");

  await runTest(
    "E4.1",
    "EXPIRATION_SAFETY",
    "Temporal TTL Invalidation: Mocked expired token (Date.now() > expiresAt) rejected without mutation",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_ttl_expired_row",
          description: "Row that must NOT be deleted due to TTL expiration",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      // Advance simulated system time beyond the 15-minute TTL
      const originalNow = Date.now;
      try {
        // Fast-forward clock by 16 minutes (16 * 60 * 1000 ms)
        Date.now = () => originalNow() + 16 * 60 * 1000;

        const consumed = consumePendingDbDelete(approvalId, userId);
        assert(consumed === null, "Expired token was successfully consumed!");
      } finally {
        Date.now = originalNow;
      }

      // Verify row in database is still 100% intact
      const { data: check } = await db.from("ai_memories").select("id").eq("id", targetId);
      assert(check.length === 1, "Database row was mutated despite token expiration!");
    }
  );

  await runTest(
    "E4.2",
    "EXPIRATION_SAFETY",
    "Deny decision cancels deletion, purges token, and leaves database records intact",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_deny_token_row",
          description: "Row that must NOT be deleted when user denies",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      const resDeny = handleDbApprovalRequest(approvalId, "deny", userId);
      const textDeny = await readSseResponse(resDeny);
      assert(
        textDeny.includes("Delete cancelled — no rows were removed"),
        `Expected cancellation message, got: "${textDeny}"`
      );

      const { data: check } = await db.from("ai_memories").select("id").eq("id", targetId);
      assert(check.length === 1, "Row was deleted even though Deny was requested!");

      const resAfterDeny = handleDbApprovalRequest(approvalId, "allow", userId);
      const textAfterDeny = await readSseResponse(resAfterDeny);
      assert(
        textAfterDeny.includes("expired or was already handled"),
        `Expected denied token to be non-reusable, got: "${textAfterDeny}"`
      );
    }
  );

  await runTest(
    "E4.3",
    "EXPIRATION_SAFETY",
    "Cross-user isolation: User B cannot consume or approve User A's pending deletion token",
    async () => {
      const { data: row, error } = await db
        .from("ai_memories")
        .insert({
          user_id: userId,
          title: "stress_cross_user_row",
          description: "Row owned by user A",
        })
        .select("id")
        .single();

      if (error || !row) throw new Error(error?.message ?? "Insert failed");
      const targetId = row.id as string;
      cleanupRows.push({ table: "ai_memories", id: targetId });

      const approvalId = createPendingDbDelete({
        userId,
        table: "ai_memories",
        ownerCol: "user_id",
        ids: [targetId],
        label: "AI Memories",
        preview: `id: ${targetId}`,
        sql: `DELETE FROM ai_memories WHERE id = ? AND user_id = ?`,
      });

      const attackerUserId = "attacker_user_9999";
      const resAttack = handleDbApprovalRequest(approvalId, "allow", attackerUserId);
      const textAttack = await readSseResponse(resAttack);

      assert(
        textAttack.includes("expired or was already handled"),
        `Expected cross-user attack to be rejected, got: "${textAttack}"`
      );

      const { data: check } = await db.from("ai_memories").select("id").eq("id", targetId);
      assert(check.length === 1, "SECURITY BREACH: User B deleted User A's record!");
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────────────────
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n" + "=".repeat(70));
  console.log(`STRESS TEST SUMMARY: TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=".repeat(70) + "\n");
}

main()
  .catch((err) => {
    console.error("Fatal stress test runner error:", err);
    reports.push({
      id: "FATAL",
      category: "QUEUE_BURST",
      name: "Fatal runner exception",
      passed: false,
      durationMs: 0,
      error: String(err),
    });
  })
  .finally(async () => {
    for (const { table, id } of cleanupRows) {
      try {
        await db.from(table).delete().eq("id", id);
      } catch {}
    }

    if (reports.some((r) => !r.passed)) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });

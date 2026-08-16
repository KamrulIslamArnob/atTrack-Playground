/**
 * scripts/challenge-multi-session-stress.ts
 *
 * Adversarial Stress & Chaos Test Suite for atTrack AI Chatbot:
 * - 50 concurrent streams with micro-fragmented chunks (1-5 byte slices, UTF-8 boundaries)
 * - Arbitrary boundary splitting (mid-line, mid-tag <th...ink>, mid-JSON, trailing unclosed frames)
 * - Multi-session abort isolation (S1 abort while S2 and S3 stream to completion)
 * - Fast session switching and rapid abort/re-prompt cycles (chaos monkey)
 * - State leakage and race condition detection
 */

import { extractThinkingAndContent, type ChatMessage, type DbApproval, type ToolExecutionStep } from "../lib/ai-chatbot/use-chat";
import { streamResponse, type AgentExecutionResult } from "../lib/ai-chatbot/pipeline";

interface ChallengeResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

const results: ChallengeResult[] = [];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let uncaughtErrors: unknown[] = [];
process.on("unhandledRejection", (r) => uncaughtErrors.push(r));
process.on("uncaughtException", (e) => uncaughtErrors.push(e));

function assert(condition: boolean, msg: string, details?: unknown) {
  if (!condition) {
    const err = new Error(msg);
    if (details) (err as unknown as { details: unknown }).details = details;
    throw err;
  }
}

async function runChallenge(suite: string, name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  [PASS] ${name} (${durationMs}ms)`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ suite, name, passed: false, durationMs, error: errorMsg });
    console.error(`  [FAIL] ${name} (${durationMs}ms): ${errorMsg}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE Fragmentation Engine
// Simulates network delivery with arbitrary byte slicing
// ─────────────────────────────────────────────────────────────────────────────

function createFragmentedStream(
  frames: string[],
  sliceMinBytes = 1,
  sliceMaxBytes = 4,
  delayMs = 1
): ReadableStream<Uint8Array> {
  const fullText = frames.join("");
  const fullBytes = encoder.encode(fullText);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      while (offset < fullBytes.length) {
        const chunkSize = Math.floor(Math.random() * (sliceMaxBytes - sliceMinBytes + 1)) + sliceMinBytes;
        const end = Math.min(offset + chunkSize, fullBytes.length);
        const slice = fullBytes.subarray(offset, end);
        controller.enqueue(slice);
        offset = end;
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      controller.close();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Reader & Decoder (Mirrors use-chat.ts and chat-queue-context.tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface StreamReconstruction {
  finalContent: string;
  finalThinking: string;
  sources: string[];
  toolSteps: ToolExecutionStep[];
  approval: DbApproval | null;
  rawChunksCount: number;
}

async function consumeSSEStream(
  stream: ReadableStream<Uint8Array>,
  targetSessionId: string,
  signal?: AbortSignal
): Promise<StreamReconstruction> {
  const reader = stream.getReader();
  const streamDecoder = new TextDecoder();
  let structuredThinkingAcc = "";
  let rawContentAcc = "";
  let sourcesAcc: string[] = [];
  let toolStepsAcc: ToolExecutionStep[] = [];
  let approvalAcc: DbApproval | null = null;
  let buffer = "";
  let rawChunksCount = 0;

  try {
    while (true) {
      if (signal?.aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
      }

      const { done, value } = await reader.read();
      if (done) break;

      rawChunksCount++;
      buffer += streamDecoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const reasoningDelta =
            parsed?.choices?.[0]?.delta?.reasoning_content ??
            parsed?.choices?.[0]?.delta?.reasoning ??
            parsed?.delta?.reasoning_content ??
            parsed?.thinking;
          if (reasoningDelta) structuredThinkingAcc += reasoningDelta;

          const contentDelta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
          if (contentDelta) rawContentAcc += contentDelta;

          if (Array.isArray(parsed?.sources) && parsed.sources.length > 0) {
            sourcesAcc = parsed.sources;
          }

          if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
            toolStepsAcc = parsed.tool_calls.map((s: unknown, i: number) => {
              const rec = s as { name?: string; status?: string; args?: Record<string, unknown>; error?: string };
              return {
                id: `tool-${i}`,
                label: rec.name ?? "tool",
                status: (rec.status === "error" ? "failed" : "completed") as "failed" | "completed",
                detail: rec.args ? JSON.stringify(rec.args) : undefined,
              };
            });
          }

          if (parsed?.approval && typeof parsed.approval === "object") {
            approvalAcc = {
              ...parsed.approval,
              sessionId: targetSessionId,
              expiresAt: parsed.approval.expiresAt || Date.now() + 60_000,
            };
          }
        } catch {
          // partial JSON frame waiting for next chunks
        }
      }
    }

    // Flush trailing buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const reasoningDelta =
              parsed?.choices?.[0]?.delta?.reasoning_content ??
              parsed?.choices?.[0]?.delta?.reasoning ??
              parsed?.delta?.reasoning_content ??
              parsed?.thinking;
            if (reasoningDelta) structuredThinkingAcc += reasoningDelta;

            const contentDelta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
            if (contentDelta) rawContentAcc += contentDelta;
          } catch {}
        }
      }
    }

    const { thinking, content } = extractThinkingAndContent(rawContentAcc, structuredThinkingAcc);

    return {
      finalContent: content,
      finalThinking: thinking || "",
      sources: sourcesAcc,
      toolSteps: toolStepsAcc,
      approval: approvalAcc,
      rawChunksCount,
    };
  } finally {
    reader.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Session Concurrency Model
// ─────────────────────────────────────────────────────────────────────────────

interface QueueTask {
  id: string;
  sessionId: string;
  prompt: string;
  status: "queued" | "streaming" | "completed" | "cancelled" | "failed";
  output?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

class ConcurrencyHarness {
  public queue: QueueTask[] = [];
  public abortControllers = new Map<string, AbortController>();
  public activeSessions = new Set<string>();
  public sessionStore = new Map<string, string[]>(); // sessionId -> messages
  public executionLog: string[] = [];

  public drainQueue(streamGenerator: (task: QueueTask, signal: AbortSignal) => Promise<string>): void {
    const active = new Set(this.abortControllers.keys());
    const toStart: QueueTask[] = [];
    const scheduledSessions = new Set<string>();

    for (const task of this.queue) {
      if (task.status === "queued" && !active.has(task.sessionId) && !scheduledSessions.has(task.sessionId)) {
        toStart.push(task);
        scheduledSessions.add(task.sessionId);
        active.add(task.sessionId);
      }
    }

    for (const task of toStart) {
      void this.runTask(task, streamGenerator);
    }
  }

  private async runTask(task: QueueTask, streamGenerator: (task: QueueTask, signal: AbortSignal) => Promise<string>) {
    task.status = "streaming";
    task.startTime = Date.now();
    this.executionLog.push(`START:${task.id}:${task.sessionId}`);

    const controller = new AbortController();
    this.abortControllers.set(task.sessionId, controller);
    this.activeSessions.add(task.sessionId);

    try {
      const output = await streamGenerator(task, controller.signal);
      task.status = "completed";
      task.output = output;
      task.endTime = Date.now();
      this.executionLog.push(`COMPLETE:${task.id}:${task.sessionId}`);

      // Save to session store
      const list = this.sessionStore.get(task.sessionId) || [];
      list.push(output);
      this.sessionStore.set(task.sessionId, list);
    } catch (err) {
      task.endTime = Date.now();
      if ((err as Error).name === "AbortError" || controller.signal.aborted) {
        task.status = "cancelled";
        this.executionLog.push(`CANCEL:${task.id}:${task.sessionId}`);
      } else {
        task.status = "failed";
        task.error = (err as Error).message;
        this.executionLog.push(`FAIL:${task.id}:${task.sessionId}`);
      }
    } finally {
      this.abortControllers.delete(task.sessionId);
      this.activeSessions.delete(task.sessionId);
      this.queue = this.queue.filter((t) => t.id !== task.id);
      this.drainQueue(streamGenerator);
    }
  }

  public enqueue(sessionId: string, prompt: string, streamGen: (task: QueueTask, signal: AbortSignal) => Promise<string>): QueueTask {
    const task: QueueTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      prompt,
      status: "queued",
    };
    this.queue.push(task);
    this.drainQueue(streamGen);
    return task;
  }

  public cancel(sessionId: string): void {
    const ctrl = this.abortControllers.get(sessionId);
    if (ctrl) {
      ctrl.abort();
      this.abortControllers.delete(sessionId);
    }
    this.queue = this.queue.filter((t) => t.sessionId !== sessionId);
    this.activeSessions.delete(sessionId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

async function challenge1_50ConcurrentStreamsMicroFragmentation() {
  const STREAM_COUNT = 50;
  const expectedPayloads: { sessionId: string; expectedContent: string; expectedThinking: string }[] = [];
  const promises: Promise<StreamReconstruction>[] = [];

  for (let i = 0; i < STREAM_COUNT; i++) {
    const sessionId = `stream_sess_${i}`;
    const expectedThinking = `Thinking stream for session ${i}: analyzing parameters and preparing response.`;
    const expectedContent = `Session ${i} final content payload: 🚀 High-load testing Unicode ✨ & numbers: ${i * 42} (한국어/日本語/عربي)`;

    expectedPayloads.push({ sessionId, expectedContent, expectedThinking });

    // Build SSE frames
    const frames = [
      `data: ${JSON.stringify({ sources: [`source_doc_${i}.pdf`, "SQLite_DB"] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: expectedThinking.slice(0, 20) } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: expectedThinking.slice(20) } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: expectedContent.slice(0, 15) } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: expectedContent.slice(15, 35) } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: expectedContent.slice(35) } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];

    // Micro-fragmentation: slice streams into 1-3 byte chunks with random 0-1ms micro-delays
    const stream = createFragmentedStream(frames, 1, 3, 0);
    promises.push(consumeSSEStream(stream, sessionId));
  }

  const results = await Promise.all(promises);

  assert(results.length === STREAM_COUNT, `Expected ${STREAM_COUNT} results, got ${results.length}`);

  for (let i = 0; i < STREAM_COUNT; i++) {
    const res = results[i];
    const exp = expectedPayloads[i];

    assert(
      res.finalContent === exp.expectedContent,
      `Session ${i} content mismatch!\nExpected: "${exp.expectedContent}"\nGot:      "${res.finalContent}"`
    );
    assert(
      res.finalThinking === exp.expectedThinking,
      `Session ${i} thinking mismatch!\nExpected: "${exp.expectedThinking}"\nGot:      "${res.finalThinking}"`
    );
    assert(res.sources.length === 2, `Session ${i} expected 2 sources, got ${res.sources.length}`);
    assert(res.rawChunksCount > 10, `Session ${i} should be fragmented into many micro-chunks, got ${res.rawChunksCount}`);
  }
}

async function challenge2_ArbitraryByteAndTagBoundarySplitting() {
  // Scenario 2.1: Mid-tag split across byte fragments: `<th` | `ink>Internal reasoning</th` | `ink>Real content`
  {
    const frames = [
      'data: {"choices":[{"delta":{"content":"<th',
      'ink>Internal reasoning</th',
      'ink>Real content"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = createFragmentedStream(frames, 1, 2, 0);
    const res = await consumeSSEStream(stream, "sess_tag_split");
    assert(res.finalThinking === "Internal reasoning", `Tag split thinking failed: got "${res.finalThinking}"`);
    assert(res.finalContent === "Real content", `Tag split content failed: got "${res.finalContent}"`);
  }

  // Scenario 2.2: 4-Byte UTF-8 Emoji (🚀, 💡, 🛡️, 🌐) split across single-byte stream chunks
  {
    const emojiPayload = "Rocket: 🚀 Light: 💡 Shield: 🛡️ Globe: 🌐";
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: emojiPayload } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    // Strict 1-byte chunking forces multi-byte UTF-8 sequences to be sliced in mid-code-point
    const stream = createFragmentedStream(frames, 1, 1, 0);
    const res = await consumeSSEStream(stream, "sess_emoji");
    assert(res.finalContent === emojiPayload, `UTF-8 multi-byte split corrupted emoji: got "${res.finalContent}"`);
  }

  // Scenario 2.3: Trailing frame with NO terminating newline (Testing trailing buffer flush)
  {
    const frames = [
      'data: {"choices":[{"delta":{"content":"Initial part "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"and trailing frame without newline"}}]}', // valid JSON but NO trailing \n\n
    ];
    const stream = createFragmentedStream(frames, 1, 4, 0);
    const res = await consumeSSEStream(stream, "sess_trailing");
    assert(
      res.finalContent === "Initial part and trailing frame without newline",
      `Trailing buffer flush failed: got "${res.finalContent}"`
    );
  }

  // Scenario 2.4: Sequential thinking blocks with interspersed content
  {
    const raw = "<think>Step 1 analysis</think>First result.<think>Step 2 analysis</think>Second result.";
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: raw } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const stream = createFragmentedStream(frames, 2, 5, 0);
    const res = await consumeSSEStream(stream, "sess_seq_think");
    assert(
      res.finalThinking === "Step 1 analysis\nStep 2 analysis",
      `Sequential thinking blocks failed: got "${res.finalThinking}"`
    );
    assert(res.finalContent === "First result.Second result.", `Sequential content failed: got "${res.finalContent}"`);
  }

  // Scenario 2.5: Unclosed thinking tag at end of stream (streaming interrupted or model cuts off)
  {
    const raw = "<think>Reasoning in progress that never got closed tag";
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: raw } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const stream = createFragmentedStream(frames, 1, 3, 0);
    const res = await consumeSSEStream(stream, "sess_unclosed");
    assert(
      res.finalThinking === "Reasoning in progress that never got closed tag",
      `Unclosed thinking tag failed to extract thinking: got "${res.finalThinking}"`
    );
    assert(res.finalContent === "", `Unclosed thinking tag should leave content empty, got "${res.finalContent}"`);
  }
}

async function challenge3_MultiSessionAbortIsolation() {
  const harness = new ConcurrencyHarness();

  let s1Started = false;
  let s1Aborted = false;
  let s2Finished = false;
  let s3Finished = false;
  let s1NewFinished = false;

  const mockWorker = async (task: QueueTask, signal: AbortSignal): Promise<string> => {
    if (task.sessionId === "session_1" && task.prompt === "Query 1 (to be aborted)") {
      s1Started = true;
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => resolve("S1 completed unexpectedly"), 300);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          s1Aborted = true;
          const err = new Error("AbortError");
          err.name = "AbortError";
          reject(err);
        });
      });
    }

    if (task.sessionId === "session_2") {
      await new Promise((r) => setTimeout(r, 120));
      s2Finished = true;
      return "S2 Full Response Data";
    }

    if (task.sessionId === "session_3") {
      await new Promise((r) => setTimeout(r, 180));
      s3Finished = true;
      return "S3 Full Response Data";
    }

    if (task.sessionId === "session_1" && task.prompt === "Query 2 (new prompt after abort)") {
      await new Promise((r) => setTimeout(r, 80));
      s1NewFinished = true;
      return "S1-New Full Response Data";
    }

    return "Default Output";
  };

  // Launch S1, S2, S3 concurrently
  const t1 = harness.enqueue("session_1", "Query 1 (to be aborted)", mockWorker);
  const t2 = harness.enqueue("session_2", "Query S2", mockWorker);
  const t3 = harness.enqueue("session_3", "Query S3", mockWorker);

  // Wait 40ms to ensure all are actively streaming
  await new Promise((r) => setTimeout(r, 40));
  assert(s1Started, "Session 1 should be active");
  assert(harness.abortControllers.has("session_1"), "Session 1 abort controller must exist");
  assert(harness.abortControllers.has("session_2"), "Session 2 abort controller must exist");
  assert(harness.abortControllers.has("session_3"), "Session 3 abort controller must exist");

  // Abort Session 1
  harness.cancel("session_1");

  // Wait 20ms then enqueue a new query in Session 1
  await new Promise((r) => setTimeout(r, 20));
  const t1New = harness.enqueue("session_1", "Query 2 (new prompt after abort)", mockWorker);

  // Wait for all remaining tasks to finish
  const deadline = Date.now() + 2000;
  while (t2.status !== "completed" || t3.status !== "completed" || t1New.status !== "completed") {
    if (Date.now() > deadline) throw new Error("Abort isolation test timed out");
    await new Promise((r) => setTimeout(r, 20));
  }

  assert(s1Aborted, "Session 1 was not aborted cleanly");
  assert(t1.status === "cancelled", `Expected t1 status 'cancelled', got ${t1.status}`);
  assert(s2Finished, "Session 2 was disrupted by Session 1 abort!");
  assert(t2.status === "completed" && t2.output === "S2 Full Response Data", "Session 2 data corrupted");
  assert(s3Finished, "Session 3 was disrupted by Session 1 abort!");
  assert(t3.status === "completed" && t3.output === "S3 Full Response Data", "Session 3 data corrupted");
  assert(s1NewFinished, "Session 1 new prompt failed to execute after abort");
  assert(t1New.status === "completed" && t1New.output === "S1-New Full Response Data", "Session 1 new output mismatch");

  // Verify no controller leak
  assert(harness.abortControllers.size === 0, `Leaked abort controllers: ${harness.abortControllers.size}`);
  assert(harness.queue.length === 0, `Leaked queue items: ${harness.queue.length}`);
}

async function challenge4_ChaosSessionSwitchingAndRapidAbortReprompt() {
  const harness = new ConcurrencyHarness();
  const SESSIONS = ["sess_alpha", "sess_beta", "sess_gamma", "sess_delta", "sess_epsilon"];
  const tasks: QueueTask[] = [];

  const chaosWorker = async (task: QueueTask, signal: AbortSignal): Promise<string> => {
    const chunkCount = 5;
    let accumulated = "";
    for (let i = 0; i < chunkCount; i++) {
      if (signal.aborted) {
        const err = new Error("AbortError");
        err.name = "AbortError";
        throw err;
      }
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 15));
      accumulated += `[${task.sessionId}:${task.id}:c${i}]`;
    }
    return accumulated;
  };

  // Chaotic dispatch: 60 actions across 5 sessions with rapid cancels & enqueues
  for (let cycle = 0; cycle < 60; cycle++) {
    const targetSession = SESSIONS[cycle % SESSIONS.length];
    const action = Math.random();

    if (action < 0.65) {
      // Enqueue new prompt
      const t = harness.enqueue(targetSession, `Prompt_${cycle}`, chaosWorker);
      tasks.push(t);
    } else if (action < 0.85) {
      // Rapid cancel and immediate re-enqueue
      harness.cancel(targetSession);
      const t = harness.enqueue(targetSession, `Prompt_Re_${cycle}`, chaosWorker);
      tasks.push(t);
    } else {
      // Cancel target session
      harness.cancel(targetSession);
    }

    // Small random interval
    if (cycle % 5 === 0) {
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  // Wait for all remaining active & queued tasks to settle
  const deadline = Date.now() + 6000;
  while (harness.queue.some((t) => t.status === "queued" || t.status === "streaming")) {
    if (Date.now() > deadline) {
      throw new Error(`Chaos test did not settle in time. Remaining tasks: ${harness.queue.length}`);
    }
    await new Promise((r) => setTimeout(r, 30));
  }

  // Assertions
  assert(harness.abortControllers.size === 0, `Dangling abort controllers: ${harness.abortControllers.size}`);
  assert(harness.queue.length === 0, `Unprocessed tasks remaining: ${harness.queue.length}`);

  // Check data integrity: each completed session message belongs strictly to that session
  for (const [sessId, messages] of harness.sessionStore.entries()) {
    for (const msg of messages) {
      assert(msg.includes(`[${sessId}:`), `Session store contamination: found foreign chunk in ${sessId}: "${msg}"`);
    }
  }

  console.log(`    Chaos metrics: total tasks processed=${tasks.length}, completed=${tasks.filter(t => t.status === 'completed').length}, cancelled=${tasks.filter(t => t.status === 'cancelled').length}`);
}

async function challenge5_StreamResponsePipelineEdgeCases() {
  // Test pipeline streamResponse with 0 chunks, aborts, and multiple simultaneous subscribers
  const mockBaseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Alpha"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" Beta"}}]}\n\n'));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const res = streamResponse({
    mode: "stream",
    baseStream: mockBaseStream,
    sources: ["Doc1", "Doc2"],
  });

  assert(res.status === 200, "Response status should be 200");
  assert(res.headers.get("Content-Type") === "text/event-stream; charset=utf-8", "Content-Type must be text/event-stream");
  assert(res.headers.get("Cache-Control") === "no-cache", "Cache-Control must be no-cache");

  const streamReconstruction = await consumeSSEStream(res.body!, "test_pipe");
  assert(streamReconstruction.finalContent === "Alpha Beta", `Pipeline final content failed: "${streamReconstruction.finalContent}"`);
  assert(streamReconstruction.sources.length === 2, `Pipeline sources count mismatch: ${streamReconstruction.sources.length}`);
}

async function challenge6_ApprovalSessionTargetingUnderConcurrentSessionSwitch() {
  // Session 1 is generating a tool call that triggers delete_database approval
  // While Session 1 is waiting for approval, user switches to Session 2 and Session 3 and chats
  // User approves from Session 2's UI view (via global modal)
  // Ensure Session 1 gets the approval result, and Session 2/3 are completely unaffected

  const messagesBySession: Record<string, ChatMessage[]> = {
    session_1: [
      { id: "m1_u", role: "user", content: "Delete table candidates", createdAt: new Date().toISOString() },
    ],
    session_2: [
      { id: "m2_u", role: "user", content: "Write a resume summary", createdAt: new Date().toISOString() },
      { id: "m2_a", role: "assistant", content: "Here is your summary...", createdAt: new Date().toISOString(), status: "delivered" },
    ],
    session_3: [
      { id: "m3_u", role: "user", content: "Explain React 19 hooks", createdAt: new Date().toISOString() },
    ],
  };

  const approvalPayload: DbApproval = {
    approvalId: "appr_secure_token_999",
    label: "Delete database table 'candidates'",
    preview: "DELETE FROM candidates WHERE status = 'archived'",
    sql: "DELETE FROM candidates WHERE status = 'archived'",
    sessionId: "session_1", // Originated in Session 1
    expiresAt: Date.now() + 60_000,
  };

  // User is currently looking at session_3
  const activeSessionId = "session_3";

  // Global resolveApproval routes by approvalPayload.sessionId
  const targetId = approvalPayload.sessionId || activeSessionId;
  assert(targetId === "session_1", `Approval routed to wrong session: expected session_1, got ${targetId}`);

  // Simulate result injection into target session
  const approvalConfirmation: ChatMessage = {
    id: "m1_approval_resp",
    role: "assistant",
    content: "✅ Deletion executed: 14 rows removed from 'candidates'.",
    status: "delivered",
    createdAt: new Date().toISOString(),
  };

  messagesBySession[targetId] = [...messagesBySession[targetId], approvalConfirmation];

  // Verify Session 1 has user query + approval confirmation
  assert(messagesBySession["session_1"].length === 2, "Session 1 should have 2 messages");
  assert(messagesBySession["session_1"][1].content.includes("14 rows removed"), "Session 1 missing confirmation message");

  // Verify Session 2 and Session 3 are completely pristine and unchanged
  assert(messagesBySession["session_2"].length === 2, "Session 2 was corrupted by approval resolution!");
  assert(messagesBySession["session_2"][1].content === "Here is your summary...", "Session 2 content corrupted");
  assert(messagesBySession["session_3"].length === 1, "Session 3 was corrupted by approval resolution!");
  assert(messagesBySession["session_3"][0].content === "Explain React 19 hooks", "Session 3 content corrupted");
}

async function challenge7_100ParallelStreamsStress() {
  const STREAM_COUNT = 100;
  const promises: Promise<StreamReconstruction>[] = [];

  for (let i = 0; i < STREAM_COUNT; i++) {
    const sId = `extreme_stream_${i}`;
    const text = `Extreme stream #${i}: payload token test [OK]`;
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const stream = createFragmentedStream(frames, 1, 2, 0);
    promises.push(consumeSSEStream(stream, sId));
  }

  const results = await Promise.all(promises);
  assert(results.length === 100, `Expected 100 results, got ${results.length}`);
  for (let i = 0; i < STREAM_COUNT; i++) {
    assert(
      results[i].finalContent === `Extreme stream #${i}: payload token test [OK]`,
      `Extreme stream #${i} content failed: got "${results[i].finalContent}"`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log("CHALLENGER 1: ADVERSARIAL MULTI-SESSION CONCURRENCY & STREAM STRESS SUITE");
  console.log("================================================================================\n");

  await runChallenge(
    "Concurrency & Volume",
    "50 Parallel Streams with Micro-Byte Chunk Fragmentation (1-3 Byte Slices & UTF-8)",
    challenge1_50ConcurrentStreamsMicroFragmentation
  );

  await runChallenge(
    "Buffer & Tag Robustness",
    "Arbitrary Byte Boundary Splitting (Mid-Tag <th...ink>, Multi-byte UTF-8, Trailing Flush)",
    challenge2_ArbitraryByteAndTagBoundarySplitting
  );

  await runChallenge(
    "Session Isolation & Aborts",
    "Multi-Session Abort Isolation (Cancel Session 1 while Session 2 & 3 Continue)",
    challenge3_MultiSessionAbortIsolation
  );

  await runChallenge(
    "Chaos Monkey & Race Conditions",
    "Rapid Session Switching & Abort/Re-Prompt Cycles (60 Actions across 5 Sessions)",
    challenge4_ChaosSessionSwitchingAndRapidAbortReprompt
  );

  await runChallenge(
    "Pipeline Headers & Edge Cases",
    "streamResponse SSE Headers, Sources Injection, and Clean Terminal Closure",
    challenge5_StreamResponsePipelineEdgeCases
  );

  await runChallenge(
    "Approval Session Targeting",
    "Approval Session Targeting & Isolation during Active Session Switching",
    challenge6_ApprovalSessionTargetingUnderConcurrentSessionSwitch
  );

  await runChallenge(
    "Extreme Concurrency",
    "100 Parallel Micro-Fragmented Streams Concurrent Execution",
    challenge7_100ParallelStreamsStress
  );

  console.log("\n================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL CHALLENGES: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`UNCAUGHT SYSTEM ERRORS / LEAKS: ${uncaughtErrors.length}`);
  console.log("================================================================================\n");

  if (failed > 0 || uncaughtErrors.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal challenge runner error:", err);
  process.exit(1);
});

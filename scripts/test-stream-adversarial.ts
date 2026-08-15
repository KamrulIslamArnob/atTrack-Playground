import { streamResponse, type AgentExecutionResult } from "../lib/ai-chatbot/pipeline";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];
let unhandledRejections: unknown[] = [];

process.on("unhandledRejection", (reason) => {
  console.error("FATAL: Unhandled Rejection detected:", reason);
  unhandledRejections.push(reason);
});

process.on("uncaughtException", (err) => {
  console.error("FATAL: Uncaught Exception detected:", err);
  unhandledRejections.push(err);
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Tools Mode — Normal execution with tool_calls, sources, and result
// ─────────────────────────────────────────────────────────────────────────────
async function testToolsModeNormal() {
  const result: AgentExecutionResult = {
    mode: "tools",
    executedToolCalls: [
      {
        name: "searchJobs",
        args: { query: "frontend" },
        status: "done",
        result: { content: "Found 3 jobs", citations: ["job-1", "job-2"] },
      },
    ],
    sources: ["jobs", "contacts"],
    toolResultText: "Here are the jobs found for you.",
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");
  const raw = await readAll(response.body);

  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  if (frames.length !== 4) {
    throw new Error(`Expected 4 SSE frames, got ${frames.length}: ${JSON.stringify(frames)}`);
  }

  const toolCallsFrame = JSON.parse(frames[0]);
  if (!toolCallsFrame.tool_calls || toolCallsFrame.tool_calls.length !== 1) {
    throw new Error(`Invalid tool_calls frame: ${frames[0]}`);
  }

  const sourcesFrame = JSON.parse(frames[1]);
  if (!Array.isArray(sourcesFrame.sources) || sourcesFrame.sources.length !== 2) {
    throw new Error(`Invalid sources frame: ${frames[1]}`);
  }

  const choicesFrame = JSON.parse(frames[2]);
  if (choicesFrame.choices?.[0]?.delta?.content !== "Here are the jobs found for you.") {
    throw new Error(`Invalid choices frame: ${frames[2]}`);
  }

  if (frames[3] !== "[DONE]") {
    throw new Error(`Expected last frame to be [DONE], got ${frames[3]}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Tools Mode — Empty fields (empty tools, empty sources, empty text)
// ─────────────────────────────────────────────────────────────────────────────
async function testToolsModeEmpty() {
  const result: AgentExecutionResult = {
    mode: "tools",
    executedToolCalls: [],
    sources: [],
    toolResultText: "",
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");
  const raw = await readAll(response.body);

  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  if (frames.length !== 1 || frames[0] !== "[DONE]") {
    throw new Error(`Expected only [DONE] frame, got ${JSON.stringify(frames)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Stream Mode — Normal token streaming with sources
// ─────────────────────────────────────────────────────────────────────────────
async function testStreamModeNormal() {
  const chunks = ["Hello", " world", "! How can", " I help?"];
  const baseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: ["resumes", "jobs"],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");
  const raw = await readAll(response.body);

  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  // First frame should be sources
  const sourcesFrame = JSON.parse(frames[0]);
  if (!Array.isArray(sourcesFrame.sources) || sourcesFrame.sources.length !== 2) {
    throw new Error(`Invalid sources frame: ${frames[0]}`);
  }

  // Next 4 frames should be delta tokens
  for (let i = 0; i < chunks.length; i++) {
    const frame = JSON.parse(frames[i + 1]);
    if (frame.choices?.[0]?.delta?.content !== chunks[i]) {
      throw new Error(`Expected chunk ${chunks[i]}, got ${frames[i + 1]}`);
    }
  }

  // Last frame should be [DONE]
  if (frames[frames.length - 1] !== "[DONE]") {
    throw new Error(`Expected terminating [DONE], got ${frames[frames.length - 1]}`);
  }

  // BaseStream should no longer be locked
  if (baseStream.locked) {
    throw new Error("baseStream is still locked after stream completed!");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Stream Mode — Empty sources (no sources frame emitted)
// ─────────────────────────────────────────────────────────────────────────────
async function testStreamModeNoSources() {
  const baseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Direct" } }] })}\n\n`)
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: [],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");
  const raw = await readAll(response.body);

  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  if (frames.length !== 2) {
    throw new Error(`Expected exactly 2 frames (token + DONE), got ${frames.length}: ${JSON.stringify(frames)}`);
  }
  const chunk = JSON.parse(frames[0]);
  if (chunk.choices?.[0]?.delta?.content !== "Direct") {
    throw new Error(`Unexpected token: ${frames[0]}`);
  }
  if (frames[1] !== "[DONE]") {
    throw new Error(`Expected [DONE], got ${frames[1]}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Early Client Abort / Cancellation Before Any Read
// ─────────────────────────────────────────────────────────────────────────────
async function testEarlyAbortBeforeRead() {
  let baseStreamCancelled = false;
  let cancelReason: unknown = null;

  const baseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("data: initial\n\n"));
    },
    cancel(reason) {
      baseStreamCancelled = true;
      cancelReason = reason;
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: [],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");

  // Client cancels immediately
  await response.body.cancel("client abort before read");

  // Give microtasks time to run
  await new Promise((r) => setTimeout(r, 20));

  if (!baseStreamCancelled) {
    throw new Error("baseStream.cancel was not triggered when response.body was cancelled before read!");
  }
  if (cancelReason !== "client abort before read") {
    throw new Error(`Unexpected cancel reason: ${cancelReason}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Mid-Stream Client Abort (After 1 Chunk Read)
// ─────────────────────────────────────────────────────────────────────────────
async function testMidStreamAbort() {
  let baseStreamCancelled = false;
  let cancelReason: unknown = null;

  const baseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "chunk1" } }] })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "chunk2" } }] })}\n\n`)
      );
    },
    cancel(reason) {
      baseStreamCancelled = true;
      cancelReason = reason;
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: [],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");

  const reader = response.body.getReader();
  const first = await reader.read();
  if (first.done) throw new Error("Stream closed unexpectedly early");

  // Client aborts after reading first chunk
  await reader.cancel("client abort mid-stream");
  reader.releaseLock();

  await new Promise((r) => setTimeout(r, 20));

  if (!baseStreamCancelled) {
    throw new Error("baseStream.cancel was not triggered on mid-stream abort!");
  }
  if (cancelReason !== "client abort mid-stream") {
    throw new Error(`Unexpected cancel reason: ${cancelReason}`);
  }

  // BaseStream must not be left locked
  if (baseStream.locked) {
    throw new Error("baseStream is locked after mid-stream abort!");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: BaseStream Throws Error on Start / Read (Provider Failure)
// ─────────────────────────────────────────────────────────────────────────────
async function testBaseStreamThrowsError() {
  const baseStream = new ReadableStream<Uint8Array>({
    pull() {
      throw new Error("Gemini API rate limit exceeded: 429 ResourceExhausted");
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: ["jobs"],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");

  const raw = await readAll(response.body);
  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  // First frame is sources
  const sourcesFrame = JSON.parse(frames[0]);
  if (!Array.isArray(sourcesFrame.sources)) {
    throw new Error(`Expected sources frame, got ${frames[0]}`);
  }

  // Second frame should be error frame
  const errorFrame = JSON.parse(frames[1]);
  if (!errorFrame.error || !errorFrame.error.includes("429 ResourceExhausted")) {
    throw new Error(`Expected error frame containing 429, got ${frames[1]}`);
  }

  // baseStream must be unlocked
  if (baseStream.locked) {
    throw new Error("baseStream is locked after error!");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: BaseStream Throws Non-Error Object
// ─────────────────────────────────────────────────────────────────────────────
async function testBaseStreamThrowsNonError() {
  const baseStream = new ReadableStream<Uint8Array>({
    pull() {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "Raw string provider crash";
    },
  });

  const result: AgentExecutionResult = {
    mode: "stream",
    baseStream,
    sources: [],
  };

  const response = streamResponse(result);
  if (!response.body) throw new Error("Missing response body");

  const raw = await readAll(response.body);
  const lines = raw.split("\n\n").filter(Boolean);
  const frames = lines.map((l) => l.replace(/^data: /, "").trim());

  const errorFrame = JSON.parse(frames[0]);
  if (errorFrame.error !== "Raw string provider crash") {
    throw new Error(`Expected 'Raw string provider crash', got ${frames[0]}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Stress & Concurrency (50 concurrent streams with random behavior)
// ─────────────────────────────────────────────────────────────────────────────
async function testStressConcurrency() {
  const iterations = 50;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < iterations; i++) {
    const mode = i % 4;
    if (mode === 0) {
      // Normal stream
      promises.push(
        (async () => {
          const bs = new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"stress_${i}"}}]}\n\n`));
              c.enqueue(encoder.encode("data: [DONE]\n\n"));
              c.close();
            },
          });
          const res = streamResponse({ mode: "stream", baseStream: bs, sources: ["test"] });
          const text = await readAll(res.body!);
          if (!text.includes(`stress_${i}`)) throw new Error(`Stress ${i} failed`);
        })()
      );
    } else if (mode === 1) {
      // Aborted stream
      promises.push(
        (async () => {
          const bs = new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"abort_${i}"}}]}\n\n`));
            },
          });
          const res = streamResponse({ mode: "stream", baseStream: bs, sources: [] });
          const reader = res.body!.getReader();
          await reader.read();
          await reader.cancel("stress abort");
          reader.releaseLock();
        })()
      );
    } else if (mode === 2) {
      // Error stream
      promises.push(
        (async () => {
          const bs = new ReadableStream<Uint8Array>({
            pull() {
              throw new Error(`stress_err_${i}`);
            },
          });
          const res = streamResponse({ mode: "stream", baseStream: bs, sources: [] });
          const text = await readAll(res.body!);
          if (!text.includes(`stress_err_${i}`)) throw new Error(`Stress err ${i} missing`);
        })()
      );
    } else {
      // Tools mode
      promises.push(
        (async () => {
          const res = streamResponse({
            mode: "tools",
            executedToolCalls: [{ name: "tool", args: {}, status: "done" }],
            sources: ["crm"],
            toolResultText: `tool_res_${i}`,
          });
          const text = await readAll(res.body!);
          if (!text.includes(`tool_res_${i}`)) throw new Error(`Stress tool ${i} failed`);
        })()
      );
    }
  }

  await Promise.all(promises);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Runner
// ─────────────────────────────────────────────────────────────────────────────
async function runAllTests() {
  const tests = [
    { name: "testToolsModeNormal", fn: testToolsModeNormal },
    { name: "testToolsModeEmpty", fn: testToolsModeEmpty },
    { name: "testStreamModeNormal", fn: testStreamModeNormal },
    { name: "testStreamModeNoSources", fn: testStreamModeNoSources },
    { name: "testEarlyAbortBeforeRead", fn: testEarlyAbortBeforeRead },
    { name: "testMidStreamAbort", fn: testMidStreamAbort },
    { name: "testBaseStreamThrowsError", fn: testBaseStreamThrowsError },
    { name: "testBaseStreamThrowsNonError", fn: testBaseStreamThrowsNonError },
    { name: "testStressConcurrency", fn: testStressConcurrency },
  ];

  console.log("Starting Adversarial Streaming Test Suite...\n");

  for (const t of tests) {
    try {
      await t.fn();
      results.push({ name: t.name, passed: true });
      console.log(`  PASS: ${t.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: t.name, passed: false, error: msg });
      console.error(`  FAIL: ${t.name} -> ${msg}`);
    }
  }

  // Check unhandled rejections
  await new Promise((r) => setTimeout(r, 100));

  console.log("\n==========================================");
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Unhandled Rejections: ${unhandledRejections.length}`);
  console.log("==========================================\n");

  if (results.some((r) => !r.passed) || unhandledRejections.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();

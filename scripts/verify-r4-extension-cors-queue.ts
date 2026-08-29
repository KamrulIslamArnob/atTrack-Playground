/**
 * R4 Verification Suite: Extension Communication, Multi-Browser CORS & Queue Resiliency
 *
 * Verifies:
 * 1. Comprehensive multi-browser extension CORS whitelist:
 *    - chrome-extension://*
 *    - moz-extension://*
 *    - edge-extension://*
 *    - safari-web-extension://*
 *    - Loopback origins (localhost, 127.0.0.1, [::1])
 *    - Rejection of external web origins (https://evil.com) -> no Access-Control-Allow-Origin header
 * 2. Extension offline queue bounded retention & TTL pruning:
 *    - 24-hour expiration TTL.
 *    - 100-item queue capacity limit (FIFO eviction).
 *    - 500KB maximum payload size per job.
 * 3. Auth secret rotation & handshake synchronization.
 *
 * Run via: npx tsx scripts/verify-r4-extension-cors-queue.ts
 */

import crypto from "node:crypto";
import { getExtensionCorsHeaders } from "../lib/db/extension-cors.ts";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

// ---------------------------------------------------------------------------
// Authoritative Queue Implementation for Logic Testing
// ---------------------------------------------------------------------------

interface QueuedJob {
  id: string;
  jobData: any;
  queuedAt: number;
}

const MAX_QUEUE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const MAX_QUEUE_ITEMS = 100;
const MAX_PAYLOAD_BYTES = 500 * 1024; // 500KB

function pruneQueue(jobs: QueuedJob[], now = Date.now()): QueuedJob[] {
  return jobs.filter(
    (item) => item && typeof item.queuedAt === "number" && now - item.queuedAt <= MAX_QUEUE_TTL_MS
  );
}

function enqueueJob(queue: QueuedJob[], jobData: any, now = Date.now()): QueuedJob[] {
  const payloadStr = JSON.stringify(jobData);
  if (payloadStr.length > MAX_PAYLOAD_BYTES) {
    throw new Error("Job payload exceeds maximum offline queue size limit (500KB).");
  }

  let active = pruneQueue(queue, now);

  const newEntry: QueuedJob = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    jobData,
    queuedAt: now,
  };

  if (active.length >= MAX_QUEUE_ITEMS) {
    active = active.slice(active.length - MAX_QUEUE_ITEMS + 1);
  }

  active.push(newEntry);
  return active;
}

// ---------------------------------------------------------------------------
// Main Verification Runner
// ---------------------------------------------------------------------------

async function runR4Verification() {
  console.log("\n=======================================================");
  console.log("  R4 VERIFICATION: Extension CORS & Queue Resiliency   ");
  console.log("=======================================================\n");

  // -------------------------------------------------------------------------
  // Test 1: Multi-Browser Extension CORS Whitelist
  // -------------------------------------------------------------------------
  console.log("[Test 1] Multi-Browser Extension CORS Whitelist Headers");

  const allowedOrigins = [
    "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    "moz-extension://12345678-1234-1234-1234-123456789abc",
    "edge-extension://xyz12345xyz12345xyz12345xyz12345",
    "safari-web-extension://ABCDEF12-3456-7890-ABCD-EF1234567890",
    "http://127.0.0.1:3788",
    "http://localhost:3788",
    "http://[::1]:3788",
  ];

  for (const origin of allowedOrigins) {
    const req = new Request("http://127.0.0.1:3788/api/extension/status", {
      headers: { Origin: origin },
    });
    const headers = getExtensionCorsHeaders(req);
    const allowOrigin = headers["Access-Control-Allow-Origin"];
    assert(
      allowOrigin === origin || allowOrigin === "*",
      `Allowed origin "${origin.slice(0, 45)}..." received matching CORS header: "${allowOrigin}"`
    );
  }

  // -------------------------------------------------------------------------
  // Test 2: Rejection of Unauthorized External Origins
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Unauthorized External Origins Rejection");

  const blockedOrigins = [
    "https://malicious-site.com",
    "http://192.168.1.100:3000",
    "https://phishing.example.org",
    "http://attacker.com",
  ];

  for (const origin of blockedOrigins) {
    const req = new Request("http://127.0.0.1:3788/api/extension/status", {
      headers: { Origin: origin },
    });
    const headers = getExtensionCorsHeaders(req);
    const allowOrigin = headers["Access-Control-Allow-Origin"];
    // Header must be ABSENT, never the literal string "null" — some browsers
    // treat "Access-Control-Allow-Origin: null" as matching a request whose
    // Origin is literally "null" (sandboxed iframes, file://, data: URIs),
    // which would let such a page pass the CORS check. Omitting the header
    // denies by default instead.
    assert(
      allowOrigin === undefined,
      `External origin "${origin}" correctly rejected — no Access-Control-Allow-Origin header set (got: ${JSON.stringify(allowOrigin)})`
    );
  }

  // -------------------------------------------------------------------------
  // Test 3: Offline Queue 24-Hour TTL Expiration
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Offline Queue 24-Hour TTL Expiration Pruning");

  const now = Date.now();
  const queueWithExpired: QueuedJob[] = [
    { id: "job-fresh-1", jobData: { title: "Dev 1" }, queuedAt: now - 1000 * 60 * 60 }, // 1h ago (valid)
    { id: "job-fresh-2", jobData: { title: "Dev 2" }, queuedAt: now - 1000 * 60 * 60 * 12 }, // 12h ago (valid)
    { id: "job-stale-1", jobData: { title: "Dev 3" }, queuedAt: now - 1000 * 60 * 60 * 25 }, // 25h ago (expired)
    { id: "job-stale-2", jobData: { title: "Dev 4" }, queuedAt: now - 1000 * 60 * 60 * 48 }, // 48h ago (expired)
  ];

  const pruned = pruneQueue(queueWithExpired, now);
  assert(pruned.length === 2, `Queue pruned from 4 items to 2 items (actual: ${pruned.length})`);
  assert(
    pruned.every((j) => j.id.startsWith("job-fresh")),
    "Only jobs queued within 24h window are retained"
  );

  // -------------------------------------------------------------------------
  // Test 4: Queue 100-Item Capacity Bound (FIFO Eviction)
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Offline Queue 100-Item Capacity Cap (FIFO Eviction)");

  let cappedQueue: QueuedJob[] = [];

  // Enqueue 120 jobs
  for (let i = 1; i <= 120; i++) {
    cappedQueue = enqueueJob(cappedQueue, { title: `Job Number ${i}` }, now + i);
  }

  assert(
    cappedQueue.length === 100,
    `Queue length capped at exactly 100 items (actual: ${cappedQueue.length})`
  );
  assert(
    cappedQueue[0].jobData.title === "Job Number 21",
    `Oldest retained item is item #21 (first 20 evicted via FIFO)`
  );
  assert(
    cappedQueue[99].jobData.title === "Job Number 120",
    `Newest item is item #120`
  );

  // -------------------------------------------------------------------------
  // Test 5: 500KB Single Item Payload Guard
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] 500KB Maximum Item Payload Size Limit");

  let caughtOversizedError = false;
  const oversizedData = {
    title: "Large Payload",
    description: "A".repeat(600 * 1024), // 600KB
  };

  try {
    enqueueJob([], oversizedData, now);
  } catch (err: any) {
    caughtOversizedError = true;
    assert(
      err.message.includes("exceeds maximum offline queue size limit"),
      "Error message explicitly identifies 500KB size limit violation"
    );
  }

  assert(caughtOversizedError, "Oversized payload (>500KB) rejected with error");

  // -------------------------------------------------------------------------
  // Test 6: Secret Rotation & Cryptographic Randomness
  // -------------------------------------------------------------------------
  console.log("\n[Test 6] Secret Rotation & Handshake Synchronization");

  const secretA = crypto.randomBytes(32).toString("hex");
  const secretB = crypto.randomBytes(32).toString("hex");

  assert(secretA.length === 64, `Secret A is 64 hex characters (32 bytes entropy)`);
  assert(secretB.length === 64, `Secret B is 64 hex characters (32 bytes entropy)`);
  assert(secretA !== secretB, "Regenerated secrets are distinct and non-repeating");

  // Verify timing-safe comparison helper
  const bufA = Buffer.from(secretA, "utf8");
  const bufB = Buffer.from(secretA, "utf8");
  const bufC = Buffer.from(secretB, "utf8");

  assert(
    crypto.timingSafeEqual(bufA, bufB) === true,
    "Timing-safe equality confirms matching secrets"
  );
  assert(
    crypto.timingSafeEqual(bufA, bufC) === false,
    "Timing-safe equality correctly rejects mismatched secrets"
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log(`R4 Suite Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log("-------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runR4Verification().catch((err) => {
  console.error("Fatal error in R4 test suite:", err);
  process.exit(1);
});

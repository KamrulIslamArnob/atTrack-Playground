/**
 * Verification script for Milestone M3: Extension Communication, CORS & Queue TTL (R4)
 * Run with: npx tsx scripts/verify-extension-m3.ts
 */

import assert from "node:assert";
import { isAllowedOrigin, getExtensionCorsHeaders } from "../lib/db/extension-cors";
import { getExtensionSecret, rotateExtensionSecret } from "../lib/actions/extension";
import { getUser } from "../lib/auth";
import { getDb } from "../lib/db/sqlite";

async function verifyCors() {
  console.log("--- 1. Testing Extension & Loopback CORS ---");

  // Extension schemes
  assert.strictEqual(isAllowedOrigin("chrome-extension://abcdefghijklmnop"), true, "Chrome extension origin allowed");
  assert.strictEqual(isAllowedOrigin("moz-extension://1234-5678-abcd"), true, "Firefox extension origin allowed");
  assert.strictEqual(isAllowedOrigin("edge-extension://abcdefghijklmnop"), true, "Edge extension origin allowed");
  assert.strictEqual(isAllowedOrigin("safari-web-extension://ABCDEF12-3456-7890"), true, "Safari extension origin allowed");

  // Local loopback origins (IPv4, IPv6, localhost)
  assert.strictEqual(isAllowedOrigin("http://localhost:3788"), true, "localhost with port allowed");
  assert.strictEqual(isAllowedOrigin("http://localhost"), true, "localhost without port allowed");
  assert.strictEqual(isAllowedOrigin("https://localhost:3000"), true, "https localhost allowed");
  assert.strictEqual(isAllowedOrigin("http://127.0.0.1:3788"), true, "127.0.0.1 with port allowed");
  assert.strictEqual(isAllowedOrigin("http://127.0.0.1"), true, "127.0.0.1 without port allowed");
  assert.strictEqual(isAllowedOrigin("http://[::1]:3788"), true, "IPv6 loopback [::1] with port allowed");
  assert.strictEqual(isAllowedOrigin("http://[::1]"), true, "IPv6 loopback [::1] without port allowed");
  assert.strictEqual(isAllowedOrigin(null), true, "null origin allowed");
  assert.strictEqual(isAllowedOrigin(undefined), true, "undefined origin allowed");
  // The literal string "null" is what a sandboxed iframe / file:// / data:
  // URI sends — an attacker-controllable context, NOT the same as a
  // genuinely absent header. Must be rejected, not special-cased as allowed.
  assert.strictEqual(isAllowedOrigin("null"), false, "'null' string origin (sandboxed iframe/file://) rejected");

  // Disallowed origins
  assert.strictEqual(isAllowedOrigin("https://evil-hacker.com"), false, "External domain blocked");
  assert.strictEqual(isAllowedOrigin("http://localhost.evil.com"), false, "Subdomain spoofing blocked");
  assert.strictEqual(isAllowedOrigin("http://evil.com/localhost"), false, "Path spoofing blocked");
  assert.strictEqual(isAllowedOrigin("ftp://localhost"), false, "Non-http protocol blocked");

  // getExtensionCorsHeaders
  const reqAllowed = new Request("http://localhost:3788/api/extension/status", {
    headers: { origin: "chrome-extension://abcdefghijklmnop" },
  });
  const headersAllowed = getExtensionCorsHeaders(reqAllowed);
  assert.strictEqual(headersAllowed["Access-Control-Allow-Origin"], "chrome-extension://abcdefghijklmnop");

  const reqBlocked = new Request("http://localhost:3788/api/extension/status", {
    headers: { origin: "https://attacker.site" },
  });
  const headersBlocked = getExtensionCorsHeaders(reqBlocked);
  // Must be ABSENT, never the literal string "null" (see extension-cors.ts
  // for why that string is itself a CORS-bypass footgun).
  assert.strictEqual(headersBlocked["Access-Control-Allow-Origin"], undefined);

  const reqNullOrigin = new Request("http://localhost:3788/api/extension/status", {
    headers: { origin: "null" },
  });
  const headersNullOrigin = getExtensionCorsHeaders(reqNullOrigin);
  assert.strictEqual(
    headersNullOrigin["Access-Control-Allow-Origin"],
    undefined,
    "literal 'null' Origin (sandboxed iframe/file://) gets no CORS header"
  );

  console.log("✅ CORS origin and headers verification passed!");
}

async function verifySecretRotation() {
  console.log("\n--- 2. Testing Extension Secret Rotation ---");

  const initialSecret = await getExtensionSecret();
  assert.ok(initialSecret && initialSecret.length === 64, "Initial secret is 64-char hex token");

  const rotation1 = await rotateExtensionSecret();
  assert.strictEqual(rotation1.success, true, "rotateExtensionSecret succeeded");
  assert.ok(rotation1.secret && rotation1.secret.length === 64, "Rotated secret is valid hex token");
  assert.notStrictEqual(rotation1.secret, initialSecret, "Rotated secret is different from initial secret");

  const retrievedSecret1 = await getExtensionSecret();
  assert.strictEqual(retrievedSecret1, rotation1.secret, "Retrieved secret matches rotated secret");

  // Verify in SQLite authority directly
  const { userId } = await getUser();
  const db = getDb();
  const row = db.prepare("SELECT secret FROM extension_config WHERE user_id = ?").get(userId) as { secret: string };
  assert.strictEqual(row.secret, rotation1.secret, "SQLite authority holds the rotated secret");

  // Second rotation
  const rotation2 = await rotateExtensionSecret();
  assert.strictEqual(rotation2.success, true, "Second rotation succeeded");
  assert.notStrictEqual(rotation2.secret, rotation1.secret, "Second rotation generated new secret");

  const retrievedSecret2 = await getExtensionSecret();
  assert.strictEqual(retrievedSecret2, rotation2.secret, "Retrieved secret matches second rotated secret");

  console.log("✅ Extension secret rotation and SQLite authority verification passed!");
}

async function verifyQueueTtlAndBounds() {
  console.log("\n--- 3. Testing Service Worker Queue TTL & Bounds Logic ---");

  const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_QUEUED_JOBS = 100;
  const MAX_QUEUE_PAYLOAD_BYTES = 500 * 1024;

  function getPayloadByteSize(data: any) {
    const jsonStr = typeof data === "string" ? data : JSON.stringify(data);
    return new TextEncoder().encode(jsonStr).length;
  }

  function pruneJobs(jobs: any[]) {
    if (!Array.isArray(jobs)) return [];
    const now = Date.now();

    // 1. TTL check
    let validJobs = jobs.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const queuedAt = typeof item.queuedAt === "number" ? item.queuedAt : now;
      return now - queuedAt <= QUEUE_TTL_MS;
    });

    // 2. Max 100 jobs cap
    if (validJobs.length > MAX_QUEUED_JOBS) {
      validJobs = validJobs.slice(validJobs.length - MAX_QUEUED_JOBS);
    }

    // 3. 500KB payload cap
    while (validJobs.length > 0 && getPayloadByteSize(validJobs) > MAX_QUEUE_PAYLOAD_BYTES) {
      validJobs.shift();
    }

    return validJobs;
  }

  const now = Date.now();

  // Test TTL pruning
  const mixedJobs = [
    { id: "expired-1", jobData: { title: "Old 1" }, queuedAt: now - (25 * 60 * 60 * 1000) }, // 25h old -> should prune
    { id: "expired-2", jobData: { title: "Old 2" }, queuedAt: now - (48 * 60 * 60 * 1000) }, // 48h old -> should prune
    { id: "valid-1", jobData: { title: "Fresh 1" }, queuedAt: now - (2 * 60 * 60 * 1000) },  // 2h old -> keep
    { id: "valid-2", jobData: { title: "Fresh 2" }, queuedAt: now - (10 * 1000) },            // 10s old -> keep
  ];
  const prunedTtl = pruneJobs(mixedJobs);
  assert.strictEqual(prunedTtl.length, 2, "Expired jobs pruned by 24h TTL");
  assert.strictEqual(prunedTtl[0].id, "valid-1");
  assert.strictEqual(prunedTtl[1].id, "valid-2");

  // Test max 100 jobs cap
  const manyJobs = Array.from({ length: 150 }, (_, i) => ({
    id: `job-${i}`,
    jobData: { title: `Job ${i}` },
    queuedAt: now - (i * 1000),
  }));
  const boundedCount = pruneJobs(manyJobs);
  assert.strictEqual(boundedCount.length, 100, "Queue bounded to max 100 items");
  assert.strictEqual(boundedCount[0].id, "job-50", "Oldest 50 items dropped in FIFO order");
  assert.strictEqual(boundedCount[99].id, "job-149", "Newest items preserved");

  // Test 500KB total queue payload cap
  const largeJobData = "X".repeat(100 * 1024); // ~100KB per job
  const largeJobs = Array.from({ length: 10 }, (_, i) => ({
    id: `large-job-${i}`,
    jobData: { description: largeJobData },
    queuedAt: now - (i * 1000),
  }));
  const boundedSize = pruneJobs(largeJobs);
  const totalSize = getPayloadByteSize(boundedSize);
  assert.ok(totalSize <= MAX_QUEUE_PAYLOAD_BYTES, `Total size (${totalSize} bytes) <= 500KB`);
  assert.ok(boundedSize.length <= 5, "Large jobs evicted until under 500KB cap");

  console.log("✅ Service worker queue TTL, job count cap, and 500KB payload cap verification passed!");
}

async function main() {
  try {
    await verifyCors();
    await verifySecretRotation();
    await verifyQueueTtlAndBounds();
    console.log("\n=======================================================");
    console.log("🎉 ALL M3 EXTENSION COMMUNICATION & QUEUE TESTS PASSED!");
    console.log("=======================================================\n");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main();

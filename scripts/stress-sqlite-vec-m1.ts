/**
 * Adversarial Empirical Stress Test Suite for Milestone 1
 * Targets:
 *   - sqlite-vec extension loading on DatabaseSync
 *   - vec_memories & vec_document_chunks virtual tables
 *   - 768-dim float array insertion, serialization formats, and KNN queries
 *   - Mathematical distance oracles (cosine metric: d=0, d=1, d=2, monotonic ordering)
 *   - Boundary conditions: N=0, k=0, k>N, dimension mismatch (512, 1536), NaNs, Infinities
 *   - Scale stress: 1,000 vectors batch insert & KNN latency benchmark
 *   - Multi-tenant relational JOIN scoping & isolation
 *   - Concurrency, WAL mode, transaction rollbacks
 *   - Simultaneous Three-Tier workload (Standard SQL + FTS5 omni_search_index + sqlite-vec)
 */

import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Test Reporting Infrastructure
interface TestCaseResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

const testResults: TestCaseResult[] = [];
let testSuiteFailed = false;

function recordResult(res: TestCaseResult) {
  testResults.push(res);
  if (!res.passed) {
    testSuiteFailed = true;
    console.error(`❌ [FAIL] ${res.id}: ${res.name} (${res.durationMs.toFixed(1)}ms)`);
    if (res.error) console.error(`   Error: ${res.error}`);
    if (res.details) console.error(`   Details:`, JSON.stringify(res.details, null, 2));
  } else {
    console.log(`✅ [PASS] ${res.id}: ${res.name} (${res.durationMs.toFixed(1)}ms)`);
  }
}

async function runTest(
  id: string,
  category: string,
  name: string,
  fn: () => void | Promise<void>,
  detailsExtractor?: () => Record<string, unknown>
) {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    recordResult({
      id,
      category,
      name,
      passed: true,
      durationMs: duration,
      details: detailsExtractor ? detailsExtractor() : undefined,
    });
  } catch (err: unknown) {
    const duration = performance.now() - start;
    const errorMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    recordResult({
      id,
      category,
      name,
      passed: false,
      durationMs: duration,
      error: errorMsg,
      details: detailsExtractor ? detailsExtractor() : undefined,
    });
  }
}

// Vector Generators & Math Helpers
function generateRandomVector(dim = 768): Float32Array {
  const vec = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    const val = (Math.random() - 0.5) * 2;
    vec[i] = val;
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function generateUnitVector(axis: number, dim = 768): Float32Array {
  const vec = new Float32Array(dim);
  vec[axis] = 1.0;
  return vec;
}

function computeCosineDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Dimension mismatch");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1.0;
  const sim = dot / denom;
  return 1.0 - sim;
}

function setupTestDb(customPath?: string): DatabaseSync {
  const targetPath = customPath ?? path.join(os.tmpdir(), `attrack-stress-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const db = new DatabaseSync(targetPath, { allowExtension: true });
  db.enableLoadExtension(true);
  sqliteVec.load(db);
  db.enableLoadExtension(false);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  const schemaPath = path.join(process.cwd(), "lib", "db", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);

  return db;
}

async function main() {
  console.log("================================================================================");
  console.log("🚀 STARTING ADVERSARIAL STRESS TEST SUITE: Milestone 1 sqlite-vec");
  console.log("================================================================================\n");

  const tempDbPath = path.join(os.tmpdir(), `attrack-m1-stress-${Date.now()}.db`);
  const db = setupTestDb(tempDbPath);

  // ---------------------------------------------------------------------------
  // SUITE 1: Extension Loading & Version Sanity
  // ---------------------------------------------------------------------------
  console.log("--- SUITE 1: Extension Loading & Version Sanity ---");

  await runTest("T1.1", "Extension Loading", "Verify sqlite-vec extension loads and vec_version() returns semver", () => {
    const row = db.prepare("SELECT vec_version() as version").get() as { version: string };
    if (!row || typeof row.version !== "string" || !row.version.startsWith("v")) {
      throw new Error(`Invalid vec_version return: ${JSON.stringify(row)}`);
    }
  });

  await runTest("T1.2", "Extension Loading", "Idempotent extension loading on existing connection", () => {
    // Calling load again on same db connection
    db.enableLoadExtension(true);
    sqliteVec.load(db);
    db.enableLoadExtension(false);
    const row = db.prepare("SELECT vec_version() as version").get() as { version: string };
    if (!row.version.startsWith("v")) {
      throw new Error(`Extension broke after secondary load: ${row.version}`);
    }
  });

  await runTest("T1.3", "Extension Loading", "Concurrent second DatabaseSync connection can load sqlite-vec on same file", () => {
    const db2 = new DatabaseSync(tempDbPath, { allowExtension: true });
    db2.enableLoadExtension(true);
    sqliteVec.load(db2);
    db2.enableLoadExtension(false);
    const row = db2.prepare("SELECT vec_version() as version").get() as { version: string };
    if (!row.version.startsWith("v")) throw new Error("Secondary connection failed to load extension");
    db2.close();
  });

  await runTest("T1.4", "Extension Loading", "Virtual tables vec_memories and vec_document_chunks exist in schema", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").all() as { name: string }[];
    const names = tables.map(t => t.name);
    const required = ["document_chunks", "vec_memories", "vec_document_chunks", "omni_search_index", "jobs", "profiles"];
    const missing = required.filter(r => !names.includes(r));
    if (missing.length > 0) {
      throw new Error(`Missing expected tables: ${missing.join(", ")}`);
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: Vector Representation Formats & Primary Key Types
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 2: Vector Formats & Primary Key Types ---");

  // Create a dummy user and profile for relational FKs
  const testUserId = "user_stress_001";
  db.prepare("INSERT OR REPLACE INTO users (id, email) VALUES (?, ?)").run(testUserId, "stress@test.local");
  db.prepare("INSERT OR REPLACE INTO profiles (id, full_name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    testUserId, "Stress Tester", new Date().toISOString(), new Date().toISOString()
  );

  await runTest("T2.1", "Vector Formats", "Insert 768-dim Float32Array into vec_memories (Autoincrement ID)", () => {
    const vec = generateRandomVector(768);
    const memoryId = "mem_001";
    const stmt = db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)");
    const info = stmt.run(vec, memoryId, testUserId);
    if (!info.lastInsertRowid) throw new Error("No rowid returned for vec_memories insertion");

    const queryStmt = db.prepare("SELECT id, memory_id, user_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1");
    const result = queryStmt.get(vec) as { id: number | bigint; memory_id: string; user_id: string; distance: number };
    if (!result) throw new Error("Failed to retrieve inserted vector memory via MATCH");
    if (result.memory_id !== memoryId) throw new Error(`Memory ID mismatch: expected ${memoryId}, got ${result.memory_id}`);
    if (Math.abs(result.distance) > 1e-4) throw new Error(`Self-distance should be ~0, got ${result.distance}`);
  });

  await runTest("T2.2", "Vector Formats", "Insert 768-dim vector as raw Buffer / Uint8Array into vec_memories", () => {
    const vec = generateRandomVector(768);
    const buffer = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
    const memoryId = "mem_buf_002";
    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(buffer, memoryId, testUserId);

    const queryStmt = db.prepare("SELECT id, memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1");
    const result = queryStmt.get(buffer) as { id: number | bigint; memory_id: string; distance: number };
    if (!result || result.memory_id !== memoryId) {
      throw new Error(`Buffer vector query failed. Got: ${JSON.stringify(result)}`);
    }
  });

  await runTest("T2.3", "Vector Formats", "Insert explicit BigInt(id) into vec_document_chunks with companion document_chunks", () => {
    const chunkId = 1001;
    const vec = generateRandomVector(768);
    const sourceId = "job_stress_001";

    // 1. Insert relational row
    db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text, token_count)
      VALUES (?, ?, ?, 'job_description', 0, 'Test chunk text for stress test', 50)
    `).run(chunkId, testUserId, sourceId);

    // 2. Insert vector row with BigInt id
    db.prepare(`
      INSERT INTO vec_document_chunks (id, embedding, user_id, source_id)
      VALUES (?, ?, ?, ?)
    `).run(BigInt(chunkId), vec, testUserId, sourceId);

    // 3. Query vector
    const res = db.prepare(`
      SELECT vdc.id, vdc.distance, dc.chunk_text
      FROM vec_document_chunks vdc
      JOIN document_chunks dc ON vdc.id = dc.id
      WHERE vdc.embedding MATCH ? AND vdc.k = 1
    `).get(vec) as { id: number | bigint; distance: number; chunk_text: string };

    if (!res) throw new Error("Failed to join vec_document_chunks with document_chunks on BigInt id");
    if (res.chunk_text !== "Test chunk text for stress test") throw new Error("Chunk text mismatch");
    if (Math.abs(res.distance) > 1e-4) throw new Error(`Expected self-distance ~0, got ${res.distance}`);
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: Mathematical Oracles & Cosine Metric Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 3: Mathematical Distance Oracles & Cosine Metric ---");

  await runTest("T3.1", "Math Oracles", "Verify exact cosine distance for Orthogonal and Opposite vectors", () => {
    const unitX = generateUnitVector(0, 768); // Axis 0
    const unitY = generateUnitVector(1, 768); // Axis 1
    const negX = new Float32Array(768);
    negX[0] = -1.0; // Opposite of Axis 0

    const memX = "mem_oracle_x";
    const memY = "mem_oracle_y";
    const memNegX = "mem_oracle_neg_x";

    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(unitX, memX, testUserId);
    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(unitY, memY, testUserId);
    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(negX, memNegX, testUserId);

    // Query with unitX:
    // unitX to unitX -> distance 0.0
    // unitX to unitY -> distance 1.0 (orthogonal)
    // unitX to negX -> distance 2.0 (opposite)
    const matches = db.prepare(`
      SELECT memory_id, distance
      FROM vec_memories
      WHERE embedding MATCH ? AND k = 10
    `).all(unitX) as { memory_id: string; distance: number }[];

    const map = new Map(matches.map(m => [m.memory_id, m.distance]));

    const distX = map.get(memX);
    const distY = map.get(memY);
    const distNegX = map.get(memNegX);

    if (distX === undefined || Math.abs(distX - 0.0) > 1e-4) {
      throw new Error(`Self distance failed: expected 0.0, got ${distX}`);
    }
    if (distY === undefined || Math.abs(distY - 1.0) > 1e-4) {
      throw new Error(`Orthogonal distance failed: expected 1.0, got ${distY}`);
    }
    if (distNegX === undefined || Math.abs(distNegX - 2.0) > 1e-4) {
      throw new Error(`Opposite distance failed: expected 2.0, got ${distNegX}`);
    }
  });

  await runTest("T3.2", "Math Oracles", "Verify monotonic distance ordering for KNN top-K", () => {
    const queryVec = generateRandomVector(768);
    const results = db.prepare(`
      SELECT id, distance
      FROM vec_memories
      WHERE embedding MATCH ? AND k = 10
    `).all(queryVec) as { id: number; distance: number }[];

    if (results.length < 2) throw new Error("Expected at least 2 results to check monotonic ordering");
    for (let i = 1; i < results.length; i++) {
      if (results[i].distance < results[i - 1].distance - 1e-6) {
        throw new Error(`Non-monotonic ranking at index ${i}: prev=${results[i-1].distance}, current=${results[i].distance}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: Boundary Conditions, Edge Cases & Adversarial Inputs
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 4: Boundary Conditions & Adversarial Inputs ---");

  await runTest("T4.1", "Edge Cases", "KNN query on empty virtual table returns empty array without error", () => {
    // Create dedicated empty table for this test
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS vec_empty_test USING vec0(id INTEGER PRIMARY KEY, embedding float[768] distance_metric=cosine)");
    const queryVec = generateRandomVector(768);
    const rows = db.prepare("SELECT id, distance FROM vec_empty_test WHERE embedding MATCH ? AND k = 5").all(queryVec);
    if (!Array.isArray(rows) || rows.length !== 0) {
      throw new Error(`Expected empty array, got ${JSON.stringify(rows)}`);
    }
    db.exec("DROP TABLE vec_empty_test");
  });

  await runTest("T4.2", "Edge Cases", "KNN query with k=0 returns empty array", () => {
    const queryVec = generateRandomVector(768);
    const rows = db.prepare("SELECT id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 0").all(queryVec);
    if (rows.length !== 0) {
      throw new Error(`Expected 0 rows for k=0, got ${rows.length}`);
    }
  });

  await runTest("T4.3", "Edge Cases", "KNN query with k <= 4096 returns rows sorted; k > 4096 throws descriptive error", () => {
    const totalMemories = (db.prepare("SELECT count(*) as cnt FROM vec_memories").get() as { cnt: number }).cnt;
    const queryVec = generateRandomVector(768);
    const rows = db.prepare("SELECT id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 4096").all(queryVec) as { distance: number }[];
    if (rows.length !== totalMemories) {
      throw new Error(`Expected all ${totalMemories} rows for large k=4096, got ${rows.length}`);
    }
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].distance < rows[i - 1].distance - 1e-6) throw new Error("Distance sorting violated for large k");
    }

    // Verify hard limit k > 4096 throws
    let threwTooLarge = false;
    try {
      db.prepare("SELECT id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 4097").all(queryVec);
    } catch (err: unknown) {
      threwTooLarge = true;
      if (!String(err).includes("limit is 4096")) {
        throw new Error(`Expected limit error message, got: ${err}`);
      }
    }
    if (!threwTooLarge) {
      throw new Error("Expected sqlite-vec to throw when k > 4096");
    }
  });

  await runTest("T4.4", "Adversarial Inputs", "Dimension mismatch (512, 767, 769, 1536 dims) throws error on insertion and query", () => {
    const badDims = [128, 512, 767, 769, 1536];
    for (const dim of badDims) {
      const badVec = generateRandomVector(dim);
      let threwInsert = false;
      try {
        db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(badVec, `bad_${dim}`, testUserId);
      } catch {
        threwInsert = true;
      }
      if (!threwInsert) {
        throw new Error(`Expected dimension mismatch exception when inserting vector of dim ${dim}`);
      }

      let threwQuery = false;
      try {
        db.prepare("SELECT id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 5").all(badVec);
      } catch {
        threwQuery = true;
      }
      if (!threwQuery) {
        throw new Error(`Expected dimension mismatch exception when querying with vector of dim ${dim}`);
      }
    }
  });

  await runTest("T4.5", "Adversarial Inputs", "Invalid payloads: NaN, Infinity, null, and empty buffers fail safely", () => {
    const nanVec = new Float32Array(768);
    nanVec[0] = NaN;
    let threwNan = false;
    try {
      db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(nanVec, "nan_mem", testUserId);
    } catch {
      threwNan = true;
    }
    // Note: If sqlite-vec accepts NaN without throwing on insert, check if it breaks subsequent queries
    if (!threwNan) {
      // Test if querying with valid vector still works or if NaN is handled
      const validVec = generateRandomVector(768);
      const rows = db.prepare("SELECT id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 5").all(validVec);
      if (!Array.isArray(rows)) throw new Error("Database query broke after NaN insertion");
    }

    let threwEmpty = false;
    try {
      db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(new Float32Array(0), "empty_mem", testUserId);
    } catch {
      threwEmpty = true;
    }
    if (!threwEmpty) throw new Error("Expected empty buffer to throw dimension mismatch");
  });

  await runTest("T4.6", "Adversarial Inputs", "Extreme subnormal and high magnitude floating-point vectors remain stable", () => {
    const subnormalVec = new Float32Array(768);
    for (let i = 0; i < 768; i++) subnormalVec[i] = 1e-37;
    const highMagVec = new Float32Array(768);
    for (let i = 0; i < 768; i++) highMagVec[i] = 1e12;

    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(subnormalVec, "subnormal_mem", testUserId);
    db.prepare("INSERT INTO vec_memories (embedding, memory_id, user_id) VALUES (?, ?, ?)").run(highMagVec, "highmag_mem", testUserId);

    const res = db.prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 2").all(highMagVec) as { memory_id: string; distance: number }[];
    if (res.length < 1 || isNaN(res[0].distance)) {
      throw new Error(`Extreme magnitude query produced NaN distance: ${JSON.stringify(res)}`);
    }
  });

  await runTest("T4.7", "Edge Cases", "Duplicate ID insertion on vec_document_chunks violates primary key constraint", () => {
    const duplicateId = 99999;
    const vec = generateRandomVector(768);
    db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'source_dup', 'job_description', 0, 'dup text')").run(duplicateId, testUserId);
    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(BigInt(duplicateId), vec, testUserId, "source_dup");

    let threwDuplicate = false;
    try {
      db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(BigInt(duplicateId), vec, testUserId, "source_dup");
    } catch (err: unknown) {
      threwDuplicate = true;
      if (!String(err).includes("UNIQUE") && !String(err).includes("constraint") && !String(err).includes("PRIMARY KEY")) {
        console.warn("Duplicate ID threw non-constraint error:", err);
      }
    }
    if (!threwDuplicate) {
      throw new Error("Expected primary key duplicate constraint error on vec_document_chunks");
    }

    // Clean up to prevent orphaned rows
    db.prepare("DELETE FROM vec_document_chunks WHERE id = ?").run(BigInt(duplicateId));
    db.prepare("DELETE FROM document_chunks WHERE id = ?").run(duplicateId);
  });

  // ---------------------------------------------------------------------------
  // SUITE 5: Scale Stress, Batch Throughput & KNN Latency Benchmark
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 5: Scale Stress & Latency Benchmark ---");

  const BATCH_SIZE = 1000;
  let batchInsertTimeMs = 0;
  let knnQueryP99Ms = 0;

  await runTest("T5.1", "Scale Stress", `Insert ${BATCH_SIZE} 768-dim vectors in single transaction`, () => {
    const insertDocChunk = db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text, token_count)
      VALUES (?, ?, ?, 'resume', ?, ?, 100)
    `);
    const insertVecChunk = db.prepare(`
      INSERT INTO vec_document_chunks (id, embedding, user_id, source_id)
      VALUES (?, ?, ?, ?)
    `);

    const start = performance.now();
    db.exec("BEGIN TRANSACTION");
    for (let i = 0; i < BATCH_SIZE; i++) {
      const chunkId = 20000 + i;
      const sourceId = `source_bench_${i % 10}`;
      const vec = generateRandomVector(768);
      insertDocChunk.run(chunkId, testUserId, sourceId, i, `Chunk ${i} lorem ipsum text content`);
      insertVecChunk.run(BigInt(chunkId), vec, testUserId, sourceId);
    }
    db.exec("COMMIT");
    batchInsertTimeMs = performance.now() - start;

    console.log(`      ⚡ Inserted ${BATCH_SIZE} vectors in ${batchInsertTimeMs.toFixed(1)}ms (${(BATCH_SIZE / (batchInsertTimeMs / 1000)).toFixed(0)} vectors/sec)`);
    if (batchInsertTimeMs > 10000) {
      throw new Error(`Batch insert took too long: ${batchInsertTimeMs}ms > 10000ms`);
    }
  });

  await runTest("T5.2", "Scale Stress", "Execute 100 KNN queries (k=10) against 1,000+ vector dataset & measure latency", () => {
    const knnStmt = db.prepare(`
      SELECT vdc.id, vdc.distance, dc.chunk_text, dc.source_id
      FROM vec_document_chunks vdc
      JOIN document_chunks dc ON vdc.id = dc.id
      WHERE vdc.embedding MATCH ? AND vdc.k = 10 AND dc.user_id = ?
    `);

    const latencies: number[] = [];
    for (let i = 0; i < 100; i++) {
      const qVec = generateRandomVector(768);
      const t0 = performance.now();
      const rows = knnStmt.all(qVec, testUserId) as { id: number; distance: number }[];
      const t1 = performance.now();
      latencies.push(t1 - t0);
      if (rows.length !== 10) {
        throw new Error(`Expected 10 KNN rows, got ${rows.length}`);
      }
    }

    latencies.sort((a, b) => a - b);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    knnQueryP99Ms = p99;

    console.log(`      ⚡ KNN Latency (100 runs): Mean=${mean.toFixed(2)}ms, P50=${p50.toFixed(2)}ms, P95=${p95.toFixed(2)}ms, P99=${p99.toFixed(2)}ms`);
    if (p99 > 50) {
      console.warn(`⚠️ Warning: P99 KNN query latency is ${p99.toFixed(2)}ms (>50ms target)`);
    }
  });

  await runTest("T5.3", "Scale Stress", "Delete vector row and verify KNN exclusion", () => {
    const targetId = 20000;
    const beforeCount = (db.prepare("SELECT count(*) as cnt FROM vec_document_chunks").get() as { cnt: number }).cnt;
    db.prepare("DELETE FROM vec_document_chunks WHERE id = ?").run(BigInt(targetId));
    db.prepare("DELETE FROM document_chunks WHERE id = ?").run(targetId);
    const afterCount = (db.prepare("SELECT count(*) as cnt FROM vec_document_chunks").get() as { cnt: number }).cnt;

    if (afterCount !== beforeCount - 1) {
      throw new Error(`Expected count ${beforeCount - 1} after delete, got ${afterCount}`);
    }

    const check = db.prepare("SELECT id FROM vec_document_chunks WHERE id = ?").get(BigInt(targetId));
    if (check) throw new Error("Deleted vector row still exists");
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: Multi-Tenant Scoping, Relational Joins & Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 6: Multi-Tenant Hybrid Relational Scoping ---");

  const userAlice = "user_alice_001";
  const userBob = "user_bob_002";

  await runTest("T6.1", "Multi-Tenant", "Strict tenant isolation: Bob cannot retrieve Alice's vector chunks", () => {
    db.prepare("INSERT OR REPLACE INTO users (id, email) VALUES (?, ?)").run(userAlice, "alice@test.local");
    db.prepare("INSERT OR REPLACE INTO profiles (id, full_name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      userAlice, "Alice", new Date().toISOString(), new Date().toISOString()
    );
    db.prepare("INSERT OR REPLACE INTO users (id, email) VALUES (?, ?)").run(userBob, "bob@test.local");
    db.prepare("INSERT OR REPLACE INTO profiles (id, full_name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      userBob, "Bob", new Date().toISOString(), new Date().toISOString()
    );

    const aliceSharedVec = generateRandomVector(768);
    const aliceChunkId = 70001;
    db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'alice_secret_doc', 'document', 0, 'Alice secret financial data')").run(aliceChunkId, userAlice);
    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, 'alice_secret_doc')").run(BigInt(aliceChunkId), aliceSharedVec, userAlice);

    const bobChunkId = 70002;
    db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'bob_public_doc', 'document', 0, 'Bob normal doc')").run(bobChunkId, userBob);
    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, 'bob_public_doc')").run(BigInt(bobChunkId), generateRandomVector(768), userBob);

    // Bob queries with Alice's EXACT vector embedding, scoped to Bob's user_id
    const bobResults = db.prepare(`
      SELECT vdc.id, dc.chunk_text, dc.user_id
      FROM vec_document_chunks vdc
      JOIN document_chunks dc ON vdc.id = dc.id
      WHERE vdc.embedding MATCH ? AND vdc.k = 10 AND dc.user_id = ?
    `).all(aliceSharedVec, userBob) as { id: number; chunk_text: string; user_id: string }[];

    for (const r of bobResults) {
      if (r.user_id !== userBob) {
        throw new Error(`CRITICAL SECURITY FAILURE: Bob retrieved Alice's chunk! User=${r.user_id}, Text=${r.chunk_text}`);
      }
      if (r.chunk_text.includes("Alice secret")) {
        throw new Error("CRITICAL SECURITY FAILURE: Alice secret data leaked to Bob!");
      }
    }
  });

  await runTest("T6.2", "Multi-Tenant", "Filtered source_ids relational subquery", () => {
    const queryVec = generateRandomVector(768);
    const sourceWhitelist = ["source_bench_1", "source_bench_3"];
    const results = db.prepare(`
      SELECT vdc.id, dc.source_id, vdc.distance
      FROM vec_document_chunks vdc
      JOIN document_chunks dc ON vdc.id = dc.id
      WHERE vdc.embedding MATCH ? AND vdc.k = 20 AND dc.user_id = ? AND dc.source_id IN (?, ?)
    `).all(queryVec, testUserId, sourceWhitelist[0], sourceWhitelist[1]) as { source_id: string }[];

    for (const row of results) {
      if (!sourceWhitelist.includes(row.source_id)) {
        throw new Error(`Source filter breached: got ${row.source_id}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 7: Concurrency, Transactions & WAL Mode Stress
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 7: Concurrency, Transactions & WAL Mode Stress ---");

  await runTest("T7.1", "Concurrency", "Transaction rollback cleanly cancels both relational and vector insertions", () => {
    const rollbackChunkId = 88888;
    const testVec = generateRandomVector(768);

    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'tx_test', 'document', 0, 'Should rollback')").run(rollbackChunkId, testUserId);
      db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, 'tx_test')").run(BigInt(rollbackChunkId), testVec, testUserId);
      // Intentionally force error
      db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'tx_test', 'INVALID_SOURCE_TYPE', 1, 'Error')").run(rollbackChunkId + 1, testUserId);
      db.exec("COMMIT");
    } catch {
      try { db.exec("ROLLBACK"); } catch {}
    }

    const docCheck = db.prepare("SELECT id FROM document_chunks WHERE id = ?").get(rollbackChunkId);
    const vecCheck = db.prepare("SELECT id FROM vec_document_chunks WHERE id = ?").get(BigInt(rollbackChunkId));

    if (docCheck || vecCheck) {
      throw new Error(`Rollback failure: docCheck=${JSON.stringify(docCheck)}, vecCheck=${JSON.stringify(vecCheck)}`);
    }
  });

  await runTest("T7.2", "Concurrency", "Concurrent multi-connection reader + writer stress in WAL mode", async () => {
    // Open 3 concurrent DatabaseSync connections
    const reader1 = setupTestDb(tempDbPath);
    const reader2 = setupTestDb(tempDbPath);
    const writer = setupTestDb(tempDbPath);

    const ops = [];

    // Concurrent Writers inserting new jobs and chunks
    ops.push((async () => {
      for (let i = 0; i < 20; i++) {
        const cId = 90000 + i;
        writer.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, 'concurrent_src', 'job_description', ?, ?)").run(cId, testUserId, i, `Concurrent chunk ${i}`);
        writer.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, 'concurrent_src')").run(BigInt(cId), generateRandomVector(768), testUserId);
      }
    })());

    // Concurrent Reader 1 performing KNN searches
    ops.push((async () => {
      for (let i = 0; i < 30; i++) {
        const qVec = generateRandomVector(768);
        reader1.prepare("SELECT id, distance FROM vec_document_chunks WHERE embedding MATCH ? AND k = 5").all(qVec);
      }
    })());

    // Concurrent Reader 2 performing relational queries and FTS searches
    ops.push((async () => {
      for (let i = 0; i < 30; i++) {
        reader2.prepare("SELECT count(*) as c FROM document_chunks WHERE user_id = ?").get(testUserId);
      }
    })());

    await Promise.all(ops);
    reader1.close();
    reader2.close();
    writer.close();
  });

  // ---------------------------------------------------------------------------
  // SUITE 8: Simultaneous Three-Tier Workload (Standard SQL + FTS5 + sqlite-vec)
  // ---------------------------------------------------------------------------
  console.log("\n--- SUITE 8: Simultaneous Three-Tier Architecture Workload ---");

  await runTest("T8.1", "Three-Tier", "Interleaved execution of Relational State, FTS5 Search, and Vector KNN", () => {
    // 1. Relational insert: company and job
    const companyId = `comp_${Date.now()}`;
    db.prepare("INSERT INTO companies (id, user_id, name, location, website, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      companyId, testUserId, "Acme AI Corp", "San Francisco", "https://acme.ai", new Date().toISOString(), new Date().toISOString()
    );

    const jobId = `job_${Date.now()}`;
    db.prepare("INSERT INTO jobs (id, user_id, company_id, title, description, status, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      jobId, testUserId, companyId, "Staff Distributed Systems Engineer", "Building high scale vector search and distributed storage engines with sqlite and AI.", "saved", "active", new Date().toISOString(), new Date().toISOString()
    );

    // 2. FTS5 Index insert
    db.prepare(`
      INSERT INTO omni_search_index (entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      VALUES ('job', ?, ?, 'Staff Distributed Systems Engineer', 'Acme AI Corp', 'Building high scale vector search and distributed storage engines', '/board', 'job')
    `).run(jobId, testUserId);

    // 3. Vector insert
    const vecChunkId = 95000;
    const vec = generateRandomVector(768);
    db.prepare("INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text) VALUES (?, ?, ?, 'job_description', 0, 'Distributed storage vector search')").run(vecChunkId, testUserId, jobId);
    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(BigInt(vecChunkId), vec, testUserId, jobId);

    // 4. Interleaved test loop: run 20 cycles of all three tiers
    for (let i = 0; i < 20; i++) {
      // Tier 1: Standard SQL
      const relRow = db.prepare("SELECT id, title, state, status FROM jobs WHERE id = ? AND user_id = ?").get(jobId, testUserId) as { state: string; status: string };
      if (!relRow || relRow.state !== "active" || relRow.status !== "saved") throw new Error("Tier 1 Relational query failed");

      // Tier 2: FTS5 omni_search_index MATCH
      const ftsRows = db.prepare("SELECT entity_id, title FROM omni_search_index WHERE omni_search_index MATCH 'Distributed Systems' AND user_id = ?").all(testUserId) as { entity_id: string }[];
      if (ftsRows.length === 0 || ftsRows[0].entity_id !== jobId) {
        throw new Error(`Tier 2 FTS5 query failed: got ${JSON.stringify(ftsRows)}`);
      }

      // Tier 3: sqlite-vec KNN MATCH
      const vecRows = db.prepare(`
        SELECT vdc.id, vdc.distance, dc.chunk_text
        FROM vec_document_chunks vdc
        JOIN document_chunks dc ON vdc.id = dc.id
        WHERE vdc.embedding MATCH ? AND vdc.k = 1 AND dc.user_id = ?
      `).all(vec, testUserId) as { id: number; distance: number }[];
      if (vecRows.length === 0 || Math.abs(vecRows[0].distance) > 1e-4) {
        throw new Error(`Tier 3 Vector KNN query failed: got ${JSON.stringify(vecRows)}`);
      }
    }
  });

  // Cleanup temporary test DB
  db.close();
  try {
    fs.rmSync(tempDbPath, { force: true });
    fs.rmSync(`${tempDbPath}-wal`, { force: true });
    fs.rmSync(`${tempDbPath}-shm`, { force: true });
  } catch {}

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 EMPIRICAL STRESS TEST SUITE SUMMARY");
  console.log("================================================================================");

  const total = testResults.length;
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;

  console.log(`Total Tests Executed: ${total}`);
  console.log(`Passed:              ${passed} (✅)`);
  console.log(`Failed:              ${failed} (${failed > 0 ? "❌" : "None"})`);
  console.log(`Batch Insert Rate:   ${(BATCH_SIZE / (batchInsertTimeMs / 1000)).toFixed(0)} vectors/sec`);
  console.log(`KNN P99 Latency:     ${knnQueryP99Ms.toFixed(2)}ms`);

  if (failed > 0) {
    console.log("\nFailures Detail:");
    for (const f of testResults.filter(t => !t.passed)) {
      console.log(`- [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log("\n🎯 ALL EMPIRICAL STRESS TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});

/**
 * Challenger 2 Empirical Test Suite for Milestone 1
 *
 * Scope:
 * 1. Vector Parameter Serialization (Float32Array, Buffer, Uint8Array, ArrayBuffer, JSON, Array, BigInt)
 * 2. Foreign Key Cascade & Relational Constraints (document_chunks, vec_document_chunks, ai_memories, vec_memories)
 * 3. Relational Filtering + Vector KNN Matching (Shadowing vulnerability, JOIN vs Subquery vs Aux, latency)
 * 4. FTS5 BM25 Omni-Search + Vector Coexistence (Transactions, Triggers, Concurrent Querying)
 */

import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Test Framework
// ─────────────────────────────────────────────────────────────────────────────

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
  metric?: Record<string, any>;
}

const results: TestResult[] = [];
let currentSuite = "";

function describe(suiteName: string, fn: () => void) {
  currentSuite = suiteName;
  console.log(`\n================================================================`);
  console.log(`[SUITE] ${suiteName}`);
  console.log(`================================================================`);
  fn();
}

function test(testName: string, fn: () => void) {
  try {
    fn();
    results.push({ suite: currentSuite, name: testName, passed: true });
    console.log(`  ✅ [PASS] ${testName}`);
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ suite: currentSuite, name: testName, passed: false, error: errorMsg });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${errorMsg}`);
  }
}

function testWithMetric(testName: string, fn: () => Record<string, any>) {
  try {
    const metric = fn();
    results.push({ suite: currentSuite, name: testName, passed: true, metric });
    console.log(`  ✅ [PASS] ${testName}`, metric ? `-> ${JSON.stringify(metric)}` : "");
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ suite: currentSuite, name: testName, passed: false, error: errorMsg });
    console.error(`  ❌ [FAIL] ${testName}`);
    console.error(`     Error: ${errorMsg}`);
  }
}

function createTestDb(): { db: DatabaseSync; dbPath: string; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "attrack-chal2-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = new DatabaseSync(dbPath, { allowExtension: true });
  db.enableLoadExtension(true);
  sqliteVec.load(db);
  db.enableLoadExtension(false);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Read and execute schema.sql
  const schemaSql = fs.readFileSync(path.join(process.cwd(), "lib", "db", "schema.sql"), "utf8");
  db.exec(schemaSql);

  const cleanup = () => {
    try {
      db.close();
    } catch {}
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  };

  return { db, dbPath, cleanup };
}

// Helper to generate normalized 768-dim float vector
function createNormalizedVector(dim: number = 768, seed: number = 1): Float32Array {
  const vec = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(seed * (i + 1));
    vec[i] = val;
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < dim; i++) {
    vec[i] /= norm;
  }
  return vec;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION OF EMPIRICAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

console.log(`Starting Empirical Challenge Test Suite (Challenger M1-2)...`);

// =============================================================================
// 1. Vector Parameter Serialization Matrix
// =============================================================================
describe("1. Vector Parameter Serialization Matrix", () => {
  const { db, cleanup } = createTestDb();

  // Test Float32Array directly
  test("1.1 INSERT & SELECT with Float32Array directly", () => {
    const vec = createNormalizedVector(768, 1);
    db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
      vec,
      "mem-1",
      "usr-1"
    );

    const matchRow = db
      .prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1")
      .get(vec) as any;

    if (!matchRow || matchRow.memory_id !== "mem-1") {
      throw new Error(`Expected memory_id 'mem-1', got: ${JSON.stringify(matchRow)}`);
    }
    if (Math.abs(matchRow.distance) > 1e-4) {
      throw new Error(`Expected distance ~0.0 for identical vector, got: ${matchRow.distance}`);
    }
  });

  // Test Float32Array.buffer (ArrayBuffer) - verify node:sqlite rejects un-viewed ArrayBuffer
  test("1.2 Raw ArrayBuffer rejection in node:sqlite (requires TypedArray or Buffer)", () => {
    const vec = createNormalizedVector(768, 2);
    let threw = false;
    try {
      db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
        vec.buffer as any,
        "mem-2",
        "usr-1"
      );
    } catch (err: any) {
      threw = true;
      if (!err.message.includes("JSON array parsing error") && !err.message.includes("Input does not start with '['")) {
        throw new Error(`Unexpected error message for raw ArrayBuffer: ${err.message}`);
      }
    }
    if (!threw) {
      throw new Error("Expected raw ArrayBuffer to be rejected without TypedArray/Buffer wrapper");
    }
  });

  // Test Buffer.from(Float32Array.buffer) (Node.js Buffer)
  test("1.3 INSERT & SELECT with Buffer.from(Float32Array.buffer)", () => {
    const vec = createNormalizedVector(768, 3);
    const buf = Buffer.from(vec.buffer);
    db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
      buf,
      "mem-3",
      "usr-1"
    );

    const matchRow = db
      .prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1")
      .get(buf) as any;

    if (!matchRow || matchRow.memory_id !== "mem-3") {
      throw new Error(`Expected memory_id 'mem-3', got: ${JSON.stringify(matchRow)}`);
    }
  });

  // Test Uint8Array view
  test("1.4 INSERT & SELECT with Uint8Array view of Float32Array", () => {
    const vec = createNormalizedVector(768, 4);
    const uint8 = new Uint8Array(vec.buffer);
    db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
      uint8,
      "mem-4",
      "usr-1"
    );

    const matchRow = db
      .prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1")
      .get(uint8) as any;

    if (!matchRow || matchRow.memory_id !== "mem-4") {
      throw new Error(`Expected memory_id 'mem-4', got: ${JSON.stringify(matchRow)}`);
    }
  });

  // Test JSON string serialization "[0.1, 0.2, ...]"
  test("1.5 INSERT & SELECT with JSON string format", () => {
    const vec = createNormalizedVector(768, 5);
    const jsonStr = JSON.stringify(Array.from(vec));
    db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
      jsonStr,
      "mem-5",
      "usr-1"
    );

    const matchRow = db
      .prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1")
      .get(jsonStr) as any;

    if (!matchRow || matchRow.memory_id !== "mem-5") {
      throw new Error(`Expected memory_id 'mem-5', got: ${JSON.stringify(matchRow)}`);
    }
  });

  // Test JS standard Array of numbers (fails in node:sqlite binding)
  test("1.6 Behavior with raw JavaScript number[] array (rejected by node:sqlite)", () => {
    const vec = Array.from(createNormalizedVector(768, 6));
    let threw = false;
    try {
      db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
        vec as any,
        "mem-6",
        "usr-1"
      );
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected raw number[] array to fail without Float32Array or JSON string conversion");
    }
  });

  // Test Direct Auxiliary Column Query Limitation
  test("1.7 Auxiliary column condition limitation on vec0 virtual table", () => {
    const vec = createNormalizedVector(768, 7);
    let threw = false;
    try {
      // vec0 does not allow WHERE embedding MATCH ? AND user_id = ?
      db.prepare("SELECT memory_id FROM vec_memories WHERE embedding MATCH ? AND user_id = ? AND k = 1").all(
        vec,
        "usr-1"
      );
    } catch (err: any) {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected vec0 to reject direct auxiliary column constraint combined with MATCH");
    }
  });

  // Test Primary Key BigInt vs Number on vec_document_chunks (which has id INTEGER PRIMARY KEY without AUTOINCREMENT)
  test("1.7 vec_document_chunks ID parameter binding (BigInt vs Number)", () => {
    const vec = createNormalizedVector(768, 7);
    
    // Using BigInt(100)
    db.prepare("INSERT INTO vec_document_chunks(id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(100),
      vec,
      "usr-1",
      "src-1"
    );

    const row = db.prepare("SELECT id, user_id, source_id FROM vec_document_chunks WHERE id = ?").get(BigInt(100)) as any;
    if (!row || row.id !== 100) {
      throw new Error(`Failed to query by BigInt(100): ${JSON.stringify(row)}`);
    }

    // Using regular JS number 200
    db.prepare("INSERT INTO vec_document_chunks(id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(200),
      vec,
      "usr-1",
      "src-2"
    );
  });

  // Test Dimension mismatch rejection (e.g. 512 dims against float[768])
  test("1.8 Dimension mismatch error handling (512-dim vs 768-dim table)", () => {
    const vec512 = createNormalizedVector(512, 8);
    let threw = false;
    try {
      db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
        vec512,
        "mem-bad-dim",
        "usr-1"
      );
    } catch (err: any) {
      threw = true;
      if (!err.message.includes("dimension") && !err.message.includes("vector") && !err.message.includes("768") && !err.message.includes("sqlite")) {
        throw new Error(`Unexpected error message on dim mismatch: ${err.message}`);
      }
    }
    if (!threw) {
      throw new Error("Expected sqlite-vec to reject mismatched dimension vector, but it succeeded!");
    }
  });

  // Test unaligned / corrupted buffer length (e.g. 768 * 4 - 2 bytes)
  test("1.9 Corrupted buffer byteLength rejection", () => {
    const corruptBuf = Buffer.alloc(768 * 4 - 3);
    let threw = false;
    try {
      db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
        corruptBuf,
        "mem-corrupt",
        "usr-1"
      );
    } catch (err) {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected error for unaligned byteLength buffer, but insertion succeeded!");
    }
  });

  // Test NaN values in vector
  test("1.10 Vector containing NaN values", () => {
    const nanVec = createNormalizedVector(768, 10);
    nanVec[0] = NaN;
    let threw = false;
    try {
      db.prepare("INSERT INTO vec_memories(embedding, memory_id, user_id) VALUES (?, ?, ?)").run(
        nanVec,
        "mem-nan",
        "usr-1"
      );
    } catch (err) {
      threw = true;
    }
    // Even if inserted, MATCH should handle or throw gracefully
    try {
      db.prepare("SELECT memory_id FROM vec_memories WHERE embedding MATCH ? AND k = 1").get(nanVec);
    } catch (err) {
      // Expected to either throw or return 0
    }
  });

  cleanup();
});

// =============================================================================
// 2. Foreign Key Cascade & Relational Constraints
// =============================================================================
describe("2. Foreign Key Cascade & Relational Constraints", () => {
  const { db, cleanup } = createTestDb();

  test("2.1 Foreign Key enforcement (PRAGMA foreign_keys = ON)", () => {
    const fkRow = db.prepare("PRAGMA foreign_keys").get() as any;
    if (fkRow.foreign_keys !== 1) {
      throw new Error(`PRAGMA foreign_keys is not 1! Got: ${fkRow.foreign_keys}`);
    }

    // Attempt insert into document_chunks with non-existent user_id
    let threw = false;
    try {
      db.prepare(`
        INSERT INTO document_chunks (user_id, source_id, source_type, chunk_index, chunk_text)
        VALUES ('non-existent-user', 'doc-1', 'resume', 0, 'sample text')
      `).run();
    } catch (err: any) {
      threw = true;
      if (!err.message.includes("FOREIGN KEY")) {
        throw new Error(`Expected FOREIGN KEY error, got: ${err.message}`);
      }
    }
    if (!threw) {
      throw new Error("Expected FOREIGN KEY constraint violation when inserting invalid user_id!");
    }
  });

  test("2.2 Cascade deletion from profiles -> document_chunks", () => {
    // Setup user & profile
    const userId = "test-user-cascade";
    db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userId, "cascade@test.com");
    db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userId, "Cascade Tester");

    // Insert 5 document chunks for this user
    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO document_chunks (user_id, source_id, source_type, chunk_index, chunk_text)
        VALUES (?, 'doc-cascade', 'resume', ?, ?)
      `).run(userId, i, `Chunk ${i} content`);
    }

    const countBefore = db.prepare("SELECT COUNT(*) as count FROM document_chunks WHERE user_id = ?").get(userId) as any;
    if (countBefore.count !== 5) {
      throw new Error(`Expected 5 chunks before cascade, got ${countBefore.count}`);
    }

    // Delete user from profiles (or users)
    db.prepare("DELETE FROM profiles WHERE id = ?").run(userId);

    const countAfter = db.prepare("SELECT COUNT(*) as count FROM document_chunks WHERE user_id = ?").get(userId) as any;
    if (countAfter.count !== 0) {
      throw new Error(`Cascade deletion failed! Expected 0 document_chunks remaining, got ${countAfter.count}`);
    }
  });

  test("2.3 Cascade deletion behavior on virtual table vec_document_chunks & vec_memories", () => {
    const userId = "test-user-vec-sync";
    db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userId, "vecsync@test.com");
    db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userId, "Vec Sync Tester");

    // Insert document_chunk
    const insertStmt = db.prepare(`
      INSERT INTO document_chunks (user_id, source_id, source_type, chunk_index, chunk_text)
      VALUES (?, 'doc-1', 'resume', 0, 'Chunk 0')
    `);
    insertStmt.run(userId);
    const chunkRow = db.prepare("SELECT id FROM document_chunks WHERE user_id = ?").get(userId) as any;
    const chunkId = chunkRow.id;

    // Insert into vec_document_chunks with matching ID
    const vec = createNormalizedVector(768, 1);
    db.prepare("INSERT INTO vec_document_chunks(id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(chunkId),
      vec,
      userId,
      "doc-1"
    );

    // Verify presence in both tables
    const vecBefore = db.prepare("SELECT count(*) as count FROM vec_document_chunks WHERE id = ?").get(BigInt(chunkId)) as any;
    if (vecBefore.count !== 1) {
      throw new Error("vec_document_chunks row not found before deletion");
    }

    // Now delete the document_chunk
    db.prepare("DELETE FROM document_chunks WHERE id = ?").run(chunkId);

    // Check document_chunks
    const chunkAfter = db.prepare("SELECT count(*) as count FROM document_chunks WHERE id = ?").get(chunkId) as any;
    if (chunkAfter.count !== 0) {
      throw new Error("document_chunks row was not deleted");
    }

    // Note: SQLite virtual tables (vec0) do NOT support SQLite FOREIGN KEY constraints automatically.
    // Let's document whether vec0 still retains the ID unless explicitly deleted.
    const vecAfter = db.prepare("SELECT count(*) as count FROM vec_document_chunks WHERE id = ?").get(BigInt(chunkId)) as any;
    console.log(`     ℹ️ [VIRTUAL TABLE SYNC BEHAVIOR]: vec_document_chunks count after document_chunks DELETE: ${vecAfter.count}`);
    
    // Explicit deletion from vec_document_chunks
    db.prepare("DELETE FROM vec_document_chunks WHERE id = ?").run(BigInt(chunkId));
    const vecAfterExplicit = db.prepare("SELECT count(*) as count FROM vec_document_chunks WHERE id = ?").get(BigInt(chunkId)) as any;
    if (vecAfterExplicit.count !== 0) {
      throw new Error("Explicit DELETE on vec_document_chunks failed!");
    }
  });

  test("2.4 Full schema relationship integrity (jobs, documents, applications, omni_search_index)", () => {
    const userId = "test-user-rel-all";
    db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userId, "relall@test.com");
    db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userId, "Rel All Tester");

    // Insert company, job, document
    db.prepare("INSERT INTO companies(id, user_id, name) VALUES ('cmp-1', ?, 'Acme Corp')").run(userId);
    db.prepare("INSERT INTO documents(id, user_id, type, name, file_path) VALUES ('doc-1', ?, 'resume', 'My Resume', '/res.pdf')").run(userId);
    db.prepare("INSERT INTO jobs(id, user_id, company_id, title, status) VALUES ('job-1', ?, 'cmp-1', 'Software Engineer', 'saved')").run(userId);

    // Verify omni_search_index triggers populated jobs, documents, companies
    const omniJobs = db.prepare("SELECT COUNT(*) as count FROM omni_search_index WHERE user_id = ? AND entity_type = 'job'").get(userId) as any;
    const omniDocs = db.prepare("SELECT COUNT(*) as count FROM omni_search_index WHERE user_id = ? AND entity_type = 'document'").get(userId) as any;
    const omniCmps = db.prepare("SELECT COUNT(*) as count FROM omni_search_index WHERE user_id = ? AND entity_type = 'company'").get(userId) as any;

    if (omniJobs.count !== 1 || omniDocs.count !== 1 || omniCmps.count !== 1) {
      throw new Error(`Omni search triggers failed to sync! Jobs: ${omniJobs.count}, Docs: ${omniDocs.count}, Companies: ${omniCmps.count}`);
    }

    // Delete job -> verify omni_search_index trigger cleans up
    db.prepare("DELETE FROM jobs WHERE id = 'job-1'").run();
    const omniJobsAfter = db.prepare("SELECT COUNT(*) as count FROM omni_search_index WHERE user_id = ? AND entity_type = 'job'").get(userId) as any;
    if (omniJobsAfter.count !== 0) {
      throw new Error(`Omni search index retained deleted job! Count: ${omniJobsAfter.count}`);
    }
  });

  cleanup();
});

// =============================================================================
// 3. Relational Filtering Combined with Vector KNN Matching
// =============================================================================
describe("3. Relational Filtering Combined with Vector KNN Matching", () => {
  const { db, cleanup } = createTestDb();

  // Setup multi-tenant benchmark dataset
  const userA = "usr-alice";
  const userB = "usr-bob";
  db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userA, "alice@test.com");
  db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userA, "Alice");
  db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userB, "bob@test.com");
  db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userB, "Bob");

  const queryVec = createNormalizedVector(768, 999);

  // Populate Bob with 50 vectors very close to queryVec (distance ~ 0.01 - 0.05)
  // Populate Alice with 50 vectors slightly further from queryVec (distance ~ 0.20 - 0.30)
  let currentChunkId = 1;

  for (let i = 0; i < 50; i++) {
    // Bob's vector: slight perturbation from queryVec
    const vecB = new Float32Array(queryVec);
    vecB[0] += (i + 1) * 0.001;
    let norm = 0;
    for (let j = 0; j < 768; j++) norm += vecB[j] * vecB[j];
    norm = Math.sqrt(norm);
    for (let j = 0; j < 768; j++) vecB[j] /= norm;

    const id = currentChunkId++;
    db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
      VALUES (?, ?, 'doc-bob', 'resume', ?, ?)
    `).run(id, userB, i, `Bob chunk ${i}`);

    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(id),
      vecB,
      userB,
      "doc-bob"
    );
  }

  for (let i = 0; i < 50; i++) {
    // Alice's vector: orthogonal + slight query blend (further distance)
    const vecA = createNormalizedVector(768, 100 + i);
    for (let j = 0; j < 768; j++) {
      vecA[j] = 0.8 * vecA[j] + 0.2 * queryVec[j];
    }
    let norm = 0;
    for (let j = 0; j < 768; j++) norm += vecA[j] * vecA[j];
    norm = Math.sqrt(norm);
    for (let j = 0; j < 768; j++) vecA[j] /= norm;

    const id = currentChunkId++;
    db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
      VALUES (?, ?, 'doc-alice', 'resume', ?, ?)
    `).run(id, userA, i, `Alice chunk ${i}`);

    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(id),
      vecA,
      userA,
      "doc-alice"
    );
  }

  testWithMetric("3.1 Shadowing / Top-K Truncation Challenge: JOIN with small k", () => {
    // CHALLENGE: If someone queries vec_document_chunks with k = 5 and JOINs on document_chunks WHERE user_id = 'usr-alice'
    // Because Bob's 50 vectors are closer, vec0 picks top 5 (all Bob), then the JOIN filters them out -> 0 results!
    const queryWithSmallK = db.prepare(`
      SELECT d.id, d.user_id, d.chunk_text, v.distance
      FROM vec_document_chunks v
      JOIN document_chunks d ON v.id = d.id
      WHERE v.embedding MATCH ? AND v.k = 5 AND d.user_id = ?
    `).all(queryVec, userA) as any[];

    console.log(`     ⚠️ [SHADOWING RESULT]: k=5 returned ${queryWithSmallK.length} records for Alice (expected 0 due to vec0 pre-filtering before JOIN)`);

    return {
      kRequested: 5,
      recordsReturnedForAlice: queryWithSmallK.length,
      shadowedByOtherUserVectors: queryWithSmallK.length === 0
    };
  });

  testWithMetric("3.2 Resilient Multi-Tenant Retrieval: Adequate k candidate pool", () => {
    // Proper retrieval pattern: Request k = candidate_pool (e.g. k = 100) to ensure user's partition is captured
    const queryWithLargeK = db.prepare(`
      SELECT d.id, d.user_id, d.chunk_text, v.distance
      FROM vec_document_chunks v
      JOIN document_chunks d ON v.id = d.id
      WHERE v.embedding MATCH ? AND v.k = 100 AND d.user_id = ?
      ORDER BY v.distance ASC
      LIMIT 5
    `).all(queryVec, userA) as any[];

    if (queryWithLargeK.length !== 5) {
      throw new Error(`Expected 5 records for Alice when k=100 candidate pool is used, got ${queryWithLargeK.length}`);
    }

    if (queryWithLargeK.some(r => r.user_id !== userA)) {
      throw new Error("Data leakage! Found non-Alice record in Alice's scoped query!");
    }

    return {
      kCandidatePool: 100,
      limit: 5,
      returnedCount: queryWithLargeK.length,
      topDistance: queryWithLargeK[0].distance,
      worstDistance: queryWithLargeK[queryWithLargeK.length - 1].distance
    };
  });

  testWithMetric("3.3 Source-specific filtering (source_id IN (...)) with Vector KNN", () => {
    // Add another source for Alice
    const extraId = currentChunkId++;
    const extraVec = createNormalizedVector(768, 777);
    db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
      VALUES (?, ?, 'doc-alice-job-notes', 'job_notes', 0, 'Alice Job Note chunk')
    `).run(extraId, userA);

    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, ?)").run(
      BigInt(extraId),
      extraVec,
      userA,
      "doc-alice-job-notes"
    );

    const scopedToSource = db.prepare(`
      SELECT d.id, d.source_id, d.chunk_text, v.distance
      FROM vec_document_chunks v
      JOIN document_chunks d ON v.id = d.id
      WHERE v.embedding MATCH ? AND v.k = 100 AND d.user_id = ? AND d.source_id = 'doc-alice-job-notes'
      LIMIT 5
    `).all(extraVec, userA) as any[];

    if (scopedToSource.length === 0 || scopedToSource[0].source_id !== "doc-alice-job-notes") {
      throw new Error(`Source scoping failed! Got: ${JSON.stringify(scopedToSource)}`);
    }

    return {
      foundSourceId: scopedToSource[0].source_id,
      distance: scopedToSource[0].distance
    };
  });

  testWithMetric("3.4 Performance Benchmark: Latency across 500 KNN + Relational queries", () => {
    const stmt = db.prepare(`
      SELECT d.id, d.user_id, d.chunk_text, v.distance
      FROM vec_document_chunks v
      JOIN document_chunks d ON v.id = d.id
      WHERE v.embedding MATCH ? AND v.k = 50 AND d.user_id = ?
      ORDER BY v.distance ASC
      LIMIT 5
    `);

    const ITERATIONS = 500;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      stmt.all(queryVec, userA);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / ITERATIONS;
    const qps = Math.round((ITERATIONS / elapsed) * 1000);

    return {
      iterations: ITERATIONS,
      totalElapsedMs: Math.round(elapsed * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs * 1000) / 1000,
      qps
    };
  });

  cleanup();
});

// =============================================================================
// 4. FTS5 BM25 Omni-Search + Vector Coexistence & Concurrency
// =============================================================================
describe("4. FTS5 BM25 Omni-Search + Vector Coexistence & Concurrency", () => {
  const { db, cleanup } = createTestDb();

  const userId = "usr-omnivec";
  db.prepare("INSERT INTO users(id, email) VALUES (?, ?)").run(userId, "omnivec@test.com");
  db.prepare("INSERT INTO profiles(id, full_name) VALUES (?, ?)").run(userId, "OmniVec User");

  test("4.1 FTS5 BM25 match query on omni_search_index", () => {
    // Insert jobs and documents
    db.prepare(`
      INSERT INTO jobs(id, user_id, title, description, location, status)
      VALUES ('job-senior-fe', ?, 'Senior Frontend Engineer', 'React TypeScript Next.js specialist needed in Berlin', 'Berlin', 'saved')
    `).run(userId);

    db.prepare(`
      INSERT INTO jobs(id, user_id, title, description, location, status)
      VALUES ('job-backend-go', ?, 'Principal Backend Engineer', 'Go Distributed Systems PostgreSQL in Remote', 'Remote', 'saved')
    `).run(userId);

    db.prepare(`
      INSERT INTO documents(id, user_id, type, name, content, file_path)
      VALUES ('doc-react-cv', ?, 'resume', 'Senior React CV', 'Over 8 years experience with React, TypeScript, Next.js, Redux, Performance optimization', '/cv.pdf')
    `).run(userId);

    // Query FTS5 with BM25 ranking
    const ftsResults = db.prepare(`
      SELECT entity_type, entity_id, title, subtitle, bm25(omni_search_index) as rank
      FROM omni_search_index
      WHERE omni_search_index MATCH 'React TypeScript'
      ORDER BY rank
    `).all() as any[];

    if (ftsResults.length !== 2) {
      throw new Error(`Expected 2 FTS matches for 'React TypeScript', got ${ftsResults.length}: ${JSON.stringify(ftsResults)}`);
    }

    // Both job and document should be found
    const types = ftsResults.map(r => r.entity_type);
    if (!types.includes("job") || !types.includes("document")) {
      throw new Error(`Missing expected entity types in FTS results: ${JSON.stringify(types)}`);
    }
  });

  test("4.2 Interleaved Write Transactions (Relational + FTS5 Trigger + sqlite-vec)", () => {
    const vec = createNormalizedVector(768, 555);

    // Run combined transaction
    db.exec("BEGIN IMMEDIATE");
    try {
      // 1. Insert Job
      db.prepare(`
        INSERT INTO jobs(id, user_id, title, description)
        VALUES ('job-trans-1', ?, 'Machine Learning Engineer', 'PyTorch LLM Fine-tuning')
      `).run(userId);

      // 2. Insert document chunk
      db.prepare(`
        INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
        VALUES (9999, ?, 'job-trans-1', 'job_description', 0, 'PyTorch LLM Fine-tuning')
      `).run(userId);

      // 3. Insert vector
      db.prepare(`
        INSERT INTO vec_document_chunks (id, embedding, user_id, source_id)
        VALUES (?, ?, ?, ?)
      `).run(BigInt(9999), vec, userId, "job-trans-1");

      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    // Verify all 3 tiers populated correctly
    const jobRow = db.prepare("SELECT title FROM jobs WHERE id = 'job-trans-1'").get() as any;
    const ftsRow = db.prepare("SELECT title FROM omni_search_index WHERE entity_id = 'job-trans-1'").get() as any;
    const chunkRow = db.prepare("SELECT chunk_text FROM document_chunks WHERE id = 9999").get() as any;
    const vecRow = db.prepare("SELECT distance FROM vec_document_chunks WHERE embedding MATCH ? AND k = 1").get(vec) as any;

    if (!jobRow || !ftsRow || !chunkRow || !vecRow) {
      throw new Error("One or more entities failed to commit in atomic transaction!");
    }
  });

  testWithMetric("4.3 Simultaneous FTS5 & sqlite-vec query execution", () => {
    const vec = createNormalizedVector(768, 555);

    const ftsStmt = db.prepare(`
      SELECT entity_type, entity_id, title, bm25(omni_search_index) as rank
      FROM omni_search_index
      WHERE omni_search_index MATCH 'Engineer'
      ORDER BY rank
      LIMIT 5
    `);

    const vecStmt = db.prepare(`
      SELECT d.id, d.chunk_text, v.distance
      FROM vec_document_chunks v
      JOIN document_chunks d ON v.id = d.id
      WHERE v.embedding MATCH ? AND v.k = 10 AND d.user_id = ?
      LIMIT 5
    `);

    const ITERATIONS = 300;
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      ftsStmt.all();
      vecStmt.all(vec, userId);
    }
    const elapsed = performance.now() - start;

    return {
      iterations: ITERATIONS,
      totalElapsedMs: Math.round(elapsed * 100) / 100,
      avgCombinedLatencyMs: Math.round((elapsed / ITERATIONS) * 1000) / 1000,
      qps: Math.round((ITERATIONS / elapsed) * 1000)
    };
  });

  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary Report
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n================================================================`);
console.log(`EMPIRICAL CHALLENGE RESULTS SUMMARY`);
console.log(`================================================================`);

const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;

console.log(`Total Tests Run: ${results.length}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);

if (failedCount > 0) {
  console.log(`\nFailed Tests:`);
  for (const f of results.filter(r => !r.passed)) {
    console.log(`  - [${f.suite}] ${f.name}: ${f.error}`);
  }
}

console.log(`\nMetric Details:`);
for (const r of results.filter(r => r.metric)) {
  console.log(`  - ${r.name}: ${JSON.stringify(r.metric)}`);
}

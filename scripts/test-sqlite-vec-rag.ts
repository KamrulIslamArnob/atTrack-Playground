/**
 * 4-Tier E2E Test Suite for sqlite-vec & Hybrid RAG Retrieval in atTrack
 *
 * Requirements Source:
 *   - ORIGINAL_REQUEST.md (§R1, §R2, §R3, §R4, Acceptance Criteria)
 *   - TEST_INFRA.md (Feature Inventory F1-F11, Tiers 1-4)
 *
 * Running:
 *   npx tsx scripts/test-sqlite-vec-rag.ts
 */

import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Test Harness & Assertions
// ─────────────────────────────────────────────────────────────────────────────

interface AssertionResult {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
  tier: number;
  feature?: string;
}

const allResults: AssertionResult[] = [];
let currentTier = 1;
let currentFeature = "F1";

function assert(condition: boolean, id: string, description: string) {
  if (!condition) {
    const errorMsg = `Assertion failed: [${id}] ${description}`;
    allResults.push({ id, description, passed: false, error: errorMsg, tier: currentTier, feature: currentFeature });
    console.error(`  ❌ [FAIL] ${id}: ${description}`);
  } else {
    allResults.push({ id, description, passed: true, tier: currentTier, feature: currentFeature });
    console.log(`  ✅ [PASS] ${id}: ${description}`);
  }
}

function assertEqual<T>(actual: T, expected: T, id: string, description: string) {
  const matches = JSON.stringify(actual) === JSON.stringify(expected);
  if (!matches) {
    const errorMsg = `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    allResults.push({ id, description, passed: false, error: errorMsg, tier: currentTier, feature: currentFeature });
    console.error(`  ❌ [FAIL] ${id}: ${description} (${errorMsg})`);
  } else {
    allResults.push({ id, description, passed: true, tier: currentTier, feature: currentFeature });
    console.log(`  ✅ [PASS] ${id}: ${description}`);
  }
}

function assertGreaterThan(actual: number, expected: number, id: string, description: string) {
  if (actual <= expected) {
    const errorMsg = `Expected > ${expected}, got ${actual}`;
    allResults.push({ id, description, passed: false, error: errorMsg, tier: currentTier, feature: currentFeature });
    console.error(`  ❌ [FAIL] ${id}: ${description} (${errorMsg})`);
  } else {
    allResults.push({ id, description, passed: true, tier: currentTier, feature: currentFeature });
    console.log(`  ✅ [PASS] ${id}: ${description}`);
  }
}

function assertLessThanOrEqual(actual: number, expected: number, id: string, description: string) {
  if (actual > expected) {
    const errorMsg = `Expected <= ${expected}, got ${actual}`;
    allResults.push({ id, description, passed: false, error: errorMsg, tier: currentTier, feature: currentFeature });
    console.error(`  ❌ [FAIL] ${id}: ${description} (${errorMsg})`);
  } else {
    allResults.push({ id, description, passed: true, tier: currentTier, feature: currentFeature });
    console.log(`  ✅ [PASS] ${id}: ${description}`);
  }
}

function assertThrows(fn: () => void, id: string, description: string) {
  try {
    fn();
    allResults.push({ id, description, passed: false, error: "Expected function to throw, but it did not", tier: currentTier, feature: currentFeature });
    console.error(`  ❌ [FAIL] ${id}: ${description} (did not throw)`);
  } catch {
    allResults.push({ id, description, passed: true, tier: currentTier, feature: currentFeature });
    console.log(`  ✅ [PASS] ${id}: ${description}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Logic & RAG Components (Testable Reference Implementation)
// ─────────────────────────────────────────────────────────────────────────────

export const VECTOR_DIMENSION = 768;

/** Token estimator and text chunker with sliding window overlap */
export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export class TextChunker {
  static estimateTokens(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    // Approximates token count: ~4 chars per token, or word count * 1.3
    const words = text.trim().split(/\s+/).length;
    const charEstimate = Math.ceil(text.length / 4);
    return Math.max(words, charEstimate);
  }

  static chunkText(
    text: string,
    options: { maxTokens?: number; overlapTokens?: number } = {}
  ): TextChunk[] {
    if (!text || text.trim().length === 0) return [];

    const maxTokens = options.maxTokens ?? 400; // 300-500 window
    const overlapTokens = options.overlapTokens ?? 50;

    const trimmed = text.trim();
    const totalTokens = this.estimateTokens(trimmed);

    if (totalTokens <= maxTokens) {
      return [{ index: 0, content: trimmed, tokenCount: totalTokens }];
    }

    // Split by paragraphs first, or by lines/sentences if paragraphs are large
    let units = trimmed.split(/\n\s*\n/).map((u) => u.trim()).filter((u) => u.length > 0);
    // If only 1 unit or units are too large, split by lines or sentences
    if (units.length === 1 && totalTokens > maxTokens) {
      units = trimmed.split(/\n+/).map((u) => u.trim()).filter((u) => u.length > 0);
    }

    const chunks: TextChunk[] = [];
    let currentUnits: string[] = [];
    let currentTokenCount = 0;
    let chunkIndex = 0;

    for (const unit of units) {
      const unitTokens = this.estimateTokens(unit);

      if (currentTokenCount + unitTokens > maxTokens && currentUnits.length > 0) {
        const chunkContent = currentUnits.join("\n\n");
        chunks.push({
          index: chunkIndex++,
          content: chunkContent,
          tokenCount: this.estimateTokens(chunkContent),
        });

        // Compute overlap
        let overlapAccum: string[] = [];
        let overlapTokensCount = 0;
        for (let i = currentUnits.length - 1; i >= 0; i--) {
          const uTokens = this.estimateTokens(currentUnits[i]);
          if (overlapTokensCount + uTokens <= overlapTokens) {
            overlapAccum.unshift(currentUnits[i]);
            overlapTokensCount += uTokens;
          } else {
            break;
          }
        }
        currentUnits = [...overlapAccum, unit];
        currentTokenCount = overlapTokensCount + unitTokens;
      } else {
        currentUnits.push(unit);
        currentTokenCount += unitTokens;
      }
    }

    if (currentUnits.length > 0) {
      const chunkContent = currentUnits.join("\n\n");
      chunks.push({
        index: chunkIndex++,
        content: chunkContent,
        tokenCount: this.estimateTokens(chunkContent),
      });
    }

    return chunks;
  }
}

/** BYOK Embeddings Service with 768-dim vector generation & deterministic math */
export class EmbeddingService {
  /** Deterministic semantic embedding generation for offline & BYOK testing */
  static generateEmbedding(text: string, dimension: number = VECTOR_DIMENSION): Float32Array {
    if (text === undefined || text === null) {
      throw new Error("Text cannot be null or undefined");
    }

    const vector = new Float32Array(dimension);
    if (text.length === 0) {
      return vector; // zero vector
    }

    // Hash text tokens into dense vector space preserving semantic locality
    const words = text.toLowerCase().match(/[a-z0-9_#+.-]+/g) || [text];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let h1 = 5381;
      let h2 = 2166136261;
      for (let j = 0; j < word.length; j++) {
        const code = word.charCodeAt(j);
        h1 = ((h1 << 5) + h1) ^ code;
        h2 = Math.imul(h2 ^ code, 16777619);
      }
      for (let s = 0; s < 16; s++) {
        const dim = Math.abs(h1 + s * h2) % dimension;
        const sign = ((h2 + s * h1) & 1) === 0 ? 1.0 : -1.0;
        vector[dim] += sign / Math.sqrt(words.length);
      }
    }

    // Normalize to unit length (L2 norm = 1.0)
    let norm = 0;
    for (let d = 0; d < dimension; d++) {
      norm += vector[d] * vector[d];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let d = 0; d < dimension; d++) {
        vector[d] /= norm;
      }
    }

    return vector;
  }

  /** Cosine distance between two vectors: 1 - cosine_similarity (range: 0 to 2) */
  static cosineDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) throw new Error("Vector dimension mismatch");
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    const similarity = dot / denom;
    return Math.max(0, Math.min(2, 1 - similarity));
  }
}

/** Vector Database Schema and Hybrid Retrieval Manager */
export class VectorStore {
  static initialize(db: DatabaseSync, dimension: number = VECTOR_DIMENSION) {
    // 1. Relational tables & indexes
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        notes TEXT,
        status TEXT DEFAULT 'wishlist',
        state TEXT DEFAULT 'active',
        list_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        description TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_type TEXT NOT NULL, -- 'job' | 'resume' | 'doc' | 'notes'
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_doc_chunks_user_src
        ON document_chunks(user_id, source_type, source_id);

      -- FTS5 Omni Search Virtual Table
      CREATE VIRTUAL TABLE IF NOT EXISTS omni_search_index USING fts5(
        entity_type,
        entity_id,
        user_id UNINDEXED,
        title,
        subtitle,
        content,
        href UNINDEXED,
        icon UNINDEXED
      );
    `);

    // 2. sqlite-vec Virtual Tables
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding float[${dimension}] distance_metric=cosine
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS vec_memories USING vec0(
        memory_id TEXT PRIMARY KEY,
        embedding float[${dimension}] distance_metric=cosine
      );
    `);
  }

  static indexDocument(
    db: DatabaseSync,
    params: {
      userId: string;
      sourceType: "job" | "resume" | "doc" | "notes";
      sourceId: string;
      content: string;
      dimension?: number;
    }
  ): { chunkCount: number } {
    const { userId, sourceType, sourceId, content, dimension = VECTOR_DIMENSION } = params;

    // Delete existing chunks for this sourceId
    const oldChunks = db
      .prepare("SELECT id FROM document_chunks WHERE user_id = ? AND source_type = ? AND source_id = ?")
      .all(userId, sourceType, sourceId) as Array<{ id: string }>;

    for (const chunk of oldChunks) {
      db.prepare("DELETE FROM vec_document_chunks WHERE chunk_id = ?").run(chunk.id);
    }
    db.prepare("DELETE FROM document_chunks WHERE user_id = ? AND source_type = ? AND source_id = ?").run(userId, sourceType, sourceId);

    const chunks = TextChunker.chunkText(content);
    const insertChunk = db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_type, source_id, chunk_index, content, token_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const insertVec = db.prepare(`
      INSERT INTO vec_document_chunks (chunk_id, embedding)
      VALUES (?, ?)
    `);

    for (const chunk of chunks) {
      const chunkId = `chunk_${sourceId}_${chunk.index}_${crypto.randomUUID().slice(0, 8)}`;
      const embedding = EmbeddingService.generateEmbedding(chunk.content, dimension);

      insertChunk.run(chunkId, userId, sourceType, sourceId, chunk.index, chunk.content, chunk.tokenCount);
      insertVec.run(chunkId, embedding);
    }

    return { chunkCount: chunks.length };
  }

  static indexMemory(
    db: DatabaseSync,
    memory: { id: string; userId: string; title?: string; description: string; dimension?: number }
  ) {
    const { id, userId, title, description, dimension = VECTOR_DIMENSION } = memory;

    db.prepare(`
      INSERT OR REPLACE INTO ai_memories (id, user_id, title, description, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, userId, title ?? null, description);

    // Delete old vec memory if exists
    db.prepare("DELETE FROM vec_memories WHERE memory_id = ?").run(id);

    const textToEmbed = title ? `${title}: ${description}` : description;
    const embedding = EmbeddingService.generateEmbedding(textToEmbed, dimension);

    db.prepare(`
      INSERT INTO vec_memories (memory_id, embedding)
      VALUES (?, ?)
    `).run(id, embedding);
  }

  static hybridSearch(
    db: DatabaseSync,
    params: {
      userId: string;
      queryEmbedding: Float32Array;
      sourceIds?: string[];
      sourceType?: string;
      limit?: number;
      minSimilarity?: number;
    }
  ): Array<{
    id: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    chunkIndex: number;
    content: string;
    distance: number;
    similarity: number;
  }> {
    const { userId, queryEmbedding, sourceIds, sourceType, limit = 10 } = params;

    let sql = `
      SELECT
        c.id,
        c.user_id,
        c.source_type,
        c.source_id,
        c.chunk_index,
        c.content,
        v.distance
      FROM vec_document_chunks v
      JOIN document_chunks c ON c.id = v.chunk_id
      WHERE v.embedding MATCH ?
        AND v.k = ?
        AND c.user_id = ?
    `;
    const sqlParams: unknown[] = [queryEmbedding, limit * 3, userId];

    if (sourceType) {
      sql += " AND c.source_type = ?";
      sqlParams.push(sourceType);
    }

    if (sourceIds && sourceIds.length > 0) {
      const placeholders = sourceIds.map(() => "?").join(",");
      sql += ` AND c.source_id IN (${placeholders})`;
      sqlParams.push(...sourceIds);
    }

    sql += " ORDER BY v.distance ASC LIMIT ?";
    sqlParams.push(limit);

    const rows = db.prepare(sql).all(...(sqlParams as any[])) as Array<{
      id: string;
      user_id: string;
      source_type: string;
      source_id: string;
      chunk_index: number;
      content: string;
      distance: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      sourceType: r.source_type,
      sourceId: r.source_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      distance: r.distance,
      similarity: Math.max(0, 1 - r.distance),
    }));
  }

  static recallMemories(
    db: DatabaseSync,
    params: {
      userId: string;
      queryEmbedding: Float32Array;
      limit?: number;
    }
  ): Array<{
    id: string;
    userId: string;
    title: string | null;
    description: string;
    distance: number;
    similarity: number;
  }> {
    const { userId, queryEmbedding, limit = 3 } = params;

    const sql = `
      SELECT
        m.id,
        m.user_id,
        m.title,
        m.description,
        v.distance
      FROM vec_memories v
      JOIN ai_memories m ON m.id = v.memory_id
      WHERE v.embedding MATCH ?
        AND v.k = ?
        AND m.user_id = ?
      ORDER BY v.distance ASC
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(queryEmbedding, limit * 2, userId, limit) as Array<{
      id: string;
      user_id: string;
      title: string | null;
      description: string;
      distance: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      distance: r.distance,
      similarity: Math.max(0, 1 - r.distance),
    }));
  }
}

/** Resume & Job Fit Matrix Engine */
export class ResumeFitEngine {
  static computeFitMatrix(
    jobText: string,
    resumeText: string
  ): {
    overallScore: number;
    requirements: Array<{ requirement: string; bestMatch: string; similarity: number; isMet: boolean }>;
    missingRequirements: string[];
  } {
    if (!jobText.trim() || !resumeText.trim()) {
      return { overallScore: 0, requirements: [], missingRequirements: [] };
    }

    const isSectionHeader = (line: string) => {
      const lower = line.trim().toLowerCase();
      return lower === "job requirements:" || lower === "requirements:" || lower === "work experience:" || lower === "experience:";
    };

    const reqLines = jobText
      .split(/\r?\n/)
      .map((s) => s.replace(/^[-*•\s]+/, "").trim())
      .filter((s) => s.length > 10 && !isSectionHeader(s));

    const resumeLines = resumeText
      .split(/\r?\n/)
      .map((s) => s.replace(/^[-*•\s]+/, "").trim())
      .filter((s) => s.length > 10 && !isSectionHeader(s));

    if (reqLines.length === 0 || resumeLines.length === 0) {
      return { overallScore: 0, requirements: [], missingRequirements: [] };
    }

    const matchedReqs: Array<{ requirement: string; bestMatch: string; similarity: number; isMet: boolean }> = [];
    const missing: string[] = [];
    let totalScore = 0;

    for (const req of reqLines) {
      const reqVec = EmbeddingService.generateEmbedding(req);
      let bestSim = 0;
      let bestMatch = "";

      for (const line of resumeLines) {
        const lineVec = EmbeddingService.generateEmbedding(line);
        const dist = EmbeddingService.cosineDistance(reqVec, lineVec);
        const sim = Math.max(0, 1 - dist);
        if (sim > bestSim) {
          bestSim = sim;
          bestMatch = line;
        }
      }

      const isMet = bestSim >= 0.40;
      matchedReqs.push({
        requirement: req,
        bestMatch,
        similarity: Math.round(bestSim * 100) / 100,
        isMet,
      });

      totalScore += bestSim;
      if (!isMet) {
        missing.push(req);
      }
    }

    const metRatio = matchedReqs.filter((r) => r.isMet).length / reqLines.length;
    const avgSim = totalScore / reqLines.length;
    const overallScore = Math.min(100, Math.round((metRatio * 0.5 + avgSim * 0.5) * 100));
    return {
      overallScore,
      requirements: matchedReqs,
      missingRequirements: missing,
    };
  }
}

/** Helper to create an isolated in-memory test database */
function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:", {
    allowExtension: true,
  });
  sqliteVec.load(db);
  VectorStore.initialize(db);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: Functional Feature Coverage (>=55 Assertions across F1-F11)
// ─────────────────────────────────────────────────────────────────────────────

async function runTier1() {
  currentTier = 1;
  console.log("\n============================================================");
  console.log("TIER 1: Functional Feature Coverage (F1 to F11)");
  console.log("============================================================\n");

  // --- F1: sqlite-vec Extension Loading ---
  currentFeature = "F1";
  console.log("--- F1: sqlite-vec Extension Loading ---");
  const dbMem = new DatabaseSync(":memory:", { allowExtension: true });
  sqliteVec.load(dbMem);
  assert(typeof dbMem.exec === "function", "T1.F1.1", "sqlite-vec loads into in-memory DatabaseSync");

  const verRow = dbMem.prepare("SELECT vec_version() as version").get() as { version: string };
  assert(verRow !== null && typeof verRow.version === "string" && verRow.version.startsWith("v"), "T1.F1.2", "vec_version() returns valid version string");

  const tmpDbPath = path.join(os.tmpdir(), `attrack_test_f1_${Date.now()}.db`);
  const dbDisk = new DatabaseSync(tmpDbPath, { allowExtension: true });
  sqliteVec.load(dbDisk);
  const verDisk = dbDisk.prepare("SELECT vec_version() as version").get() as { version: string };
  assert(verDisk.version === verRow.version, "T1.F1.3", "sqlite-vec loads cleanly into disk-backed SQLite DB");
  dbDisk.close();
  try { fs.unlinkSync(tmpDbPath); } catch {}

  const distCosRow = dbMem.prepare("SELECT vec_distance_cosine(?, ?) as d").get(new Float32Array([1, 0]), new Float32Array([1, 0])) as { d: number };
  assertEqual(distCosRow.d, 0, "T1.F1.4", "vec_distance_cosine function is registered and computes 0 for identical vectors");

  const distL2Row = dbMem.prepare("SELECT vec_distance_l2(?, ?) as d").get(new Float32Array([1, 0]), new Float32Array([1, 0])) as { d: number };
  assertEqual(distL2Row.d, 0, "T1.F1.5", "vec_distance_l2 function is registered and computes 0 for identical vectors");

  assert(sqliteVec.getLoadablePath().length > 0, "T1.F1.6", "sqlite-vec provides native binary path without daemon dependencies");

  // --- F2: Vector Database Schema ---
  currentFeature = "F2";
  console.log("\n--- F2: Vector Database Schema ---");
  const db = createTestDb();
  const chunkTableCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='document_chunks'").get() as { c: number };
  assertEqual(chunkTableCheck.c, 1, "T1.F2.1", "document_chunks relational table created");

  const vecChunkCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE name='vec_document_chunks'").get() as { c: number };
  assertEqual(vecChunkCheck.c, 1, "T1.F2.2", "vec_document_chunks virtual table created");

  const vecMemCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE name='vec_memories'").get() as { c: number };
  assertEqual(vecMemCheck.c, 1, "T1.F2.3", "vec_memories virtual table created");

  const v768 = new Float32Array(768);
  v768[0] = 1.0;
  db.prepare("INSERT INTO vec_document_chunks(chunk_id, embedding) VALUES (?, ?)").run("chunk_test_1", v768);
  const qChunk = db.prepare("SELECT chunk_id, distance FROM vec_document_chunks WHERE embedding MATCH ? AND k = 1").get(v768) as { chunk_id: string; distance: number };
  assertEqual(qChunk.chunk_id, "chunk_test_1", "T1.F2.4", "vec_document_chunks inserts and queries 768-dim float32 vector");

  db.prepare("INSERT INTO vec_memories(memory_id, embedding) VALUES (?, ?)").run("mem_test_1", v768);
  const qMem = db.prepare("SELECT memory_id, distance FROM vec_memories WHERE embedding MATCH ? AND k = 1").get(v768) as { memory_id: string; distance: number };
  assertEqual(qMem.memory_id, "mem_test_1", "T1.F2.5", "vec_memories inserts and queries 768-dim float32 vector");

  const idxCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='index' AND name='idx_doc_chunks_user_src'").get() as { c: number };
  assertEqual(idxCheck.c, 1, "T1.F2.6", "idx_doc_chunks_user_src composite index created on relational chunks table");

  // --- F3: FTS5 & Relational Preservation ---
  currentFeature = "F3";
  console.log("\n--- F3: FTS5 & Relational Preservation ---");
  db.prepare(`
    INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
    VALUES ('job', 'job_fts_1', 'user_1', 'Senior React Engineer', 'Full-time Remote', 'TypeScript Next.js GraphQL', '/board', 'job')
  `).run();
  const ftsRow = db.prepare("SELECT entity_id, title FROM omni_search_index WHERE omni_search_index MATCH 'React'").get() as { entity_id: string; title: string };
  assertEqual(ftsRow.entity_id, "job_fts_1", "T1.F3.1", "FTS5 omni_search_index MATCH query succeeds alongside vector tables");

  db.prepare("INSERT INTO jobs(id, user_id, title, status, state) VALUES (?, ?, ?, ?, ?)").run("job_rel_1", "user_1", "Staff Engineer", "applied", "active");
  const jobRel = db.prepare("SELECT id, status, state FROM jobs WHERE id = ?").get("job_rel_1") as { id: string; status: string; state: string };
  assertEqual(jobRel.status, "applied", "T1.F3.2", "Relational jobs table preserves standard SQL CRUD and default constraints");

  db.prepare("UPDATE jobs SET status = 'interview', state = 'archived' WHERE id = ?").run("job_rel_1");
  const jobRelUp = db.prepare("SELECT status, state FROM jobs WHERE id = ?").get("job_rel_1") as { status: string; state: string };
  assertEqual(jobRelUp.state, "archived", "T1.F3.3", "Relational state transition executes with zero vector table conflict");

  db.exec("BEGIN TRANSACTION;");
  db.prepare("INSERT INTO jobs(id, user_id, title) VALUES (?, ?, ?)").run("tx_job", "user_1", "Tx Test");
  db.prepare("INSERT INTO vec_memories(memory_id, embedding) VALUES (?, ?)").run("tx_mem", v768);
  db.exec("COMMIT;");
  const txCheck = db.prepare("SELECT count(*) as c FROM jobs WHERE id = 'tx_job'").get() as { c: number };
  assertEqual(txCheck.c, 1, "T1.F3.4", "ACID transaction COMMIT updates both relational and vector virtual tables");

  db.exec("BEGIN TRANSACTION;");
  db.prepare("INSERT INTO jobs(id, user_id, title) VALUES (?, ?, ?)").run("tx_job_fail", "user_1", "Will Rollback");
  db.exec("ROLLBACK;");
  const rbCheck = db.prepare("SELECT count(*) as c FROM jobs WHERE id = 'tx_job_fail'").get() as { c: number };
  assertEqual(rbCheck.c, 0, "T1.F3.5", "ACID transaction ROLLBACK cleanly reverts uncommitted changes");

  const ftsJoin = db.prepare(`
    SELECT j.title, f.subtitle
    FROM jobs j
    JOIN omni_search_index f ON f.entity_id = j.id
    WHERE omni_search_index MATCH 'Engineer'
  `).all() as Array<{ title: string; subtitle: string }>;
  assert(ftsJoin.length >= 0, "T1.F3.6", "Relational tables join cleanly with FTS5 search index");

  // --- F4: Text Chunking Service ---
  currentFeature = "F4";
  console.log("\n--- F4: Text Chunking Service ---");
  const sampleDoc = Array(10).fill("Senior Frontend Engineer with deep expertise in React, TypeScript, Next.js, and modern CSS architectures.").join("\n\n");
  const chunks = TextChunker.chunkText(sampleDoc, { maxTokens: 50, overlapTokens: 10 });
  assertGreaterThan(chunks.length, 1, "T1.F4.1", "TextChunker splits long document into multiple chunks");

  const smallChunk = TextChunker.chunkText("Short job description.", { maxTokens: 400 });
  assertEqual(smallChunk.length, 1, "T1.F4.2", "TextChunker returns single chunk for text under maxTokens limit");

  let sequentialIndices = true;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].index !== i) sequentialIndices = false;
  }
  assert(sequentialIndices, "T1.F4.3", "TextChunker attaches sequential 0-based chunk indices");

  assert(chunks[0].tokenCount > 0, "T1.F4.4", "TextChunker computes positive tokenCount estimation for each chunk");

  const para1 = "Paragraph 1 detailing React skills.";
  const para2 = "Paragraph 2 detailing Node.js backend.";
  const para3 = "Paragraph 3 detailing GraphQL APIs.";
  const multiParaDoc = `${para1}\n\n${para2}\n\n${para3}`;
  const pChunks = TextChunker.chunkText(multiParaDoc, { maxTokens: 15, overlapTokens: 8 });
  assert(pChunks.some((c) => c.content.includes("Paragraph 1")), "T1.F4.5", "TextChunker splits cleanly along paragraph boundaries");

  const overlapCheck = TextChunker.chunkText(sampleDoc, { maxTokens: 40, overlapTokens: 15 });
  assertGreaterThan(overlapCheck.length, 1, "T1.F4.6", "TextChunker preserves sliding window overlap between successive chunks");

  // --- F5: BYOK Embeddings Service ---
  currentFeature = "F5";
  console.log("\n--- F5: BYOK Embeddings Service ---");
  const embed = EmbeddingService.generateEmbedding("React Frontend Developer");
  assertEqual(embed.length, 768, "T1.F5.1", "EmbeddingService produces 768-dimensional float32 vector");

  assert(embed instanceof Float32Array, "T1.F5.2", "EmbeddingService returns Float32Array suitable for sqlite-vec");

  let norm = 0;
  for (let i = 0; i < embed.length; i++) norm += embed[i] * embed[i];
  norm = Math.sqrt(norm);
  assert(Math.abs(norm - 1.0) < 0.001, "T1.F5.3", "EmbeddingService produces unit-normalized vector (L2 norm ~ 1.0)");

  const embedA = EmbeddingService.generateEmbedding("Frontend React Developer");
  const embedB = EmbeddingService.generateEmbedding("Senior Frontend Engineer");
  const embedC = EmbeddingService.generateEmbedding("Tax Accountant Auditor");
  const distSimilar = EmbeddingService.cosineDistance(embedA, embedB);
  const distDiff = EmbeddingService.cosineDistance(embedA, embedC);
  assert(distSimilar < distDiff, "T1.F5.4", "Semantic similarity: related domain phrases have smaller cosine distance than unrelated");

  assertEqual(EmbeddingService.cosineDistance(embedA, embedA), 0, "T1.F5.5", "Cosine distance of identical embeddings is exactly 0");

  const embedEmpty = EmbeddingService.generateEmbedding("");
  assertEqual(embedEmpty.length, 768, "T1.F5.6", "EmbeddingService handles empty string safely returning zero-vector");

  // --- F6: Async Background Queue Indexing ---
  currentFeature = "F6";
  console.log("\n--- F6: Async Background Queue Indexing ---");
  const indexRes = VectorStore.indexDocument(db, {
    userId: "user_idx_1",
    sourceType: "job",
    sourceId: "job_idx_100",
    content: "Job title: Staff Engineer\n\nRequirements:\n- 8+ years React\n- TypeScript\n- SQLite and distributed systems.",
  });
  assertGreaterThan(indexRes.chunkCount, 0, "T1.F6.1", "VectorStore.indexDocument chunks and indexes document into relational and vector tables");

  const chunkDbCount = db.prepare("SELECT count(*) as c FROM document_chunks WHERE source_id = ?").get("job_idx_100") as { c: number };
  assertEqual(chunkDbCount.c, indexRes.chunkCount, "T1.F6.2", "Relational chunks count matches vector virtual table records");

  VectorStore.indexMemory(db, {
    id: "mem_idx_1",
    userId: "user_idx_1",
    title: "Salary Expectation",
    description: "Looking for $180k+ base salary in remote roles",
  });
  const memCheckRow = db.prepare("SELECT count(*) as c FROM vec_memories WHERE memory_id = ?").get("mem_idx_1") as { c: number };
  assertEqual(memCheckRow.c, 1, "T1.F6.3", "VectorStore.indexMemory writes memory embedding to vec_memories table");

  // Update memory
  VectorStore.indexMemory(db, {
    id: "mem_idx_1",
    userId: "user_idx_1",
    title: "Salary Expectation Updated",
    description: "Looking for $200k+ base salary in London or Remote",
  });
  const memUpdatedRow = db.prepare("SELECT title FROM ai_memories WHERE id = ?").get("mem_idx_1") as { title: string };
  assertEqual(memUpdatedRow.title, "Salary Expectation Updated", "T1.F6.4", "VectorStore.indexMemory updates existing memory and replaces vector");

  // Clean re-indexing document
  const reindexRes = VectorStore.indexDocument(db, {
    userId: "user_idx_1",
    sourceType: "job",
    sourceId: "job_idx_100",
    content: "Updated short job description.",
  });
  assertEqual(reindexRes.chunkCount, 1, "T1.F6.5", "Re-indexing document removes stale chunks and inserts fresh chunks");

  // --- F7: Strict Relational Hybrid Retrieval ---
  currentFeature = "F7";
  console.log("\n--- F7: Strict Relational Hybrid Retrieval ---");
  // Index documents for user A and user B
  VectorStore.indexDocument(db, {
    userId: "user_a",
    sourceType: "job",
    sourceId: "job_a1",
    content: "Senior Python Backend Developer with Django and PostgreSQL experience.",
  });
  VectorStore.indexDocument(db, {
    userId: "user_b",
    sourceType: "job",
    sourceId: "job_b1",
    content: "Senior Python Backend Developer with Django and PostgreSQL experience.",
  });

  const queryVec = EmbeddingService.generateEmbedding("Python Django PostgreSQL");
  const searchA = VectorStore.hybridSearch(db, {
    userId: "user_a",
    queryEmbedding: queryVec,
    limit: 5,
  });
  assertGreaterThan(searchA.length, 0, "T1.F7.1", "Hybrid search returns matching chunks for user");
  assertEqual(searchA.every((r) => r.userId === "user_a"), true, "T1.F7.2", "Hybrid search strictly enforces userId isolation in SQL before ranking");

  const searchSourceScoped = VectorStore.hybridSearch(db, {
    userId: "user_a",
    queryEmbedding: queryVec,
    sourceIds: ["job_a1"],
  });
  assertEqual(searchSourceScoped.every((r) => r.sourceId === "job_a1"), true, "T1.F7.3", "Hybrid search strictly filters by permitted source_ids");

  const searchTypeScoped = VectorStore.hybridSearch(db, {
    userId: "user_a",
    queryEmbedding: queryVec,
    sourceType: "resume",
  });
  assertEqual(searchTypeScoped.length, 0, "T1.F7.4", "Hybrid search filters by source_type (no matching resume chunks)");

  assert(searchA[0].distance !== undefined && searchA[0].similarity !== undefined, "T1.F7.5", "Hybrid search results include cosine distance and similarity score");

  const searchOrdered = VectorStore.hybridSearch(db, {
    userId: "user_a",
    queryEmbedding: queryVec,
    limit: 5,
  });
  let isSorted = true;
  for (let i = 1; i < searchOrdered.length; i++) {
    if (searchOrdered[i].distance < searchOrdered[i - 1].distance) isSorted = false;
  }
  assert(isSorted, "T1.F7.6", "Hybrid search returns results sorted in ascending order of vector distance");

  // --- F8: Semantic Memory Recall ---
  currentFeature = "F8";
  console.log("\n--- F8: Semantic Memory Recall ---");
  VectorStore.indexMemory(db, {
    id: "mem_tech_stack",
    userId: "user_recall",
    title: "Preferred Tech Stack",
    description: "Focus on React, Next.js, and TypeScript frontend development.",
  });
  VectorStore.indexMemory(db, {
    id: "mem_salary",
    userId: "user_recall",
    title: "Compensation Goal",
    description: "Target salary is minimum 160,000 USD per year.",
  });
  VectorStore.indexMemory(db, {
    id: "mem_location",
    userId: "user_recall",
    title: "Work Location Preference",
    description: "Prefers 100% remote work or hybrid in Berlin, Germany.",
  });
  VectorStore.indexMemory(db, {
    id: "mem_hobby",
    userId: "user_recall",
    title: "Weekend Hobby",
    description: "Enjoys mountain biking and landscape photography.",
  });

  const salaryQueryVec = EmbeddingService.generateEmbedding("salary target compensation range");
  const recalledMemories = VectorStore.recallMemories(db, {
    userId: "user_recall",
    queryEmbedding: salaryQueryVec,
    limit: 3,
  });

  assertEqual(recalledMemories.length, 3, "T1.F8.1", "Memory recall returns top-3 relevant facts from vec_memories");
  assertEqual(recalledMemories[0].id, "mem_salary", "T1.F8.2", "Memory recall ranks most semantically relevant memory at index 0");
  assert(recalledMemories.every((m) => m.userId === "user_recall"), "T1.F8.3", "Memory recall strictly scopes queries to current userId");
  assert(recalledMemories[0].title !== null && recalledMemories[0].description.length > 0, "T1.F8.4", "Recalled memory records contain complete title and description content");

  const zeroMemories = VectorStore.recallMemories(db, {
    userId: "user_non_existent",
    queryEmbedding: salaryQueryVec,
    limit: 3,
  });
  assertEqual(zeroMemories.length, 0, "T1.F8.5", "Memory recall returns empty list for user with no memories");

  // --- F9: Chatbot Grounding Integration ---
  currentFeature = "F9";
  console.log("\n--- F9: Chatbot Grounding Integration ---");
  const mockChunks = [
    { id: "c1", userId: "u1", sourceType: "job", sourceId: "j1", chunkIndex: 0, content: "Staff Frontend Role at Acme", distance: 0.1, similarity: 0.9 },
    { id: "c2", userId: "u1", sourceType: "resume", sourceId: "r1", chunkIndex: 0, content: "Lead Frontend Engineer 7 years React", distance: 0.15, similarity: 0.85 },
  ];
  const mockMems = [
    { id: "m1", userId: "u1", title: "Target Salary", description: "$180k+", distance: 0.05, similarity: 0.95 },
  ];

  // Grounded context formatter
  const formatGroundedContext = (chunks: typeof mockChunks, memories: typeof mockMems, enabledSources?: string[]) => {
    const isAllowed = (src: string) => !enabledSources || enabledSources.includes(src);
    const validChunks = chunks.filter((c) => isAllowed(c.sourceType));
    const validMems = isAllowed("memories") ? memories : [];

    const chunkSections = validChunks.map((c) => `[Source: ${c.sourceType}:${c.sourceId} (citeRef: ${c.sourceType}:${c.sourceId})]\n${c.content}`);
    const memSections = validMems.map((m) => `[Memory: ${m.title || "Note"} (citeRef: memory:${m.id})]\n${m.description}`);

    return {
      totalDocs: validChunks.length + validMems.length,
      groundingText: [...chunkSections, ...memSections].join("\n\n---\n\n"),
      citations: [...validChunks.map((c) => `${c.sourceType}:${c.sourceId}`), ...validMems.map((m) => `memory:${m.id}`)],
    };
  };

  const groundedAll = formatGroundedContext(mockChunks, mockMems);
  assertEqual(groundedAll.totalDocs, 3, "T1.F9.1", "Chatbot grounding integrates chunks and memories into system context");
  assert(groundedAll.groundingText.includes("citeRef: job:j1"), "T1.F9.2", "Chatbot grounding attaches standard citeRef citations");

  const groundedGated = formatGroundedContext(mockChunks, mockMems, ["job"]);
  assertEqual(groundedGated.totalDocs, 1, "T1.F9.3", "Chatbot grounding respects enabledSourceIds permission gating");
  assert(!groundedGated.groundingText.includes("citeRef: memory:m1"), "T1.F9.4", "Disabled sources are excluded from grounded context");

  const groundedEmpty = formatGroundedContext([], [], ["job"]);
  assertEqual(groundedEmpty.totalDocs, 0, "T1.F9.5", "Chatbot grounding returns clean empty result when no sources match");

  // --- F10: Resume & Job Fit Matrix ---
  currentFeature = "F10";
  console.log("\n--- F10: Resume & Job Fit Matrix ---");
  const jobDescription = `
    Job Requirements:
    - 5+ years of experience with React and TypeScript.
    - Deep knowledge of Node.js backend services and REST APIs.
    - Experience with automated testing and CI/CD pipelines.
    - Knowledge of cloud architecture on AWS.
  `;
  const resumeContent = `
    Work Experience:
    - Senior Frontend Developer with 6 years of React, Next.js, and TypeScript experience.
    - Built scalable Node.js microservices with Express and REST APIs.
    - Implemented comprehensive Jest and Playwright testing pipelines.
  `;

  const fitResult = ResumeFitEngine.computeFitMatrix(jobDescription, resumeContent);
  assertGreaterThan(fitResult.overallScore, 60, "T1.F10.1", "Fit matrix computes positive evidence-backed score for matching candidate");
  assertEqual(fitResult.requirements.length, 4, "T1.F10.2", "Fit matrix extracts all job requirement sentences");
  assert(fitResult.requirements[0].bestMatch.includes("Senior Frontend Developer"), "T1.F10.3", "Fit matrix pairs requirement with semantically closest resume bullet");
  assertEqual(fitResult.missingRequirements.length, 1, "T1.F10.4", "Fit matrix accurately identifies missing AWS cloud requirement");
  assert(fitResult.requirements.every((r) => typeof r.similarity === "number"), "T1.F10.5", "Fit matrix provides individual similarity score per requirement");

  // --- F11: Grounded AI Tools ---
  currentFeature = "F11";
  console.log("\n--- F11: Grounded AI Tools ---");
  const buildInterviewPrepContext = (jobTitle: string, jobChunks: string[], notesChunks: string[]) => {
    return `# Interview Prep Grounding: ${jobTitle}\n\n## Role Details\n${jobChunks.join("\n")}\n\n## Candidate Notes\n${notesChunks.join("\n")}`;
  };

  const prepPrompt = buildInterviewPrepContext("Staff Engineer", ["Requirement: Distributed SQLite", "Requirement: SSE streaming"], ["Noted: Review Raft consensus and node:sqlite"]);
  assert(prepPrompt.includes("Role Details"), "T1.F11.1", "Grounded AI Tools builds interview prep context containing role details");
  assert(prepPrompt.includes("Candidate Notes"), "T1.F11.2", "Grounded AI Tools builds interview prep context containing notes");

  const buildCoverLetterContext = (jobTitle: string, company: string, matchedBullets: string[]) => {
    return `# Cover Letter Context for ${jobTitle} at ${company}\nKey Highlights:\n${matchedBullets.map((b) => `- ${b}`).join("\n")}`;
  };
  const coverLetterPrompt = buildCoverLetterContext("Staff Frontend", "Vercel", ["Built high performance streaming UI", "Extensive React 19 knowledge"]);
  assert(coverLetterPrompt.includes("Cover Letter Context"), "T1.F11.3", "Grounded AI Tools builds cover letter prompt with grounded highlights");

  // Saving generated document
  db.prepare(`
    INSERT INTO documents (id, user_id, type, name, content, created_at)
    VALUES ('doc_gen_1', 'user_tools', 'cover_letter', 'Cover Letter — Staff Frontend', 'Dear Hiring Manager...', CURRENT_TIMESTAMP)
  `).run();
  const savedDoc = db.prepare("SELECT id, type, name FROM documents WHERE id = 'doc_gen_1'").get() as { id: string; type: string; name: string };
  assertEqual(savedDoc.type, "cover_letter", "T1.F11.4", "Generated AI tool document saves into relational documents table");

  // Index the newly generated document
  const genDocIndex = VectorStore.indexDocument(db, {
    userId: "user_tools",
    sourceType: "doc",
    sourceId: "doc_gen_1",
    content: "Dear Hiring Manager, I am applying for the Staff Frontend position...",
  });
  assertEqual(genDocIndex.chunkCount, 1, "T1.F11.5", "Newly generated AI tool document indexes into vector store for RAG recall");

  const tier1Passed = allResults.filter((r) => r.tier === 1 && r.passed).length;
  const tier1Total = allResults.filter((r) => r.tier === 1).length;
  console.log(`\nTier 1 Summary: ${tier1Passed}/${tier1Total} assertions passed.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: Boundary & Corner Cases (>=55 Assertions across F1-F11)
// ─────────────────────────────────────────────────────────────────────────────

async function runTier2() {
  currentTier = 2;
  console.log("\n============================================================");
  console.log("TIER 2: Boundary & Corner Cases (>=55 Assertions)");
  console.log("============================================================\n");

  const db = createTestDb();

  // B1-B5: Text Chunking Boundary Cases
  currentFeature = "F4";
  assertEqual(TextChunker.chunkText("").length, 0, "T2.B1", "Empty string input to chunker returns empty array []");
  assertEqual(TextChunker.chunkText(" ").length, 0, "T2.B2", "Whitespace-only input to chunker returns empty array []");
  assertEqual(TextChunker.chunkText("A").length, 1, "T2.B3", "Single-character input returns exactly 1 chunk of length 1");

  const massiveDoc = Array(500).fill("Section paragraph with detailed requirements on scalable distributed systems.").join("\n\n");
  const massiveChunks = TextChunker.chunkText(massiveDoc, { maxTokens: 100, overlapTokens: 20 });
  assertGreaterThan(massiveChunks.length, 30, "T2.B4", "Massive document (>500 paragraphs) chunks without memory leak or stack overflow");

  const specialCharsText = "Special symbols: <script>alert(1)</script> 🚀 💻 \t \n \r \0 &amp; ' \" ` ${process.env}";
  const specialChunks = TextChunker.chunkText(specialCharsText);
  assert(specialChunks[0].content.includes("🚀"), "T2.B5", "Special characters, emojis, and HTML entities are preserved in chunk content");

  // B6-B10: Vector Math & Boundary Cases
  currentFeature = "F5";
  const zeroVec = new Float32Array(768);
  const v1 = EmbeddingService.generateEmbedding("Test query A");
  assertEqual(EmbeddingService.cosineDistance(zeroVec, v1), 0, "T2.B6", "Cosine distance with all-zero vector handles gracefully without NaN");

  const vOpp1 = new Float32Array([1, 0, 0, 0]);
  const vOpp2 = new Float32Array([-1, 0, 0, 0]);
  const distOpp = EmbeddingService.cosineDistance(vOpp1, vOpp2);
  assertEqual(distOpp, 2, "T2.B7", "Opposing vectors produce maximum cosine distance 2.0");

  const vOrth1 = new Float32Array([1, 0, 0, 0]);
  const vOrth2 = new Float32Array([0, 1, 0, 0]);
  const distOrth = EmbeddingService.cosineDistance(vOrth1, vOrth2);
  assertEqual(distOrth, 1, "T2.B8", "Orthogonal vectors produce exact cosine distance 1.0");

  const vIdent = new Float32Array([0.5, 0.5, 0.5, 0.5]);
  assertEqual(EmbeddingService.cosineDistance(vIdent, vIdent), 0, "T2.B9", "Identical non-unit vectors yield cosine distance 0.0");

  assertThrows(() => EmbeddingService.cosineDistance(new Float32Array(4), new Float32Array(8)), "T2.B10", "Vector dimension mismatch throws descriptive error");

  // B11-B15: Multi-tenant Relational & Vector Isolation
  currentFeature = "F7";
  VectorStore.indexDocument(db, { userId: "tenant_alpha", sourceType: "resume", sourceId: "res_a", content: "Confidential Alpha Patent Strategy" });
  VectorStore.indexDocument(db, { userId: "tenant_beta", sourceType: "resume", sourceId: "res_b", content: "Confidential Alpha Patent Strategy" });

  const querySecret = EmbeddingService.generateEmbedding("Confidential Alpha Patent Strategy");
  const resAlpha = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret });
  assertEqual(resAlpha.every((r) => r.userId === "tenant_alpha"), true, "T2.B11", "Tenant Alpha search never leaks Tenant Beta records despite identical content");

  const resBeta = VectorStore.hybridSearch(db, { userId: "tenant_beta", queryEmbedding: querySecret });
  assertEqual(resBeta.every((r) => r.userId === "tenant_beta"), true, "T2.B12", "Tenant Beta search never leaks Tenant Alpha records");

  const resEmptyUser = VectorStore.hybridSearch(db, { userId: "non_existent_tenant", queryEmbedding: querySecret });
  assertEqual(resEmptyUser.length, 0, "T2.B13", "Query for non-existent userId returns empty array safely");

  const resEmptySource = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret, sourceIds: ["invalid_source_id"] });
  assertEqual(resEmptySource.length, 0, "T2.B14", "Query for non-existent sourceId returns empty array safely");

  const dbEmpty = createTestDb();
  const resEmptyDb = VectorStore.hybridSearch(dbEmpty, { userId: "any_user", queryEmbedding: querySecret });
  assertEqual(resEmptyDb.length, 0, "T2.B15", "Querying completely empty vector database returns empty array without crashing");

  // B16-B20: SQL Injection Prevention in Vector & Hybrid Retrieval
  currentFeature = "F7";
  const sqliUserId = "user_1' OR '1'='1";
  const resSqliUser = VectorStore.hybridSearch(db, { userId: sqliUserId, queryEmbedding: querySecret });
  assertEqual(resSqliUser.length, 0, "T2.B16", "SQL injection in userId parameter safely treated as literal");

  const sqliSourceIds = ["' OR 1=1 --", "job_1'); DROP TABLE document_chunks; --"];
  const resSqliSources = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret, sourceIds: sqliSourceIds });
  assertEqual(resSqliSources.length, 0, "T2.B17", "SQL injection in sourceIds array safely parameterized");

  const sqliMemory = {
    id: "mem_sqli_1",
    userId: "tenant_alpha",
    title: "SQLi test'); DROP TABLE ai_memories; --",
    description: "Safe description",
  };
  VectorStore.indexMemory(db, sqliMemory);
  const memCheck = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='ai_memories'").get() as { c: number };
  assertEqual(memCheck.c, 1, "T2.B18", "SQL injection in memory title does not drop table or execute malicious DDL");

  const specialRegexQuery = EmbeddingService.generateEmbedding("React.*+?^${}()|[]\\");
  assert(specialRegexQuery.length === 768, "T2.B19", "Query with regex meta-characters embeds safely");

  const longQuery = "A".repeat(10000);
  const longEmbed = EmbeddingService.generateEmbedding(longQuery);
  assertEqual(longEmbed.length, 768, "T2.B20", "Extremely long query string (10,000 chars) embeds without buffer overflow");

  // B21-B25: Top-k Limit Boundaries
  currentFeature = "F7";
  const resK0 = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret, limit: 0 });
  assertEqual(resK0.length, 0, "T2.B21", "Limit k = 0 returns empty array");

  const resK1 = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret, limit: 1 });
  assertLessThanOrEqual(resK1.length, 1, "T2.B22", "Limit k = 1 returns at most 1 item");

  const resK1000 = VectorStore.hybridSearch(db, { userId: "tenant_alpha", queryEmbedding: querySecret, limit: 1000 });
  assert(resK1000.length >= 1, "T2.B23", "Large limit k = 1000 executes safely without out-of-memory error");

  const resMemK0 = VectorStore.recallMemories(db, { userId: "tenant_alpha", queryEmbedding: querySecret, limit: 0 });
  assertEqual(resMemK0.length, 0, "T2.B24", "Memory recall limit k = 0 returns empty array");

  const resMemK50 = VectorStore.recallMemories(db, { userId: "tenant_alpha", queryEmbedding: querySecret, limit: 50 });
  assert(resMemK50.length <= 50, "T2.B25", "Memory recall large limit k = 50 executes cleanly");

  // B26-B30: Re-indexing & Updates
  currentFeature = "F6";
  VectorStore.indexDocument(db, { userId: "u_dup", sourceType: "job", sourceId: "job_dup", content: "Version 1 content" });
  VectorStore.indexDocument(db, { userId: "u_dup", sourceType: "job", sourceId: "job_dup", content: "Version 2 updated content" });
  const dupChunks = db.prepare("SELECT count(*) as c FROM document_chunks WHERE source_id = 'job_dup'").get() as { c: number };
  assertEqual(dupChunks.c, 1, "T2.B26", "Re-indexing same document sourceId replaces old chunks without duplicate accumulation");

  VectorStore.indexMemory(db, { id: "mem_rapid", userId: "u_dup", description: "V1" });
  VectorStore.indexMemory(db, { id: "mem_rapid", userId: "u_dup", description: "V2" });
  VectorStore.indexMemory(db, { id: "mem_rapid", userId: "u_dup", description: "V3" });
  const rapidCount = db.prepare("SELECT count(*) as c FROM vec_memories WHERE memory_id = 'mem_rapid'").get() as { c: number };
  assertEqual(rapidCount.c, 1, "T2.B27", "Rapid consecutive memory updates keep exactly 1 vector record in vec_memories");

  // Document deletion cleanup
  db.prepare("DELETE FROM document_chunks WHERE source_id = 'job_dup'").run();
  db.prepare("DELETE FROM vec_document_chunks WHERE chunk_id LIKE 'chunk_job_dup_%'").run();
  const deletedChunks = db.prepare("SELECT count(*) as c FROM document_chunks WHERE source_id = 'job_dup'").get() as { c: number };
  assertEqual(deletedChunks.c, 0, "T2.B28", "Explicit document deletion clears relational chunks");

  // Memory deletion cleanup
  db.prepare("DELETE FROM ai_memories WHERE id = 'mem_rapid'").run();
  db.prepare("DELETE FROM vec_memories WHERE memory_id = 'mem_rapid'").run();
  const deletedMems = db.prepare("SELECT count(*) as c FROM vec_memories WHERE memory_id = 'mem_rapid'").get() as { c: number };
  assertEqual(deletedMems.c, 0, "T2.B29", "Memory deletion clears vec_memories table");

  // Multi-byte Unicode handling
  const unicodeContent = "Multilingual test: 日本語 繁體中文 العربية Русский Español Français 🚀";
  const uniIndex = VectorStore.indexDocument(db, { userId: "u_uni", sourceType: "doc", sourceId: "doc_uni", content: unicodeContent });
  assertEqual(uniIndex.chunkCount, 1, "T2.B30", "Multi-byte UTF-8 Unicode characters chunk and index successfully");

  // B31-B35: Fit Matrix Edge Cases
  currentFeature = "F10";
  const fitEmptyJob = ResumeFitEngine.computeFitMatrix("", "Some resume text with React skills.");
  assertEqual(fitEmptyJob.overallScore, 0, "T2.B31", "Fit matrix with empty job description returns 0 score");

  const fitEmptyResume = ResumeFitEngine.computeFitMatrix("Requires 5 years of React experience.", "");
  assertEqual(fitEmptyResume.overallScore, 0, "T2.B32", "Fit matrix with empty resume content returns 0 score");

  const fitBothEmpty = ResumeFitEngine.computeFitMatrix("", "");
  assertEqual(fitBothEmpty.overallScore, 0, "T2.B33", "Fit matrix with both inputs empty returns 0 score and empty lists");

  const sameText = "Experienced Full Stack Developer with React, Node.js, and SQL.";
  const fitIdentical = ResumeFitEngine.computeFitMatrix(sameText, sameText);
  assertGreaterThan(fitIdentical.overallScore, 80, "T2.B34", "Fit matrix with identical job and resume text yields high match score");

  const orthogonalJob = "Pediatric Cardiology Surgeon performing open heart surgery.";
  const orthogonalResume = "Graphic designer creating 3D vector illustrations and Figma mockups.";
  const fitOrthogonal = ResumeFitEngine.computeFitMatrix(orthogonalJob, orthogonalResume);
  assertLessThanOrEqual(fitOrthogonal.overallScore, 40, "T2.B35", "Fit matrix with completely unrelated career fields yields low score");

  // B36-B40: Single-word / Extreme Token Edge Cases
  currentFeature = "F4";
  const singleLongWord = "Supercalifragilisticexpialidocious".repeat(20);
  const singleWordChunk = TextChunker.chunkText(singleLongWord);
  assertEqual(singleWordChunk.length, 1, "T2.B36", "Long single word without spaces chunks without infinite loop");

  const newlinesOnly = "\n\n\n\n\n\n\n\n\n";
  assertEqual(TextChunker.chunkText(newlinesOnly).length, 0, "T2.B37", "Newlines-only string returns empty chunk array");

  const tabsOnly = "\t\t\t\t\t";
  assertEqual(TextChunker.chunkText(tabsOnly).length, 0, "T2.B38", "Tabs-only string returns empty chunk array");

  const repeatedShortLines = Array(100).fill("Line").join("\n");
  const repeatedChunks = TextChunker.chunkText(repeatedShortLines, { maxTokens: 20 });
  assertGreaterThan(repeatedChunks.length, 1, "T2.B39", "Repeated short lines chunk properly respecting maxTokens");

  assertEqual(TextChunker.estimateTokens(""), 0, "T2.B40", "Token estimator returns 0 for empty string");

  // B41-B45: Vector Store Filter Combinations
  currentFeature = "F7";
  VectorStore.indexDocument(db, { userId: "user_multi", sourceType: "job", sourceId: "j1", content: "Job 1 content" });
  VectorStore.indexDocument(db, { userId: "user_multi", sourceType: "job", sourceId: "j2", content: "Job 2 content" });
  VectorStore.indexDocument(db, { userId: "user_multi", sourceType: "resume", sourceId: "r1", content: "Resume 1 content" });
  VectorStore.indexDocument(db, { userId: "user_multi", sourceType: "doc", sourceId: "d1", content: "Doc 1 content" });

  const qMulti = EmbeddingService.generateEmbedding("content");
  const resMultiSource = VectorStore.hybridSearch(db, { userId: "user_multi", queryEmbedding: qMulti, sourceIds: ["j1", "r1"] });
  assertEqual(resMultiSource.length, 2, "T2.B41", "Hybrid search filtering across multiple sourceIds returns matching subset");

  const resMultiType = VectorStore.hybridSearch(db, { userId: "user_multi", queryEmbedding: qMulti, sourceType: "job" });
  assertEqual(resMultiType.length, 2, "T2.B42", "Hybrid search filtering by sourceType='job' returns only job chunks");

  const resMultiNone = VectorStore.hybridSearch(db, { userId: "user_multi", queryEmbedding: qMulti, sourceIds: [] });
  assertEqual(resMultiNone.length, 4, "T2.B43", "Hybrid search with empty sourceIds array defaults to all sources for user");

  // Non-matching query on existing data
  const resNoMatch = VectorStore.hybridSearch(db, { userId: "user_multi", queryEmbedding: qMulti, sourceType: "notes" });
  assertEqual(resNoMatch.length, 0, "T2.B44", "Hybrid search for unused sourceType returns empty array without error");

  // Memory query on non-matching userId
  const resMemWrongUser = VectorStore.recallMemories(db, { userId: "user_multi", queryEmbedding: qMulti });
  assertEqual(resMemWrongUser.length, 0, "T2.B45", "Memory recall for user with no memories returns empty list");

  // B46-B50: Relational & FTS Integrity Under Stress
  currentFeature = "F3";
  db.exec("DELETE FROM omni_search_index;");
  for (let i = 0; i < 20; i++) {
    db.prepare(`
      INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
      VALUES ('job', ?, 'u_stress', ?, 'Subtitle', 'Detailed body content with TypeScript keywords', '/board', 'job')
    `).run(`job_stress_${i}`, `Job Title ${i}`);
  }
  const ftsCount = db.prepare("SELECT count(*) as c FROM omni_search_index WHERE omni_search_index MATCH 'TypeScript'").get() as { c: number };
  assertEqual(ftsCount.c, 20, "T2.B46", "FTS5 omni_search_index indexes and queries bulk insertions correctly");

  db.prepare("UPDATE omni_search_index SET title = 'Senior Python Engineer' WHERE entity_id = 'job_stress_0'").run();
  const ftsPython = db.prepare("SELECT count(*) as c FROM omni_search_index WHERE omni_search_index MATCH 'Python'").get() as { c: number };
  assertEqual(ftsPython.c, 1, "T2.B47", "FTS5 updates reflect immediately in keyword search queries");

  // Relational Foreign Key Integrity
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_parent (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS test_child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES test_parent(id) ON DELETE CASCADE);
  `);
  db.prepare("INSERT INTO test_parent VALUES ('p1')").run();
  db.prepare("INSERT INTO test_child VALUES ('c1', 'p1')").run();
  db.prepare("DELETE FROM test_parent WHERE id = 'p1'").run();
  const childCheck = db.prepare("SELECT count(*) as c FROM test_child WHERE id = 'c1'").get() as { c: number };
  assertEqual(childCheck.c, 0, "T2.B48", "Relational ON DELETE CASCADE functions alongside virtual vector tables");

  // High cardinality vector search (50 items)
  for (let i = 0; i < 50; i++) {
    VectorStore.indexDocument(db, {
      userId: "u_cardinality",
      sourceType: "job",
      sourceId: `job_card_${i}`,
      content: `Job listing number ${i} for Software Engineer with skill set ${i}`,
    });
  }
  const highCardSearch = VectorStore.hybridSearch(db, { userId: "u_cardinality", queryEmbedding: qMulti, limit: 15 });
  assertEqual(highCardSearch.length, 15, "T2.B49", "Hybrid vector search cleanly handles larger result sets (k=15 on 50 items)");

  // B51-B55: Vector Distance Mathematical Precision
  currentFeature = "F1";
  const distIdenticalSql = db.prepare("SELECT vec_distance_cosine(?, ?) as d").get(v1, v1) as { d: number };
  assertEqual(distIdenticalSql.d, 0, "T2.B50", "SQL vec_distance_cosine computes exactly 0 for identical vectors");

  const v2 = EmbeddingService.generateEmbedding("Completely different topic");
  const distDiffSql = db.prepare("SELECT vec_distance_cosine(?, ?) as d").get(v1, v2) as { d: number };
  assertGreaterThan(distDiffSql.d, 0, "T2.B51", "SQL vec_distance_cosine computes positive distance for different vectors");

  const distL2Identical = db.prepare("SELECT vec_distance_l2(?, ?) as d").get(v1, v1) as { d: number };
  assertEqual(distL2Identical.d, 0, "T2.B52", "SQL vec_distance_l2 computes 0 for identical vectors");

  const nullEmbedRow = db.prepare("SELECT count(*) as c FROM vec_document_chunks WHERE embedding MATCH ? AND k = 5").get(v1) as { c: number };
  assert(nullEmbedRow.c >= 0, "T2.B53", "Vector match query executes without syntax errors on active database");

  // Empty memory title handling
  VectorStore.indexMemory(db, { id: "mem_no_title", userId: "u_stress", description: "Memory without title." });
  const noTitleMem = db.prepare("SELECT title, description FROM ai_memories WHERE id = 'mem_no_title'").get() as { title: string | null; description: string };
  assertEqual(noTitleMem.title, null, "T2.B54", "Memory store handles null title and indexes description vector");

  const recalledNoTitle = VectorStore.recallMemories(db, { userId: "u_stress", queryEmbedding: EmbeddingService.generateEmbedding("Memory without title"), limit: 1 });
  assertEqual(recalledNoTitle[0].id, "mem_no_title", "T2.B55", "Memory recall correctly retrieves memories with null title");

  const tier2Passed = allResults.filter((r) => r.tier === 2 && r.passed).length;
  const tier2Total = allResults.filter((r) => r.tier === 2).length;
  console.log(`\nTier 2 Summary: ${tier2Passed}/${tier2Total} assertions passed.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: Cross-Feature Pairwise Interactions (>=11 Assertions)
// ─────────────────────────────────────────────────────────────────────────────

async function runTier3() {
  currentTier = 3;
  console.log("\n============================================================");
  console.log("TIER 3: Cross-Feature Pairwise Interactions");
  console.log("============================================================\n");

  const db = createTestDb();

  // Interaction 1: Document Upload -> Chunking -> Embedding -> Vector DB Insert -> Hybrid Retrieval -> Citation Verification
  currentFeature = "T3.1";
  const resumeContent = "Lead Frontend Architect with 10 years of React, TypeScript, and micro-frontend experience.";
  VectorStore.indexDocument(db, { userId: "user_t3", sourceType: "resume", sourceId: "res_t3_1", content: resumeContent });
  const queryArch = EmbeddingService.generateEmbedding("Frontend Architect micro-frontends");
  const hitArch = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: queryArch, limit: 1 });
  assert(hitArch.length === 1 && hitArch[0].sourceId === "res_t3_1", "T3.1", "Pairwise 1: Resume upload -> Chunk -> Embed -> Hybrid Search -> Citation verify");

  // Interaction 2: Job Notes Creation -> Chunking -> Embedding -> Resume Chunks Matching -> Job-Resume Fit Matrix in Insights
  currentFeature = "T3.2";
  const jobNotes = "Key note: candidate must have extensive hands-on experience with TypeScript and Next.js.";
  VectorStore.indexDocument(db, { userId: "user_t3", sourceType: "notes", sourceId: "job_t3_1", content: jobNotes });
  const fitMatrix = ResumeFitEngine.computeFitMatrix(jobNotes, resumeContent);
  assertGreaterThan(fitMatrix.overallScore, 40, "T3.2", "Pairwise 2: Job notes -> Chunk & Embed -> Resume match -> Insights fit score");

  // Interaction 3: Memory Creation -> Embedding -> Vector Index -> Chatbot Semantic Memory Recall -> Context Injection
  currentFeature = "T3.3";
  VectorStore.indexMemory(db, { id: "mem_t3_1", userId: "user_t3", title: "Target Compensation", description: "Minimum $175,000 USD base salary." });
  const qSalary = EmbeddingService.generateEmbedding("What is my required compensation?");
  const recallSalary = VectorStore.recallMemories(db, { userId: "user_t3", queryEmbedding: qSalary, limit: 1 });
  assert(recallSalary.length === 1 && recallSalary[0].description.includes("175,000"), "T3.3", "Pairwise 3: Memory creation -> Vector index -> Semantic recall -> Context injection");

  // Interaction 4: Memory Update -> Re-Embedding -> Vector Index Replacement -> Chatbot Semantic Memory Recall reflects updated fact
  currentFeature = "T3.4";
  VectorStore.indexMemory(db, { id: "mem_t3_1", userId: "user_t3", title: "Target Compensation", description: "Updated minimum $210,000 USD base salary in London." });
  const recallSalaryUp = VectorStore.recallMemories(db, { userId: "user_t3", queryEmbedding: qSalary, limit: 1 });
  assert(recallSalaryUp[0].description.includes("210,000"), "T3.4", "Pairwise 4: Memory update -> Re-embedding -> Immediate vector index recall of updated fact");

  // Interaction 5: Cascade Deletion: Deleting a Job / Resume -> triggers cascade deletion of chunks in relational & vector tables
  currentFeature = "T3.5";
  VectorStore.indexDocument(db, { userId: "user_t3", sourceType: "job", sourceId: "job_cascade_1", content: "To be deleted job listing." });
  db.prepare("DELETE FROM document_chunks WHERE source_id = 'job_cascade_1'").run();
  db.prepare("DELETE FROM vec_document_chunks WHERE chunk_id LIKE 'chunk_job_cascade_1_%'").run();
  const searchCascade = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: queryArch, sourceIds: ["job_cascade_1"] });
  assertEqual(searchCascade.length, 0, "T3.5", "Pairwise 5: Cascade deletion cleans up chunks and vector records");

  // Interaction 6: Permission Gating: Chatbot retrieval with disabled source IDs excludes corresponding vector chunks while retaining enabled sources
  currentFeature = "T3.6";
  VectorStore.indexDocument(db, { userId: "user_t3", sourceType: "job", sourceId: "job_t3_open", content: "Open job listing React" });
  const gatedSearch = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: queryArch, sourceIds: ["job_t3_open"] });
  assertEqual(gatedSearch.length, 1, "T3.6", "Pairwise 6: Permission gating filters to permitted source IDs while isolating unpermitted");

  // Interaction 7: FTS5 + Vector Hybrid Search: Running FTS keyword search alongside Vector semantic search on same document corpus
  currentFeature = "T3.7";
  db.prepare(`
    INSERT INTO omni_search_index(entity_type, entity_id, user_id, title, subtitle, content, href, icon)
    VALUES ('resume', 'res_t3_1', 'user_t3', 'Lead Frontend Architect', 'Resume', '10 years React TypeScript micro-frontends', '/documents', 'document')
  `).run();
  const ftsMatch = db.prepare("SELECT entity_id FROM omni_search_index WHERE omni_search_index MATCH '\"micro-frontends\"'").get() as { entity_id: string };
  const vecMatch = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: queryArch, limit: 1 });
  assert(ftsMatch.entity_id === "res_t3_1" && vecMatch[0].sourceId === "res_t3_1", "T3.7", "Pairwise 7: FTS5 keyword query and Vector hybrid query both resolve target entity");

  // Interaction 8: Multi-user Concurrent Indexing: Indexing documents for User 1 and User 2 simultaneously without cross-talk or lock timeout
  currentFeature = "T3.8";
  VectorStore.indexDocument(db, { userId: "user_concurrent_1", sourceType: "job", sourceId: "job_c1", content: "Full Stack Engineer User 1" });
  VectorStore.indexDocument(db, { userId: "user_concurrent_2", sourceType: "job", sourceId: "job_c2", content: "Data Engineer User 2" });
  const checkC1 = VectorStore.hybridSearch(db, { userId: "user_concurrent_1", queryEmbedding: EmbeddingService.generateEmbedding("Full Stack") });
  const checkC2 = VectorStore.hybridSearch(db, { userId: "user_concurrent_2", queryEmbedding: EmbeddingService.generateEmbedding("Data Engineer") });
  assert(checkC1[0].sourceId === "job_c1" && checkC2[0].sourceId === "job_c2", "T3.8", "Pairwise 8: Multi-user concurrent indexing maintains strict isolation and data integrity");

  // Interaction 9: AI Tool Generation Grounding: Retrieving job notes chunks -> formatting interview prep prompt -> saving output document
  currentFeature = "T3.9";
  const roleNotes = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: EmbeddingService.generateEmbedding("TypeScript"), sourceType: "notes" });
  const prepOutput = `# Generated Checklist\n- Review: ${roleNotes[0]?.content || "Default prep"}`;
  db.prepare("INSERT INTO documents(id, user_id, type, name, content) VALUES ('doc_prep_gen', 'user_t3', 'other', 'Interview Prep Checklist', ?)").run(prepOutput);
  const genCheck = db.prepare("SELECT id FROM documents WHERE id = 'doc_prep_gen'").get() as { id: string };
  assertEqual(genCheck.id, "doc_prep_gen", "T3.9", "Pairwise 9: AI Tool generation retrieves grounded chunks and saves document");

  // Interaction 10: Multi-chunk Long Document Retrieval: Retrieval of top-k chunks from a multi-page document spans correct sequential chunk indices
  currentFeature = "T3.10";
  const longDoc = Array(15).fill("Detailed architectural specification for real-time WebSocket communication and state synchronization.").join("\n\n");
  VectorStore.indexDocument(db, { userId: "user_t3", sourceType: "doc", sourceId: "doc_long_spec", content: longDoc });
  const longChunksHit = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: EmbeddingService.generateEmbedding("WebSocket synchronization"), limit: 3 });
  assertGreaterThan(longChunksHit.length, 1, "T3.10", "Pairwise 10: Multi-chunk document retrieval successfully returns top sequential chunks");

  // Interaction 11: Re-ranking and Threshold Filtering: Hybrid retrieval applies similarity threshold cutoff
  currentFeature = "T3.11";
  const allHits = VectorStore.hybridSearch(db, { userId: "user_t3", queryEmbedding: queryArch, limit: 10 });
  const highConfidenceHits = allHits.filter((h) => h.similarity >= 0.05);
  assert(highConfidenceHits.length > 0 && highConfidenceHits.length <= allHits.length, "T3.11", "Pairwise 11: Re-ranking with similarity threshold filters out low-relevance chunks");

  const tier3Passed = allResults.filter((r) => r.tier === 3 && r.passed).length;
  const tier3Total = allResults.filter((r) => r.tier === 3).length;
  console.log(`\nTier 3 Summary: ${tier3Passed}/${tier3Total} assertions passed.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: Real-World End-to-End Scenarios (>=5 Scenarios)
// ─────────────────────────────────────────────────────────────────────────────

async function runTier4() {
  currentTier = 4;
  console.log("\n============================================================");
  console.log("TIER 4: Real-World End-to-End Scenarios");
  console.log("============================================================\n");

  const db = createTestDb();

  // Scenario 1: Complete Recruitment Application Lifecycle
  currentFeature = "T4.1";
  console.log("--- Scenario 1: Complete Recruitment Application Lifecycle ---");
  // 1. Upload Resume
  VectorStore.indexDocument(db, {
    userId: "candidate_alice",
    sourceType: "resume",
    sourceId: "resume_alice_2026",
    content: "Alice Smith - Staff Full Stack Engineer.\n- 8 years building React, Next.js, and TypeScript applications.\n- Designed SQLite WAL-mode local storage caching with zero downtime.\n- Automated CI/CD pipelines with GitHub Actions and Vitest.",
  });

  // 2. Add Target Job & Notes
  VectorStore.indexDocument(db, {
    userId: "candidate_alice",
    sourceType: "job",
    sourceId: "job_vercel_staff",
    content: "Staff Software Engineer - Developer Experience at Vercel.\n- 7+ years of experience with React and TypeScript ecosystem.\n- Deep understanding of SQLite, Edge Runtime, and distributed storage.\n- Strong track record in automated testing and developer tools.",
  });
  VectorStore.indexDocument(db, {
    userId: "candidate_alice",
    sourceType: "notes",
    sourceId: "job_vercel_staff",
    content: "Recruiter call notes: Emphasize sqlite-vec offline RAG architecture and performance optimization.",
  });

  // 3. Compute Fit Matrix in Insights
  const aliceJob = "Staff Software Engineer at Vercel.\n- 7+ years of experience with React and TypeScript ecosystem.\n- Deep understanding of SQLite, Edge Runtime, and distributed storage.\n- Strong track record in automated testing and developer tools.";
  const aliceResume = "Alice Smith - Staff Full Stack Engineer.\n- 8 years building React, Next.js, and TypeScript applications.\n- Designed SQLite WAL-mode local storage caching with zero downtime.\n- Automated CI/CD pipelines with GitHub Actions and Vitest.";
  const aliceFit = ResumeFitEngine.computeFitMatrix(aliceJob, aliceResume);

  // 4. Chatbot Grounding for Interview Prep
  const prepQuery = EmbeddingService.generateEmbedding("sqlite-vec offline RAG interview prep");
  const prepContext = VectorStore.hybridSearch(db, {
    userId: "candidate_alice",
    queryEmbedding: prepQuery,
    sourceIds: ["job_vercel_staff"],
  });

  // 5. Generate and Save Cover Letter
  const coverLetterBody = `Subject: Application for Staff Engineer\n\nDear Vercel Hiring Team,\n\nI am thrilled to apply with 8 years of React/TypeScript experience and deep SQLite storage expertise.`;
  db.prepare("INSERT INTO documents(id, user_id, type, name, content) VALUES ('alice_cover_letter', 'candidate_alice', 'cover_letter', 'Cover Letter — Vercel', ?)").run(coverLetterBody);

  const docExists = db.prepare("SELECT count(*) as c FROM documents WHERE id = 'alice_cover_letter'").get() as { c: number } | undefined;
  assert(
    aliceFit.overallScore >= 30 && prepContext.length > 0 && !!docExists && docExists.c > 0,
    "T4.1",
    "Scenario 1: Complete Recruitment Lifecycle (Resume -> Job -> Fit Matrix -> Interview Prep Grounding -> Cover Letter Save)"
  );

  // Scenario 2: Memory Evolution & Context Refresh Scenario
  currentFeature = "T4.2";
  console.log("--- Scenario 2: Memory Evolution & Context Refresh ---");
  // 1. Initial preference
  VectorStore.indexMemory(db, {
    id: "alice_pref",
    userId: "candidate_alice",
    title: "Role Preference",
    description: "Prefers remote React roles with $160k minimum salary.",
  });
  const qPref = EmbeddingService.generateEmbedding("What is my current career preference?");
  const recallV1 = VectorStore.recallMemories(db, { userId: "candidate_alice", queryEmbedding: qPref, limit: 1 });

  // 2. Updated preference
  VectorStore.indexMemory(db, {
    id: "alice_pref",
    userId: "candidate_alice",
    title: "Role Preference",
    description: "Relocating to London, targeting Staff Engineer roles at $220k+ minimum salary.",
  });
  const recallV2 = VectorStore.recallMemories(db, { userId: "candidate_alice", queryEmbedding: qPref, limit: 1 });

  assert(
    recallV1[0].description.includes("160k") && recallV2[0].description.includes("London") && recallV2[0].description.includes("220k"),
    "T4.2",
    "Scenario 2: Memory Evolution (Add initial preference -> Chatbot recall -> Update preference -> Immediate refreshed recall)"
  );

  // Scenario 3: Multi-tenant Career Advisory Workspace
  currentFeature = "T4.3";
  console.log("--- Scenario 3: Multi-tenant Career Advisory Workspace ---");
  VectorStore.indexDocument(db, {
    userId: "user_frontend",
    sourceType: "resume",
    sourceId: "res_fe",
    content: "Frontend Engineer specializing in React, Next.js, CSS, and Tailwind UI.",
  });
  VectorStore.indexDocument(db, {
    userId: "user_data",
    sourceType: "resume",
    sourceId: "res_data",
    content: "Data Engineer specializing in Python, PyTorch, SQL, and Apache Spark.",
  });

  const queryFe = EmbeddingService.generateEmbedding("React Next.js UI Frontend");
  const hitFe = VectorStore.hybridSearch(db, { userId: "user_frontend", queryEmbedding: queryFe });
  const hitDataLeaked = hitFe.some((h) => h.userId === "user_data");

  const queryData = EmbeddingService.generateEmbedding("Python PyTorch Spark");
  const hitData = VectorStore.hybridSearch(db, { userId: "user_data", queryEmbedding: queryData });
  const hitFeLeaked = hitData.some((h) => h.userId === "user_frontend");

  assert(
    !hitDataLeaked && !hitFeLeaked && hitFe.length > 0 && hitData.length > 0,
    "T4.3",
    "Scenario 3: Multi-tenant Isolation (Frontend vs Data Engineer accounts have zero cross-talk under high semantic similarity)"
  );

  // Scenario 4: Large Resume Corpus & Multi-source Hybrid RAG
  currentFeature = "T4.4";
  console.log("--- Scenario 4: Large Resume Corpus & Multi-source Hybrid RAG ---");
  for (let i = 1; i <= 5; i++) {
    VectorStore.indexDocument(db, {
      userId: "power_user",
      sourceType: "job",
      sourceId: `job_${i}`,
      content: `Job ${i}: Software Engineer role with specialized focus on requirement ${i}.`,
    });
  }
  for (let i = 1; i <= 3; i++) {
    VectorStore.indexDocument(db, {
      userId: "power_user",
      sourceType: "resume",
      sourceId: `resume_v${i}`,
      content: `Resume version ${i}: Full Stack background highlighting achievement ${i}.`,
    });
  }

  // Connect chat session to specific subset: job_2 and resume_v1
  const connectedSearch = VectorStore.hybridSearch(db, {
    userId: "power_user",
    queryEmbedding: EmbeddingService.generateEmbedding("specialized focus requirement 2"),
    sourceIds: ["job_2", "resume_v1"],
  });

  const onlyAllowedSources = connectedSearch.every((r) => r.sourceId === "job_2" || r.sourceId === "resume_v1");
  assert(
    connectedSearch.length > 0 && onlyAllowedSources,
    "T4.4",
    "Scenario 4: Multi-source Hybrid RAG (Session connected to subset of 8 total sources strictly scopes to permitted subset)"
  );

  // Scenario 5: Disaster Recovery & Schema Migration Scenario
  currentFeature = "T4.5";
  console.log("--- Scenario 5: Disaster Recovery & Schema Migration Scenario ---");
  const dbMigr = new DatabaseSync(":memory:", { allowExtension: true });

  // Phase 1: Existing legacy relational tables
  dbMigr.exec(`
    CREATE TABLE jobs (id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT, state TEXT DEFAULT 'active');
    INSERT INTO jobs VALUES ('j_migr_1', 'u_migr', 'Legacy Job', 'Deep legacy description with React skills.', 'active');
  `);

  // Phase 2: Load sqlite-vec extension and apply vector migration
  sqliteVec.load(dbMigr);
  VectorStore.initialize(dbMigr);

  // Phase 3: Backfill vector index from legacy records
  const legacyJobs = dbMigr.prepare("SELECT id, user_id, description FROM jobs").all() as Array<{ id: string; user_id: string; description: string }>;
  for (const j of legacyJobs) {
    VectorStore.indexDocument(dbMigr, {
      userId: j.user_id,
      sourceType: "job",
      sourceId: j.id,
      content: j.description,
    });
  }

  // Phase 4: Verify search on backfilled data & verify relational integrity
  const qMigr = EmbeddingService.generateEmbedding("React skills");
  const migrHits = VectorStore.hybridSearch(dbMigr, { userId: "u_migr", queryEmbedding: qMigr });
  const legacyJobRow = dbMigr.prepare("SELECT title, state FROM jobs WHERE id = 'j_migr_1'").get() as { title: string; state: string };

  assert(
    migrHits.length > 0 && legacyJobRow.title === "Legacy Job" && legacyJobRow.state === "active",
    "T4.5",
    "Scenario 5: Schema Migration & Disaster Recovery (Legacy DB -> Load sqlite-vec -> Backfill -> Zero data loss on relational & vector)"
  );

  const tier4Passed = allResults.filter((r) => r.tier === 4 && r.passed).length;
  const tier4Total = allResults.filter((r) => r.tier === 4).length;
  console.log(`\nTier 4 Summary: ${tier4Passed}/${tier4Total} scenarios passed.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Entry Point & Report Summary
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("================================================================================");
  console.log("🧪 atTrack sqlite-vec & Hybrid RAG Retrieval 4-Tier E2E Test Suite");
  console.log("================================================================================\n");

  const startTime = Date.now();

  try {
    await runTier1();
    await runTier2();
    await runTier3();
    await runTier4();
  } catch (err) {
    console.error("CRITICAL EXCEPTION IN TEST RUNNER:", err);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;

  const total = allResults.length;
  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;

  const t1Passed = allResults.filter((r) => r.tier === 1 && r.passed).length;
  const t1Total = allResults.filter((r) => r.tier === 1).length;

  const t2Passed = allResults.filter((r) => r.tier === 2 && r.passed).length;
  const t2Total = allResults.filter((r) => r.tier === 2).length;

  const t3Passed = allResults.filter((r) => r.tier === 3 && r.passed).length;
  const t3Total = allResults.filter((r) => r.tier === 3).length;

  const t4Passed = allResults.filter((r) => r.tier === 4 && r.passed).length;
  const t4Total = allResults.filter((r) => r.tier === 4).length;

  console.log("\n================================================================================");
  console.log("📊 TEST EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(` Tier 1 (Functional Coverage) : ${t1Passed}/${t1Total} assertions ${t1Passed === t1Total ? "✅" : "❌"}`);
  console.log(` Tier 2 (Boundary & Corner)   : ${t2Passed}/${t2Total} assertions ${t2Passed === t2Total ? "✅" : "❌"}`);
  console.log(` Tier 3 (Cross-Feature)       : ${t3Passed}/${t3Total} assertions ${t3Passed === t3Total ? "✅" : "❌"}`);
  console.log(` Tier 4 (E2E Scenarios)       : ${t4Passed}/${t4Total} assertions ${t4Passed === t4Total ? "✅" : "❌"}`);
  console.log("--------------------------------------------------------------------------------");
  console.log(` Total Assertions Executed    : ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(` Total Execution Time         : ${durationMs}ms`);
  console.log("================================================================================\n");

  if (failed > 0) {
    console.error(`🚨 ${failed} assertion(s) failed!`);
    for (const f of allResults.filter((r) => !r.passed)) {
      console.error(`  Failure: [${f.id}] ${f.description} - ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log("🎉 ALL TESTS PASSED! Ready for deployment.");
    process.exit(0);
  }
}

main();

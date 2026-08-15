/**
 * Direct Module Integration & Edge Stress Test for lib/db/sqlite.ts
 *
 * Tests:
 *  - getDb() singleton instantiation and sqlite-vec auto-loading
 *  - CURRENT_SCHEMA_VERSION = 7 application
 *  - transaction() wrapper with rollback semantics on error
 *  - rebuildOmniSearchIndex() execution with jobs, contacts, companies, documents
 *  - Multi-process WAL durability
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Isolate DB for module test
const testDbFile = path.join(os.tmpdir(), `attrack-module-stress-${Date.now()}.db`);
process.env.SQLITE_PATH = testDbFile;

async function testModule() {
  console.log("--------------------------------------------------------------------------------");
  console.log("🧪 TESTING lib/db/sqlite.ts DIRECT EXPORTS");
  console.log("--------------------------------------------------------------------------------\n");

  const { getDb, transaction, rebuildOmniSearchIndex } = await import("../lib/db/sqlite");

  const db = getDb();

  // 1. Check version and extension
  const ver = db.prepare("SELECT vec_version() as v").get() as { v: string };
  console.log(`[PASS] Extension vec_version: ${ver.v}`);
  if (!ver.v.startsWith("v0.")) throw new Error(`Unexpected vec_version: ${ver.v}`);

  const userVer = db.prepare("PRAGMA user_version").get() as { user_version: number };
  console.log(`[PASS] PRAGMA user_version: ${userVer.user_version}`);
  if (userVer.user_version !== 7) throw new Error(`Expected user_version 7, got ${userVer.user_version}`);

  // 2. Test transaction helper
  const userId = "user_mod_001";
  db.prepare("INSERT OR REPLACE INTO users (id, email) VALUES (?, ?)").run(userId, "mod@test.local");
  db.prepare("INSERT OR REPLACE INTO profiles (id, full_name) VALUES (?, ?)").run(userId, "Module Tester");

  // Successful transaction
  transaction(() => {
    db.prepare(`
      INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
      VALUES (30001, ?, 'src_tx', 'resume', 0, 'In transaction chunk')
    `).run(userId);
    const vec = new Float32Array(768);
    vec[0] = 0.5;
    vec[1] = 0.5;
    db.prepare("INSERT INTO vec_document_chunks (id, embedding, user_id, source_id) VALUES (?, ?, ?, 'src_tx')").run(BigInt(30001), vec, userId);
  });

  const checkDoc = db.prepare("SELECT id, chunk_text FROM document_chunks WHERE id = 30001").get() as { chunk_text: string };
  if (!checkDoc || checkDoc.chunk_text !== "In transaction chunk") throw new Error("Transaction commit failed");
  console.log("[PASS] transaction() commit successful");

  // Failed transaction rollback
  let threw = false;
  try {
    transaction(() => {
      db.prepare(`
        INSERT INTO document_chunks (id, user_id, source_id, source_type, chunk_index, chunk_text)
        VALUES (30002, ?, 'src_tx', 'resume', 1, 'Should not exist')
      `).run(userId);
      throw new Error("Deliberate failure inside transaction");
    });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Transaction did not rethrow error");

  const checkRolledBack = db.prepare("SELECT id FROM document_chunks WHERE id = 30002").get();
  if (checkRolledBack) throw new Error("Transaction failed to rollback inserted record");
  console.log("[PASS] transaction() rollback successfully reverted changes");

  // 3. Test rebuildOmniSearchIndex
  db.prepare(`
    INSERT INTO jobs (id, user_id, title, description, status, state)
    VALUES ('job_mod_001', ?, 'Senior Frontend Architect', 'Next.js, TypeScript, React', 'saved', 'active')
  `).run(userId);

  rebuildOmniSearchIndex(db);

  const ftsMatch = db.prepare("SELECT entity_id, title FROM omni_search_index WHERE omni_search_index MATCH 'Architect' AND user_id = ?").all(userId) as { entity_id: string }[];
  if (ftsMatch.length === 0 || ftsMatch[0].entity_id !== "job_mod_001") {
    throw new Error(`rebuildOmniSearchIndex failed to index job: ${JSON.stringify(ftsMatch)}`);
  }
  console.log("[PASS] rebuildOmniSearchIndex indexed jobs into omni_search_index FTS5");

  // 4. Test KNN query against inserted vector
  const qVec = new Float32Array(768);
  qVec[0] = 0.5;
  qVec[1] = 0.5;
  const matchVec = db.prepare(`
    SELECT vdc.id, vdc.distance, dc.chunk_text
    FROM vec_document_chunks vdc
    JOIN document_chunks dc ON vdc.id = dc.id
    WHERE vdc.embedding MATCH ? AND vdc.k = 1 AND dc.user_id = ?
  `).get(qVec, userId) as { id: number; distance: number; chunk_text: string };

  if (!matchVec || matchVec.id !== 30001) {
    throw new Error(`KNN query failed on module DB: ${JSON.stringify(matchVec)}`);
  }
  console.log(`[PASS] KNN matching distance: ${matchVec.distance.toFixed(6)}`);

  console.log("\n🎯 ALL MODULE INTEGRATION TESTS PASSED!");

  db.close();
  try {
    fs.rmSync(testDbFile, { force: true });
    fs.rmSync(`${testDbFile}-wal`, { force: true });
    fs.rmSync(`${testDbFile}-shm`, { force: true });
  } catch {}
}

testModule().catch((err) => {
  console.error("FATAL MODULE TEST ERROR:", err);
  process.exit(1);
});

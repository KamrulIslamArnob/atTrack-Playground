// Verifies the chatbot's write/delete database tools: FK name-resolution
// (find-or-create) and the delete propose->confirm gate. db-tables.ts and
// delete-database.ts use relative, .ts-extensioned imports specifically so
// this can run standalone, the same reason lib/db/*.ts does.
//
// Run with:  node scripts/verify-db-write-delete.ts
// Every row it creates is prefixed `verify_` and removed at the end.

import { createDbClient } from "../lib/db/client.ts";
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { findOrCreateByName } from "../lib/ai/tools/db-tables.ts";
import { deleteDatabaseTool } from "../lib/ai/tools/delete-database.ts";

interface Report { name: string; passed: boolean; error?: string }
const reports: Report[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    reports.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    reports.push({ name, passed: false, error });
    console.log(`  [FAIL] ${name}: ${error}`);
  }
}

const db = createDbClient();
const userId = getOrCreateLocalUser().id;
const cleanup: { table: string; id: string }[] = [];

async function main(): Promise<void> {
  console.log("write_database / delete_database verification\n");

  await runTest("findOrCreateByName creates once and reuses on repeat calls", async () => {
    const first = await findOrCreateByName(db, "link_categories", userId, "verify_category_x");
    if ("error" in first) throw new Error(first.error);
    cleanup.push({ table: "link_categories", id: first.id });

    const second = await findOrCreateByName(db, "link_categories", userId, "verify_category_x");
    if ("error" in second) throw new Error(second.error);
    assert(second.id === first.id, `second call created a new row (${second.id} vs ${first.id})`);

    const { data } = await db.from("link_categories").select("id").eq("user_id", userId).eq("name", "verify_category_x");
    assert(data.length === 1, `expected exactly 1 row, found ${data.length}`);
  });

  await runTest("delete_database never deletes on the proposing call", async () => {
    const { data: row, error } = await db
      .from("ai_memories")
      .insert({ user_id: userId, title: "verify_delete_me", description: "scratch row for verification" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    cleanup.push({ table: "ai_memories", id: row.id as string });

    const proposal = await deleteDatabaseTool.execute(
      { table: "ai_memories", ids: [row.id] },
      { userId, traceId: "verify-turn-1" }
    );
    assert(proposal.content.includes("About to delete"), `expected a proposal, got: ${proposal.content}`);
    assert(proposal.content.includes("DELETE FROM ai_memories"), `proposal is missing the SQL text: ${proposal.content}`);

    const { data: stillThere } = await db.from("ai_memories").select("id").eq("id", row.id);
    assert(stillThere.length === 1, "row was deleted on the proposing call — confirmation gate is broken");
  });

  await runTest("delete_database refuses to confirm within the SAME turn (same traceId)", async () => {
    const { data: row, error } = await db
      .from("ai_memories")
      .insert({ user_id: userId, title: "verify_delete_me_2", description: "scratch row for verification" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    cleanup.push({ table: "ai_memories", id: row.id as string });

    await deleteDatabaseTool.execute({ table: "ai_memories", ids: [row.id] }, { userId, traceId: "verify-turn-A" });
    const repeat = await deleteDatabaseTool.execute({ table: "ai_memories", ids: [row.id] }, { userId, traceId: "verify-turn-A" });
    assert(repeat.content.includes("About to delete"), `same-turn repeat call executed instead of re-proposing: ${repeat.content}`);

    const { data: stillThere } = await db.from("ai_memories").select("id").eq("id", row.id);
    assert(stillThere.length === 1, "row was deleted within the same traceId — confirmation gate is broken");
  });

  await runTest("delete_database executes once confirmed in a LATER turn (different traceId)", async () => {
    const { data: row, error } = await db
      .from("ai_memories")
      .insert({ user_id: userId, title: "verify_delete_me_3", description: "scratch row for verification" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    await deleteDatabaseTool.execute({ table: "ai_memories", ids: [row.id] }, { userId, traceId: "verify-turn-B1" });
    const confirmed = await deleteDatabaseTool.execute({ table: "ai_memories", ids: [row.id] }, { userId, traceId: "verify-turn-B2" });
    assert(confirmed.content.startsWith("Deleted"), `expected the delete to execute, got: ${confirmed.content}`);

    const { data: stillThere } = await db.from("ai_memories").select("id").eq("id", row.id);
    assert(stillThere.length === 0, "row survived the confirmed delete");
  });

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.length - passed;
  console.log(`\nTOTAL: ${reports.length} | PASSED: ${passed} | FAILED: ${failed}`);
}

main()
  .catch((err) => {
    console.error("Fatal runner error:", err);
    reports.push({ name: "fatal", passed: false, error: String(err) });
  })
  .finally(async () => {
    for (const { table, id } of cleanup) {
      await db.from(table).delete().eq("id", id);
    }
    if (reports.some((r) => !r.passed)) process.exit(1);
  });

// Verifies the chatbot's generalized write/delete database tools against
// atTrack's hard invariants: TEXT-id generation on insert, jobs.status being
// derived (never model-writable), the Applied-list -> ensureApplication
// trigger, and the delete propose-then-approve lifecycle
// (lib/ai-chatbot/db-approval.ts).
//
// lib/ai/tools/{write,delete,query}-database.ts and db-utils.ts all use the
// @/* alias (ensureApplication pulls in @/lib/actions/board -> @/lib/auth,
// which is Next-only regardless), so this does NOT run under plain `node`.
// Run with:
//
//   npx tsx scripts/verify-db-write-delete.ts
//
// Every row it creates is prefixed `verify_` and removed at the end.

import { createDbClient } from "@/lib/db/client";
import { getOrCreateLocalUser } from "@/lib/db/local-user";
import { writeDatabaseTool } from "@/lib/ai/tools/write-database";
import { deleteDatabaseTool } from "@/lib/ai/tools/delete-database";
import {
  createPendingDbDelete,
  consumePendingDbDelete,
  executeApprovedDelete,
} from "@/lib/ai-chatbot/db-approval";

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

/** Returns this user's Applied-kind board list, seeding the default columns
 *  first if none exist yet (a fresh local database has none). */
async function appliedListId(): Promise<string> {
  const { data: existing } = await db
    .from("board_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "applied")
    .maybeSingle();
  if (existing) return existing.id as string;

  await db.rpc("seed_board_lists", { p_user_id: userId });
  const { data: seeded } = await db
    .from("board_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "applied")
    .single();
  return seeded!.id as string;
}

function extractRowId(content: string): string {
  const match = content.match(/row ([^:]+):/);
  if (!match) throw new Error(`couldn't find a row id in: ${content}`);
  return match[1];
}

async function main(): Promise<void> {
  console.log("write_database / delete_database verification\n");

  await runTest("write_database insert generates a real TEXT id, not a bare rowid", async () => {
    const result = await writeDatabaseTool.execute(
      { action: "insert", table: "link_categories", values: { name: "verify_category_x" } },
      { userId }
    );
    const newId = extractRowId(result.content);
    assert(/^[0-9a-f-]{36}$/i.test(newId), `id "${newId}" isn't a uuid — id-generation bug`);
    cleanup.push({ table: "link_categories", id: newId });

    const { data } = await db.from("link_categories").select("id,name").eq("id", newId);
    assert(
      data.length === 1 && data[0].name === "verify_category_x",
      "row is not queryable by the id the tool reported"
    );
  });

  await runTest("write_database drops jobs.status — it's derived, never model-writable", async () => {
    const result = await writeDatabaseTool.execute(
      { action: "insert", table: "jobs", values: { title: "verify_status_block", status: "applied" } },
      { userId }
    );
    const jobId = extractRowId(result.content);
    cleanup.push({ table: "jobs", id: jobId });

    assert(result.content.includes("(ignored: status)"), `expected status to be reported dropped: ${result.content}`);
    const { data } = await db.from("jobs").select("status").eq("id", jobId).single();
    assert(data!.status !== "applied", `status was set to "applied" directly — the block is broken`);
  });

  await runTest("write_database moving a job into an Applied-kind list creates its application", async () => {
    const listId = await appliedListId();
    const insertResult = await writeDatabaseTool.execute(
      { action: "insert", table: "jobs", values: { title: "verify_ensure_application" } },
      { userId }
    );
    const jobId = extractRowId(insertResult.content);
    cleanup.push({ table: "jobs", id: jobId });

    await writeDatabaseTool.execute(
      { action: "update", table: "jobs", id: jobId, values: { list_id: listId } },
      { userId }
    );

    const { data: applications } = await db
      .from("applications")
      .select("id")
      .eq("job_id", jobId)
      .eq("user_id", userId);
    assert(applications.length === 1, `expected an applications row for the job, found ${applications.length}`);
  });

  await runTest("delete_database never deletes on the proposing call", async () => {
    const { data: row, error } = await db
      .from("ai_memories")
      .insert({ user_id: userId, title: "verify_delete_me", description: "scratch row for verification" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    cleanup.push({ table: "ai_memories", id: row.id as string });

    const proposal = await deleteDatabaseTool.execute({ table: "ai_memories", ids: [row.id] }, { userId });
    assert(proposal.content.includes("This has NOT run yet"), `expected a proposal, got: ${proposal.content}`);
    assert(!!proposal.approval?.approvalId, "proposal did not return an approval payload for the UI card");

    const { data: stillThere } = await db.from("ai_memories").select("id").eq("id", row.id);
    assert(stillThere.length === 1, "row was deleted on the proposing call — the gate is broken");
  });

  await runTest("db-approval deletes exactly once on Allow, and refuses a replayed decision", async () => {
    const { data: row, error } = await db
      .from("ai_memories")
      .insert({ user_id: userId, title: "verify_delete_me_2", description: "scratch row for verification" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");

    const approvalId = createPendingDbDelete({
      userId,
      table: "ai_memories",
      ownerCol: "user_id",
      ids: [row.id as string],
      label: "AI Memories",
      preview: "",
      sql: "DELETE FROM ai_memories WHERE id = ?",
    });

    const pending = consumePendingDbDelete(approvalId, userId);
    assert(!!pending, "consume returned null for a fresh, unexpired approval");
    const deleted = executeApprovedDelete(pending!);
    assert(deleted === 1, `expected 1 row deleted, got ${deleted}`);

    const { data: stillThere } = await db.from("ai_memories").select("id").eq("id", row.id);
    assert(stillThere.length === 0, "row survived the approved delete");

    const replay = consumePendingDbDelete(approvalId, userId);
    assert(replay === null, "the same approvalId was consumable a second time — replay risk");
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
    // jobs -> applications cascades (ON DELETE CASCADE, foreign_keys=ON), so
    // no separate applications cleanup is needed.
    for (const { table, id } of cleanup) {
      await db.from(table).delete().eq("id", id);
    }
    if (reports.some((r) => !r.passed)) process.exit(1);
  });

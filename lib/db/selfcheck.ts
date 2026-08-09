/**
 * Self-check for the SQLite query shim.
 *
 * Run with:  node lib/db/selfcheck.ts
 *
 * The shim reimplements the slice of PostgREST that ~137 call sites depend on.
 * A silent wrong answer here surfaces as a data bug far from the cause, so every
 * behaviour those call sites rely on is asserted below. No test framework — plain
 * asserts, matching the repo's "no test tooling" convention.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Assertions deliberately index into untyped rows to verify their real shape.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "attrack-selfcheck-"));
process.env.SQLITE_PATH = path.join(dir, "test.db");

const { from } = await import("./query.ts");
const { getDb } = await import("./sqlite.ts");

let passed = 0;
function ok(label: string) {
  passed++;
  console.log(`  ok  ${label}`);
}

try {
  // ---------- fixtures ----------
  const userA = randomUUID();
  const userB = randomUUID();
  const db = getDb();

  for (const [id, email] of [
    [userA, "a@example.com"],
    [userB, "b@example.com"],
  ]) {
    db.prepare("INSERT INTO users (id,email,encrypted_password) VALUES (?,?,?)").run(id, email, "x");
    db.prepare("INSERT INTO profiles (id,full_name) VALUES (?,?)").run(id, `User ${email}`);
  }

  // ---------- insert + select().single() ----------
  const ins = await from("companies").insert({ user_id: userA, name: "Acme" }).select("id").single();
  assert.equal(ins.error, null, "insert should not error");
  assert.ok(ins.data && typeof (ins.data as unknown as { id: string }).id === "string", "insert returns id");
  const acmeId = (ins.data as unknown as { id: string }).id;
  ok("insert auto-generates id and .select().single() returns it");

  // userB's own company: exists so the cross-user scoping assertions below have
  // foreign data to (fail to) reach.
  await from("companies").insert({ user_id: userB, name: "Globex" });

  // ---------- board_lists + unique-per-kind index ----------
  const lists: Record<string, string> = {};
  for (const [i, kind] of ["wishlist", "preparing", "applied"].entries()) {
    const r = await from("board_lists")
      .insert({ user_id: userA, name: kind, kind, sort_order: i + 1 })
      .select("id")
      .single();
    lists[kind] = (r.data as unknown as { id: string }).id;
  }
  const dupe = await from("board_lists")
    .insert({ user_id: userA, name: "again", kind: "wishlist" })
    .select("id")
    .single();
  assert.ok(dupe.error, "duplicate semantic kind must be rejected by the partial unique index");
  ok("partial unique index blocks two lists of the same kind per user");

  // ---------- JSON + boolean round-trip ----------
  const jobIns = await from("jobs")
    .insert({
      user_id: userA,
      company_id: acmeId,
      title: "Senior Engineer",
      location: "Remote",
      list_id: lists.wishlist,
      board_position: 0,
      notes: [{ id: "n1", title: "Stack", bullets: ["Go", "SQLite"] }],
      project_links: [{ id: "p1", label: "Repo", url: "https://example.com" }],
      match_score: 84,
    })
    .select("id")
    .single();
  const jobId = (jobIns.data as unknown as { id: string }).id;

  const jobRead = await from("jobs").select("*").eq("id", jobId).single();
  const job = jobRead.data as Record<string, any>;
  assert.deepEqual(job.notes, [{ id: "n1", title: "Stack", bullets: ["Go", "SQLite"] }]);
  assert.deepEqual(job.project_links, [{ id: "p1", label: "Repo", url: "https://example.com" }]);
  assert.equal(typeof job.match_score, "number");
  ok("JSON columns round-trip as objects, not strings");

  const docIns = await from("documents")
    .insert({
      user_id: userA,
      type: "resume",
      name: "resume.pdf",
      file_path: `${userA}/resume.pdf`,
      is_default: true,
      match_data: { skills: ["ts"], experience: [], education: [], summary: "s" },
    })
    .select("id")
    .single();
  const docId = (docIns.data as unknown as { id: string }).id;
  const docRead = await from("documents").select("is_default, match_data").eq("id", docId).single();
  assert.equal((docRead.data as any).is_default, true, "0/1 must decode to a real boolean");
  assert.deepEqual((docRead.data as any).match_data.skills, ["ts"]);
  ok("boolean columns decode to true/false");

  // ---------- derived status trigger ----------
  assert.equal(job.status, "saved", "wishlist list => status 'saved'");
  await from("jobs").update({ list_id: lists.applied }).eq("id", jobId);
  const afterMove = await from("jobs").select("status, list_id").eq("id", jobId).single();
  assert.equal((afterMove.data as any).status, "preparing", "non-wishlist list => 'preparing'");
  await from("jobs").update({ list_id: lists.wishlist }).eq("id", jobId);
  ok("jobs.status is derived from the board list's kind by trigger");

  // ---------- to-one embed with alias ----------
  const withCompany = await from("jobs").select("id, title, company:companies(name)").eq("id", jobId).single();
  assert.equal((withCompany.data as any).company.name, "Acme");
  ok("to-one embed with alias resolves");

  // ---------- to-one embed with FK hint (jobs has 3 FKs to documents) ----------
  await from("jobs").update({ resume_id: docId, matched_resume_id: docId }).eq("id", jobId);
  const withResume = await from("jobs")
    .select("id, resume:documents!jobs_resume_id_fkey(name)")
    .eq("id", jobId)
    .single();
  assert.equal((withResume.data as any).resume.name, "resume.pdf");
  ok("FK-hinted embed disambiguates multiple FKs to the same table");

  // ---------- to-one embed that is null ----------
  const noCompany = await from("jobs")
    .insert({ user_id: userA, title: "No Company", list_id: lists.wishlist })
    .select("id")
    .single();
  const orphanId = (noCompany.data as unknown as { id: string }).id;
  const orphan = await from("jobs").select("id, company:companies(name)").eq("id", orphanId).single();
  assert.equal((orphan.data as any).company, null, "missing FK must embed as null, not undefined");
  ok("null FK embeds as null");

  // ---------- to-many embed ----------
  await from("applications").insert({ user_id: userA, job_id: jobId, status: "submitted" });
  const withApps = await from("jobs").select("id, applications(id, status)").eq("id", jobId).single();
  assert.equal((withApps.data as any).applications.length, 1);
  assert.equal((withApps.data as any).applications[0].status, "submitted");
  const emptyMany = await from("jobs").select("id, applications(id)").eq("id", orphanId).single();
  assert.deepEqual((emptyMany.data as any).applications, [], "to-many with no children => []");
  ok("to-many embed groups children and yields [] when empty");

  // ---------- nested embed (applications -> job -> company) ----------
  const nested = await from("applications")
    .select("id, status, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userA);
  assert.equal((nested.data as any)[0].job.company.name, "Acme");
  assert.equal((nested.data as any)[0].job.title, "Senior Engineer");
  ok("nested embeds resolve two levels deep");

  // ---------- projection: unlisted columns are excluded ----------
  const projected = await from("jobs").select("id, title").eq("id", jobId).single();
  assert.deepEqual(Object.keys(projected.data as object).sort(), ["id", "title"]);
  ok("select() projects only requested columns");

  // ---------- filters ----------
  const eqCount = await from("jobs").select("id").eq("user_id", userA);
  assert.equal((eqCount.data as any[]).length, 2);

  const neq = await from("jobs").select("id").eq("user_id", userA).neq("id", jobId);
  assert.equal((neq.data as any[]).length, 1);

  const inList = await from("jobs").select("id").in("id", [jobId, orphanId]);
  assert.equal((inList.data as any[]).length, 2);

  const inEmpty = await from("jobs").select("id").in("id", []);
  assert.deepEqual(inEmpty.data, [], ".in([]) must match nothing, not everything");
  ok("eq / neq / in filters, including the empty-IN edge case");

  const ilike = await from("jobs").select("id, title").ilike("title", "%senior%");
  assert.equal((ilike.data as any[]).length, 1, "ilike must be case-insensitive");
  ok("ilike is case-insensitive");

  const ored = await from("jobs")
    .select("id")
    .eq("user_id", userA)
    .or("title.ilike.%Senior%,location.ilike.%Nowhere%");
  assert.equal((ored.data as any[]).length, 1);
  ok(".or() mini-syntax parses into an OR group");

  const notNull = await from("documents").select("id").not("match_data", "is", null);
  assert.equal((notNull.data as any[]).length, 1);
  const isNull = await from("jobs").select("id").is("company_id", null);
  assert.equal((isNull.data as any[]).length, 1);
  ok(".not(col,'is',null) and .is(col,null)");

  // ---------- ordering, limit, range, count ----------
  const ordered = await from("jobs").select("title").eq("user_id", userA).order("title", { ascending: true });
  assert.deepEqual((ordered.data as any[]).map((r) => r.title), ["No Company", "Senior Engineer"]);
  const desc = await from("jobs").select("title").eq("user_id", userA).order("title", { ascending: false });
  assert.equal((desc.data as any[])[0].title, "Senior Engineer");
  ok("order() ascending and descending");

  const counted = await from("jobs").select("id", { count: "exact" }).eq("user_id", userA);
  assert.equal(counted.count, 2, "count must reflect the filter, not the page");
  const ranged = await from("jobs").select("id", { count: "exact" }).eq("user_id", userA).order("title").range(0, 0);
  assert.equal((ranged.data as any[]).length, 1, "range(0,0) returns one row");
  assert.equal(ranged.count, 2, "count ignores range");
  ok("count:'exact' is independent of range/limit");

  const head = await from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userA);
  assert.deepEqual(head.data, []);
  assert.equal(head.count, 2);
  ok("head:true returns count without rows");

  // ---------- single vs maybeSingle on zero rows ----------
  const missingSingle = await from("jobs").select("id").eq("id", "nope").single();
  assert.equal(missingSingle.data, null);
  assert.ok(missingSingle.error, "single() on 0 rows must report an error");
  const missingMaybe = await from("jobs").select("id").eq("id", "nope").maybeSingle();
  assert.equal(missingMaybe.data, null);
  assert.equal(missingMaybe.error, null, "maybeSingle() on 0 rows must NOT error");
  ok("single() errors on 0 rows; maybeSingle() does not");

  // ---------- update ----------
  await from("jobs").update({ title: "Staff Engineer" }).eq("id", jobId).eq("user_id", userA);
  const updated = await from("jobs").select("title").eq("id", jobId).single();
  assert.equal((updated.data as any).title, "Staff Engineer");
  ok("update() applies to the filtered row");

  // update scoped to the wrong user must change nothing
  await from("jobs").update({ title: "HACKED" }).eq("id", jobId).eq("user_id", userB);
  const notHacked = await from("jobs").select("title").eq("id", jobId).single();
  assert.equal((notHacked.data as any).title, "Staff Engineer", "user_id scoping must hold");
  ok("user_id-scoped update cannot touch another user's row");

  // ---------- upsert ----------
  await from("profiles").upsert({ id: userA, full_name: "Renamed", headline: "Dev" }, { onConflict: "id" });
  const upserted = await from("profiles").select("full_name, headline").eq("id", userA).single();
  assert.equal((upserted.data as any).full_name, "Renamed");
  assert.equal((upserted.data as any).headline, "Dev");
  const profileCount = await from("profiles").select("id", { count: "exact", head: true });
  assert.equal(profileCount.count, 2, "upsert must update, not insert a duplicate");
  ok("upsert(onConflict) updates in place");

  // ---------- delete + unfiltered-delete guard ----------
  const guard = await from("jobs").delete();
  assert.ok(guard.error, "unfiltered DELETE must be refused");
  const stillThere = await from("jobs").select("id", { count: "exact", head: true });
  assert.equal(stillThere.count, 2, "guard must not have deleted anything");
  ok("unfiltered DELETE is refused");

  await from("jobs").delete().eq("id", orphanId).eq("user_id", userA);
  const afterDelete = await from("jobs").select("id", { count: "exact", head: true }).eq("user_id", userA);
  assert.equal(afterDelete.count, 1);
  ok("filtered delete removes exactly one row");

  // ---------- FK cascade (PRAGMA foreign_keys must be ON) ----------
  await from("applications").insert({ user_id: userA, job_id: jobId, status: "draft" });
  await from("jobs").delete().eq("id", jobId).eq("user_id", userA);
  const cascaded = await from("applications").select("id", { count: "exact", head: true });
  assert.equal(cascaded.count, 0, "deleting a job must cascade to its applications");
  ok("ON DELETE CASCADE is active");

  // ---------- unknown relation fails loudly ----------
  const bad = await from("jobs").select("id, nonsense:widgets(name)").eq("user_id", userA);
  assert.ok(bad.error && /relation/i.test(bad.error.message), "unknown embed must error, not return junk");
  ok("unknown embed reports a clear error");

  // ---------- injection attempt in an identifier ----------
  const evil = await from("jobs").select("id").eq('id"; DROP TABLE jobs; --', "x");
  assert.ok(evil.error, "unsafe identifier must be rejected");
  const survived = await from("board_lists").select("id", { count: "exact", head: true });
  assert.equal(survived.count, 3, "tables must survive an injection attempt");
  ok("identifiers are validated against injection");

  console.log(`\nAll ${passed} checks passed.`);
} finally {
  try {
    getDb().close();
  } catch {}
  rmSync(dir, { recursive: true, force: true });
}

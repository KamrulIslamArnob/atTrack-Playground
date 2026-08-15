# Chatbot DB write/delete tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the AI chatbot two new tools — `write_database` (insert/update, executes immediately) and `delete_database` (always proposes first, only executes once confirmed in a later turn) — so it can create/update/delete the user's own workspace rows instead of refusing.

**Architecture:** Two new files in `lib/ai/tools/` alongside the existing read-only `query_database`, sharing a small declarative table-allowlist module. A per-turn `traceId` is threaded from the chat pipeline into tool context so `delete_database` can prove a confirming call happened in a later HTTP turn than the one that proposed it — not just trust the model's wording.

**Tech Stack:** TypeScript, Next.js Route Handlers, `node:sqlite` via the existing `lib/db/query.ts` query builder. No new dependencies.

## Global Constraints

- Spec: [docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md](../specs/2026-08-15-chatbot-db-write-delete-design.md).
- Owner column (`user_id`) is always forced server-side — never taken from model-supplied values.
- `status` (jobs), `id`, `user_id`, `created_at`, `updated_at` are never model-writable, on any table.
- Entering an "applied"-kind board column must call the existing `ensureApplication()` ([lib/actions/board.ts:291](../../../lib/actions/board.ts)) — never a raw `list_id` write that skips it.
- `delete_database` must never execute on the call that proposes a delete — only on a later call whose `traceId` differs from the proposing call's.
- No automated test runner in this repo (per [CLAUDE.md](../../../CLAUDE.md)). Verification is `npx tsc --noEmit`, `npm run lint`, a standalone Node verify script for the parts that don't depend on Next-only modules, and a manual chat smoke test for the parts that do.
- `db-tables.ts` and `delete-database.ts` use relative, `.ts`-extensioned imports for their own runtime dependencies (not the `@/*` alias) specifically so a plain `node scripts/....ts` can import them directly — the same reason `lib/db/*` already does this (see the comment in `tsconfig.json` next to `allowImportingTsExtensions`). `write-database.ts` stays on the `@/*` alias, matching the rest of `lib/ai/tools/`, because its `ensureApplication` import pulls in `lib/actions/board.ts` → `@/lib/auth`, which is Next-only regardless — so there's no standalone-runnability to gain by relativizing just this file.

---

### Task 1: Thread a per-turn `traceId` through the tool-execution context

**Files:**
- Modify: `lib/ai/tools/types.ts`
- Modify: `lib/ai/providers.ts` (the `ToolExecutionContext` interface, ~line 910)
- Modify: `lib/ai-chatbot/pipeline.ts` (the `toolCtx` construction inside `executeAgent`, ~line 482)

**Interfaces:**
- Produces: `ToolContext.traceId?: string` and `ToolExecutionContext.traceId?: string` — later tasks (delete-database.ts) read `ctx.traceId`.

- [ ] **Step 1: Add `traceId` to `ToolContext`**

In `lib/ai/tools/types.ts`, add the field to the existing interface:

```ts
export interface ToolContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian vaultPath, GitHub token, etc.). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
  /** The current turn's trace id (see lib/ai-chatbot/pipeline.ts). Used by
   *  delete_database to prove a confirming call happened in a LATER turn
   *  than the one that proposed the delete, not the same tool round. */
  traceId?: string;
}
```

- [ ] **Step 2: Add the matching field to `ToolExecutionContext`**

In `lib/ai/providers.ts`, find:

```ts
export interface ToolExecutionContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian path, GitHub token). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
}
```

Replace with:

```ts
export interface ToolExecutionContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian path, GitHub token). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
  /** Per-turn id, threaded through so tools can tell "this turn" apart from
   *  "a later turn" (see delete_database's confirm gate). */
  traceId?: string;
}
```

- [ ] **Step 3: Pass `traceId` into `toolCtx` in the pipeline**

In `lib/ai-chatbot/pipeline.ts`, inside `executeAgent`, find:

```ts
    const toolCtx: ToolExecutionContext = {
      userId: ctx.input.userId,
      personaId: ctx.input.personaId,
      sourceConfig: ctx.input.sourceConfig,
    };
```

Replace with:

```ts
    const toolCtx: ToolExecutionContext = {
      userId: ctx.input.userId,
      personaId: ctx.input.personaId,
      sourceConfig: ctx.input.sourceConfig,
      traceId,
    };
```

(`traceId` is already the function's parameter — `executeAgent(ctx, traceId = newTraceId())` — so this is in scope.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (both interfaces still structurally compatible — `tool.execute(args, ectx)` in pipeline.ts passes a `ToolExecutionContext` where a `ToolContext` is expected; both now carry the same optional `traceId`).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools/types.ts lib/ai/providers.ts lib/ai-chatbot/pipeline.ts
git commit -m "feat(ai-tools): thread per-turn traceId into tool execution context"
```

---

### Task 2: Shared write-allowlist config + FK name-resolution helper

**Files:**
- Create: `lib/ai/tools/db-tables.ts`
- Create: `scripts/verify-db-write-delete.ts` (started here, extended in Task 3)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Tasks 3 and 4):
  - `interface WritableTableConfig { ownerCol: string; label: string; insertColumns: string[]; updateColumns: string[]; allowInsert: boolean; allowUpdate: boolean; }`
  - `const WRITABLE_TABLES: Record<string, WritableTableConfig>`
  - `const FK_NAME_FIELDS: Record<string, { virtualField: string; column: string; table: string }[]>`
  - `function findOrCreateByName(db: DbClient, table: string, userId: string, name: string): Promise<{ id: string } | { error: string }>`

- [ ] **Step 1: Write `lib/ai/tools/db-tables.ts`**

```ts
// Shared config for the chatbot's write/delete database tools. Declarative on
// purpose: this is the actual security boundary (which tables, which columns,
// whose row) — see docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// `DbClient` is imported as a type only, so this file has zero runtime
// dependency on the `@/*` alias and can be imported directly by a plain
// `node scripts/....ts` (see scripts/verify-db-write-delete.ts).
import type { DbClient } from "@/lib/db/client";

export interface WritableTableConfig {
  ownerCol: string;
  label: string;
  /** Columns the model may set on insert. */
  insertColumns: string[];
  /** Columns the model may set on update. */
  updateColumns: string[];
  allowInsert: boolean;
  allowUpdate: boolean;
}

export const WRITABLE_TABLES: Record<string, WritableTableConfig> = {
  jobs: {
    ownerCol: "user_id",
    label: "Job Applications",
    insertColumns: [
      "title", "description", "location", "deadline", "application_url",
      "application_email", "application_process", "employment_type",
      "work_location", "salary_range", "source", "notes", "skills", "state",
    ],
    updateColumns: [
      "title", "description", "location", "deadline", "application_url",
      "application_email", "application_process", "employment_type",
      "work_location", "salary_range", "source", "notes", "skills", "state",
    ],
    allowInsert: true,
    allowUpdate: true,
  },
  companies: {
    ownerCol: "user_id",
    label: "Companies",
    insertColumns: ["name", "website", "location", "founded_year", "company_type", "country"],
    updateColumns: ["name", "website", "location", "founded_year", "company_type", "country"],
    allowInsert: true,
    allowUpdate: true,
  },
  documents: {
    ownerCol: "user_id",
    label: "Resumes & Documents",
    // Creating a resume row without an uploaded file is meaningless — update only.
    insertColumns: [],
    updateColumns: ["name", "is_default"],
    allowInsert: false,
    allowUpdate: true,
  },
  ai_memories: {
    ownerCol: "user_id",
    label: "AI Memories & Writing Rules",
    insertColumns: ["title", "description"],
    updateColumns: ["title", "description"],
    allowInsert: true,
    allowUpdate: true,
  },
  contacts: {
    ownerCol: "user_id",
    label: "Contacts CRM",
    insertColumns: ["name", "role", "email", "phone", "position", "linkedin_url", "github_url", "notes"],
    updateColumns: ["name", "role", "email", "phone", "position", "linkedin_url", "github_url", "notes"],
    allowInsert: true,
    allowUpdate: true,
  },
  link_categories: {
    ownerCol: "user_id",
    label: "Link Categories",
    insertColumns: ["name", "sort_order"],
    updateColumns: ["name", "sort_order"],
    allowInsert: true,
    allowUpdate: true,
  },
  links: {
    ownerCol: "user_id",
    label: "Links",
    insertColumns: ["title", "url", "notes", "tags"],
    updateColumns: ["title", "url", "notes", "tags"],
    allowInsert: true,
    allowUpdate: true,
  },
  ai_tool_prompts: {
    ownerCol: "user_id",
    label: "AI Prompts",
    // `kind` rows are pre-seeded, one per kind per user (UNIQUE constraint) — update only.
    insertColumns: [],
    updateColumns: ["system_prompt"],
    allowInsert: false,
    allowUpdate: true,
  },
};

/** Tables whose row may reference another table by name instead of id — the
 *  write tool resolves (or creates) the target row so the model can do it in
 *  a single call. Necessary, not just convenient: the chat pipeline runs one
 *  tool round per turn, so the model cannot look a name up in one call and
 *  use the id in a second call within the same turn. */
export const FK_NAME_FIELDS: Record<string, { virtualField: string; column: string; table: string }[]> = {
  jobs: [{ virtualField: "company", column: "company_id", table: "companies" }],
  contacts: [{ virtualField: "company", column: "company_id", table: "companies" }],
  links: [{ virtualField: "category", column: "category_id", table: "link_categories" }],
};

/** Finds a same-user row in `table` whose `name` matches (case-insensitive,
 *  exact — no wildcards), creating one if none exists. */
export async function findOrCreateByName(
  db: DbClient,
  table: string,
  userId: string,
  name: string
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: `Empty name given for ${table}.` };

  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return { id: existing.id as string };

  const { data: created, error } = await db
    .from(table)
    .insert({ user_id: userId, name: trimmed })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? `Failed to create a ${table} row.` };
  return { id: created.id as string };
}
```

- [ ] **Step 2: Start the verify script**

Create `scripts/verify-db-write-delete.ts`:

```ts
// Verifies the chatbot's write/delete database tools: FK name-resolution
// (find-or-create) and (added in Task 3) the delete propose->confirm gate.
// db-tables.ts and delete-database.ts use relative, .ts-extensioned imports
// specifically so this can run standalone, the same reason lib/db/*.ts does.
//
// Run with:  node scripts/verify-db-write-delete.ts
// Every row it creates is prefixed `verify_` and removed at the end.

import { createDbClient } from "../lib/db/client.ts";
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { findOrCreateByName } from "../lib/ai/tools/db-tables.ts";

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
```

- [ ] **Step 3: Run it and confirm it passes**

Run: `node scripts/verify-db-write-delete.ts`
Expected:
```
write_database / delete_database verification

  [PASS] findOrCreateByName creates once and reuses on repeat calls

TOTAL: 1 | PASSED: 1 | FAILED: 0
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools/db-tables.ts scripts/verify-db-write-delete.ts
git commit -m "feat(ai-tools): add shared writable-table config and FK find-or-create helper"
```

---

### Task 3: `delete_database` tool — propose/confirm gate

**Files:**
- Create: `lib/ai/tools/delete-database.ts`
- Modify: `scripts/verify-db-write-delete.ts` (add the gate tests)

**Interfaces:**
- Consumes: `WRITABLE_TABLES` from `./db-tables.ts` (Task 2); `ToolContext.traceId` (Task 1); `ToolDefinition` from `./types.ts`.
- Produces: `export const deleteDatabaseTool: ToolDefinition` — registered in Task 5.

- [ ] **Step 1: Write `lib/ai/tools/delete-database.ts`**

```ts
// Deletes rows from the user's own workspace tables. NEVER deletes on the
// call that proposes it — only when a LATER call (different traceId) repeats
// the exact same table+ids while a pending record still matches. See
// docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// Relative, .ts-extensioned imports (not the `@/*` alias) so this file can be
// imported directly by scripts/verify-db-write-delete.ts under plain Node —
// same reason lib/db/*.ts does it (see tsconfig.json).
import type { ToolDefinition } from "./types";
import { createDbClient } from "../../db/client.ts";
import { WRITABLE_TABLES } from "./db-tables.ts";

interface PendingDelete {
  table: string;
  ids: string[];
  traceId: string;
  expiresAt: number;
}

const TTL_MS = 15 * 60 * 1000;
/** One pending delete per user — a fresh propose overwrites any older one.
 *  Module-level and in-memory: a dev hot-reload or process restart just
 *  clears it, and the model re-proposes. Fine for a single local user. */
const pending = new Map<string, PendingDelete>();

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export const deleteDatabaseTool: ToolDefinition = {
  name: "delete_database",
  sourceId: "db_query",
  description:
    "Deletes rows from the user's own workspace database (jobs, companies, documents, ai_memories, contacts, link_categories, links, ai_tool_prompts). SAFETY: the first call never deletes anything — it returns the exact matching rows and the SQL that would run, and you must show that to the user and stop. Only call this tool again — with the exact same table and ids — after the user explicitly confirms in a LATER message. Never call it a second time in the same reply.",
  parameters: {
    type: "object",
    properties: {
      table: { type: "string", enum: Object.keys(WRITABLE_TABLES) },
      ids: {
        type: "array",
        items: { type: "string" },
        description: "Row ids to delete — get them from query_database or a prior write_database result.",
      },
    },
    required: ["table", "ids"],
  },
  execute: async (args, ctx) => {
    const table = typeof args.table === "string" ? args.table : "";
    const def = WRITABLE_TABLES[table];
    const ids = Array.isArray(args.ids)
      ? args.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];
    if (!def || ids.length === 0) {
      return {
        content: `Invalid delete: table must be one of ${Object.keys(WRITABLE_TABLES).join(", ")}, and ids must be a non-empty array of strings.`,
        citations: [],
      };
    }

    const db = createDbClient();
    const { data: rows, error: fetchError } = await db
      .from(table)
      .select("*")
      .eq(def.ownerCol, ctx.userId)
      .in("id", ids);
    if (fetchError) {
      return { content: `Couldn't look up ${def.label} rows: ${fetchError.message}`, citations: [def.label] };
    }
    const found = (rows ?? []) as Record<string, unknown>[];
    if (found.length === 0) {
      pending.delete(ctx.userId);
      return { content: `No ${def.label} rows found for those ids — nothing to delete.`, citations: [def.label] };
    }
    const foundIds = found.map((r) => String(r.id));

    const existing = pending.get(ctx.userId);
    const currentTraceId = ctx.traceId ?? "";
    const isConfirming =
      !!existing &&
      existing.table === table &&
      sameIds(existing.ids, foundIds) &&
      existing.expiresAt > Date.now() &&
      existing.traceId !== currentTraceId;

    if (isConfirming) {
      pending.delete(ctx.userId);
      const { error: delError } = await db.from(table).delete().eq(def.ownerCol, ctx.userId).in("id", foundIds);
      if (delError) {
        return { content: `Delete failed: ${delError.message}`, citations: [def.label] };
      }
      return {
        content: `Deleted ${found.length} row(s) from ${def.label} (ids: ${foundIds.join(", ")}).`,
        citations: [def.label],
      };
    }

    pending.set(ctx.userId, { table, ids: foundIds, traceId: currentTraceId, expiresAt: Date.now() + TTL_MS });
    const summary = found.map((r) => `  - ${r.id}: ${JSON.stringify(r).slice(0, 200)}`).join("\n");
    const sql = `DELETE FROM ${table} WHERE id IN (${foundIds.map(() => "?").join(",")}) AND ${def.ownerCol} = ?`;
    return {
      content:
        `About to delete ${found.length} row(s) from ${def.label}:\n${summary}\n\n` +
        `SQL: ${sql}\n\n` +
        `This has NOT run yet. Show this to the user and ask them to confirm. Only call delete_database again, with the same table and ids, after they say yes in their next message.`,
      citations: [def.label],
    };
  },
};
```

- [ ] **Step 2: Add the gate tests to the verify script**

In `scripts/verify-db-write-delete.ts`, add the import:

```ts
import { deleteDatabaseTool } from "../lib/ai/tools/delete-database.ts";
```

Then add these three `runTest` calls inside `main()`, after the `findOrCreateByName` test and before the `passed`/`failed` summary:

```ts
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
```

- [ ] **Step 3: Run it and confirm all 4 checks pass**

Run: `node scripts/verify-db-write-delete.ts`
Expected: `TOTAL: 4 | PASSED: 4 | FAILED: 0`

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools/delete-database.ts scripts/verify-db-write-delete.ts
git commit -m "feat(ai-tools): add delete_database with a turn-separated confirm gate"
```

---

### Task 4: `write_database` tool — insert/update with FK and board-list resolution

**Files:**
- Create: `lib/ai/tools/write-database.ts`

**Interfaces:**
- Consumes: `WRITABLE_TABLES`, `FK_NAME_FIELDS`, `findOrCreateByName` from `./db-tables.ts` (Task 2); `ensureApplication(db: DbClient, userId: string, jobId: string): Promise<void>` from `@/lib/actions/board` (existing, [lib/actions/board.ts:291](../../../lib/actions/board.ts)).
- Produces: `export const writeDatabaseTool: ToolDefinition` — registered in Task 5.

- [ ] **Step 1: Write `lib/ai/tools/write-database.ts`**

```ts
// Creates or updates rows in the user's own workspace database. Executes
// immediately — no confirmation (unlike delete-database.ts). See
// docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// Uses the @/* alias like the rest of lib/ai/tools/ (not relative-.ts, unlike
// db-tables.ts/delete-database.ts) because ensureApplication pulls in
// lib/actions/board.ts -> @/lib/auth, which is Next-only regardless — there's
// no standalone-runnability to gain by relativizing just this file.
import type { ToolDefinition } from "./types";
import { createDbClient, type DbClient } from "@/lib/db/client";
import { ensureApplication } from "@/lib/actions/board";
import { WRITABLE_TABLES, FK_NAME_FIELDS, findOrCreateByName } from "./db-tables";

/** Never settable by the model, on any table. */
const ALWAYS_BLOCKED = new Set(["id", "user_id", "status", "created_at", "updated_at"]);

/** Board columns a job can be placed in by name (case-insensitive) or by kind
 *  (wishlist/preparing/applied/interview/offer/accepted/rejected/custom). */
async function resolveBoardList(
  db: DbClient,
  userId: string,
  identifier: string
): Promise<{ id: string; kind: string } | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const { data: byKind } = await db
    .from("board_lists")
    .select("id,kind")
    .eq("user_id", userId)
    .eq("kind", trimmed.toLowerCase())
    .maybeSingle();
  if (byKind) return { id: byKind.id as string, kind: byKind.kind as string };

  const { data: byName } = await db
    .from("board_lists")
    .select("id,kind")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (byName) return { id: byName.id as string, kind: byName.kind as string };

  return null;
}

/** Appends a job to the end of `listId`'s column — no drag-precision reordering. */
async function nextBoardPosition(db: DbClient, userId: string, listId: string): Promise<number> {
  const { data: last } = await db
    .from("jobs")
    .select("board_position")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .order("board_position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(last?.board_position) || 0) + 1000;
}

export const writeDatabaseTool: ToolDefinition = {
  name: "write_database",
  sourceId: "db_query",
  description:
    'Creates or updates a row in the user\'s own workspace database (jobs, companies, documents, ai_memories, contacts, link_categories, links, ai_tool_prompts). Executes immediately, no confirmation needed. For jobs: pass `company` (a name) instead of company_id and it is found or created automatically; pass `list` (the board column\'s name or kind, e.g. "MCQ" or "applied") instead of list_id to place or move the job there — entering an Applied-kind column automatically creates the matching application record, same as dragging the card. Never pass `status` — it is derived automatically from the column the job is in. `action: "update"` requires the row\'s `id` (look it up with query_database first if you don\'t have it); `action: "insert"` creates a new row (documents and ai_tool_prompts don\'t support insert here — update only).',
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["insert", "update"] },
      table: { type: "string", enum: Object.keys(WRITABLE_TABLES) },
      id: { type: "string", description: "Row id. Required for update, ignored for insert." },
      values: {
        type: "object",
        description: "Column name -> new value. Unknown or blocked columns are dropped and reported back in the result.",
      },
    },
    required: ["action", "table", "values"],
  },
  execute: async (args, ctx) => {
    const action = args.action === "insert" || args.action === "update" ? args.action : null;
    const table = typeof args.table === "string" ? args.table : "";
    const def = WRITABLE_TABLES[table];
    if (!action || !def) {
      return {
        content: `Invalid write: action must be "insert" or "update", table must be one of ${Object.keys(WRITABLE_TABLES).join(", ")}.`,
        citations: [],
      };
    }
    if (action === "insert" && !def.allowInsert) {
      return { content: `${def.label} does not support creating new rows through chat — update an existing one instead.`, citations: [def.label] };
    }
    if (action === "update" && !def.allowUpdate) {
      return { content: `${def.label} does not support updates through chat.`, citations: [def.label] };
    }
    const rowId = typeof args.id === "string" ? args.id : "";
    if (action === "update" && !rowId) {
      return { content: 'Update requires an "id" — look the row up first (e.g. with query_database).', citations: [def.label] };
    }
    const rawValues = args.values && typeof args.values === "object" ? (args.values as Record<string, unknown>) : {};

    const virtualFields = new Set<string>((FK_NAME_FIELDS[table] ?? []).map((fk) => fk.virtualField));
    if (table === "jobs") virtualFields.add("list");

    const allowedCols = new Set(action === "insert" ? def.insertColumns : def.updateColumns);
    const values: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, val] of Object.entries(rawValues)) {
      if (virtualFields.has(key)) continue;
      if (ALWAYS_BLOCKED.has(key) || !allowedCols.has(key)) {
        dropped.push(key);
        continue;
      }
      values[key] = val;
    }

    const db = createDbClient();
    const notes: string[] = [];

    for (const fk of FK_NAME_FIELDS[table] ?? []) {
      const raw = rawValues[fk.virtualField];
      if (typeof raw === "string" && raw.trim()) {
        const resolved = await findOrCreateByName(db, fk.table, ctx.userId, raw);
        if ("error" in resolved) notes.push(`Could not resolve "${fk.virtualField}": ${resolved.error}`);
        else values[fk.column] = resolved.id;
      }
    }

    let targetListKind: string | null = null;
    if (table === "jobs") {
      const rawList = typeof rawValues.list === "string" && rawValues.list.trim() ? rawValues.list : undefined;
      // Every job must land in a column or it's invisible on /board — default
      // new jobs to Wishlist when no column was given, matching
      // app/api/extension/add-job/route.ts. Updates leave list_id untouched
      // when `list` is omitted (a normal partial update).
      const listIdent = rawList ?? (action === "insert" ? "wishlist" : undefined);
      if (listIdent) {
        const list = await resolveBoardList(db, ctx.userId, listIdent);
        if (list) {
          values.list_id = list.id;
          targetListKind = list.kind;
          values.board_position = await nextBoardPosition(db, ctx.userId, list.id);
        } else {
          notes.push(
            `Board column "${listIdent}" not found — left where it was. Use the exact column name or kind (wishlist/preparing/applied/interview/offer/accepted/rejected).`
          );
        }
      }
    }

    if (action === "update" && Object.keys(values).length === 0) {
      return { content: "Nothing to update after dropping unknown/blocked fields.", citations: [def.label] };
    }

    const selectCols = ["id", ...Object.keys(values).filter((c) => c !== "user_id")].join(",");

    if (action === "insert") {
      values.user_id = ctx.userId;
      const { data, error } = await db.from(table).insert(values).select(selectCols).single();
      if (error || !data) {
        return { content: `Insert into ${def.label} failed: ${error?.message ?? "unknown error"}`, citations: [def.label] };
      }
      const newId = data.id as string;
      if (table === "jobs" && targetListKind === "applied") await ensureApplication(db, ctx.userId, newId);
      const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
      const extra = notes.length ? ` ${notes.join(" ")}` : "";
      return { content: `Created ${def.label} row ${newId}: ${JSON.stringify(data)}.${droppedNote}${extra}`, citations: [def.label] };
    }

    const { data, error } = await db
      .from(table)
      .update(values)
      .eq("id", rowId)
      .eq(def.ownerCol, ctx.userId)
      .select(selectCols)
      .maybeSingle();
    if (error) {
      return { content: `Update to ${def.label} failed: ${error.message}`, citations: [def.label] };
    }
    if (!data) {
      return { content: `No ${def.label} row with id ${rowId} for this user — nothing updated.`, citations: [def.label] };
    }
    if (table === "jobs" && targetListKind === "applied") await ensureApplication(db, ctx.userId, rowId);
    const droppedNote = dropped.length ? ` (ignored: ${dropped.join(", ")})` : "";
    const extra = notes.length ? ` ${notes.join(" ")}` : "";
    return { content: `Updated ${def.label} row ${rowId}: ${JSON.stringify(data)}.${droppedNote}${extra}`, citations: [def.label] };
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`ensureApplication`'s first parameter type is `Awaited<ReturnType<typeof getUser>>["supabase"]`, which is `Awaited<ReturnType<typeof createDbClient>>` — the same as `DbClient` — so passing the `db` created via `createDbClient()` here type-checks without a cast.)

- [ ] **Step 3: Manual smoke test (this file is Next-only, not standalone-testable — see Global Constraints)**

Run: `npm run dev`, open the app, open a chat, enable "Database Access" (currently labelled "Database Query") in Workspace Sources (Task 6 renames it), and in the general assistant:
1. Ask it to create a job: title + a company name it hasn't seen before + `list: "MCQ"` (or any existing custom board column name). Confirm: a `companies` row appears for that name, the job appears in that board column, and (if you point it at a column whose kind is `applied`) an `applications` row exists for the job.
2. Ask it to update that job's `description`. Confirm the change shows on the job detail page.
3. Ask it to move the job into an `applied`-kind column by name, then check `/applications` — an application row should now exist.

Expected: all three land without the model claiming it can't write.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/tools/write-database.ts
git commit -m "feat(ai-tools): add write_database (insert/update) with FK and board-list resolution"
```

---

### Task 5: Register the tools

**Files:**
- Modify: `lib/ai/tools/registry.ts`
- Modify: `lib/ai/agents/registry.ts`

**Interfaces:**
- Consumes: `writeDatabaseTool` (Task 4), `deleteDatabaseTool` (Task 3).

- [ ] **Step 1: Register in the tool registry**

In `lib/ai/tools/registry.ts`, add the imports next to the existing `queryDatabaseTool` import:

```ts
import { queryDatabaseTool } from "./query-database";
import { writeDatabaseTool } from "./write-database";
import { deleteDatabaseTool } from "./delete-database";
```

And add both to the `TOOL_REGISTRY` array, right after `queryDatabaseTool`:

```ts
export const TOOL_REGISTRY: ToolDefinition[] = [
  searchJobsTool,
  getResumeTool,
  searchContactsTool,
  searchLinksTool,
  searchAiPromptsTool,
  searchMemoriesTool,
  queryDatabaseTool,
  writeDatabaseTool,
  deleteDatabaseTool,
  readObsidianTool,
  searchGithubTool,
  webSearchTool,
];
```

- [ ] **Step 2: Add to the `general` agent and the persona-fallback tool list**

In `lib/ai/agents/registry.ts`, in the `general` agent's `tools` array, add the two new names after `"query_database"`:

```ts
  general: {
    id: "general",
    name: "General Assistant",
    badge: "Versatile",
    icon: "Sparkles",
    description: "All-purpose career, coding, and productivity assistant",
    systemPrompt: "You are atTrack AI, a helpful, precise, and professional career & software engineering assistant.",
    tools: [
      "search_jobs",
      "get_resume",
      "search_contacts",
      "search_links",
      "search_ai_prompts",
      "search_memories",
      "query_database",
      "write_database",
      "delete_database",
      "read_obsidian",
      "search_github",
      "web_search",
    ],
  },
```

Then do the same in `getAgent()`'s persona-fallback tool list (the second, identical-looking array near the bottom of the file):

```ts
      tools: [
        "search_jobs",
        "get_resume",
        "search_contacts",
        "search_links",
        "search_ai_prompts",
        "search_memories",
        "query_database",
        "write_database",
        "delete_database",
        "read_obsidian",
        "search_github",
        "web_search",
      ],
```

`ats_coach`, `interviewer`, `outreach`, `code_architect`, `negotiator`, `market_analyst`, `career_strategist` are left unchanged — `code_architect` keeps `query_database` only.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/tools/registry.ts lib/ai/agents/registry.ts
git commit -m "feat(ai-tools): register write_database and delete_database for the general agent"
```

---

### Task 6: UI copy — rename the source and fix the stale approval claim

**Files:**
- Modify: `lib/ai-chatbot/workspace.ts`
- Modify: `components/ai-chatbot/workspace-connection-drawer.tsx`

- [ ] **Step 1: Rename the source's display name**

In `lib/ai-chatbot/workspace.ts`, inside `deriveWorkspaceSources`, find the `db_query` entry:

```ts
    {
      id: "db_query",
      type: "db_query",
      name: "Database Query",
      kind: "native",
      recordCount: 0,
      lastSync: null,
      enabled: false,
      toolName: "query_database",
      auth: { status: "none" },
    },
```

Change `name` only (id/type stay `"db_query"` for storage/back-compat):

```ts
    {
      id: "db_query",
      type: "db_query",
      name: "Database Access",
      kind: "native",
      recordCount: 0,
      lastSync: null,
      enabled: false,
      toolName: "query_database",
      auth: { status: "none" },
    },
```

- [ ] **Step 2: Fix the `DbQueryInfo` panel copy**

In `components/ai-chatbot/workspace-connection-drawer.tsx`, find:

```tsx
function DbQueryInfo() {
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
        <Database className="size-3.5 text-primary" />
        Local SQLite Database Connection
      </div>
      Direct read-only connection to your local database tables (jobs, contacts, links, prompts).
      <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
        🔒 <strong>Human-in-the-loop approval:</strong> The agent cannot execute database queries without your permission. It will always present the query proposal and wait for your explicit approval before running it in SQLite.
      </div>
    </div>
  );
}
```

Replace with:

```tsx
function DbQueryInfo() {
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
        <Database className="size-3.5 text-primary" />
        Local SQLite Database Connection
      </div>
      Direct read, create, and update access to your local database tables (jobs, companies, contacts, links, prompts, memories). Reads and writes run immediately.
      <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
        🔒 <strong>Deletes need your OK:</strong> the agent always shows the exact rows and SQL it wants to delete first. Nothing is removed until you confirm in your next message.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, and visually confirm**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors or warnings.

Then `npm run dev`, open Workspace Sources, expand "Database Access", confirm the new copy renders correctly in both light and dark theme.

- [ ] **Step 4: Commit**

```bash
git add lib/ai-chatbot/workspace.ts components/ai-chatbot/workspace-connection-drawer.tsx
git commit -m "fix(ai-chatbot): rename Database Query source, correct stale approval copy"
```

---

### Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (catches anything `tsc --noEmit` alone wouldn't, e.g. server/client boundary issues).

- [ ] **Step 4: Re-run the standalone verify script**

Run: `node scripts/verify-db-write-delete.ts`
Expected: `TOTAL: 4 | PASSED: 4 | FAILED: 0`

- [ ] **Step 5: Manual chat smoke test**

Repeat Task 4 Step 3's three checks, then additionally in the same chat:
1. Ask the assistant to delete the scratch job you just created. Confirm the reply shows the exact row and `DELETE FROM jobs …` SQL, and the job is still on the board afterward.
2. Reply "yes, delete it." Confirm the assistant calls the tool again and the job disappears from the board.

Expected: the delete never happens on the first ask — only after the explicit follow-up.

- [ ] **Step 6: Final commit (if anything changed during verification)**

```bash
git status
# if clean, nothing to do — Task 6's commit was the last one.
```

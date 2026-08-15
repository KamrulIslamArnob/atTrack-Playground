# AI chatbot: database write + delete tools

**Date:** 2026-08-15 · **Status:** approved, moving to implementation plan

## Problem

The chatbot's only database tool (`query_database`, [lib/ai/tools/query-database.ts](../../../lib/ai/tools/query-database.ts)) is read-only by design. The user wants it to create, update, and delete workspace rows directly — e.g. "I gave an MCQ test at w3engineers, add that job to the MCQ column" — instead of refusing and asking the user to do it manually. Writes and updates should execute immediately (local, single-user database, low stakes). Deletes must show the exact rows/query first and only run after the user explicitly confirms.

## Architectural constraint

`generateTextWithToolsStream` ([lib/ai/providers.ts:1246](../../../lib/ai/providers.ts)) runs exactly **one** non-streaming tool round per user turn, then streams the final answer — the model cannot chain "look this up" → "use the result" across two tool calls inside one turn. This shapes the design:

1. A propose-then-confirm delete is naturally turn-separated: the model cannot self-confirm within the same reply it proposed a delete in, because confirming requires a second HTTP request (a later user turn).
2. Any write needing a name→id lookup (company name → `company_id`, board list name → `list_id`) must resolve internally in a single call — the model can't do a lookup call then a write call in one turn.

## Scope

Tables: `jobs`, `companies`, `documents`, `ai_memories`, `contacts`, `link_categories`, `links`, `ai_tool_prompts` — the same set `query_database` already reads, plus `companies` (needed to attach a job/contact to a company by name). Chosen over "everything in the schema" to keep the initial blast radius matched to what's already readable.

## Tool 1 — `write_database` (insert / update, executes immediately)

- `sourceId: "db_query"` — same Workspace Sources toggle `query_database` uses today ("Database Query", off by default). Enabling it grants read + write + delete-with-confirm together; no second toggle.
- Params: `{ action: "insert" | "update", table, id?, values: Record<string, unknown> }`. `id` required for `update`, ignored for `insert`.
- Owner column (`user_id`) is always forced to `ctx.userId` — never taken from `values`, so cross-user writes are impossible regardless of what the model passes.
- Per-table writable-column allowlist (anything in `values` outside the list is silently dropped and named back in the tool result, so the model/user can see what didn't apply):
  - `jobs`: `title`, `description`, `location`, `deadline`, `application_url`, `application_email`, `application_process`, `employment_type`, `work_location`, `salary_range`, `source`, `notes`, `skills`, `state`. Plus two virtual fields (see below): `company`, `list`.
  - `companies`: `name`, `website`, `location`, `founded_year`, `company_type`, `country`.
  - `documents`: `name`, `is_default` (update only — creating a resume row without an uploaded file is meaningless, so `insert` is rejected for this table).
  - `ai_memories`: `title`, `description`.
  - `contacts`: `name`, `role`, `email`, `phone`, `position`, `linkedin_url`, `github_url`, `notes`. Plus virtual field `company`.
  - `link_categories`: `name`, `sort_order`.
  - `links`: `title`, `url`, `notes`, `tags`. Plus virtual field `category`.
  - `ai_tool_prompts`: `system_prompt` (update only — `kind` rows are pre-seeded, one per kind per user via a UNIQUE constraint; no chat-driven insert).
- Always blocked, every table: `id`, `user_id`, `status` (jobs — trigger-derived from `list_id`, per [CLAUDE.md](../../../CLAUDE.md)), `created_at`, `updated_at`.
- **FK name-resolution** (so one call suffices, per the architectural constraint above): a small declarative resolver map handles `jobs.company` / `contacts.company` → find-or-create in `companies` by case-insensitive name, and `links.category` → find-or-create in `link_categories` by name. Resolved id replaces the virtual field before the write.
- **`jobs.list`** (name or `kind`, e.g. `"MCQ"` or `"applied"`): resolves the user's `board_lists` row (case-insensitive name match, or exact `kind` match), sets `list_id`, and appends `board_position` (current column max + 1000, matching the pattern in [app/api/extension/add-job/route.ts](../../../app/api/extension/add-job/route.ts) — no drag-precision reordering). If the resolved list's `kind === "applied"`, calls the already-exported `ensureApplication()` ([lib/actions/board.ts:291](../../../lib/actions/board.ts)) after the write — same idempotent-application logic the board drag path uses, so that CLAUDE.md invariant holds instead of being bypassed by a raw column write. Unresolvable list name → row still writes, tool result says so and leaves `list_id` untouched (or null on insert, i.e. unfiled — never a hard failure).
- Returns the written row (re-selected) as the tool result content, so the model can summarize it back to the user.

## Tool 2 — `delete_database` (propose → confirm, never same-turn)

- Same `sourceId: "db_query"`, same table list as above.
- Params: `{ table, ids: string[] }`.
- Server-side pending-delete state: one in-memory `Map<userId, { table, ids, traceId, expiresAt }>` (module-level in the tool file; a process restart or dev hot-reload clearing it is fine — the model just re-proposes). TTL 15 minutes.
- `ToolContext`/`ToolExecutionContext` gains an optional `traceId` field, threaded from the per-turn `traceId` already minted in [lib/ai-chatbot/pipeline.ts](../../../lib/ai-chatbot/pipeline.ts). This is the real confirmation gate — not model self-restraint.
- Call behavior:
  - If no pending record matches this exact `userId` + `table` + `ids` set (or one exists but is expired, or its `traceId` equals the *current* call's `traceId` — i.e. it would be a same-turn self-confirm): fetch the rows (owner-scoped), build a human-readable summary and the literal `DELETE FROM <table> WHERE id IN (…) AND user_id = ?` text, store/overwrite the pending record with the current `traceId`, return the proposal. **Nothing is deleted.**
  - Else (pending matches, unexpired, different `traceId`): run the delete owner-scoped, clear the pending record, return a success summary.
- System prompt addition instructs the model to present the proposal and stop — only call the tool again after the user affirmatively confirms in a later message, never in the same reply.

## Wiring

- Register both tools in `TOOL_REGISTRY` ([lib/ai/tools/registry.ts](../../../lib/ai/tools/registry.ts)).
- Add `"write_database"` and `"delete_database"` next to `"query_database"` in the `general` agent's tool list and the `CHAT_PERSONAS` fallback list in [lib/ai/agents/registry.ts](../../../lib/ai/agents/registry.ts). Not added to the specialist personas that don't have `query_database` today (ats_coach, interviewer, outreach, negotiator, market_analyst, career_strategist). `code_architect` keeps `query_database` only (no write/delete — it's a code-review persona, not a data-entry one).

## UI copy fix

[components/ai-chatbot/workspace-connection-drawer.tsx](../../../components/ai-chatbot/workspace-connection-drawer.tsx) `DbQueryInfo` panel currently claims *reads* need approval ("agent cannot execute database queries without your permission") — that was never actually true for `query_database`, which always executed immediately. Replace with copy that matches the real behavior: reads and writes execute immediately once this source is enabled; deletes always show the exact rows and SQL first and only run after an explicit follow-up confirmation. Source display name changes from "Database Query" to "Database Access".

## Explicitly out of scope (this pass)

- Bulk/filter-based updates or deletes (only explicit `id`/`ids`).
- Board-position drag precision (append-to-end only).
- Every other schema table (`applications`, `interviews`, `positions`, `job_deadlines`, `smtp_config`, `extension_config`, …) — not opened up in this pass.
- A separate toggle for write/delete distinct from read — they share one switch.

## Verification

No automated test runner in this repo (per CLAUDE.md). Verification is `npx tsc --noEmit`, `npm run lint`, and a manual chat smoke test (enable "Database Access" in Workspace Sources, ask the general assistant to create a job into a named board column, then ask it to delete a scratch row and confirm the two-turn gate holds).

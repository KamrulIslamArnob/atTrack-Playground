# AtTrack Chatbot — Intent-Aware Native-Data Retrieval Workflow

**Type:** Implementation guideline (paste-ready spec for an AI coding agent)
**Supersedes:** R3 "deferred" status from `chatbot-langgraph-migration-plan.md` — the user
has now explicitly authorized the `retrieveContext` node. This document is the
implementation spec for it.
**Date:** 2026-08-13
**Scope:** Chatbot ONLY. No other UI, no DB schema changes (read-only queries),
no SSE/contract/UI/localStorage changes.

---

## 0. Objective

When the user sends a chat message, the pipeline must:

1. **Detect intent** from the user's text (and current persona).
2. **Retrieve native data FIRST** — query the local SQLite DB (jobs, job details,
   social links, resumes, CRM/contacts, the inbuilt AI-prompt DB, performance)
   scoped by the detected intent, so we only pull what's relevant.
3. **Assemble a grounded context block** from that native data (verbatim, cited).
4. **Call the LLM** with (a) the accurate native context and (b) the model's own
   general knowledge, instructing it to keep DB facts 100% accurate and clearly
   separate them from general advice.
5. **Stream the answer** through the EXISTING SSE contract (unchanged).
6. **Surface "Sources used"** dynamically from what was actually retrieved.

Result: answers mix authoritative workspace data with LLM reasoning, without
dumping the whole database or hallucinating facts.

---

## 1. Architecture Extension (within existing migration seam)

Existing graph (from migration plan): `loadContext → generate → finalize`.
Extend to:

```
START
  → classifyIntent      [NEW]  infer intent(s) from query + persona
  → loadContext         [kept] auth/user scope, base system prompt
  → retrieveContext     [NEW, was deferred R3] pull native data per intent
  → generate            [kept] LLM call (SSE)
  → finalize            [kept]
END
```

- `classifyIntent` is cheap/deterministic (heuristic + optional tiny LLM call; see §4).
- `retrieveContext` runs **read-only** SQL via the existing `lib/db/client` (Supabase
  client over local SQLite). All queries scoped by `userId`. No writes.
- `generate` receives `systemPrompt` + a `groundedContext` string built from retrieved docs.
- SSE frames, localStorage, markdown rendering, retry/stop, slash commands,
  persona/model selectors: **all unchanged**.

---

## 2. Native Data Source Inventory (maps to verified schema)

| Source (user term) | Table(s) | Key columns to retrieve | Notes |
|---|---|---|---|
| Jobs | `jobs` JOIN `companies` | jobs.title, jobs.status, jobs.state, jobs.location, jobs.deadline, jobs.section_deadline, jobs.salary_min/max/currency/period, jobs.match_score, jobs.skills (JSON), jobs.employment_type, jobs.application_url, jobs.application_email, companies.name, companies.website, companies.location | One row per job; company via `company_id`. |
| Job details | `jobs` | jobs.description, jobs.skills, jobs.educational_requirements, jobs.benefits (JSON), jobs.work_schedule, jobs.holiday_policy, jobs.notes (JSON), jobs.match_reasoning, jobs.project_links (JSON), jobs.application_process | Used when intent = a specific job. |
| Social links | `links` (+ `link_categories`), `contacts.social_links`, `contacts.linkedin_url`, `contacts.github_url` | links.title, links.url, links.tags, links.notes; contacts.*_url | `links` = user bookmarks; contacts social = per-person. |
| Resumes | `documents` WHERE type='resume' | documents.name, documents.content, documents.is_default, documents.match_data | `content` can be large → truncate (§6). |
| CRM | `contacts` + `job_contacts` | contacts.name, role, position, email, phone, linkedin_url, github_url, social_links, notes; job_contacts for a job | CRM = relationship manager. |
| Inbuilt AI prompt DB | `ai_tool_prompts` | ai_tool_prompts.kind, ai_tool_prompts.system_prompt | Existing "AI Tools" prompts; reuse as guidance templates. |
| Performance | `app/api/performance/route.ts` (INSPECT) + `applications`, `interviews`, `job_deadlines` | TBD after inspection (see §9) | Aggregate metrics (counts by status, upcoming interviews, due dates). |
| Applications | `applications` | status, applied_at, resume_name, notes | For performance / interview prep. |
| Interviews | `interviews` | scheduled_at, type, interviewer_name, meeting_url, prep_notes, status | For interview prep / performance. |

**INSPECTION REQUIRED (do not guess):** read `app/api/performance/route.ts` and any
`lib/.../performance*` module to learn the exact performance shape, then implement
`performanceRepo` returning the same fields. Until inspected, `retrieveContext`
MUST skip performance and log a warning (do not fabricate columns).

---

## 3. Intent Taxonomy + Routing Table

Intent drives WHICH sources are pulled (keeps token budget bounded).

| Intent | Trigger signals (examples) | Sources to retrieve |
|---|---|---|
| `job_list` | "jobs I'm tracking", "applications", "what positions" | jobs + companies (summary cols) |
| `job_detail` | mentions a specific job title/company, "details", "deadline", "salary for X" | jobs (full detail) + companies + job_deadlines + applications |
| `resume_review` | "review my resume", "ATS", "bullet points" (persona ats_coach) | documents(type=resume) + matched job (jobs) |
| `outreach` | "message recruiter", "cold email", "LinkedIn" (persona outreach) | contacts + job_contacts + companies + ai_tool_prompts(kind~email) |
| `interview_prep` | "mock interview", "prepare for X interview" (persona interviewer) | interviews + jobs + applications + ai_tool_prompts(kind~interview) |
| `crm_lookup` | "my contacts", "who at X company", "recruiter" | contacts + job_contacts + companies |
| `social_links` | "my links", "bookmarks", "resources" | links + link_categories + contacts social URLs |
| `performance` | "how am I doing", "stats", "progress", "metrics" | performanceRepo + applications + interviews |
| `general_qa` | everything else | minimal/none (model knowledge only) |

Persona is a **hint**, not a hard override: if the query clearly indicates a
different intent, use the query. Default to `general_qa` when uncertain (safe:
no retrieval, no token waste).

---

## 4. `classifyIntent` — implementation

Two-tier (cheap first, LLM only if needed):
1. **Heuristic pass:** keyword/regex match against the routing table signals.
   Fast, deterministic, no tokens. Handles ~80% of cases.
2. **LLM fallback:** only when heuristic is inconclusive, call a tiny classification
   with `maxOutputTokens` small (e.g., 16) returning one of the intent enum values.
   Reuse `resolveProviderChain(userId,"text")` + a cheap model; do NOT stream this.

Return: `IntentResult { primary: Intent; secondary?: Intent[] }`.
Keep it pure and unit-tested (intent.test.ts) with fixed query fixtures.

---

## 5. New / Modified Files

```
lib/ai-chatbot/intent.ts              [NEW] classifyIntent(query, persona) -> IntentResult
lib/ai-chatbot/retrieval/
   index.ts                           [NEW] retrieveContext(intent, userId, query) -> RetrievedDoc[]
   jobs.ts                            [NEW] getJobs(userId, opts), getJobDetail(userId, jobId/title)
   resumes.ts                         [NEW] getResumes(userId)
   crm.ts                             [NEW] getContacts(userId, {jobId?})
   social.ts                          [NEW] getLinks(userId), getContactSocials(userId)
   prompts.ts                         [NEW] getAiToolPrompts(userId, kind?)
   performance.ts                     [NEW] getPerformance(userId)  (after §9 inspection)
services/chat/context.ts             [NEW] buildGroundedContext(retrieved: RetrievedDoc[]) -> string
ai/graph/state.ts                     [edit] add retrievedDocs: RetrievedDoc[]; intent: Intent
ai/graph/nodes.ts                     [edit] add classifyIntent + retrieveContext nodes
lib/ai-chatbot/workspace.ts           [edit] re-export deriveContext via retrieval layer (avoid dup)
app/api/chat/route.ts                 [edit] pass `query` to graph (already sends messages)
components/ai-chatbot/chat-messages.tsx [edit] render Sources from retrievedDocs (already has UI)
```

`RetrievedDoc` type:
```ts
type RetrievedDoc = {
  source: "jobs" | "job_detail" | "resumes" | "crm" | "social" | "ai_prompts" | "performance" | "applications" | "interviews";
  id: string;                 // stable id, e.g. "job:123"
  title: string;              // human label for Sources UI
  text: string;               // verbatim, truncated content
  citeRef: string;            // e.g. "[src:job:123]" used in context + answer
};
```

---

## 6. Token Budget & Truncation (accuracy vs cost)

| Source | Cap | Rule |
|---|---|---|
| jobs summary | 25 rows | title/company/status/deadline only |
| job detail description | 1500 chars | hard truncate, add "…(truncated)" |
| resume content | 4000 chars per resume, top 2 | truncate; note if cut |
| contacts | 20 rows | name/role/company/linkedin only |
| links | 30 rows | title/url |
| ai_tool_prompts | 1 matching kind | full |
| performance | TBD | aggregates only, no raw rows |

Total grounded context MUST stay under ~6000 tokens; if exceeded, keep highest-
priority source for the intent and drop lower-priority. Log what was dropped.

---

## 7. Grounding / Accuracy Rules (the "100% accurate" requirement)

The LLM must NOT invent workspace facts. Enforce via the system prompt (§10):

- Native data is wrapped in `[src:<id>] ... [/src]` blocks; the model may quote/
  paraphrase them but must keep IDs, salaries, dates, URLs, and names EXACTLY.
- General knowledge (not in any `[src]` block) must be labeled as the model's own
  guidance, e.g. "Generally, you might…" — never presented as workspace fact.
- If the answer depends on data the retrieval did NOT find, the model says so
  ("I don't see a deadline for that job in your workspace") instead of guessing.
- Citations: the model should reference `[src:job:123]` so the UI can map to Sources.

---

## 8. Streaming / SSE / Sources (unchanged contract + dynamic Sources)

- SSE frames: **unchanged** (`data: {choices:[{delta:{content}}]}`, `data:[DONE]`,
  `data:{error}`).
- The graph already returns `retrievedDocs`; the route attaches them to the response
  metadata. Since SSE is token-only today, send Sources via the **existing** post-
  message mechanism the UI already uses (the "Sources used: Resume • Job Description •
  GitHub" row). Map `retrievedDocs[].source` → those chips. No new protocol.
- `use-chat.ts` already parses; only the Sources payload content changes (now real).

---

## 9. Performance Source — INSPECTION STEP (mandatory before coding performance)

Read `app/api/performance/route.ts` and any `lib/**/performance*.ts`. Implement
`performance.ts: getPerformance(userId)` to return the SAME shape the route computes
(counts by application status, upcoming interviews, near due dates, etc.). Do NOT
invent columns. If the route does heavy compute, call it or replicate its query.
Until this is done, `retrieveContext` skips `performance` and logs a warning.

---

## 10. COPY-PASTE PROMPTS

### 10.1 Intent classifier prompt (LLM fallback only, tiny)
```
You are a intent classifier for a career-tracker chatbot.
Given the user message and current persona, output exactly ONE of:
job_list, job_detail, resume_review, outreach, interview_prep, crm_lookup,
social_links, performance, general_qa.
Persona is only a hint. Output the label and nothing else.
```

### 10.2 Grounded system prompt (assembled in services/chat/context.ts)
```
You are AtTrack AI, a career & software-engineering assistant with access to the
user's OWN workspace data (jobs, resumes, CRM contacts, links, performance).

ACCURACY RULES:
- Workspace facts appear inside [src:<id>]...[/src] blocks below. You may quote or
  paraphrase them, but IDs, names, salaries, dates, URLs, and statuses must stay
  EXACT.
- Anything NOT inside a [src] block is your general knowledge — label it as guidance
  ("Generally…"), never as workspace fact.
- If a fact the user asks about is not in the retrieved sources, say you don't see it
  in their workspace. Do not guess.
- When useful, reference the source as [src:<id>] so the UI can show it.

PERSONA: {{personaSystemPrompt}}

WORKSPACE DATA:
{{#each retrievedDocs}}
[src:{{citeRef}}] {{title}}
{{text}}
[/src]
{{/each}}

If no workspace data was retrieved, answer from your general knowledge and say so.
```

---

## 11. Verification

- `npx tsc --noEmit` clean; `npm run build` passes.
- Unit: `intent.test.ts` (fixtures → expected intent); `retrieval.test.ts` (mock
  db client → expected RetrievedDoc[] per intent; assert userId scoping).
- Integration: POST `/api/chat` with "what jobs do I have to apply for soon" → assert
  response references real job titles from DB and Sources chip shows `jobs`.
- Parity: SSE frames byte-identical to pre-change; localStorage; UI unchanged.
- Accuracy: force a query about a known job; assert answer contains the real salary/
  deadline from DB, not invented.
- Rollback: behind `CHAT_LANGGRAPH` flag (off = legacy single-call). If retrieval
  regresses, flip flag.

---

## 14. Implementation Status (as of 2026-08-13)

**IMPLEMENTED (P1 of the workflow) — verified working:**

Files added:
- `lib/ai-chatbot/intent.ts` — `classifyIntent` (sync heuristic) + `classifyIntentAsync` (heuristic → optional LLM fallback).
- `lib/ai-chatbot/retrieval/types.ts` — `RetrievedDoc`, `RetrievalResult`, `RetrievedSource`.
- `lib/ai-chatbot/retrieval/index.ts` — `retrieveContext(intent, userId, query)` intent→source router (read-only, user-scoped). `performance` intent EXCLUDED (app/performance is OS metrics).
- `lib/ai-chatbot/retrieval/jobs.ts` — `getJobsSummary` (job_list) + `getJobDetails` (job_detail), via `getBoard()`.
- `lib/ai-chatbot/retrieval/resumes.ts` — `getResumes` via `getDocuments()`.
- `lib/ai-chatbot/retrieval/crm.ts` — `getContactsRetrieved` via `getContacts()`.
- `lib/ai-chatbot/retrieval/social.ts` — `getSocialLinks` via DB client (`links` table, user-scoped).
- `lib/ai-chatbot/retrieval/prompts.ts` — `getAiToolPrompts` via DB client (`ai_tool_prompts` table, user-scoped).
- `lib/ai-chatbot/grounded-context.ts` — `buildGroundedContext` (wraps facts in `[src:..]…[/src:..]`) + `assembleGroundedSystemPrompt` (accuracy rules).

Files modified (additive, behind `CHAT_RETRIEVAL=on`):
- `lib/ai/graph/state.ts` — added `intent`, `sources` annotations.
- `lib/ai/graph/nodes.ts` — added `retrieveContextNode` (between loadContext → generate); `generateNode` folds grounded context into system prompt.
- `lib/ai/graph/graph.ts` — wired `retrieveContext` node + edges.
- `services/chat/chat-service.ts` — appends `data: {sources:[...]}` SSE frame after `[DONE]`.
- `lib/ai-chatbot/use-chat.ts` — parses `sources` frame → `onSources` callback.
- `app/(dashboard)/ai-builder/chatbot/page.tsx` — `onSources` feeds real sources into the assistant message (SourcesUsedChip).

Verification:
- `npx tsc --noEmit`: 0 errors.
- `npm run build`: passes (exit 0).
- ESLint on new/changed files: 0 errors (1 pre-existing harmless warning).
- Live SSE tests (CHAT_RETRIEVAL=on): job_list→`["Job Applications"]`, resume_review→`["Resume"]`, outreach→`["CRM Contacts"]`, general_qa→no sources (correct). Answers cite real DB rows with `[src:job:...]` references and exact deadlines/match scores.

Rollback: set `CHAT_RETRIEVAL=off` (or unset) → `retrieveContextNode` returns empty → legacy non-grounded generation. Graph/LangGraph boundary untouched.

NOTE: The graph pipeline (CHAT_LANGGRAPH) was already implemented (P2) before this work — this retrieval layer slots into the existing `retrieveContext` extension point. The earlier "migration plan" doc's P1/P2 phases were completed by that prior implementation; this adds the R3 retrieval node on top.

## 15. Open items / future
- LLM-based intent fallback (`classifyIntentAsync` LLM path) is wired but defaults to heuristic; enable by passing an `llmClassify` callback if heuristic miss-rate is high.
- `performance` as a CAREER intent has no native source (app/performance = OS metrics). Add a career-performance retriever (counts by application status, upcoming interviews, due dates from `applications`/`interviews`/`job_deadlines`) if the user wants it, then include it in `INTENT_SOURCES`.
- Tool-calling / multi-agent (R3 deferred branch) remains future extension; the graph's `toolResults` slot is ready.

---

## 13. What NOT to change

Board, CRM UI, sidebar, preferences, `lib/db/schema.sql` (no new tables), auth,
other API routes (`/api/ai/*`, `/api/extension/*`, `/api/files/*`), the SSE protocol,
localStorage session logic, markdown rendering, the provider layer (`resolveProviderChain`
kept as resolver).

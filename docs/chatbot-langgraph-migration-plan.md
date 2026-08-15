# atTrack Chatbot → LangChain / LangGraph Migration Plan

**Document type:** Consolidated migration contract (planning artifact, not implementation)
**Date:** 2026-08-13
**Author role:** Principal AI Architect + Senior Next.js Backend Engineer + LangGraph Migration Specialist
**Status:** Planning complete · implementation not started · reversible
**Scope ruling:** Infrastructure migration only — behavioral parity, no chatbot feature expansion

---

## 0. Guiding Principle

> This is an **infrastructure migration**, not a chatbot feature expansion.
> The first implementation target must achieve **behavioral parity** with the
> existing chatbot while creating a clean LangGraph boundary that can later
> accommodate tools, retrieval, memory, or more sophisticated workflows
> **without another architectural rewrite**.

Operating rules applied throughout: inspect before assuming, preserve behavior
first, no unnecessary nodes (LangGraph used as a seam, not for novelty), keep
the migration reversible, and never break the existing SSE / localStorage / UI
contracts.

---

## 1. Verified Current-State Findings (evidence-based, not assumed)

These were read directly from the repository.

| Concern | Finding | Evidence |
|---|---|---|
| Chat persistence | **Client-only `localStorage`** — no server-side chat tables; messages are not in the DB today | `lib/ai-chatbot/sessions.ts:135` `STORAGE_KEY = "attrack_ai_chat_sessions"`; `saveSessions` → `localStorage` |
| Chat data flow | Client sends the **entire message array** each POST; server splits last = user turn, rest = history (as text) | `app/api/chat/route.ts:21-29` |
| Request → LLM | Single streaming call: `assembleChatSystemPrompt()` → `generateTextStream(chain, …)` | `app/api/chat/route.ts:31-69` |
| Provider layer | `resolveProviderChain(userId, "text")` → decrypts `ai_providers` keys → `generateTextStream`. Gemini = native SDK; Anthropic/OpenAI = raw `fetch` | `lib/ai/providers.ts:93-473` |
| Streaming protocol | SSE: `data: {choices:[{delta:{content}}]}` … `data: [DONE]`; error frame `data: {error}` | `lib/ai/providers.ts:393, 439, 459`; consumed in `lib/ai-chatbot/use-chat.ts` |
| Workspace context (RAG-like) | **Not vector/RAG** — SQL query of jobs/resumes/contacts, injected as a text block into the prompt | `lib/ai-chatbot/workspace.ts`; `app/api/chat/workspace/route.ts` |
| Tools / function-calling | **None present.** No `tool_call`, `tools:`, `createTool`, `structuredOutput`, `@langchain`, `langgraph` anywhere in repo | repo-wide grep: 0 results |
| Embeddings / vector DB | **None.** No `pgvector` / embeddings / retriever | repo-wide grep: 0 results |
| Auth | **Single-user.** `getUser()` resolves a local owner; no login / sessions / multi-tenancy | `lib/auth.ts:20-30` |
| Rate limiting / billing / quota | **None enforced.** `ai_usage_logs` *logs* tokens but nothing gates usage; no billing/quota tables | `lib/db/schema.sql:374-388`; grep: 0 results |
| Middleware | **No `middleware.ts`** | `ls middleware.ts` → none |
| Retry / cancel / regenerate | Client has retry (`onRetry` → `reload`) + stop (abort); persisted in localStorage | `components/ai-chatbot/chat-messages.tsx`, `chat-input.tsx` |
| DB engine | Local **SQLite** (WAL), schema in `lib/db/schema.sql`; no RLS; single owner row | `lib/db/schema.sql:1-39` |
| Models | 5 personas, 5 models (Gemini / Anthropic / OpenAI / DeepSeek); selected client-side | `lib/ai-chatbot/sessions.ts:15-121` |

**Architectural conclusion:** the chatbot today is a **linear
`input → prompt → model → streamed response`** pipeline. There is currently **no
multi-step reasoning, no tool routing, no retrieval graph** that would justify a
heavy LangGraph state machine. That finding shaped the entire migration.

---

## 2. Project Discovery Request (original, §45)

Sent before design. Grouped REQUIRED / HIGH / OPTIONAL.

### 🔴 REQUIRED
- **R1 · Migration intent** — faithful wrapper vs. agentic graph.
- **R2 · Conversation persistence target** — keep localStorage vs. move to DB.
- **R3 · Tools / function-calling** — now or deferred.
- **R4 · Streaming contract freeze** — keep SSE verbatim.

### 🟠 HIGH PRIORITY
- **H1 · LangChain model-binding swap** — replace raw SDK calls with LangChain bindings?
- **H2 · LangGraph deployment model** — in-process vs. LangGraph Platform.
- **H3 · LangSmith / observability + data-egress policy.**
- **H4 · Browser-extension ↔ chat coupling.**
- **H5 · Retry / branch semantics.**

### 🟢 OPTIONAL
- **O1 · Exact dependency versions** (Next 16.2.12, React 19 already confirmed).
- **O2 · Cost controls** (token budget / max-tool-calls / per-turn cap).
- **O3 · Future multi-user** plans.
- **O4 · Conversation export** (markdown/JSON) must survive unchanged.

---

## 3. User-Confirmed Decisions (R1–R4)

| ID | Decision |
|---|---|
| **R1** | **(a)** — keep current chatbot behavior; migrate infrastructure only. Do **not** expand scope into tools/RAG/agents during this migration. |
| **R2** | **localStorage** stays as the client-side conversation/state source of truth. No server chat persistence introduced in this migration. |
| **R3** | **Deferred.** Tools, retrieval/RAG, multi-agent behavior designed for future extensibility but **not implemented** now. |
| **R4** | **Keep existing SSE contract intact.** Frontend continues consuming the stream without a UI/client rewrite. |

---

## 4. H1–H5 Resolved with Project Evidence

| Item | Resolution | Evidence / Rationale |
|---|---|---|
| **H1** | **No per-provider swap.** Preserve existing calls; LangGraph wraps them, does not replace them. | `lib/ai/providers.ts` uses native `@google/genai` (`:156`,`:375`), raw `fetch` Anthropic (`:186`), raw `fetch` OpenAI-compatible (`:230`). LangChain `.stream()` chunking/multimodal assembly diverges from the exact `data:{choices:[{delta:{content}}]}` frames (`:393`) → would break R4 parity. Swap only if a provider's behavior cannot be preserved. |
| **H2** | **In-process**, inside the existing Next.js backend. | Avoids new deployment, minimizes infra change, low latency, simple auth/context propagation, easy rollback, small migration. Consistent with `standalone` removed from `next.config.ts` (it generated a corrupt `app.asar` that panicked Turbopack). LangGraph Platform only if requirements later justify. |
| **H3** | **Do not enable external tracing** (LangSmith) until a data-egress policy exists. Use local structured logging. | Chatbot processes resume/job/contact data (potentially sensitive); single-user local posture; "no secrets/PII to client" rule. External tracing deferred. |
| **H4** | **Confirmed decoupled; leave extension untouched.** | Code review: `app/api/extension/*` does not reference `/api/chat`; no shared session/response-format dependency found. |
| **H5** | **No branching.** Graph stays `loadContext → generate → finalize`. Retries handled inside `generate` (success→finalize; failure→retry policy→generate). | Current UI is retry-only. No multi-agent routing, autonomous loops, conditional branches, tool-selection, or RAG branches this migration. |

**H1–H5 default rule:** resolve uncertainty through project evidence; where a
decision is required now, choose the **smallest architecture** that achieves the
LangGraph migration without changing chatbot behavior.

---

## 5. Locked Architectural Direction

```
Existing Next.js Chat UI  (unchanged, includes applied polish)
        │
        │ Existing SSE contract  (R4 preserved, byte-for-byte)
        ▼
Next.js Chat API  (app/api/chat/route.ts — flag-branched)
        │
        ▼
services/chat  (ChatService: build input, run graph, translate events→SSE)
        │
        ▼
ai/graph  (LangGraph StateGraph)
        ├── loadContext
        ├── generate
        └── finalize
        │
        ▼
Existing AI Provider Layer  (resolveProviderChain + encrypted ai_providers; calls unchanged)
```

Preserved:
- `lib/ai/providers.ts` → extracted into the AI/provider layer (resolver kept)
- `prompt.ts` → centralized prompt layer
- `workspace.ts` → chat/workspace context service
- LangGraph `StateGraph` → orchestration boundary
- Existing SSE → preserved
- Existing localStorage behavior → preserved
- Existing chatbot UI → preserved
- Existing DB / application features → untouched unless discovery proves otherwise
- Legacy implementation → retained behind a feature flag during migration
- Tools / RAG / multi-agent → future extension points only

---

## 6. Executive Summary

Wrap the existing single-call chat pipeline in a minimal, **in-process**
LangGraph `StateGraph` (`loadContext → generate → finalize`) behind a
`services/chat` boundary, keeping the SSE contract verbatim, localStorage as the
chat source of truth (no DB chat tables), the existing UI untouched, and
`resolveProviderChain` + encrypted `ai_providers` as the resolver. The legacy
route stays behind a feature flag for rollback. No tools/RAG/multi-agent nodes
are implemented; graph state carries empty extension slots for later.

---

## 7. Current Architecture (verified)

- **UI:** `components/ai-chatbot/*` + `app/(dashboard)/ai-builder/chatbot/page.tsx` — sends full message array via `use-chat.ts` SSE parser.
- **API:** `app/api/chat/route.ts` — POST; builds `systemPrompt`; calls `generateTextStream(chain, …)` as SSE.
- **Provider layer:** `lib/ai/providers.ts` — `resolveProviderChain` → decrypt keys → Gemini (native SDK) / Anthropic / OpenAI (raw fetch); streams; logs usage.
- **Context:** `lib/ai-chatbot/workspace.ts` — SQL pull → text block.
- **Persistence:** localStorage only. No server chat rows.
- **Streaming:** SSE, chain[0] only streams (no mid-stream fallback — preserved).

---

## 8. Target Architecture

```
Chat UI (unchanged)
   │ SSE (unchanged contract)
   ▼
app/api/chat/route.ts        ← API boundary: auth, validate, invoke service, map SSE
   ▼
services/chat                ← ChatService: build graph input, run graph, translate events→SSE
   ▼
ai/graph (StateGraph)
   loadContext ─▶ generate ─▶ finalize
   ▼
ai/provider (existing calls, fed by resolveProviderChain)
   ▼
Existing AI Provider Layer (resolved providers + usage log)
```

DB / other app features: **untouched**.

---

## 9. LangGraph Design

### 9.1 Graph State (`ai/graph/state.ts`)

```ts
interface ChatGraphState {
  userId: string;
  model: string;
  personaId: string;
  messages: Message[];                 // full array from client
  workspaceContext: string | null;     // filled by loadContext
  systemPrompt: string | null;         // filled by loadContext
  // --- future extension slots (empty this migration) ---
  retrievedDocs: unknown[];            // RAG later
  toolResults: unknown[];              // tools later
  error: string | null;
}
```
No chain-of-thought / hidden reasoning is stored in persisted or client-visible state.

### 9.2 Nodes

| Node | Responsibility | Side effects | Failure mode |
|---|---|---|---|
| `loadContext` | call `deriveContext` (workspace.ts) + `assembleChatSystemPrompt`; populate `workspaceContext` / `systemPrompt` | none (read-only SQL) | on error → set `error`, END |
| `generate` | resolve chain → call existing provider stream → emit tokens | logs usage (preserve) | pre-first-token: try next hop; mid-stream: emit `error` frame, END |
| `finalize` | no-op close (localStorage is client-side) | none | n/a |

### 9.3 Edges

```
START → loadContext → generate → finalize → END
```
Conditional edges for `retrieveContext` / `toolExecution` are **documented but
not wired** (future flag). No loops. Per Rule 6, no unnecessary nodes.

### 9.4 Why LangGraph is justified here
Per your directive, LangGraph is used as an **orchestration seam**, not for
novelty. The 3-node graph is deliberately minimal; the payoff is that future
tools/RAG/memory slot into the same `StateGraph` (new nodes + conditional edges)
without another rewrite. Trade-off (extra deps for a simple pipeline) is accepted
because the seam is the deliverable.

---

## 10. Streaming Architecture (R4 preserved)

- Graph invoked with `graph.streamEvents(input, { version: "v2" })`.
- API route maps `on_chat_model_stream` deltas → `data: {choices:[{delta:{content}}]}`.
- On graph/LLM error → `data: {error}` frame.
- On completion → `data: [DONE]`.
- **Contract byte-for-byte identical** to `lib/ai/providers.ts:393, 439, 459` → `use-chat.ts` unchanged.

---

## 11. Feature Parity Matrix

| Feature | Current | New | Phase | Test | Risk | Rollback |
|---|---|---|---|---|---|---|
| Streaming tokens | SSE deltas | `streamEvents`→same SSE | P2 | e2e token match | Low | flag→legacy |
| SSE `[DONE]` | providers.ts:439 | graph close | P2 | curl tail | Low | flag→legacy |
| `data:{error}` | providers.ts:459 | graph error→frame | P2 | forced fail | Low | flag→legacy |
| Provider fallback (chain) | providers.ts runChain | same, chain[0] streams | P2 | kill key #1 | Med | flag→legacy |
| Workspace context | workspace.ts | loadContext node | P1 | snapshot match | Low | flag→legacy |
| Personas / system prompt | sessions.ts + prompt.ts | loadContext | P1 | prompt diff | Low | flag→legacy |
| Model override (client) | route.ts:54 | service maps | P2 | model echo | Low | flag→legacy |
| localStorage sessions | sessions.ts | untouched | — | manual | None | n/a |
| Retry / stop (client) | use-chat / chat-input | untouched | — | manual | None | n/a |
| Usage logging | logAiUsage | preserved in generate | P2 | db row | Low | flag→legacy |
| UI / markdown / avatars | components | untouched | — | visual | None | n/a |

---

## 12. Protected Application Surface (explicitly NOT modified)

- All non-chat UI (board, CRM, sidebar, preferences, dashboard, links, deadlines).
- `lib/db/schema.sql` (no chat tables added), `lib/db/*`.
- `lib/auth.ts`, `lib/ai/providers.ts` *resolver* (kept; only the call-site inside the graph changes), `ai_usage_logs` write path.
- `app/api/chat/workspace/route.ts` (consumed by `loadContext`, unchanged).
- `app/api/ai/*`, `app/api/extension/*`, `app/api/files/*`, `app/api/database/*`, `app/api/performance/*`.
- `next.config.ts` (already fixed: `standalone` removed to stop Turbopack `app.asar` panic).

---

## 13. Migration Phases (incremental, reversible)

- **P0 Audit** — ✅ done (this discovery).
- **P1 Extract** — move `prompt.ts` + `workspace.ts` under `services/chat` + `ai/graph` as pure, tested functions. Legacy route still calls them in place. *No behavior change.*
- **P2 Graph** — add `ai/graph/{state,nodes,graph}.ts`; `services/chat` runs graph; `app/api/chat/route.ts` flag-branched to map events→SSE. Legacy path retained behind `CHAT_LANGGRAPH=on|off`.
- **P3 Parity** — regression suite (token-stream diff, error frame, fallback, model override, workspace). Ship flag=off (legacy) → flip to on after green.
- **P4 Observe** — run with LangGraph on; compare usage logs / latency.
- **P5 Remove legacy** — only after stable period; delete legacy branch (Rule 10).

---

## 14. Rollback Strategy

- Feature flag `CHAT_LANGGRAPH` (env). `off` = current `generateTextStream` route; `on` = graph route.
- Every P1/P2 step independently testable; if P2 regresses, flip flag → legacy instantly.
- No DB migration to reverse (localStorage untouched). Legacy code removed only in P5.

---

## 15. Folder Structure (new only)

```
lib/ai-chatbot/
   prompt.ts            → services/chat/prompt.ts        (moved, pure)
   workspace.ts         → services/chat/workspace.ts      (moved, pure)
   sessions.ts          (unchanged, localStorage)
lib/ai/
   providers.ts         (resolver kept; call-site moved)
   graph/
      state.ts          [NEW]
      nodes.ts          [NEW: loadContext, generate, finalize]
      graph.ts          [NEW: StateGraph compile]
services/chat/
   chat-service.ts      [NEW: input build + run + SSE translate]
app/api/chat/route.ts   (flag-branched)
```

---

## 16. ADRs

- **ADR-1 LangGraph vs plain chain** — LangGraph chosen (per directive) but minimal 3-node graph; avoids future rewrite when tools/RAG added. Trade-off: extra dep for simple pipeline — accepted because the seam is the deliverable.
- **ADR-2 localStorage stays** — no server chat persistence this migration → graph runs stateless per request; clean `conversationService` seam left for future DB move.
- **ADR-3 SSE frozen** — API layer translates graph events→existing SSE; UI untouched.
- **ADR-4 In-process graph** — no LangGraph Platform (deployment simplicity; consistent with removed `standalone`).
- **ADR-5 Provider calls preserved (H1)** — existing `providers.ts` call paths unchanged; LangChain is not substituted for the LLM SDKs this migration.

---

## 17. Dependency Changes

**Add:** `@langchain/core`, `@langchain/langgraph`.
**Do NOT add (per H1):** `@langchain/google-genai`, `@langchain/anthropic`, `@langchain/openai` — existing native/raw calls are preserved.
**Keep:** `@ai-sdk/*`, `@google/genai` (board AI tools still use `generateText` non-graph path during migration — do **not** remove until P5).

---

## 18. Definition of Done

- All parity-matrix tests pass; SSE byte-identical; workspace snapshot identical; provider fallback + usage log preserved; UI/markdown/avatars unchanged; `flag=off` restores legacy; zero unrelated features broken.

---

## 19. Risk Register (top)

| Risk | Sev | Mitigation |
|---|---|---|
| Graph event mapping diverges from SSE | Med | P3 diff test vs legacy curl |
| Provider fallback differs | Med | reuse `resolveProviderChain`; chain[0] streams |
| New dep breaks build | Low | P1 typed, tsc + lint gate |
| Usage log lost | Low | preserve `logAiUsage` call in generate |

---

## 20. Next Step

Begin **P1 (Extract)**: move `prompt.ts` / `workspace.ts` under `services/chat` +
`ai/graph` as pure functions with tests, leaving the legacy route running —
zero behavior change, fully reversible. The route and providers call-site are
**not** touched until P2.

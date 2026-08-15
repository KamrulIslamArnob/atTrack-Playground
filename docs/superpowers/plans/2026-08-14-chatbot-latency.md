# Chatbot latency — verification + implementation plan

Date: 2026-08-14
Scope: `lib/ai/providers.ts`, `lib/ai-chatbot/pipeline.ts`, `lib/ai-chatbot/prompt.ts`, `lib/ai/embeddings.ts`, `lib/ai-chatbot/retrieval/hybrid.ts`

---

## Part 1 — Verification of the 3 recommendations

### R1. Instant token streaming — **CONFIRMED. Biggest single win.**

`executeAgent` ([pipeline.ts:262](../../../lib/ai-chatbot/pipeline.ts#L262)) routes to the tool path when:

```ts
const hasToolIntent =
  ctx.intentResult.primary !== "general_qa" ||
  /\b(search|find|query|lookup|fetch|show|list|get|check|calculate|analyze|run|save|update|create|delete|sql)\b/i.test(ctx.userPrompt);
const needsTools = toolDeclarations.length > 0 && !ctx.hasImages && hasToolIntent;
```

Every agent in `lib/ai/agents/registry.ts` declares tools, so `toolDeclarations.length > 0` is always true. That regex matches most real questions. **The tool path is the common path, not the exception.**

That path calls `generateTextWithTools` — fully non-streaming, up to `MAX_TOOL_ROUNDS = 4` sequential provider round-trips — then `streamResponse` ([pipeline.ts:354](../../../lib/ai-chatbot/pipeline.ts#L354)) emits the whole answer as **one** SSE frame:

```ts
if (result.toolResultText) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result.toolResultText } }] })}\n\n`));
}
```

Perceived TTFT = full generation time. Confirmed.

### R2. Local fast embeddings / cache query embeddings — **MOSTLY ALREADY DONE; scope much smaller than claimed.**

- LRU cache already exists — `MAX_CACHE_ENTRIES = 1000` ([embeddings.ts:131-151](../../../lib/ai/embeddings.ts#L131)).
- Deterministic local embedding already exists as the no-API fallback (`generateDeterministicEmbedding`).
- Corpus is already embedded at **write** time, not request time (`indexEntityChunks` from `lib/actions/jobs.ts:188`, `indexMemoryVector` from `lib/actions/memories.ts:64`).

The **only** request-time embedding in the chat hot path is `getSemanticMemories` → `generateEmbedding` ([hybrid.ts:171](../../../lib/ai-chatbot/retrieval/hybrid.ts#L171)), and it only fires when the query matches the memory regex or contains `@` ([retrieval/index.ts:121](../../../lib/ai-chatbot/retrieval/index.ts#L121)). That is a minority of queries, costing one Gemini `text-embedding-004` call.

Real, but worth ~100-300ms on a minority of requests. Not a 5x lever.

### R3. Fast provider priority — **CONFIRMED as a config action, not a code change.**

Groq preset already exists (`lib/types/ai-providers.ts:31`, `https://api.groq.com/openai/v1`) and routes through `callOpenAICompatible`. Chain order comes from `ai_task_routes.provider_ids` ([providers.ts:93](../../../lib/ai/providers.ts#L93)).

Caveats:
- I could not verify a Groq model named `qwen3.6-27b` exists. Pick the model from Groq's current model list at configuration time.
- Streaming for `openai_compatible` and `anthropic` providers is **fake**: `generateTextStream` calls them non-streaming and flushes one chunk ([providers.ts:452-476](../../../lib/ai/providers.ts#L452)). **Putting Groq first would currently make streaming worse, not better** — you'd lose Gemini's real token-by-token stream. This must be fixed (P2) before R3 is advisable.

---

## Part 2 — Verification of the 10 RAG points

| # | Point | Verdict | Evidence |
|---|---|---|---|
| 1 | Pre-embed corpus, keep warm | **Already done** | `indexEntityChunks` / `indexMemoryVector` run on write |
| 2 | ANN search (HNSW/IVF/PQ, Milvus/FAISS) | **Reject** | Local single-user SQLite. Corpus is 10s–100s of chunks. Brute-force 768-dim over a few hundred vectors is sub-millisecond. Adding a vector DB to a local-first Electron app is pure cost. |
| 3 | Limit top-K | **Already done** | `limit = 4`, fetches `limit * 2`; memories `limit 3` |
| 4 | Compress embeddings FP16/INT8 | **Reject** | 768×f32 = 3KB/vector. Whole corpus ≈ 1–2MB. Nothing to save. |
| 5 | Pre-compute / cache query variants | **Already done** | LRU cache, 1000 entries. Only gap: per-process, lost on restart. Marginal. |
| 6 | Parallelize retrieval & generation | **Real gap** | `executeChatPipeline` is strictly sequential; `resolveProviderChain` (DB read + `decrypt`) blocks retrieval for no reason |
| 7 | Optimize prompt templates | **Real gap** | Entire conversation history is stuffed into the **system prompt** as raw text every turn ([pipeline.ts:122-126](../../../lib/ai-chatbot/pipeline.ts#L122)), unbounded growth |
| 8 | Smaller model for first pass | **Already done** | Intent classification is pure regex, zero tokens (`lib/ai-chatbot/intent.ts`). A reranker at this corpus size would add latency, not remove it. |
| 9 | Keep hot data in RAM | **Already done** | Local SQLite file, cached connection in `getDb()` |
| 10 | Stream the answer | **Same as R1** | See above |

**Net: 6 of 10 already implemented, 2 rejected as inapplicable, 2 real (points 6 and 7).**

---

## Part 3 — Found during verification, not on either list

### F1. `logUsage` is awaited *inside* the streaming loop — **blocks the token stream**

[providers.ts:437-449](../../../lib/ai/providers.ts#L437): a DB write is `await`ed mid-stream, between token chunks. Same at :463 and in `generateTextWithTools`. Should be fire-and-forget.

### F2. `matchJobRequirementsToResume` — O(N×M) sequential awaited embeddings

[hybrid.ts:277-290](../../../lib/ai-chatbot/retrieval/hybrid.ts#L277) nests `await generateEmbedding` inside a double loop. The LRU cache reduces it to N+M unique API calls, but they are fully serial: 20 requirements × 30 resume lines ⇒ ~50 sequential calls ≈ 7s with Gemini active.

**Note: this function has no callers.** Same for `searchDocumentChunksHybrid` — document chunks are indexed but never searched from the chat path. Decide: fix cheap, or delete.

### F3. Fake streaming for non-Gemini providers

Already noted under R3. This is the blocker for the "use Groq" recommendation.

---

## Part 4 — Implementation plan

Ordered by (win ÷ risk). Tasks are independent unless noted.

### P1 — Stream the final answer on the tool path
**Files:** `lib/ai/providers.ts`, `lib/ai-chatbot/pipeline.ts`
**Depends on:** nothing

Split `generateTextWithTools` so the final round (the one that produces text rather than function calls) streams instead of buffering. Tool rounds stay non-streaming — that's inherent. `executeAgent` returns a `stream` result carrying the tool-call frames first, then the live token stream.

*Risk:* touches the tool-calling protocol fixed in CRIT-04. Do not alter the `assistantTurn` replay logic. Verify multi-round tool calls still work on Gemini before merging.

### P2 — Real incremental streaming for `openai_compatible` + `anthropic`
**Files:** `lib/ai/providers.ts`
**Depends on:** nothing (but P1 compounds with it)

Both APIs support SSE with `"stream": true`. Parse their event streams instead of the current buffer-and-flush. **Prerequisite for R3** — without this, switching to Groq removes streaming entirely.

### P3 — Don't block the stream on usage logging
**Files:** `lib/ai/providers.ts`
**Depends on:** nothing. Trivial.

`void logUsage(...).catch(() => {})` instead of `await` at the three in-stream sites.

### P4 — Cap conversation history in the system prompt
**Files:** `lib/ai-chatbot/pipeline.ts`, `lib/ai-chatbot/prompt.ts`
**Depends on:** nothing

Slice history to the last N turns (start at 8) with a token ceiling. Cuts input tokens, which is a direct TTFT reduction on every provider. Leaves the prompt prefix stable, which also helps implicit prompt caching.

### P5 — Parallelize provider resolution with retrieval
**Files:** `lib/ai-chatbot/pipeline.ts`
**Depends on:** nothing

`loadChatContext` and `retrieveChatContext` both do independent I/O. `Promise.all` them. Small (10-40ms) but free.

### P6 — Fix or delete the dead vector helpers
**Files:** `lib/ai-chatbot/retrieval/hybrid.ts`
**Depends on:** nothing

Either delete `matchJobRequirementsToResume` + `searchDocumentChunksHybrid` (no callers), or fix the nested-loop embedding: collect unique lines, one `Promise.all` batch, then a pure-sync cosine loop. **Recommend delete** — dead code with a 7-second bug in it.

### P7 — Provider configuration (user action, no code)
**Depends on:** P2

Once P2 lands, configure the `text` task route with a fast provider first. Verify the model name against Groq's current model list.

### Explicitly rejected
ANN / HNSW / Milvus / FAISS, INT8 or FP16 quantization, external vector DB, a reranker model, a persistent on-disk embedding cache. All are solutions to a corpus-size problem this app does not have.

---

## Parallelization

Can run concurrently (disjoint files/functions): **P4, P5, P6**.
Must be serialized: **P3 → P2 → P1** (all edit `lib/ai/providers.ts`; P1 depends on P2's stream plumbing for non-Gemini parity).
**P7** is a user config step after P2.

---

## Status (2026-08-14)

- [x] **P1** — final answer streams on the tool path (`generateTextWithToolsStream`)
- [x] **P2** — real SSE for `openai_compatible` + `anthropic` (`readSseData`, `streamOpenAICompatible`, `streamAnthropic`)
- [x] **P3** — `logUsageDetached`, no DB write between token chunks
- [x] **P4** — history capped to 8 turns / 6000 chars (`formatConversationHistory`)
- [x] **P5** — chain resolve runs concurrently with retrieval
- [x] **P6** — `matchJobRequirementsToResume` + `searchDocumentChunksHybrid` deleted
- [ ] **P7** — provider config (user action; P2 shipped, so this is now safe)

### Found while verifying live

- [x] **Auto-router stamped cross-vendor model ids.** `chain[0].model` was overwritten with e.g. `claude-3-5-sonnet-20241022` regardless of who `chain[0]` was, 400ing against an OpenAI-compatible endpoint and burning a failed round-trip. Pre-existing. Fixed by `MODEL_CATALOG` + vendor-matched promotion.
- [x] **`maxDuration = 60` silently truncated answers mid-sentence.** Measured: stream cut at exactly 60021ms, no error frame. Raised to 300 (local-first app, no serverless ceiling).
- [x] **Tool results folded into the follow-up prompt were uncapped** (~10KB observed). Capped at 6000 chars per tool.

- [x] **Auto-router stamped the picked model onto the wrong provider (second case).** The picker is built from the user's own provider rows, so its option ids are real provider models — but the resolver ignored that and wrote the id onto `chain[0]`, sending `models/gemini-3.6-flash` to a Longcat endpoint. `selectProviderForModel` now promotes the provider that owns the model. Regression cases for both observed 400s live in `scripts/verify-challenger-final.ts` (Item 7).

### Streaming progress indicator

`StreamProgress` in `components/ai-chatbot/chat-messages.tsx` renders elapsed
time, an approximate token count, and the phase while an answer streams:
`1m 9s · 38 tokens · writing…`. Tokens are a client-side estimate (~4
chars/token) because the provider's real usage arrives only after generation
ends — useless as progress. It sits below the content so it stays in view as
the answer grows, and outside the empty/streaming branch so its timer does not
remount at zero when the first token lands.

- [x] **The tool-selection round was sent the full grounded system prompt.** It
  only has to emit a function name and arguments, but it received the retrieved
  docs, workspace context and conversation history — making the cheap call as
  expensive as the answer. On a slow endpoint it blew past the 60s hop timeout,
  and the ungrounded fallback then ran a second full generation: `POST /api/chat
  200 in 2.0min`, with no tools used. Fixed with a ~40-token
  `TOOL_SELECTION_PROMPT`, a dedicated 30s `TOOL_ROUND_TIMEOUT_MS` so a failure
  is cheap, and `HOP_TIMEOUT_MS` raised to 120s (a 69s first token was being
  aborted at 60s despite being on track to succeed).

### Measured result

Tool-using query, live against the configured chain:

Tool-grounded query, same provider (a slow OpenAI-compatible endpoint), before
and after:

| | Before | After |
|---|---|---|
| SSE chunks for the answer | 1 buffered blob | **534 incremental** |
| Median gap between chunks | n/a | 66ms |
| Tool-call frame | after full generation | **1ms** |
| Time to first token | 69s | **6s** |
| Worst case | 2.0min, ungrounded (timeout + fallback) | answer streaming at 6s |

Read off the in-app progress indicator, which logs the transition directly:

```
0s · thinking…   →   6s · 17 tokens · writing…   →   14s · 377 tokens · writing…
```

P7 (provider reordering) is still worth doing, but it is no longer the
dominant term — prompt size for the selection round was.

## Verification per task

`npx tsc --noEmit` and `npm run lint` after each. Then exercise the chatbot in the dev server: one tool-using query (confirm tokens arrive incrementally, not in one blob) and one plain question, on each configured provider type.

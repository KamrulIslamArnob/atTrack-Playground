# atTrack Chatbot — Tool-Calling Architecture (Real Tools, Not Hardcoded)

**Date:** 2026-08-13
**Status:** IMPLEMENTED (gated behind `CHAT_TOOLS=on`)
**Replaces:** the fake "Executing workspace tools… / Sources used: Resume, Job Description, GitHub" UI, which was hardcoded in `components/ai-chatbot/chat-messages.tsx:185` and `components/ai-chatbot/tool-execution-status.tsx:54`. No tools were actually being called — `lib/ai/providers.ts` had no function-calling path.

---

## 1. Goal

Make the chatbot use **real, LLM-driven tool calls**:
1. The model decides which tools to call based on the user's message.
2. Each tool is a registered, self-contained unit with a JSON-Schema param spec + an `execute()` function.
3. You can add a new tool by dropping ONE file in `lib/ai/tools/` and registering it — no changes to the graph, provider, or UI.
4. The UI renders the **actual** tools the model called (real names, real statuses), not a hardcoded list.

## 2. Design principles (per project constraints)

- **Reuse the existing provider path** (`resolveProviderChain`). Do NOT swap to the Vercel AI SDK's tool API; the existing hand-rolled `callGemini`/`callAnthropic`/`callOpenAICompatible` stays untouched.
- **Additive only** for the shared provider layer: `generateTextWithTools` is a NEW export; `generateText`/`generateTextStream` are unchanged. Default behavior (`CHAT_TOOLS` unset/off) is byte-for-byte the pre-change path.
- **Read-only, user-scoped** tool bodies (same rule as retrieval). Tools may not mutate user data.
- **No framework** (no LangChain tool primitives). Plain TS interfaces + a registry map.
- **Honesty:** every tool's output becomes a `ToolCallRecord` surfaced to the UI. If a tool isn't called, no chip appears. `GitHub` is removed entirely (no GitHub tool exists).

## 3. Tool contract

```ts
// lib/ai/tools/types.ts
export interface ToolContext { userId: string; personaId?: string; }
export interface ToolResult { content: string; citations: string[]; } // citations -> Sources chip labels
export interface ToolDefinition {
  name: string;                       // snake_case, unique
  description: string;               // shown to the model
  parameters: Record<string, unknown>; // JSON Schema object
  personas?: string[];               // if set, only offered to these personas
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

A tool returns `content` (fed back to the model) and `citations` (human labels for the "Sources used" chip, e.g. `"Job Applications"`).

## 4. Registry — how to add a tool

`lib/ai/tools/registry.ts` holds `const REGISTRY: ToolDefinition[]`. To add a tool:
1. Create `lib/ai/tools/<my-tool>.ts` exporting a `ToolDefinition`.
2. Import it in `registry.ts` and add to `REGISTRY`.
That's it — the graph, provider loop, and UI pick it up automatically.

`listToolDeclarations(personaId?)` filters by `personas` and returns the JSON-Schema declarations for the active provider. `getTool(name)` looks up the executor.

## 5. Shipped tools (all reuse existing retrieval functions — DRY)

| Tool name | Source | Citations | Reuses |
|---|---|---|---|
| `search_jobs` | jobs board | `["Job Applications"]` | `retrieval/jobs.getJobsSummary` / `getJobDetails` |
| `get_resume` | documents | `["Resume"]` | `retrieval/resumes.getResumes` |
| `search_contacts` | CRM | `["CRM Contacts"]` | `retrieval/crm.getContactsRetrieved` |
| `search_links` | links table | `["Social Links"]` | `retrieval/social.getSocialLinks` |
| `search_ai_prompts` | ai_tool_prompts | `["AI Prompts"]` | `retrieval/prompts.getAiToolPrompts` |
| `web_search` | URL fetch | `["Web"]` | `providers.fetchUrlAsText` |

`web_search` takes a concrete `url` (the model calls it only when the user supplies a URL). Query-style web search (Tavily/Serper) is a FUTURE tool requiring an API key — documented, not faked.

## 6. Provider tool loop (`generateTextWithTools`)

New function in `lib/ai/providers.ts` (does NOT modify `generateText`/`generateTextStream`):

```
generateTextWithTools(chain, { systemPrompt, userPrompt, images }, tools, ctx, onStep, logContext)
  -> { text, toolCalls: ToolCallRecord[] }
```

Algorithm (max `MAX_TOOL_ROUNDS = 4`):
1. Take the first provider whose type supports tools (Gemini / Anthropic / OpenAI-compatible).
2. Call provider with `tools` declaration + conversation (`userPrompt`, plus any prior tool results).
3. If the model emits function calls:
   - for each call, `getTool(name).execute(args, ctx)` -> `ToolResult`; record a `ToolCallRecord {name, args, result, status}`.
   - feed results back as a `tool`/`tool_result` message; GOTO 2.
4. Else return `text` + collected `toolCalls`.
On provider failure, fall back to next hop in the chain (same resilience as `runChain`). If no provider supports tools, fall back to plain `generateText`.

Gemini uses `ai.models.generateContent` with `config.tools = [{functionDeclarations}]` and `functionCalls` in the response; OpenAI-compatible uses `tools` + `tool_calls`; Anthropic uses `tools` + `tool_use`/`tool_result`. (Non-streaming by nature — tool rounds resolve before the final answer streams.)

## 7. Graph wiring (`lib/ai/graph`)

State gains `toolCalls: ToolCallRecord[]` and `finalAnswer?: string`.
- `toolExecutorNode` (between `retrieveContext` and `generate`): if `CHAT_TOOLS === 'on'`, runs `generateTextWithTools` with the grounded system prompt + user prompt, stores `toolCalls` + `finalAnswer`. If off, returns empty (legacy path).
- `generateNode`: if `state.finalAnswer` is set, streams it as the answer (so streaming UX is preserved); otherwise does the normal single-pass generate.
- `retrieveContextNode` still runs (optional static grounding); the tool loop's results are the authoritative grounded data.

## 8. SSE contract (additive — existing token frames unchanged)

After `[DONE]`, the service appends frames:
- `data: {tool_calls:[{name,status,detail}]}`  (real steps, rendered by `ToolExecutionStatus`)
- `data: {sources:[...]}`  (real citation labels from tool results)

Clients ignore unknown frames; legacy clients unaffected.

## 9. UI changes

- `tool-execution-status.tsx`: removed the hardcoded `["Resume","Job Applications","GitHub"]` fallback. Now renders ONLY `steps` passed from the server (real tool calls) or `null` when none. No more fake "Analyzing context…" spinner with no backend.
- `chat-messages.tsx`: removed the hardcoded `["Resume","Job Description","GitHub"]` source fallback. Renders `message.sources` only when the server supplied them. When a query triggers no tools, NO chip appears (correct).
- `use-chat.ts`: parses `tool_calls` frames -> `onToolSteps` callback.
- `page.tsx`: stores real tool steps on the assistant message; passes to `ToolExecutionStatus`.

## 10. Verification

- `npx tsc --noEmit`: 0 errors.
- `npm run build`: pass.
- ESLint new/changed: 0 errors.
- Live (CHAT_TOOLS=on): a job query streams real `tool_calls:[{search_jobs,...}]` + `sources:["Job Applications"]`; a general query streams NO tool_calls and NO sources; `GitHub` never appears.

## 11. Rollback

`CHAT_TOOLS=off` (or unset) -> `toolExecutorNode` no-ops -> identical to pre-tool behavior. The shared `generateText`/`generateTextStream` are never touched by the flag.

## 13. Implementation Status (as of 2026-08-13)

**IMPLEMENTED — verified working (CHAT_TOOLS=on + CHAT_RETRIEVAL=on):**

Files added:
- `lib/ai/tools/types.ts` — `ToolDefinition`, `ToolResult`, `ToolContext`, `ToolCallRecord`.
- `lib/ai/tools/registry.ts` — `TOOL_REGISTRY`, `getTool(name)`, `listToolDeclarations(personaId?)`. **To add a tool: drop one file in lib/ai/tools/ and register it here.**
- `lib/ai/tools/search-jobs.ts`, `get-resume.ts`, `search-contacts.ts`, `search-links.ts`, `search-ai-prompts.ts`, `web-search.ts` — 6 real tools reusing the retrieval layer + `fetchUrlAsText`.
- `docs/chatbot-tool-calling-architecture.md` — this guideline.

Files modified (ADDITIVE, flag-gated `CHAT_TOOLS=on`):
- `lib/ai/providers.ts` — added `generateTextWithTools` (Gemini/OpenAI/Anthropic function-calling loop). Existing `generateText`/`generateTextStream` UNTOUCHED.
- `lib/ai/graph/state.ts` — added `toolCalls`, `finalAnswer` annotations.
- `lib/ai/graph/nodes.ts` — added `toolExecutorNode`; `generateNode` streams `finalAnswer` when the tool path produced one.
- `lib/ai/graph/graph.ts` — wired `toolExecutor` node (loadContext → retrieveContext → toolExecutor → generate → finalize).
- `services/chat/chat-service.ts` — appends `data: {tool_calls:[...]}` SSE frame (real steps).
- `lib/ai-chatbot/use-chat.ts` — parses `tool_calls` → `onToolSteps`.
- `app/(dashboard)/ai-builder/chatbot/page.tsx` — `onToolSteps` feeds real steps into the assistant message.
- `components/ai-chatbot/tool-execution-status.tsx` — REMOVED hardcoded `["Resume","Job Applications","GitHub"]` fallback; renders only real server steps.
- `components/ai-chatbot/chat-messages.tsx` — REMOVED hardcoded `["Resume","Job Description","GitHub"]` source fallback; renders only server-supplied sources.

Also tightened `lib/ai-chatbot/intent.ts`: generic "explain/framework" questions no longer trigger retrieval (only pulls workspace data when the query references the user's own data).

Verification (live, CHAT_TOOLS=on CHAT_RETRIEVAL=on):
- "which jobs should I prioritize this week?" → `tool_calls:[{search_jobs,done}]` + `sources:["Job Applications"]` ✅
- "review my resume for ats keywords" → `tool_calls:[{get_resume,done}]` + `sources:["Resume"]` ✅
- "give me a star-method framework" → NO tool_calls, NO sources ✅ (no theater)
- `GitHub` never appears (no such tool exists).

`npx tsc --noEmit`: 0 errors. `npm run build`: exit 0. ESLint new/changed: 0 errors.

Rollback: `CHAT_TOOLS=off` → `toolExecutorNode` no-ops → legacy single-pass. Shared provider functions untouched.

## 14. How to add a new tool (for the user)

1. Create `lib/ai/tools/<name>.ts`:
   ```ts
   import type { ToolDefinition } from "./types";
   export const myTool: ToolDefinition = {
     name: "my_tool",
     description: "What it does and when to call it.",
     parameters: { type: "object", properties: { q: { type: "string" } } },
     // optional: personas: ["general"],
     execute: async (args, ctx) => ({ content: "...", citations: ["My Source"] }),
   };
   ```
2. Add `myTool` to `TOOL_REGISTRY` in `registry.ts`.
Done — the graph, provider loop, SSE frames, and UI pick it up automatically. No other file changes.

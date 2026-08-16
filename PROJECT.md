# Project: atTrack AI Multi-Session Background Engine & Approval Modal

## Architecture
- **Global Background Streaming & Queue Layer**: `lib/ai-chatbot/chat-queue-context.tsx` mounted at root layout (`components/providers.tsx`) providing persistent FIFO task queues and multi-session isolated background streams that survive route transitions across `/jobs`, `/crm`, `/board`, and `/ai-builder/chatbot`.
- **Session & Message Isolation Layer**: `lib/ai-chatbot/use-chat.ts` with `messagesBySession: Record<string, ChatMessage[]>`, `loadingBySession: Record<string, boolean>`, and per-session `AbortController` maps (`abortControllersRef: Map<string, AbortController>`).
- **Two-Tier Persistence Engine**: Instant client-side `localStorage` mirror caching (`attrack_ai_chat_sessions`) + durable server-side SQLite authority (`chat_sessions`, `chat_messages` with monotonic `seq` ordering) via `lib/ai-chatbot/persistence.ts` and `app/api/chat/sessions/route.ts`.
- **Streaming SSE Protocol & Demuxing**: `lib/ai-chatbot/pipeline.ts` and `use-chat.ts` handling `tool_calls`, `approval`, `sources`, and `choices[0].delta.content` / `reasoning_content` with robust buffer preservation (`lines.pop()`) and `<think>` block extraction.
- **Safety-Gated Database Deletion**: `lib/ai/tools/delete-database.ts` (propose-only, zero direct SQL execution) + `lib/ai-chatbot/db-approval.ts` (single-use anti-replay token with server TTL) + `lib/ai-chatbot/db-approval-route.ts`.
- **Interactive 60s Approval Modal**: `components/ai-chatbot/approval-modal.tsx` with live 1-second countdown interval, under-10s visual pulse transition, target record preview, collapsible SQL inspector, Allow/Deny actions, and safe auto-cancellation on timeout.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Multi-Session Message & Stream Isolation | Messages, loading state, and abort controllers isolated per sessionId without cross-talk | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 2 | SSE Stream Framing & Thinking Demuxing | Buffer preservation for partial chunks, demuxing reasoning/thinking tags vs final text | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 3 | Per-Session Cancellation | Aborting one session's stream does not disrupt or cancel background streams in other sessions | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 4 | Global Background Queue & Route Persistence | Queue and streams mounted at root providers, persisting during route navigation | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 5 | Multi-Session Concurrency & FIFO Ordering | Independent sessions stream in parallel; tasks in same session process in FIFO order | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 6 | Two-Tier Persistence & Message Sequencing | Client localStorage mirror + SQLite authority with monotonic `seq` integer ordering | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 7 | Propose-Then-Approve Database Deletion | `delete_database` tool emits approval payload without executing SQL mutations | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 8 | Interactive Modal with 60s Countdown | Live 60s countdown, under-10s warning pulse, target preview, and collapsible SQL query | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 9 | Single-Use Anti-Replay Approval Token | Memory store with single-use token consumption preventing replay or duplicate execution | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 10 | Auto-Timeout & Safe Deny Fallback | Expiration or Deny cancels operation cleanly without mutating database records | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 11 | Multi-Session Concurrency & Adversarial E2E Tests | Verification scripts for stream isolation, 100-stream load, gated delete, and SQLite round-trip | M4 | ORIGINAL_REQUEST §Verification | DONE |
| 12 | TypeScript Compilation Verification | `npx tsc --noEmit` clean with 0 type errors | M4 | ORIGINAL_REQUEST §Verification | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Outputs |
|---|------|-------|-------------|--------|-------------|
| 1 | Isolated Streaming & Message Integrity (R1) | `lib/ai-chatbot/use-chat.ts`, SSE framing, thinking/content separation, per-session abort | none | DONE | Isolated state maps, trailing buffer flush, target session approval routing |
| 2 | Global Background Queue & Concurrency (R2) | `lib/ai-chatbot/chat-queue-context.tsx`, `components/providers.tsx`, root route persistence, SQLite sync | M1 | DONE | `drainQueue()` parallel scheduler, per-session FIFO, safe ID task cleanup |
| 3 | Interactive Approval Modal & 60s Countdown (R3) | `components/ai-chatbot/approval-modal.tsx`, `lib/ai/tools/delete-database.ts`, `lib/ai-chatbot/db-approval.ts` | M1 | DONE | Root modal deduplication, live 60s countdown, anti-replay single-use token |
| 4 | Verification & E2E Testing Suite (E2E & Typecheck) | Standalone verification scripts in `scripts/`, multi-session concurrency suite, `npx tsc --noEmit` | M1, M2, M3 | DONE | 5 suites (34 tests) passing 100%, 0 TypeScript errors |

## Interface Contracts
### `ChatQueueContext` ↔ `useAtTrackChat` & Pages
```typescript
export interface ChatTask {
  id: string;
  sessionId: string;
  query: string;
  status: "queued" | "streaming" | "completed" | "error";
  error?: string;
  createdAt: number;
}

export interface SessionStreamState {
  isStreaming: boolean;
  activeChunk: string;
  activeThinking?: string;
  sources?: ChatSource[];
  approval?: DbApprovalPayload;
  error?: string;
}

export interface ChatQueueContextValue {
  tasks: ChatTask[];
  activeStreams: Record<string, SessionStreamState>;
  enqueueMessage: (sessionId: string, query: string, attachments?: any[]) => Promise<void>;
  cancelStream: (sessionId: string) => void;
  getStreamState: (sessionId: string) => SessionStreamState | undefined;
  activeApproval: DbApprovalPayload | null;
  handleApprovalAction: (allow: boolean) => Promise<void>;
}
```

### Deletion Tool ↔ Approval Modal & Token Store
```typescript
export interface DbApprovalPayload {
  approvalId: string;
  label: string;
  preview: string;
  sql: string;
  tableName: string;
  targetCount: number;
  expiresAt: number; // timestamp in ms (Date.now() + 60_000)
}
```

## Code Layout
- `app/layout.tsx`, `components/providers.tsx`: Root level application wrapper and `ChatQueueProvider` mounting.
- `app/api/chat/route.ts`: Main AI chat streaming endpoint with SSE response generation and `dbApproval` routing.
- `app/api/chat/sessions/route.ts`: SQLite durable storage endpoints for chat sessions and sequenced messages.
- `lib/ai-chatbot/use-chat.ts`: Multi-session isolated streaming client hook.
- `lib/ai-chatbot/chat-queue-context.tsx`: Global FIFO queue & multi-session background worker context.
- `lib/ai-chatbot/persistence.ts`: Dual-layer persistence sync between localStorage and server SQLite.
- `lib/ai-chatbot/pipeline.ts`: 4-stage chat pipeline and SSE stream encoder.
- `lib/ai-chatbot/db-approval.ts`: Anti-replay single-use token storage and expiration management.
- `lib/ai/tools/delete-database.ts`: Safe database deletion tool with propose-only contract.
- `components/ai-chatbot/approval-modal.tsx`: Interactive modal with live 60-second countdown and SQL preview.
- `scripts/`: Standalone test & verification scripts for concurrency, SQLite sync, and approval gating.

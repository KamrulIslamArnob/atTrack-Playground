# Project: atTrack AI Chatbot Full Capability Suite Alignment

## Architecture
- **Framework & UI Runtime**: Next.js (App Router), React 19, `@assistant-ui/react` (v0.15.14), Tailwind CSS, Framer Motion.
- **Backend Pipeline**: `app/api/chat/route.ts` -> `lib/ai-chatbot/pipeline.ts` (4-stage pipeline: Model Resolution -> Intent Classification & Workspace Retrieval -> Multi-Round Tool Execution -> SSE Streaming).
- **Transport**: Server-Sent Events (SSE) emitting structured frames (`tool_calls`, `sources`, reasoning tokens, content token deltas).
- **Persistence**: Two-tier architecture (Local Mirror Cache + SQLite Authority Database via `lib/ai-chatbot/persistence.ts`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dynamic Model Selection | ModelSelector dropdown in Composer/Navigation supporting Auto Hybrid, Gemini, Claude, GPT-4o, DeepSeek R1, and custom provider models | M1 | Survey |
| 2 | Automatic Intent & Specialist Routing | Remove manual persona selector from user path; backend auto-classifies intent to select specialist agent & scoped tools | M1 | Survey |
| 3 | Thinking Stream Unblocking & Ingestion | Allow `<think>` tags in prompt and capture reasoning deltas in `providers.ts` & `use-chat.ts` | M1 | Survey |
| 4 | Real-Time Reasoning UI | Render reasoning stream in Assistant UI `<Reasoning>` component with active shimmer, elapsed timer, and collapsible accordion | M1 | Survey |
| 5 | Tool Execution Traces | Render tool states (pending/running/completed/failed) with argument previews and result inspection | M1 | Survey |
| 6 | HITL Gated Database Tool Approvals | Interactive approval cards for sensitive SQL/database operations with Allow/Deny controls | M1 | Survey |
| 7 | Grounded Source Citations | Display workspace source badges/citations (jobs, resumes, contacts, links, memories) | M1 | Survey |
| 8 | Artifact Canvas Integration | "Canvas" trigger button in CodeHeader opening code/markdown artifacts in interactive slide-over ChatCanvas | M1 | Survey |
| 9 | State Persistence & Session Switching Verification | Ensure SQLite persistence, localStorage mirror, and session operations remain intact | M2 | Survey |
| 10 | Programmatic Validation (Typecheck & Lint) | Ensure `npm run typecheck` and `npm run lint` pass with 0 errors | M2 | Survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Chatbot Capability Suite Alignment (R1-R4) | Integrate ModelSelector in Composer, remove PersonaSelector, unblock & stream reasoning into Assistant UI `<Reasoning>`, render tool traces & gated approval cards in `<ToolFallback>`, render grounded citations, connect Canvas trigger | none | DONE |
| 2 | End-to-End Verification & Quality Assurance | Validate persistence, session switching, workspace drawer, run typecheck (0 errors) and lint (0 errors) | M1 | DONE |

## Interface Contracts

### `lib/ai-chatbot/use-chat.ts` ↔ `app/(dashboard)/ai-builder/chatbot/page.tsx`
- `ChatMessage`: `{ id: string, role: "user" | "assistant" | "system", content: string, thinking?: string, sources?: string[], toolSteps?: ToolStep[], createdAt?: number, status?: "sending" | "done" | "error" }`
- `convertMessage(m: ChatMessage): ThreadMessageLike`: constructs `{ type: "reasoning", text, status }`, `{ type: "tool-call", toolName, argsText, result, approval }`, `{ type: "text", text }`, and `{ type: "source", title }` parts.

### `components/thread.tsx` (Composer) ↔ Model Selector
- `ModelSelector` embedded in `ComposerAction` or input footer, bound to `selectedModel` state and `onSelectModel` handler.

### `components/markdown-text.tsx` ↔ `components/ai-chatbot/chat-canvas.tsx`
- Canvas context/callback triggered from `CodeHeader` button: `openCanvas(content: string, title?: string, language?: string)`.

## Code Layout
- `app/(dashboard)/ai-builder/chatbot/page.tsx`: Main Chatbot Page & Runtime Adapter
- `components/thread.tsx`: Assistant UI Thread & Composer
- `components/reasoning.tsx`: Assistant UI Reasoning Component
- `components/tool-fallback.tsx`: Assistant UI Tool Fallback & Approval Component
- `components/source.tsx`: Assistant UI Source Badges Component
- `components/markdown-text.tsx`: Markdown Renderer with CodeHeader & Canvas Trigger
- `components/ai-chatbot/model-selector.tsx`: Dynamic Model Selector
- `components/ai-chatbot/chat-canvas.tsx`: Artifact Canvas Side-Panel
- `components/ai-chatbot/chat-canvas-context.tsx`: Artifact Canvas Context Provider & Hook
- `lib/ai-chatbot/use-chat.ts`: Chat Client State & SSE Parser Hook
- `lib/ai-chatbot/prompt.ts`: System Prompt Builder
- `lib/ai-chatbot/pipeline.ts`: Backend Pipeline & Stream Handler
- `lib/ai/providers.ts`: AI Provider Adapters & Multi-Round Tool Calling
- `lib/ai-chatbot/persistence.ts`: SQLite Chat Persistence
- `lib/db/sqlite.ts`: SQLite Column Migrations
- `lib/db/schema.sql`: SQLite DB Schema

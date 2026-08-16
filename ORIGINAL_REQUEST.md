# Original User Request

## 2026-08-17T03:07:07Z

Build and verify a rock-solid multi-session background execution engine and interactive approval modal for atTrack AI Chatbot. Ensure independent concurrent streaming across chat sessions without state collisions, message loss, or navigation glitches, plus a reliable 60-second interactive deletion approval popup.

Working directory: e:/07_Open-source/atTrack
Integrity mode: development

## Requirements

### R1. Multi-Session Isolated Streaming & Message Integrity
- Each chat session (`ChatSession`) must have fully isolated, independent streaming and message state.
- Creating a new chat or switching between chats while a query is actively generating must NOT abort, overwrite, or drop tokens from the background stream.
- When switching back to any previous chat, all generated tokens, reasoning/thinking blocks, sources, and tool steps must render intact without glitching or disappearing.
- When rapid switching occurs, optimistic message state and incoming stream chunks must be strictly keyed to `sessionId`.

### R2. Global Background Queue & Concurrency
- Chat requests must be processed in a reliable FIFO queue with concurrent background execution per distinct session ID.
- Background streams must persist seamlessly across app route changes (e.g. navigating to `/jobs`, `/crm`, `/board`, `/preferences`).
- Session messages must be durably synced to localStorage mirror and SQLite (`/api/chat/sessions`) on stream completion without race conditions.

### R3. Interactive Approval Modal with 60-Second Countdown
- When a dangerous database operation (e.g., `delete_database`) is called, execution halts and presents an interactive confirmation modal with live 60-second auto-expiration countdown.
- User can Allow (execute) or Deny (cancel), and timeout automatically cancels safely.

## Acceptance Criteria

### Session Isolation & Concurrent Streaming
- [ ] Starting a stream in Session A, immediately clicking "New Chat", and starting a stream in Session B executes both streams concurrently without state collision.
- [ ] Navigating back to Session A shows its complete generated output and conversation history.
- [ ] No empty outputs, missing text, or race conditions when rapidly switching sessions.

### Deletion Approval Modal
- [ ] Calling `delete_database` renders the high-priority modal with target data, SQL preview, and active 60s countdown timer.
- [ ] Clicking Allow executes the deletion and removes the row from the database.
- [ ] Clicking Deny or allowing the 60s timer to expire cancels the deletion and leaves data intact.

### Verification
- [ ] Automated multi-session concurrency tests pass.
- [ ] `npx tsc --noEmit` passes with 0 errors.

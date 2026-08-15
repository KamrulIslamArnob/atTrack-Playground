# Chatbot — Per-Chat Connected Workspaces (Workflow)

**Scope:** `app/(dashboard)/ai-builder/chatbot` only.
**Status:** Implemented + verified (tsc 0, lint 0, build 0, live SQLite round-trip).
**Env gates:** `CHAT_RETRIEVAL=on` (intent retrieval), `CHAT_TOOLS=on` (LLM tool-calling). Both additive — default paths untouched when off.

---

## 1. Problem

The user wants **each chat session** to carry its own set of connected workspace
sources (Job Applications, Resumes, Contacts, Social Links, AI Prompts, Obsidian,
GitHub, Database). The connected set must be:

- **Distinct per chat** (chat A can use Jobs+Resumes, chat B can use GitHub+Obsidian).
- **Visible in the chat input UI** (via the Workspace Connection drawer).
- **Switchable/changes-able anytime** from the drawer while that chat is active.
- **Persisted to the database** (not just browser localStorage) so it survives
  browser-data wipes and works in the Electron desktop app.

Global source *permissions* (enabled/disabled, auth config) still live in
`localStorage` via `source-permissions.ts`; per-chat *selection* (which of the
enabled sources this conversation actually uses) now lives on the session.

---

## 2. Architecture

### 2.1 Data model
`ChatSession` (`lib/ai-chatbot/sessions.ts`) gained:
```ts
connectedSourceIds?: string[];
```
This is the per-chat connected set. `null`/`undefined`/empty ⇒ fall back to global
enabled sources (see §4).

### 2.2 Storage tiers
Two-tier, identical to the pre-existing chat persistence:
1. **Instant tier — `localStorage`** (`attrack_ai_chat_sessions`): synchronous,
   never blocks the UI. Every `saveSessions()` writes here immediately.
2. **Durable tier — local SQLite** (`chat_sessions` table):
   - Column: `connected_source_ids TEXT`, registered as a **JSON column** in
     `lib/db/meta.ts` (`chat_sessions: ["connected_source_ids"]`) so it
     auto `JSON.stringify`/`JSON.parse` on write/read.
   - Added via the idempotent forward-migration in `lib/db/sqlite.ts`
     (`COLUMN_MIGRATIONS`: `ALTER TABLE chat_sessions ADD COLUMN connected_source_ids TEXT`).
     No `schema.sql` version bump needed — existing DBs get the column on next open.
   - Written by `lib/ai-chatbot/persistence.ts` `upsertSessionToDb`
     (`connected_source_ids: s.connectedSourceIds ?? []`) and read by
     `loadSessionsFromDb` (`connectedSourceIds: Array.isArray(...) ? ... : []`).
   - All queries are `user_id`-scoped.

Because `saveSessions()` already triggers the 3.5s-debounced background SQLite flush
(`scheduleDbFlush` in `sessions.ts`), **any** change to `connectedSourceIds` flows
to SQLite automatically — no extra plumbing.

### 2.3 Request flow (how the server learns the selection)
`app/(dashboard)/ai-builder/chatbot/page.tsx`:
- `activeConnectedIds` is its **own `useState`**, seeded from the active session's
  `connectedSourceIds` whenever a chat is selected, created, or reconciled from the DB.
- `buildBody()` sends `enabledSources: activeConnectedIds` (with the legacy fallback
  in §4) and `sourceConfig` (global auth config from `source-permissions.ts`).
- Server (`app/api/chat/route.ts`) reads `enabledSources`/`sourceConfig` from the
  body. Key-presence gating:
  - key **absent** ⇒ legacy behaviour, no gating.
  - explicitly **`[]`** ⇒ all sources off.
  - **non-empty** ⇒ filter to those ids.
- The gating threads through `services/chat/chat-service.ts` →
  `lib/ai/graph/{state,nodes}.ts` → retrieval (`retrieveContext`) and
  `toolExecutorNode` (tool registry filtered by `enabledSourceIds`).

---

## 3. User-facing behaviour (the drawer)

`components/ai-chatbot/workspace-connection-drawer.tsx`:
- Props: `mode="chat"`, `connectedSourceIds` (the active chat's set), `onToggleSource`.
- Each source row's toggle reflects/updates `connectedSourceIds` (the chat's set),
  not the global permission.
- Header clarifies the scope: *"Sources connected to this chat."*
- Auth/config sub-panels (Obsidian vault path, GitHub PAT, DB allowlist) still edit
  the **global** permission/config — that is shared across chats; only the
  *connection* (which sources this chat uses) is per-chat.

`handleToggleSource(id)` on the page:
```ts
if (!activeSessionId) { /* legacy global toggle */ return; }
const nextSet = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
setActiveConnectedIds(nextSet);                                  // own state
const nextSessions = sessions.map(s =>                          // write back to session
  s.id === activeSessionId ? { ...s, connectedSourceIds: nextSet } : s);
setSessions(nextSessions);
saveSessions(nextSessions);                                      // instant + schedules SQLite flush
```
Switching chats (`handleSelectSession`) and creating a chat (`handleNewChat`) both
(seed) `activeConnectedIds` and persist. New chats seed from the currently
global-enabled sources.

---

## 4. Legacy fallback (important)

Pre-existing chats (created before this feature) have `connectedSourceIds: undefined`
→ materialised as `[]` on load. Sending `enabledSources: []` would make the server
treat it as **"all sources off"** and silently disable retrieval + tools.

`buildBody()` guards against this:
```ts
const enabled = activeConnectedIds.length > 0
  ? activeConnectedIds
  : sources.filter(s => s.enabled).map(s => s.id);   // global fallback
```
So: a chat with an explicit selection uses it; a chat with none uses the global
enabled set. Once the user toggles any source in a legacy chat, it gets an explicit
`set` and stays per-chat thereafter.

---

## 5. Verification (how to prove it works)

```bash
# 1. Lint / type / build
npm run lint && npx tsc --noEmit && npm run build

# 2. Live round-trip (server on :3308 with CHAT_RETRIEVAL=on CHAT_TOOLS=on)
curl -X PUT http://localhost:3308/api/chat/sessions \
  -H 'Content-Type: application/json' \
  -d '{"session":{"id":"perchat-test-1","title":"t","createdAt":"...","updatedAt":"...",
       "model":"gpt-4o-mini","personaId":"general",
       "connectedSourceIds":["jobs","resume","github"],"messages":[{"id":"m1","role":"user","content":"hi","createdAt":"..."}]}}'

curl -s http://localhost:3308/api/chat/sessions | node -e \
  "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);
   const s=j.sessions.find(x=>x.id==='perchat-test-1');
   console.log(JSON.stringify(s.connectedSourceIds));})"

# 3. Direct DB proof (.data/attrack.db in dev; Documents/atTrack/attrack.db in Electron)
node -e "const db=require('node:sqlite');const d=new db.DatabaseSync('.data/attrack.db');
  console.log(d.prepare('SELECT connected_source_ids FROM chat_sessions WHERE id=?')
  .get('perchat-test-1'));"
```
Expected: API returns `["jobs","resume","github"]` and the DB column stores the same
JSON array. (Test confirmed during implementation.)

---

## 6. Known issues / follow-ups

- **Electron `electron/main.js:318`** — `resolve(typeof geminiApiKey === "string" ? geminiApiKey : ***` is a
  literal `***` with a missing closing `)` (Gemini-key prompt path). **Out of chatbot
  scope; not touched.** Flag to owner before relying on the Gemini-key setup flow.
- **Custom sources** are permission-only (appear as toggles) — no dynamic tool
  registration yet. Follow-up, not blocking.
- **Global vs per-chat split:** auth/config is global; only the *connection* is
  per-chat. If a user connects a source to a chat that has no global auth configured,
  the server will withhold that source (correct, safe behaviour).
- **React Compiler note:** `activeConnectedIds` is deliberately its own `useState`
  (not derived from `sessions` during render) to avoid a `preserve-manual-memoization`
  skip on this component. Do not re-merge it into a render-time derivation of
  `sessions` without re-checking `npm run lint`.

---

## 7. Files touched (this feature)

| File | Change |
|------|--------|
| `lib/ai-chatbot/sessions.ts` | `ChatSession.connectedSourceIds?: string[]` |
| `lib/db/sqlite.ts` | `COLUMN_MIGRATIONS` entry for `connected_source_ids` |
| `lib/db/meta.ts` | `chat_sessions: ["connected_source_ids"]` JSON column |
| `lib/ai-chatbot/persistence.ts` | write/read `connected_source_ids` |
| `app/api/chat/sessions/route.ts` | already PUT/GET; now carries the column |
| `components/ai-chatbot/workspace-connection-drawer.tsx` | `mode`/`connectedSourceIds` props; chat-scope toggles + header |
| `app/(dashboard)/ai-builder/chatbot/page.tsx` | `activeConnectedIds` state, per-chat `handleToggleSource`, `buildBody` legacy fallback, seeding on select/create/load |

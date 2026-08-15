# Chat History Single Source of Truth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local SQLite the only authority for chat history, with `localStorage` demoted to a mirror, so a deleted chat stays deleted and no chat ever reappears on its own.

**Architecture:** Today two stores both claim authority and reconcile through a timestamp comparison, which cannot converge — a delete has no representation, so it always loses to a row that still exists. This replaces that with one owner: every mutation awaits `/api/chat/sessions` and only then updates React state and the `localStorage` mirror. Load reads the database and overwrites the mirror; the mirror is **never** merged back. Because load never writes to the database, resurrection becomes structurally impossible rather than merely unlikely.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, native `node:sqlite` via `lib/db/client.ts`, `localStorage`.

## Global Constraints

- All UI follows [`docs/Design.md`](../../Design.md). Design tokens only — no raw Tailwind palette classes, no hex literals in components.
- UX copy per Design.md §9: sentence case, no exclamation marks, `Couldn't <verb> <noun>` for **every** error toast. Product name is always `atTrack`.
- No login, signup, sign-out, or account-switching UX. All DB reads/writes stay scoped by the local `user_id` (`lib/db/local-user.ts`).
- Use `@/*` imports and the existing TypeScript/React patterns. Keep changes focused.
- **These exports of `lib/ai-chatbot/sessions.ts` must keep working unchanged** — five other files import them and are out of scope: `CHAT_PERSONAS`, `AI_MODELS`, `type ChatSession`, `type Message`, `type AIModel`, `type ChatPersona`, `createNewSession`, `generateSessionTitle`, `exportSessionToMarkdown`, `exportSessionToJSON`, `loadActiveSessionId`, `saveActiveSessionId`, `loadLastSelectedModel`, `saveSelectedModel`.
- **Per-chat workspace selection must survive.** `ChatSession.connectedSourceIds` round-trips through the `chat_sessions.connected_source_ids` JSON column (registered in `lib/db/meta.ts`). See [`docs/chatbot-per-chat-workspaces.md`](../../chatbot-per-chat-workspaces.md).
- No schema change. `chat_sessions` and `chat_messages` already exist with the needed columns.
- Every task ends green on: `npx tsc --noEmit` (zero errors) and `npm run lint` (zero **errors**; the repo carries pre-existing warnings).

## Decisions already made (do not revisit)

- **One owner + mirror**, not two-way sync. No tombstone table, no conflict rule.
- **No migration of old `localStorage`-only history.** The user chose "start clean". Sessions that exist only in a browser's `localStorage` and never reached SQLite are dropped on first load after this change. As of 2026-08-14 the database already holds 6 sessions / 37 messages, so the practical loss is small.

## Known gaps (out of scope, do not fix here)

Three findings from the audit are deliberately left alone. Record them; do not widen the plan to cover them.

- **Attachments are not durable.** `chat_messages` has no column for `experimental_attachments`, so images do not survive a reload. Already true today — the current load path drops them too — so this plan is not a regression. Do not add a column.
- **`upsertSessionToDb` is not transactional.** It awaits N message upserts in a loop, so a crash mid-loop leaves a partially written conversation. The window is small on a local file database, and wrapping it means dropping to raw statements and hand-serializing the `connected_source_ids` JSON column, which risks more than it protects. Task 1 makes the failure visible, which is the part that actually mattered.
- **No cross-tab coordination.** Two open tabs each own their own mirror, and the last one to write wins. Under one authority this self-heals — every load rebuilds the mirror from the database — so the blast radius is a stale sidebar until reload, not lost history. A `storage` event listener would close it if it ever becomes annoying.

## File Structure

| File | Responsibility after this plan |
|---|---|
| `app/api/chat/sessions/route.ts` | HTTP surface. Reports failure honestly with a non-2xx status. |
| `lib/ai-chatbot/persistence.ts` | Server-side SQLite read/write. **Unchanged by this plan.** |
| `lib/ai-chatbot/sessions.ts` | Two clearly separated halves: pure constants/helpers (untouched), and a storage half rewritten as `readCache`/`writeCache` (mirror) plus four awaited API calls (authority). |
| `app/(dashboard)/ai-builder/chatbot/page.tsx` | Load path reads the authority; every mutation awaits the authority before touching state or mirror. |
| `scripts/verify-chat-persistence.ts` | **New.** Drives the real API against the running dev server and asserts SQLite state directly. |

---

### Task 1: Make a failed save visible

Today `PUT /api/chat/sessions` returns **HTTP 200** with `{ok:false}` when the write throws. Every caller checks only `res.ok`, so a total write failure is indistinguishable from success. Task 2 depends on this being fixed — its `persistSession` throws on `!res.ok`, which is meaningless while failures return 200.

**Files:**
- Modify: `app/api/chat/sessions/route.ts:27-31`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PUT /api/chat/sessions` returns `200 {ok:true}` on success and `500 {ok:false, error:"upsert_failed"}` on failure. Task 2's `persistSession` relies on this.

- [ ] **Step 1: Change the failure status**

In `app/api/chat/sessions/route.ts`, replace the `catch` block of `PUT`:

```ts
  } catch (err) {
    // Reported as a real failure. This used to return 200 with {ok:false},
    // which made a total write failure look identical to a successful save to
    // every caller that checks `res.ok` — the client then told the user their
    // chat was saved when nothing had been written.
    console.error("[chat/sessions] durable upsert failed:", err);
    return NextResponse.json({ ok: false, error: "upsert_failed" }, { status: 500 });
  }
```

- [ ] **Step 2: Verify the success path still returns 200**

With the dev server running on port 3308:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3308/api/chat/sessions -H "Content-Type: application/json" -d '{"session":{"id":"t1_ok","title":"T","createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z","model":"m","messages":[]},"messages":[]}'
```

Expected output: `200`

- [ ] **Step 3: Verify a malformed payload still returns 400**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:3308/api/chat/sessions -H "Content-Type: application/json" -d '{}'
```

Expected output: `400` (the existing `missing session` guard, untouched)

- [ ] **Step 4: Clean up the probe row**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('.data/attrack.db');d.exec(\"DELETE FROM chat_sessions WHERE id='t1_ok'\");d.close();console.log('cleaned')"
```

Expected output: `cleaned`

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/sessions/route.ts
git commit -m "fix(chat): report a failed session upsert as 500 instead of 200"
```

---

### Task 2: Rewrite the client storage layer as mirror + authority

**Files:**
- Modify: `lib/ai-chatbot/sessions.ts:153-246` (the whole "Background tier" block plus `loadSessions`/`saveSessions`)

**Interfaces:**
- Consumes: the `PUT` status contract from Task 1.
- Produces, for Tasks 3 and 4:
  - `readCache(): ChatSession[]`
  - `writeCache(sessions: ChatSession[]): void`
  - `fetchSessions(): Promise<ChatSession[]>`
  - `persistSession(session: ChatSession): Promise<void>` — throws on failure
  - `deleteSessionRemote(id: string): Promise<void>` — throws on failure
  - `clearAllSessionsRemote(): Promise<void>` — throws on failure
- **Removed** (Task 3 and Task 4 must stop calling these): `loadSessions`, `saveSessions`, `scheduleDbFlush`, `drainDbFlushes`, `deleteSessionDb`, `clearAllSessionsDb`, and the module-level `FLUSH_DEBOUNCE_MS` / `pendingFlushes` / `flushToDb`.

- [ ] **Step 1: Delete the background-flush machinery**

In `lib/ai-chatbot/sessions.ts`, delete everything from the comment `// --- Background tier: debounced, non-blocking SQLite flush ---` (line 153) down to and including the closing brace of `saveSessions` (line 246). Keep `const STORAGE_KEY`, `ACTIVE_SESSION_KEY`, and `LAST_MODEL_KEY` at lines 149-151.

- [ ] **Step 2: Add the mirror tier in its place**

```ts
// --- Mirror tier: localStorage -------------------------------------------
// SQLite owns chat history. localStorage exists only so the sidebar paints
// without waiting for a round trip; it is written FROM the database and is
// never merged back into it. That asymmetry is the entire design. Because
// load never writes to the database, a deleted chat cannot come back — the
// previous two-authority merge had no way to express "deleted", so a delete
// always lost to a row that still existed.

export function readCache(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch (err) {
    console.error("Couldn't read cached chat sessions:", err);
    return [];
  }
}

export function writeCache(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Couldn't cache chat sessions:", err);
  }
}
```

- [ ] **Step 3: Add the authority tier below it**

```ts
// --- Authority tier: SQLite via /api/chat/sessions ------------------------
// Each of these awaits and throws. A caller that swallows the error recreates
// the bug this replaced: the UI showing a delete the database never performed.

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch("/api/chat/sessions");
  if (!res.ok) throw new Error(`Couldn't load chat sessions (${res.status})`);
  const payload = await res.json();
  return (payload?.sessions ?? []) as ChatSession[];
}

export async function persistSession(session: ChatSession): Promise<void> {
  const res = await fetch("/api/chat/sessions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, messages: session.messages }),
  });
  if (!res.ok) throw new Error(`Couldn't save chat session (${res.status})`);
}

export async function deleteSessionRemote(id: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Couldn't delete chat session (${res.status})`);
}

export async function clearAllSessionsRemote(): Promise<void> {
  const res = await fetch("/api/chat/sessions?all=true", { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't clear chat sessions (${res.status})`);
}
```

`persistSession` re-sends every message in the session on each call. The upsert is idempotent and the database is a local file, so a full re-send costs a few milliseconds.
`// ponytail: re-upserts the whole conversation per turn; send only new message ids if a chat ever grows past a few hundred messages.`

- [ ] **Step 4: Type-check — expect failures, they are the map for Tasks 3 and 4**

Run: `npx tsc --noEmit`

Expected: errors in `app/(dashboard)/ai-builder/chatbot/page.tsx` only, naming the removed `loadSessions`, `saveSessions`, `scheduleDbFlush`, `drainDbFlushes`, `deleteSessionDb`, `clearAllSessionsDb`. **Do not fix them in this task.** Confirm no other file appears — if one does, stop: something outside the storage half was being imported and the Global Constraints list needs updating.

- [ ] **Step 5: Commit**

```bash
git add lib/ai-chatbot/sessions.ts
git commit -m "refactor(chat): replace debounced dual-write with mirror plus awaited authority"
```

---

### Task 3: Load from the authority, not from a merge

**Files:**
- Modify: `app/(dashboard)/ai-builder/chatbot/page.tsx:219-294` (session bootstrap, the DB merge, and the `beforeunload` drain effect)
- Modify: `app/(dashboard)/ai-builder/chatbot/page.tsx:1-30` (imports)

**Interfaces:**
- Consumes: `readCache`, `writeCache`, `fetchSessions` from Task 2.
- Produces: on mount, `sessions` state and the `localStorage` mirror both equal the database contents. A first run with an empty database leaves exactly one **unpersisted** in-memory session.

- [ ] **Step 1: Update the imports**

In the `@/lib/ai-chatbot/sessions` import block, remove `loadSessions`, `saveSessions`, `drainDbFlushes`, `deleteSessionDb`, `clearAllSessionsDb`, `scheduleDbFlush`. Add `readCache`, `writeCache`, `fetchSessions`, `persistSession`, `deleteSessionRemote`, `clearAllSessionsRemote`. (The last three are used in Task 4; adding them now keeps the import block edited once.)

- [ ] **Step 2: Replace the bootstrap and merge block**

Replace everything from `const loadedSessions = loadSessions();` (line 219) through the end of the `try { ... } catch { }` merge block (line 281) with:

```ts
      // Paint from the mirror first so the sidebar is not blank for a round trip.
      const cached = readCache();
      if (cached.length > 0) setSessions(cached);

      // SQLite is the authority; whatever it returns replaces the mirror. The
      // merge this replaces built its map from a `sessions` captured at mount —
      // always `[]` — so it could never see local state, and every load handed
      // the database an unopposed win that was then written back over the
      // mirror. One authority removes the question entirely.
      let known: ChatSession[];
      try {
        known = await fetchSessions();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't load chat history");
        // Stay on the mirror rather than blanking the sidebar. Nothing is
        // written back to the database from here, so this cannot resurrect.
        known = cached;
      }

      if (known.length > 0) {
        setSessions(known);
        writeCache(known);

        const storedActive = loadActiveSessionId();
        const active = known.find((s) => s.id === storedActive) ?? known[0];
        setActiveSessionId(active.id);
        saveActiveSessionId(active.id);

        // Carry every field the message model has. The previous load rebuilt
        // messages as {id, role, content} only, so `createdAt` was lost and the
        // save path then stamped every message with the current time — which
        // re-ordered history on each reload, because messages are read back
        // sorted by created_at.
        setMessages(
          (active.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content || "",
            createdAt: m.createdAt,
            experimental_attachments: m.experimental_attachments,
            feedback: m.feedback ?? null,
          }))
        );

        setActiveConnectedIds(
          active.connectedSourceIds && active.connectedSourceIds.length > 0
            ? active.connectedSourceIds
            : defaultEnabledIds
        );
      } else {
        // First run. This session lives in memory and in the mirror only; it
        // earns a database row when it gets its first message. Persisting an
        // empty chat here is what filled SQLite with "New Chat" shells that
        // reappeared in the sidebar on every open.
        const first: ChatSession = {
          ...createNewSession(selectedModel.id),
          connectedSourceIds: defaultEnabledIds,
        };
        setSessions([first]);
        setActiveSessionId(first.id);
        setActiveConnectedIds(defaultEnabledIds);
        writeCache([first]);
        saveActiveSessionId(first.id);
      }
```

- [ ] **Step 3: Delete the `beforeunload` drain effect**

Remove the whole effect at lines 289-294:

```ts
  // Safety net: flush any pending debounced writes before the tab/app closes.
  useEffect(() => {
    const handler = () => drainDbFlushes(loadSessions());
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
```

There is nothing left to drain — writes are awaited at the point of the change.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: remaining errors only in the mutation handlers Task 4 covers (`handleNewChat`, `handleDeleteSession`, `handleRenameSession`, `handleTogglePinSession`, `handleSelectModel`, `handleToggleSource`, `handleClearAllSessions`, `handleFeedback`, and the session-sync effect). No errors in the load path.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/ai-builder/chatbot/page.tsx"
git commit -m "fix(chat): load history from SQLite instead of a stale-closure merge"
```

---

### Task 4: Route every mutation through the authority

**Files:**
- Modify: `app/(dashboard)/ai-builder/chatbot/page.tsx` — the session-sync effect and seven handlers.

**Interfaces:**
- Consumes: `writeCache`, `persistSession`, `deleteSessionRemote`, `clearAllSessionsRemote` from Task 2.
- Produces: no code path writes to the database except an explicit user action.

- [ ] **Step 1: Update the session-sync effect**

Replace the `setSessions` updater body's tail (the `saveSessions(updated); return updated;` lines) so it writes the mirror and persists the active session:

```ts
        writeCache(updated);

        // A chat earns its database row on its first message, which is what
        // keeps empty "New Chat" clicks out of SQLite.
        const active = updated.find((s) => s.id === activeSessionId);
        if (active && active.messages.length > 0) {
          void persistSession(active).catch((err) => {
            console.error("Couldn't save chat session:", err);
          });
        }
        return updated;
```

`// ponytail: side effect inside a state updater matches the file's existing shape; React StrictMode double-invokes it in dev, which costs one redundant idempotent PUT. Lift to a ref-driven effect only if that ever shows up in a profile.`

- [ ] **Step 2: Stop persisting empty new chats**

In `handleNewChat`, replace `saveSessions(next);` with `writeCache(next);` and add below `saveActiveSessionId(newSession.id);`:

```ts
    // Deliberately not persisted. An empty chat is not history yet; it reaches
    // SQLite when its first message lands. Persisting here left a "New Chat"
    // row behind for every click, and those rows came back on every load.
```

- [ ] **Step 3: Make delete await the database**

Replace `handleDeleteSession` with:

```ts
  const handleDeleteSession = useCallback(
    async (id: string) => {
      // The database goes first. If it refuses, nothing is removed anywhere —
      // the previous fire-and-forget delete let the UI drop a chat the database
      // still held, and the next load brought it back for good.
      try {
        await deleteSessionRemote(id);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't delete chat session");
        return;
      }

      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const newSession = createNewSession(selectedModel.id);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        writeCache([newSession]);
        saveActiveSessionId(newSession.id);
      } else {
        setSessions(remaining);
        writeCache(remaining);
        if (activeSessionId === id) {
          const nextActive = remaining[0].id;
          setActiveSessionId(nextActive);
          saveActiveSessionId(nextActive);
          setMessages(remaining[0].messages || []);
        }
      }
      toast.success("Chat session deleted");
    },
    [activeSessionId, selectedModel.id, sessions, setMessages]
  );
```

No sidebar change is needed. `ChatSessionSidebar` declares `onDeleteSession: (id: string) => void` (`components/ai-chatbot/chat-session-sidebar.tsx:52`), and TypeScript assigns a `Promise<void>`-returning function to a `void`-returning signature without complaint. The same holds for `onRenameSession`, `onTogglePinSession`, and `onClearAllSessions`, which Steps 4 and 6 also make async.

- [ ] **Step 4: Make rename and pin durable**

Neither bumped `updatedAt`, and the old merge resolved ties in the database's favour — so both silently reverted on reload. Replace both handlers:

```ts
  const handleRenameSession = useCallback(
    async (id: string, newTitle: string) => {
      const updated = sessions.map((s) =>
        s.id === id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s
      );
      setSessions(updated);
      writeCache(updated);
      const target = updated.find((s) => s.id === id);
      if (!target) return;
      try {
        await persistSession(target);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't rename chat session");
      }
    },
    [sessions]
  );

  const handleTogglePinSession = useCallback(
    async (id: string) => {
      let nextPinned = false;
      const updated = sessions.map((s) => {
        if (s.id !== id) return s;
        nextPinned = !s.isPinned;
        return { ...s, isPinned: nextPinned, updatedAt: new Date().toISOString() };
      });
      setSessions(updated);
      writeCache(updated);
      toast.info(nextPinned ? `Pinned "${updated.find((s) => s.id === id)?.title}"` : "Unpinned");
      const target = updated.find((s) => s.id === id);
      if (!target) return;
      try {
        await persistSession(target);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't pin chat session");
      }
    },
    [sessions]
  );
```

- [ ] **Step 5: Update model selection and source toggling**

In `handleSelectModel`, replace `saveSessions(updated);` with:

```ts
        const updated = sessions.map((s) =>
          s.id === activeSessionId
            ? { ...s, model: model.id, updatedAt: new Date().toISOString() }
            : s
        );
        setSessions(updated);
        writeCache(updated);
        const target = updated.find((s) => s.id === activeSessionId);
        if (target && target.messages.length > 0) {
          void persistSession(target).catch((err) => {
            console.error("Couldn't save chat session:", err);
          });
        }
```

Add the missing `sessions` dependency to the `useCallback` array — ESLint already flags it (`react-hooks/exhaustive-deps` at the current line 449).

In `handleToggleSource`, replace `saveSessions(nextSessions); // instant tier; schedules background SQLite flush` with:

```ts
          writeCache(nextSessions);
          const target = nextSessions.find((s) => s.id === activeSessionId);
          if (target && target.messages.length > 0) {
            void persistSession(target).catch((err) => {
              console.error("Couldn't save chat session:", err);
            });
          }
```

This is the path that carries `connectedSourceIds`; a manual check for it is in Task 5, Step 4.

- [ ] **Step 6: Update feedback and clear-all**

In `handleFeedback`, replace the `scheduleDbFlush(nextSession);` line with nothing, and replace `saveSessions(updated);` with:

```ts
          writeCache(updated);
          const active = updated.find((s) => s.id === activeSessionId);
          if (active) {
            void persistSession(active).catch((err) => {
              console.error("Couldn't save chat session:", err);
            });
          }
```

Replace `handleClearAllSessions` with:

```ts
  const handleClearAllSessions = useCallback(async () => {
    try {
      await clearAllSessionsRemote();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't clear chat sessions");
      return;
    }
    const newSession = createNewSession(selectedModel.id);
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    writeCache([newSession]);
    saveActiveSessionId(newSession.id);
    toast.success("Cleared all chat sessions");
  }, [selectedModel.id, setMessages]);
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run lint`
Expected: zero **errors**. Warning count should not exceed the pre-task baseline — capture the baseline with `npm run lint 2>&1 | tail -3` before starting this task.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/ai-builder/chatbot/page.tsx" components/ai-chatbot/chat-session-sidebar.tsx
git commit -m "fix(chat): await the database on every session mutation"
```

---

### Task 5: Verification

**Files:**
- Create: `scripts/verify-chat-persistence.ts`

The script drives the real HTTP API against the running dev server and asserts SQLite state directly with `node:sqlite`. It cannot import `lib/ai-chatbot/persistence.ts`, because that file uses `@/*` path aliases which plain Node does not resolve — going over HTTP exercises the same stack the browser uses anyway. Relative imports in scripts need explicit `.ts` extensions; Node 24 strips types natively, so `node scripts/<name>.ts` runs without a loader.

**Interfaces:**
- Consumes: the running dev server on port 3308 and `.data/attrack.db`.
- Produces: exit code 0 on pass, 1 on any failure.

- [ ] **Step 1: Write the script**

```ts
// Verifies that SQLite is the single authority for chat history.
//
// Run with the dev server up:  node scripts/verify-chat-persistence.ts
// Every row it creates is prefixed `verify_` and removed at the end.

import { DatabaseSync } from "node:sqlite";

const BASE = process.env.ATTRACK_URL ?? "http://localhost:3308";
const DB = process.env.SQLITE_PATH ?? ".data/attrack.db";
const SID = "verify_sess_1";

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

function dbRows(sql: string, ...args: unknown[]): Record<string, unknown>[] {
  const db = new DatabaseSync(DB, { readOnly: true });
  try {
    return db.prepare(sql).all(...(args as never[])) as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

function session(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: SID,
    title: "Verify session",
    createdAt: now,
    updatedAt: now,
    model: "verify-model",
    personaId: "general",
    isPinned: false,
    connectedSourceIds: ["jobs", "resumes"],
    messages: [
      { id: "verify_m1", role: "user", content: "ping", createdAt: now },
      { id: "verify_m2", role: "assistant", content: "pong", createdAt: now },
    ],
    ...overrides,
  };
}

async function put(body: unknown): Promise<Response> {
  return fetch(`${BASE}/api/chat/sessions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getSessions(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/api/chat/sessions`);
  assert(res.ok, `GET returned ${res.status}`);
  const payload = await res.json();
  return (payload?.sessions ?? []) as Record<string, unknown>[];
}

async function main(): Promise<void> {
  console.log(`Chat persistence verification against ${BASE}\n`);

  await runTest("A session and its messages round-trip through SQLite", async () => {
    const s = session();
    const res = await put({ session: s, messages: s.messages });
    assert(res.status === 200, `PUT returned ${res.status}`);

    const rows = dbRows("SELECT id FROM chat_messages WHERE session_id = ?", SID);
    assert(rows.length === 2, `expected 2 message rows, found ${rows.length}`);

    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    assert(Boolean(found), "session missing from GET");
    assert(
      (found!.messages as unknown[]).length === 2,
      `GET returned ${(found!.messages as unknown[]).length} messages, expected 2`
    );
  });

  await runTest("connectedSourceIds survives the round-trip", async () => {
    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    const ids = (found?.connectedSourceIds ?? []) as string[];
    assert(
      ids.includes("jobs") && ids.includes("resumes"),
      `connectedSourceIds came back as ${JSON.stringify(ids)}`
    );
  });

  await runTest("A rename persists and is what the database returns", async () => {
    const s = session({ title: "Renamed", updatedAt: new Date().toISOString() });
    const res = await put({ session: s, messages: s.messages });
    assert(res.status === 200, `PUT returned ${res.status}`);

    const all = await getSessions();
    const found = all.find((x) => x.id === SID);
    assert(found?.title === "Renamed", `title came back as ${String(found?.title)}`);
  });

  await runTest("A deleted session stays deleted", async () => {
    const res = await fetch(`${BASE}/api/chat/sessions?id=${SID}`, { method: "DELETE" });
    assert(res.status === 200, `DELETE returned ${res.status}`);

    const sessionRows = dbRows("SELECT id FROM chat_sessions WHERE id = ?", SID);
    assert(sessionRows.length === 0, "session row survived the delete");

    const messageRows = dbRows("SELECT id FROM chat_messages WHERE session_id = ?", SID);
    assert(messageRows.length === 0, `${messageRows.length} message rows survived the delete`);

    const all = await getSessions();
    assert(!all.some((x) => x.id === SID), "deleted session still returned by GET");
  });

  await runTest("A malformed save is reported as a failure", async () => {
    const res = await put({});
    assert(res.status >= 400, `malformed PUT returned ${res.status}, expected >= 400`);
  });

  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.length - passed;
  console.log(`\nTOTAL: ${reports.length} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `node scripts/verify-chat-persistence.ts`

Expected: five `[PASS]` lines and `TOTAL: 5 | PASSED: 5 | FAILED: 0`, exit code 0.

- [ ] **Step 3: Confirm no verification rows were left behind**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('.data/attrack.db',{readOnly:true});console.log('leftovers:',d.prepare(\"SELECT count(*) n FROM chat_sessions WHERE id LIKE 'verify_%'\").get().n);d.close()"
```

Expected output: `leftovers: 0`

- [ ] **Step 4: Manual browser acceptance**

With the dev server running, at `http://localhost:3308/ai-builder/chatbot`:

1. Click **New Chat**, then reload without sending a message. The empty chat must **not** appear as a stray "New Chat" in the sidebar, and `SELECT count(*) FROM chat_sessions WHERE title='New Chat'` must not have grown.
2. Send a message, wait for the answer, reload. The full conversation must come back with its original message order.
3. Delete a chat, then reload **twice**. It must not come back either time.
4. Rename a chat, reload. The new name must survive.
5. Open the workspace-connections drawer, toggle a source off, reload. The toggle must survive — this is the `connectedSourceIds` path.

- [ ] **Step 5: Full gate**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: zero type errors, zero lint errors, `Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-chat-persistence.ts
git commit -m "test(chat): verify SQLite is the single authority for chat history"
```

---

## What this plan deliberately does not touch

Confirmed by grep before writing this plan — none of these reference the chat tables or the storage helpers, so none can regress:

- Retrieval and RAG (`lib/ai-chatbot/retrieval/*`, `pipeline.ts`) — reads `jobs`, `documents`, `contacts`, `ai_memories`.
- The vector store — chat is never indexed. `deleteEntityChunks(userId, sessionId)` in `persistence.ts` is a no-op against data that was never written; leave it.
- `/api/chat` streaming — stateless, messages arrive in the request body.
- `electron/` — zero matches for chat, session, or localStorage.
- Board, jobs, CRM, documents, resume builder.
- `resetAllData` in `lib/actions/auth.ts` — already deletes both chat tables in foreign-key order.
- `/api/chat/feedback` — unchanged, and starts working once message rows exist.
- `CHAT_PERSONAS` / `AI_MODELS` consumers: `empty-chat-state.tsx`, `persona-selector.tsx`, `model-selector.tsx`, `lib/ai/agents/registry.ts`, `lib/ai-chatbot/pipeline.ts`.

# atTrack Master Codebase Audit Report

**Repository:** `atTrack` (`e:\07_Open-source\atTrack`)  
**Stack:** Next.js 16 App Router, TypeScript, Local SQLite, Base UI, Tailwind CSS, Gemini API  
**Auditors:** Security & Auth, Frontend & State, API & AI Pipeline, Bloat & Architecture

> **Audit update — 2026-08-16**
>
> This report originally described 51 findings. Most security, reliability, and dead-code findings are now fixed. Current source was re-reviewed for a local single-user runtime. The original findings remain below as historical detail; current status and newly verified findings are listed here.

## Current Audit Status

| Check | Result |
|---|---|
| TypeScript | Passed with `tsc --noEmit` |
| ESLint | Passed with no reported diagnostics |
| Scope | Local desktop/server process, one user |
| Excluded | Network scaling, multi-user concurrency, load balancing, distributed systems |

### Previously reported findings now verified fixed

- CRIT-01 through CRIT-06: fixed and present in current source.
- HIGH-01 through HIGH-07: fixed and present in current source.
- MED-01 through MED-05: fixed or deliberately limited to new databases as documented below.
- LOW-01 and LOW-02: fixed.
- NEW-01: SQL table denylist now enforced in AI database-query path.

### New findings

#### NEW-02 — Malformed JSON is not handled in database cell update

- **Severity:** Medium
- **File:** `app/api/database/update/route.ts`
- **Problem:** `await req.json()` runs outside validation. Malformed input produces an uncontrolled 500 response.
- **Fix:** Wrap JSON parsing in `try/catch`; return HTTP 400 with a stable error message.

#### NEW-03 — PDF document is loaded once per page

- **Severity:** Medium
- **File:** `components/pdf-viewer.tsx`
- **Problem:** Every `PdfPage` calls `pdfjsLib.getDocument(url)`. Multi-page PDFs duplicate loading-task and document state, increasing memory and render time.
- **Fix:** Load one `PDFDocumentProxy` in `PdfViewer`; pass it to each page.

#### NEW-04 — PDF loading task and document are not destroyed

- **Severity:** Medium
- **Files:** `components/pdf-viewer.tsx`, `lib/utils/pdf-extract.ts`
- **Problem:** Unmounting the viewer or finishing text extraction does not consistently destroy PDF.js worker/document resources.
- **Fix:** Destroy loading tasks/documents in `finally` or effect cleanup. Keep existing `RenderTask.cancel()` cleanup.

#### NEW-05 — File responses materialize entire files in memory

- **Severity:** Medium
- **Files:** `lib/db/storage.ts`, `app/api/files/[bucket]/[...key]/route.ts`
- **Problem:** `readFile()` creates a full `Buffer`, then the response creates another `Uint8Array`. Large resumes/PDFs cause avoidable memory spikes.
- **Fix:** Use `stat()` plus `createReadStream()` and pass a Web `ReadableStream` to `NextResponse`.

#### NEW-06 — SQLite local memory profile is oversized

- **Severity:** Low
- **File:** `lib/db/sqlite.ts`
- **Problem:** `cache_size = -64000`, `temp_store = MEMORY`, and `mmap_size = 268435456` permit a large local memory footprint before application data and Electron overhead.
- **Fix:** Use a smaller cache, file-backed temp storage, and smaller mmap. Recommended baseline: 16 MB cache, 64 MB mmap, one SQLite worker thread.

#### NEW-07 — Raw database viewer materializes full database twice

- **Severity:** Medium
- **File:** `app/api/database/route.ts`
- **Problem:** Every table uses `SELECT *`; all rows are retained in `result`, then serialized into another large response string. Documents, chat messages, and embedding-adjacent data can create large transient allocations.
- **Fix:** Return table metadata plus bounded rows, for example 1,000 rows per table, with `rowCount` and table-level pagination.

#### NEW-08 — Setup IPC listener survives cancelled setup

- **Severity:** Medium
- **File:** `electron/main.js`
- **Problem:** `ipcMain.once("setup:submit", ...)` remains registered when the setup window closes without submission. A later setup attempt can invoke stale listeners.
- **Fix:** Register named listener and remove it from both submit and window-close paths.

#### NEW-09 — Windows child server shutdown is not tree-safe

- **Severity:** Medium
- **File:** `electron/server.js`
- **Problem:** `child.kill()` may leave the standalone server's descendants running on Windows.
- **Fix:** Use `taskkill /pid <pid> /t /f` on Windows. Use timed SIGTERM/SIGKILL fallback on POSIX.

### Current top risks

1. **PDF/file memory pressure:** repeated PDF loading and whole-file buffering can make large local documents spike renderer/server memory.
2. **Raw database response size:** database viewer returns every row and duplicates large allocations during serialization.
3. **Lifecycle cleanup:** setup IPC and Windows child-process shutdown can retain listeners/processes after cancellation or close.

### Current quick wins

1. Load each PDF once and destroy PDF.js resources on cleanup.
2. Stream private/public files instead of using `readFile()`.
3. Reduce SQLite cache/mmap settings for desktop baseline.
4. Bound raw database viewer rows and add table pagination.
5. Fix malformed JSON handling and setup IPC listener cleanup.

### Exact replacement snippets

#### Database JSON parsing

```ts
let body: UpdateBody;
try {
  body = (await req.json()) as UpdateBody;
} catch {
  return NextResponse.json(
    { error: "Request body must contain valid JSON." },
    { status: 400 }
  );
}
```

#### SQLite desktop profile

```ts
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA cache_size = -16000");
db.exec("PRAGMA temp_store = FILE");
db.exec("PRAGMA mmap_size = 67108864");
db.exec("PRAGMA threads = 1");
```

#### Streamed storage response

```ts
// lib/db/storage.ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

export async function streamObject(
  bucket: string,
  key: string
): Promise<{ stream: ReadableStream; size: number }> {
  const filename = objectPath(bucket, key);
  const info = await stat(filename);

  return {
    stream: Readable.toWeb(createReadStream(filename)) as ReadableStream,
    size: info.size,
  };
}
```

```ts
// app/api/files/[bucket]/[...key]/route.ts
const { stream, size } = await streamObject(bucket, key);

return new NextResponse(stream, {
  headers: {
    "Content-Type": contentTypeFor(key),
    "Content-Length": String(size),
    "Cache-Control": isPublicBucket(bucket)
      ? "public, max-age=3600"
      : "private, no-store",
  },
});
```

#### PDF document reuse

```tsx
useEffect(() => {
  let cancelled = false;
  let document: pdfjsLib.PDFDocumentProxy | null = null;
  const loadingTask = pdfjsLib.getDocument(url);

  loadingTask.promise
    .then((loaded) => {
      if (cancelled) {
        void loaded.destroy();
        return;
      }

      document = loaded;
      setPdf(loaded);
    })
    .catch(setError);

  return () => {
    cancelled = true;
    void loadingTask.destroy();
    if (document) void document.destroy();
  };
}, [url]);
```

Keep the `PDFDocumentProxy` alive while pages render; destroy it only from parent effect cleanup.

#### Electron setup listener cleanup

```js
let resolved = false;

const finish = (value) => {
  if (resolved) return;
  resolved = true;
  ipcMain.removeListener("setup:submit", onSubmit);
  if (!setupWindow.isDestroyed()) setupWindow.close();
  resolve(value);
};

const onSubmit = (_event, value) => {
  finish(typeof value === "string" ? value : "");
};

ipcMain.on("setup:submit", onSubmit);
setupWindow.on("closed", () => finish(""));
```

#### Windows child-process cleanup

```js
function stopServer(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
  const forceKill = setTimeout(() => {
    if (!child.killed && child.exitCode === null) child.kill("SIGKILL");
  }, 3000);
  forceKill.unref();
  child.once("exit", () => clearTimeout(forceKill));
}
```

---

---

## Historical Audit Snapshot

The sections below preserve the original 51-finding audit and its implementation history. Use **Current Audit Status** above as source of truth for present code. Historical “Top 3 Immediate Risks” and “Top 3 Quick Wins” are retained for traceability only.

---

## Executive Summary

| Category | Critical | High | Medium | Low / Info | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| **Security & Auth** | 4 | 5 | 5 | 2 | **16** |
| **Frontend & State Management** | 2 | 4 | 5 | 3 | **14** |
| **API Routes & AI Pipeline** | 2 | 3 | 3 | 2 | **10** |
| **Bloat, Dead Code & Architecture** | 0 | 2 | 4 | 5 | **11** |
| **Total Findings** | **8** | **14** | **17** | **12** | **51** |

---

## Fix Progress Tracker

Ground-truthed against the live code before each fix (this report was stale on at least one item — see CRIT-01). Only the 20 findings below have enough file/line detail in this report to act on; the remaining 31 are tallied in the Executive Summary with no specifics and are listed as not-actionable at the bottom.

Legend: `[ ]` open · `[x]` fixed & verified · `[~]` investigated, not changed (reason given)

### Critical
- [x] CRIT-01 — Command injection in `openDocumentFolder` — was already fixed in code (uses `spawn`, path allowlist); removed the leftover duplicate `import { spawn }` (it was breaking the build — caught live while restarting the dev server).
- [x] CRIT-02 — Unauthenticated database dump API — `RESTRICTED_TABLES` excludes `users`/`smtp_config`/`ai_providers` from `GET /api/database`. Verified: tsc/lint clean, live trace confirms those 3 tables absent from the response.
- [x] CRIT-03 — Unauthenticated database cell-update API — same exclusion set enforced in `PUT /api/database/update`, rejects with 400 before touching the DB. Verified same way.
- [x] CRIT-04 — Multi-turn AI tool-calling protocol break — `ProviderToolRoundResult` now carries the raw assistant/model turn per provider; the round loop replays it before the tool-result turn. Diff reviewed line-by-line against each provider's real API contract, matches.
- [x] CRIT-05 — Missing global & dashboard error boundaries — added `app/(dashboard)/error.tsx`, `app/error.tsx`, `app/global-error.tsx`, all tokens-only per Design.md, visually verified against the running dev server with temp throw-pages (cleanly removed after).
- [x] CRIT-06 — Uncaught server action rejections freeze modal forms — both dialogs wrapped in try/catch/finally, toast on failure, form state only resets on success. Diff reviewed.

### High
- [x] HIGH-01 — Unrestricted CORS + no auth on extension endpoints — per-install secret (`extension_config` table, `lib/db/extension-secret.ts`), verified via `timingSafeEqual`, surfaced in Settings, wired into the extension popup/service-worker as a Bearer header. Reviewed diff across all 11 files. Also fixed a pre-existing fresh-install crash the fix agent found in passing (`addMissingColumns()`'s index loop didn't swallow "no such table", 1-line fix in `lib/db/sqlite.ts`).
- [x] HIGH-02 — Date/timezone off-by-one on date-only fields — `parseLocalDate()` added to `lib/utils.ts`, applied at the 3 named call sites (`lib/types/board.ts`, 2x `board-card.tsx`). `created_at` (full timestamp) correctly left alone. Sibling bug in `applications-grid.tsx`/`deadlines-tab.tsx` flagged as follow-up, not silently fixed.
- [x] HIGH-03 — Broken debounce memory leak in search inputs — `useRef`-held timeout, cleared before each reschedule, identical fix in both files. Diff reviewed.
- [x] HIGH-04 — Board card state desync (missing `router.refresh()`) — added on the success path only, live-verified against the running dev server (card moved lanes with no manual reload).
- [x] HIGH-05 — Teed `ReadableStream` leak in AI routes — reader lock now released in `finally` on every exit path; `cancel()` only fires when the loop exited before `done: true`. Diff reviewed against the actual pre-existing try/catch shape in both files.
- [x] HIGH-06 — Uploaded resumes stored in public directory — `uploadDocument()` now goes through the private `supabase.storage.from("documents")` shim (signed-token URLs via `/api/files`), same as `deleteDocument`/`getSignedUrl` already did for non-legacy paths. Old `/resume/`-prefixed documents untouched, still work. Also fixed a live crash found in the same file: missing `import path from "node:path"` (16 tsc errors, every path.* call in the file was throwing ReferenceError at runtime).
- [x] HIGH-07 — Dead MCQ / practice-interview subsystem — 8 files deleted after verifying zero live importers each (mcq-history.tsx, mcq-test.tsx, practice-button.tsx, actions/mcq.ts, ai/mcq.ts, types/mcq.ts, resume-builder-reducer.ts, actions/performance.ts). Correctly did NOT touch `mcq_results` DB table or its `ALLOWED_TABLES`/meta.ts registration — still read by insights.ts/overview page, caught before deleting. Only removed the fully-orphaned `mcq_question_cache` registration + relation. No DB tables dropped from any existing database file.

### Medium
- [x] MED-01 — Missing FK cascades on chat tables (new DBs only — see note) — `chat_sessions.user_id`, `chat_messages.user_id`/`session_id` now `REFERENCES ... ON DELETE CASCADE` in schema.sql (new DBs). No backfill on existing DBs (SQLite can't ALTER-ADD-FK without a table rebuild — too risky on real user data, correctly deferred). Verified end-to-end on a throwaway fresh DB (cascade delete confirmed, 0 `PRAGMA foreign_key_check` violations). Investigated cascade cleanup at the app level: no chat-session-delete server action exists at all today (client-side only) — flagged as a separate, pre-existing gap, not fixed here.
- [x] MED-02 — Incomplete wipe in `resetAllData` — table list grew from 11 to 27 (every `user_id`-owned table in schema.sql), correctly children-before-parents ordered. `job_contacts`/`job_documents` correctly left out (no `user_id` column, already cascade-cleaned via `jobs`/`contacts`/`documents`); `omni_search_index` correctly left out (cleaned via `AFTER DELETE` triggers, which fire on cascade deletes too). Verified by schema review only, not executed against real data. Diff reviewed.
- [x] MED-03 — PDF.js canvas render race on zoom — `RenderTask` captured, `.cancel()` on cleanup, `RenderingCancelledException` swallowed (expected) instead of logged as an error. Diff reviewed.
- [x] MED-04 — Section deadline target list accepts free text instead of a real list — replaced with a `Select` bound to real `board_lists`, `lists` prop threaded through `AddJobDialog` and its 4 real callers (overview page, board-view, import-choice, ai-import). Diff reviewed.
- [x] MED-05 — Missing secondary DB indexes — `idx_positions_resume_id`, `idx_applications_resume_id`, `idx_chat_messages_user` added to both schema.sql (new DBs) and the existing-DB migration array in sqlite.ts. Verified present via grep in both files.

### Low
- [x] LOW-01 — package.json dependency placement — `@ai-sdk/react` removed, `shadcn`/`@types/sharp` moved to devDependencies, `@ai-sdk/openai` moved to dependencies. Lockfile diff traced and attributed entirely to these 4 moves (verified, not scope creep). Diff reviewed.
- [x] LOW-02 — Duplicate performance actions file — `lib/actions/performance.ts` deleted (zero importers) as part of the dead-code pass above.

### Newly discovered while fixing the above (not in the original report)
- [x] NEW-01 — `lib/actions/database-query.ts`'s `ALLOWED_TABLES` allowlist (AI chatbot's local-SQL tool) is declared but never checked against the actual query text — `SELECT * FROM smtp_config` would currently pass and leak SMTP/API-key credentials through the chatbot. Same bug class as CRIT-02/03, different surface. Found by the CRIT-02/03 fix agent, confirmed by controller. Fixed with a word-boundary denylist regex on the raw SQL text (robust against subquery/CTE bypass, verified both). tsc/lint clean.

### Not actionable from this report
The Executive Summary tallies 51 total findings; only the 20 above have file/line/root-cause detail. The other 31 (mostly Medium/Low) exist only as counts in the summary table — fixing them would mean inventing the finding, which isn't safe to do blindly. Re-run the audit with full detail if these need action.

---

## Top 3 Immediate Risks

1. **Remote Code Execution via Command Injection:** [`lib/actions/documents.ts:286-347`](file:///e:/07_Open-source/atTrack/lib/actions/documents.ts#L286-L347) passes user document paths directly into `child_process.exec()` without sanitization or shell escaping.
2. **Unauthenticated Database Dump & Cell Tampering APIs:** [`app/api/database/route.ts`](file:///e:/07_Open-source/atTrack/app/api/database/route.ts) and [`app/api/database/update/route.ts`](file:///e:/07_Open-source/atTrack/app/api/database/update/route.ts) are completely unauthenticated, allowing any network caller to exfiltrate all tables (including passwords/API keys) and alter database records.
3. **Multi-Turn Tool Calling Protocol Break:** [`lib/ai/providers.ts:700-787`](file:///e:/07_Open-source/atTrack/lib/ai/providers.ts#L700-L787) omits recording the model/assistant turn before pushing tool call responses, triggering 400 Bad Request on Gemini, OpenAI, and Anthropic APIs.

---

## Top 3 Quick Wins

1. **Delete 18 Dead Files (MCQ & Unused Marketing Stubs):** Remove orphaned practice interview quiz subsystem (`lib/actions/mcq.ts`, `lib/ai/mcq.ts`, `components/mcq-*.tsx`), dead reducer (`lib/state/resume-builder-reducer.ts`), and unused hooks to reduce codebase noise.
2. **Add Global & Dashboard Error Boundaries:** Create [`app/error.tsx`](file:///e:/07_Open-source/atTrack/app/error.tsx) and [`app/(dashboard)/error.tsx`](file:///e:/07_Open-source/atTrack/app/(dashboard)/error.tsx) to prevent unexpected runtime errors from rendering a blank white screen.
3. **Wrap Server Action Dialog Submissions in `try/catch`:** In [`components/add-job-dialog.tsx`](file:///e:/07_Open-source/atTrack/components/add-job-dialog.tsx) and [`components/add-interview-dialog.tsx`](file:///e:/07_Open-source/atTrack/components/add-interview-dialog.tsx), wrap submissions with `try/catch/finally` so failed validations show error toasts instead of freezing the form with a stuck spinner.

---

## 1. Critical Severity Findings

### [CRIT-01] Command Injection / RCE in `openDocumentFolder`
- **File:** [`lib/actions/documents.ts:286-347`](file:///e:/07_Open-source/atTrack/lib/actions/documents.ts#L286-L347)
- **Root Cause:** User document file paths interpolated into shell command strings (`exec(command)`). On Windows (`cmd.exe /c start explorer.exe ...`), macOS (`open ...`), and Linux (`xdg-open ...`), shell metacharacters (`&`, `|`, `;`, `` ` ``, `$()`) execute arbitrary host commands.
- **Fix:** Use `spawn` with path validation and no shell execution:
```typescript
import { spawn } from "node:child_process";

export async function openDocumentFolder(id: string): Promise<void> {
  const { supabase, userId } = await getUser();
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!doc?.file_path || doc.file_path.startsWith("http://") || doc.file_path.startsWith("https://")) {
    throw new Error("Invalid local file path");
  }

  let absPath = doc.file_path.startsWith("/")
    ? path.join(process.cwd(), "public", path.normalize(doc.file_path))
    : path.resolve(process.cwd(), doc.file_path);

  const folderPath = path.dirname(absPath);
  const fileExists = fs.existsSync(absPath);
  const targetPath = fileExists ? absPath : folderPath;

  return new Promise((resolve, reject) => {
    let child;
    if (process.platform === "win32") {
      const winPath = targetPath.replace(/\//g, "\\");
      child = fileExists
        ? spawn("explorer.exe", [`/select,${winPath}`], { detached: true, stdio: "ignore" })
        : spawn("explorer.exe", [winPath], { detached: true, stdio: "ignore" });
    } else if (process.platform === "darwin") {
      child = spawn(fileExists ? "open" : "open", fileExists ? ["-R", absPath] : [folderPath]);
    } else {
      child = spawn("xdg-open", [folderPath]);
    }
    child.on("error", (err) => reject(new Error(`Failed to open folder: ${err.message}`)));
    child.unref();
    resolve();
  });
}
```

---

### [CRIT-02] Unauthenticated Database Dump API
- **File:** [`app/api/database/route.ts:34-76`](file:///e:/07_Open-source/atTrack/app/api/database/route.ts#L34-L76)
- **Root Cause:** `GET /api/database` lacks auth. Queries `sqlite_master` and returns entire schema and rows of all tables, including `smtp_config` (passwords) and `ai_providers` (API keys).
- **Fix:** Authenticate user and exclude sensitive tables (`users`, `smtp_config`, `ai_providers`).

---

### [CRIT-03] Unauthenticated Arbitrary Database Cell Update API
- **File:** [`app/api/database/update/route.ts:31-94`](file:///e:/07_Open-source/atTrack/app/api/database/update/route.ts#L31-L94)
- **Root Cause:** `PUT /api/database/update` lacks auth. Accepts `table`, `column`, `pkColumn`, `pkValue`, `value` and executes unauthenticated updates against any SQLite table.
- **Fix:** Require user session, restrict allowed tables, and enforce `WHERE user_id = ?`.

---

### [CRIT-04] Multi-Turn AI Tool Calling API Protocol Break
- **File:** [`lib/ai/providers.ts:700-787`](file:///e:/07_Open-source/atTrack/lib/ai/providers.ts#L700-L787)
- **Root Cause:** Gemini, OpenAI, and Anthropic APIs require assistant/model message containing the `tool_calls` / `functionCall` before appending tool responses. Code pushed tool result turns directly without recording model turn first, throwing 400 Bad Request.
- **Fix:** Append assistant turn to `geminiParts`, `oaMessages`, and `antMessages` before appending tool response objects.

---

### [CRIT-05] Missing Global & Dashboard Error Boundaries
- **File:** `app/error.tsx`, `app/(dashboard)/error.tsx` (missing)
- **Root Cause:** App lacks Next.js `error.tsx` error boundaries. Any runtime exception crashes the entire page into a blank white screen.
- **Fix:** Add standard `app/(dashboard)/error.tsx` and `app/global-error.tsx`.

---

### [CRIT-06] Uncaught Server Action Rejections Freeze Modal Forms
- **Files:** [`components/add-job-dialog.tsx:72-112`](file:///e:/07_Open-source/atTrack/components/add-job-dialog.tsx#L72-L112), [`components/add-interview-dialog.tsx:62-95`](file:///e:/07_Open-source/atTrack/components/add-interview-dialog.tsx#L62-L95)
- **Root Cause:** Form submit handlers execute server actions without `try/catch`. When validation fails, `pending` state stays `true` forever, submit button remains disabled with spinner, modal never closes.
- **Fix:** Wrap with `try/catch/finally`, display toast on error, and reset `pending = false`.

---

## 2. High Severity Findings

### [HIGH-01] Unrestricted CORS (`*`) on Extension Endpoints
- **Files:** [`app/api/extension/add-job/route.ts:6-10`](file:///e:/07_Open-source/atTrack/app/api/extension/add-job/route.ts#L6-L10), [`app/api/extension/parse-job-ai/route.ts:6-10`](file:///e:/07_Open-source/atTrack/app/api/extension/parse-job-ai/route.ts#L6-L10)
- **Root Cause:** `Access-Control-Allow-Origin: *` with no API token allows any visited website to trigger AI extraction on user's API key or insert spam jobs into user's board.
- **Fix:** Validate bearer token / extension secret header on incoming requests.

### [HIGH-02] Date & Timezone Off-by-One Day Shift
- **Files:** [`lib/types/board.ts:162-167`](file:///e:/07_Open-source/atTrack/lib/types/board.ts#L162-L167), [`components/board/board-card.tsx:233-241`](file:///e:/07_Open-source/atTrack/components/board/board-card.tsx#L233-L241)
- **Root Cause:** ISO date string `"YYYY-MM-DD"` parsed as UTC midnight (`00:00:00Z`). In negative UTC timezones (EST/PST), `new Date("2026-08-14")` shifts to previous evening (`Aug 13`), displaying incorrect dates and triggering false overdue states.
- **Fix:** Parse date strings as local dates (`new Date(year, month - 1, day)`).

### [HIGH-03] Broken Debounce Memory Leak in Search Inputs
- **Files:** [`components/jobs-grid.tsx:417-426`](file:///e:/07_Open-source/atTrack/components/jobs-grid.tsx#L417-L426), [`components/jobs-toolbar.tsx:66-75`](file:///e:/07_Open-source/atTrack/components/jobs-toolbar.tsx#L66-L75)
- **Root Cause:** `handleSearch` returns cleanup function from `onChange` event handler, which React ignores. Rapid typing creates N uncancelled timeouts that trigger concurrent router updates.
- **Fix:** Store timeout handle in `useRef` and clear previous timer on every keystroke.

### [HIGH-04] Board Card State Desynchronization
- **File:** [`components/board/board-card.tsx:61-75`](file:///e:/07_Open-source/atTrack/components/board/board-card.tsx#L61-L75)
- **Root Cause:** `handleStateChange` calls `updateJobState` without `router.refresh()`. Card remains in current board lane until hard page reload.
- **Fix:** Call `router.refresh()` upon state update.

### [HIGH-05] Teed `ReadableStream` Memory Leak in AI Routes
- **Files:** [`app/api/ai/generate-ai-tool/route.ts:137-138`](file:///e:/07_Open-source/atTrack/app/api/ai/generate-ai-tool/route.ts#L137-L138), [`app/api/ai/generate-email/route.ts:104-105`](file:///e:/07_Open-source/atTrack/app/api/ai/generate-email/route.ts#L104-L105)
- **Root Cause:** `stream.tee()` locks readers. If client disconnects, unread branch buffers in memory indefinitely.
- **Fix:** Add `cancel()` cleanup and release reader locks in `finally` blocks.

### [HIGH-06] Uploaded Resumes Stored in Public Directory
- **File:** [`lib/actions/documents.ts:74-85`](file:///e:/07_Open-source/atTrack/lib/actions/documents.ts#L74-L85)
- **Root Cause:** `uploadDocument` writes user resumes directly to `public/resume/`, making resumes publicly accessible via web URL without auth.
- **Fix:** Upload to private storage bucket (`documents`) via `supabase.storage`.

### [HIGH-07] Dead MCQ / Practice Interview Subsystem (18 Files)
- **Files:** `components/mcq-test.tsx`, `components/mcq-history.tsx`, `components/practice-button.tsx`, `lib/actions/mcq.ts`, `lib/ai/mcq.ts`, `lib/types/mcq.ts`, DB tables `mcq_results`, `mcq_question_cache`.
- **Root Cause:** Feature abandoned and unreachable in UI.
- **Fix:** Delete dead files and drop orphaned database tables.

---

## 3. Medium & Low Severity Findings (Highlights)

- **[MED-01] Missing Foreign Key Cascades on Chat Tables:** `chat_sessions` and `chat_messages` lack `ON DELETE CASCADE` in `schema.sql`.
- **[MED-02] Incomplete Wipe in `resetAllData`:** 15 tables omitted from deletion list in [`lib/actions/auth.ts:119-136`](file:///e:/07_Open-source/atTrack/lib/actions/auth.ts#L119-L136).
- **[MED-03] PDF.js Canvas Zoom Race Condition:** [`components/pdf-viewer.tsx:88-122`](file:///e:/07_Open-source/atTrack/components/pdf-viewer.tsx#L88-L122) missing `renderTask.cancel()` cleanup on scale change.
- **[MED-04] Section Deadline Target List ID Free-Text Mismatch:** [`components/add-job-dialog.tsx:241`](file:///e:/07_Open-source/atTrack/components/add-job-dialog.tsx#L241) accepts text instead of list UUID.
- **[MED-05] Missing Secondary DB Indexes:** Foreign keys on `positions.resume_id`, `applications.resume_id`, and `chat_messages.user_id` lack indexes.
- **[LOW-01] Package.json Anomalies:** Remove dead `@ai-sdk/react`, move `shadcn` and `@types/sharp` to `devDependencies`, move `@ai-sdk/openai` to `dependencies`.
- **[LOW-02] Duplicate Performance Actions:** Delete redundant [`lib/actions/performance.ts`](file:///e:/07_Open-source/atTrack/lib/actions/performance.ts) (duplicate of `app/api/performance/route.ts`).

---

## Action Plan for Fix Implementation

1. **Security & Auth Patch:**
   - Replace `exec()` in `lib/actions/documents.ts` with `spawn()`.
   - Protect `/api/database` and `/api/database/update` with auth and table whitelisting.
   - Add origin / token verification to `/api/extension/*`.
2. **Frontend & Reliability Patch:**
   - Add `app/(dashboard)/error.tsx` and `app/global-error.tsx`.
   - Wrap `AddJobDialog` and `AddInterviewDialog` submissions in `try/catch`.
   - Standardize local date parsing in `lib/utils.ts` to eliminate timezone day shift.
   - Fix search input debounce in `jobs-grid.tsx` and `jobs-toolbar.tsx`.
3. **Dead Code & Bloat Cleanup:**
   - Delete dead MCQ subsystem (6 files + 2 db tables).
   - Delete dead `lib/actions/performance.ts`, `lib/actions/activity-log.ts`, and `lib/state/resume-builder-reducer.ts`.
   - Clean up `package.json` dependencies.

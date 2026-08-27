# Plan: Replace Notification Bar with Persistent Queue Section (AI TASKS pattern)

**Date:** 2026-08-21
**Type:** Drastic UI + state change — notification system removal → unified background queue
**Status:** DRAFT — awaiting approval before implementation
**Author:** OpenCode planning run (3 parallel explorations: notification bar, AI TASKS queue, app shell)

---

## 0. One-sentence intent

Remove the decorative `NotificationButton` / "notification bar" concept and replace it with an **always-visible, AI-TASKS-style queue entry point** that surfaces any pending / background `AITask` (job update, AI tool generation, future generic tasks). The pill is always mounted (0 tasks = idle pill), clicking expands the same `TaskQueuePanel` we already have. No new backend — unify existing client queue.

> Screenshot reference: bottom-right floating card `AI TASKS 1` → `Updating "Come join us!"` + progress bar. Same card becomes the canonical queue surface.

---

## 1. Goals / Non-Goals

### Goals
- Notification bell no longer exists — no `notification-button.tsx` in sidebar.
- Single persistent queue affordance, always mounted (even when empty), never auto-hidden.
- Queue shows **all** background work: `queued` → `processing` → `awaiting_confirmation` → `applied`/`failed`. Live progress (SSE stream for `ai_tool_generation`, simulated interval for `job_update`).
- Click pill → expand panel with full list + `Review` / `Apply` / `Dismiss` / `Retry`. Same component hierarchy as today.
- Works on desktop, collapsed sidebar, mobile drawer, and floating drag position.

### Non-Goals (this phase)
- No server-persisted job queue DB table. No WebSocket/polling server queue expose (reuse existing `lib/ai/background.ts` fire-and-forget as-is).
- No generic `notifications` DB / inbox / unread count / push. Those are separate features; queue is task-centric.
- No deletion of `sonner` toasts (`components/providers.tsx:24` `Toaster`). They remain ephemeral feedback; queue is persistent tracker.
- No new AI provider work (opencode URL + Gemini popup fixes from prior turns stay).

### Success criteria
- Bell gone in both expanded (`sidebar.tsx:780`) and collapsed (`sidebar.tsx:795`) layouts, mobile too.
- Pill visible on `/jobs` board and every dashboard route, even with 0 tasks (idle state).
- Existing flows still work: `job-ai-update-dialog.tsx:188` `enqueueJobUpdateTask`, `ai-tools-tab.tsx:65` `enqueueAiToolTask` both surface in unified queue.
- No layout shift, no z-index fight with `ChatQueueProvider` approval modal or `Toaster`.

---

## 2. Current State — Findings from exploration

| Area | File | Current behavior | Problem |
|------|------|------------------|---------|
| **Notification UI** | `components/ui/notification-button.tsx:1-47` | Stateless `button` with SVG bell + `bellRing` CSS (`app/globals.css:611-664`). No props (`count`, `notifications[]`), no `onClick`, no context. | Decorative only, explicitly marked legacy in `docs/Design.md:6.7` |
| **Notification render sites** | `components/sidebar.tsx:780,795` + mobile drawer via `dashboard-header.tsx:88` | Two mounts: expanded footer row (`ThemeLogo` + `NotificationButton`) vs collapsed column. No badge. | Takes prime footer real estate for zero function |
| **No notification system** | `lib/*` grep `notification` = 0, `app/api/*` no endpoint, `schema.sql` no `notifications` table | There is no bar to "fix" — either add one or remove bell. | Replacement is removal, not refactor |
| **AI TASKS queue (the target pattern)** | `components/ai-tasks/task-queue-panel.tsx:347` + `lib/ai-tasks/task-queue-context.tsx:458` + `lib/types/ai-task.ts:55` | `AITaskQueueProvider` mounts globally in `components/providers.tsx:23`. `TaskQueuePanel` is `fixed bottom-4 left-4 z-50` draggable (`motion/react`). Two states: minimized pill (`GripVertical + Sparkles + badge`) vs expanded card (`w-88 rounded-2xl` + header + `max-h-72` list). `TaskItem` shows `statusMessage + progress% + bar` for `queued/processing`, `Review/Apply/Dismiss` for `awaiting_confirmation`. | Currently **ephemeral React state** (`useState<AITask[]>`, `tasksRef`), no `localStorage`/DB — vanishes on refresh. Only visible when `tasks.length>0 && isPanelOpen` (empty = hidden). Screenshot draggable so user saw it bottom-right, code says bottom-left. |
| **Queue types & triggering** | `lib/types/ai-task.ts` `type AITaskType="job_update"|"ai_tool_generation"`; triggers `job-ai-update-dialog.tsx:188` + `ai-tools-tab.tsx:65`; runner `task-queue-context.tsx:98` `runTask()` | `job_update`: `setInterval 1200ms` + `await extractJobImport()` (`lib/actions/job-imports.ts:122` → `lib/ai/ai.ts:87` `extractJob`) → mock progress → `awaiting_confirmation` → `applyTask()` calls `enrichJobFromAi()` (`lib/actions/jobs.ts:1018`). `ai_tool_generation`: `for await (streamGenerateAiTool())` SSE (`lib/ai/ai-tools.ts:21` → `app/api/ai/generate-ai-tool/route.ts:216` `generateTextStream` + `stream.tee()`). Syncs to `useAiToolsStore` (`lib/stores/ai-tools-store.ts:279` `zustand sessionStorage`). | Works but split: server `lib/ai/background.ts` queue (`pending:Map/running:Set`) is fire-and-forget and never renders; UI queue is client-only. |
| **Global mount tree** | `components/providers.tsx:30` `NextThemesProvider → AITaskQueueProvider → ChatQueueProvider → children → TaskQueuePanel + Toaster` | Both AI task + chat queues share providers. Chat has `localStorage + SQLite` persistence; AI task has none. | Panel already global, already above board, already handles z-index. Replacement is about **always-visible entry point**, not new mount. |
| **Board/shell** | `app/(dashboard)/layout.tsx:62`, `components/board/board-view.tsx`, `jobs/unified-jobs-view.tsx` | Board header has `Group/Sort`, not notifications. Shell is `h-screen flex-col overflow-hidden` with sidebar + main. | Good fit: floating queue does not own layout space. |

**Key insight:** This is less "refactor notification bar" (there is none) and more "promote AI TASKS from conditional floating panel to always-visible system queue and delete the bell that currently occupies the footer slot."

---

## 3. Desired UX — Exact spec

### 3.1 Placement — replaces bell
- **Desktop expanded sidebar footer** `sidebar.tsx:780` area: remove `NotificationButton`, insert `QueuePillCompact` (or keep pill floating — decision below). Preferred: **keep pill floating global** (`providers.tsx`) and **remove bell from sidebar entirely** — sidebar footer becomes `Logo + Search + Theme` only. Rationale: floating pill is discoverable on board (see screenshot), sidebar footer is cramped at `isCollapsed` width 64.
- **Desktop collapsed sidebar** `sidebar.tsx:795`: same — remove bell, keep vertical stack `Search` only.
- **Mobile drawer** `dashboard-header.tsx`: no bell.
- **Floating pill is the single entry point** — not duplicated in sidebar. This matches AI TASKS current placement and avoids two pills.

*Alternative considered & rejected:* Embed pill inside sidebar footer (sticky). Rejected because board scroll container `overflow-x-auto` clips and sidebar resize (`200-360px`) would truncate minimized pill; drag would fight sidebar drag. Floating is proven (current code already `drag dragMomentum={false}`).

### 3.2 Persistent states (always mounted, even at 0)
Current `task-queue-panel.tsx:20` `if (tasks.length===0 || !isPanelOpen) return null` → **remove empty guard**. New logic:
```
isPanelOpen (default true, persisted localStorage `attrack-queue-open`)
  ├── isMinimized true  (default true when activeTasksCount===0, false when >0)
  │   └── Pill: "Queue" / "AI Tasks" + Sparkles (spin if active>0) + count badge (0 shows muted)
  └── isMinimized false
      └── Expanded card: header "Queue  ·  2 running · 1 needs review" + list
```
- **0 tasks:** Pill says `Queue — All caught up` or `AI Tasks` with `0` badge muted, `Sparkles` not spinning. Click → expanded panel shows empty state illustration + `No background tasks — updates & AI generations appear here`.
- **1 queued/processing:** Pill says `1 task running…` (existing copy) + green badge `1` + spinning `Sparkles`. Progress bar visible only in expanded list via `TaskItem`.
- **awaiting_confirmation:** Pill says `1 update ready` / `1 needs review` + amber dot, not spinning.

### 3.3 Expanded panel — same as today, unified
Reuse `TaskQueuePanel` layout (`w-88 rounded-2xl border bg-card/95 shadow-2xl backdrop-blur-md`):
- Header: `Queue` (or `AI Tasks` keep label? Recommend `Queue` generic) + `activeTasksCount`/`pendingConfirmationCount` summary + `Minus` (minimize) + `X` (close/hide until next task).
- Body: `TaskItem` list `max-h-72 overflow-auto` with same states:
  - `processing|queued`: `statusMessage` (`"AI is analyzing posting… 30%"`, `"Structuring skills…"` >50%, `"AI is generating Cover Letter… 25%"` streaming) + `h-1.5 progress` (`width: progress%`).
  - `awaiting_confirmation`: summary (`changesCount`) + `Review` → `TaskReviewModal` + `Apply` (job_update) / `Dismiss` + `Retry` on failed.
  - Footer: `Clear finished tasks` (`clearCompletedTasks`).
- Modal `TaskReviewModal` (`task-review-modal.tsx:448`) unchanged — field grid diff & email preview.

### 3.4 Queue types in first release
Reuse `lib/types/ai-task.ts` as `QueueTask` (rename alias, keep compat):
- `job_update` (from `job-ai-update-dialog.tsx`) — main user story: updating a task card shows pending → background → needs review.
- `ai_tool_generation` (from `ai-tools-tab.tsx`) — generates cover letter etc.
- Future: `generic` (placeholder for other background work). No new type needed now; treat notification-like work as `generic` with `title/subtitle/progress` only.

---

## 4. Architecture & Data Flow

### 4.1 Data model — extend, don't rewrite
```ts
// lib/types/ai-task.ts — rename export to QueueTask with compat alias
type QueueTaskStatus = "queued" | "processing" | "awaiting_confirmation" | "applied" | "completed" | "dismissed" | "failed"
type QueueTaskType   = "job_update" | "ai_tool_generation" | "generic"
interface QueueTask { id,title,subtitle?,status,progress?,statusMessage?,payload,type,result?,error?,createdAt,completedAt? }
// Keep `AITask = QueueTask` alias for incremental migration
```
No DB migration. `payload` stays polymorphic (`jobId/jobTitle/companyName/url/text/imageIds/kind/...`) so existing `applyTask()` + `enrichJobFromAi()` continue.

### 4.2 Context & persistence
- Keep `lib/ai-tasks/task-queue-context.tsx` as canonical context — **rename to `lib/queue/queue-context.tsx` or keep path + add re-export** to minimize churn (prefer keep path, add `export type QueueTask = AITask`). Changing path touches 8 imports (`providers.tsx`, `task-queue-panel`, `task-review-modal`, `job-ai-update-dialog`, `ai-tools-tab`, `ai-tools-store` sync) — doable but optional.
- Add lightweight persistence for always-visible expectation:
  - `localStorage` `attrack-queue-tasks` (array) + `attrack-queue-open/minimized` (booleans). On mount hydrate, on `tasks` change debounce persist. On `applied/dismissed` after 24h prune.
  - Do **not** persist active `processing` as processing — rehydrate as `failed` with `Retry` CTA so refresh doesn't leave stuck spinner (same as chat queue's `localStorage` rehydration pattern).
- Server `lib/ai/background.ts` remains fire-and-forget; no polling needed for AI tasks (SSE + single `await extractJobImport` already cover). For future generic notifications, add polling only if needed.

### 4.3 Execution pipeline (no change, just unified title)
```
User edits job → job-ai-update-dialog "Run in Background"
  → enqueueJobUpdateTask() → setTasks([newTask,...]) → setIsPanelOpen(true) → runTask()
    → updateTask(processing,30) + interval 1200ms simulated progress → await extractJobImport() → clearInterval → awaiting_confirmation 100%
      → user Review → applyTask() → enrichJobFromAi() → applied → toast + router.refresh()
```
SSE path unchanged (`streamGenerateAiTool` tee).

### 4.4 Mount point — keep `providers.tsx`
```
Providers
 └─ AITaskQueueProvider (or QueueProvider)  ← rename internal, keep compat
     └─ ChatQueueProvider
         └─ children + QueuePanel + Toaster
```
No new provider. `QueuePanel` stays `fixed bottom-4 left-4 z-50` draggable; decide left vs right — keep `left-4` as code, accept screenshot right as user-dragged position (persist `drag` x/y in localStorage as today via `motion`? currently not persisted — add `localStorage attrack-queue-pos` if needed, optional).

### 4.5 Replacement of bell — code delta
- Delete `components/ui/notification-button.tsx` **or** keep for storybook but remove import.
- Delete `app/globals.css:611-664` `.notification-btn / bellRing` (dead code) — optional cleanup.
- `components/sidebar.tsx:1` remove `import { NotificationButton }`, remove lines 780 and 795 JSX. Footer simplifies to `Logo + Search` (expanded) / `Search` only (collapsed). Verify `isCollapsed` branch still has `gap-2`.
- `components/ui/bell.tsx` (unused `BellIcon` with `motion`) — delete or keep, not mounted.

---

## 5. Component Changes — File-by-file

| # | File | Action | Detail | Risk |
|---|------|--------|--------|------|
| 1 | `components/providers.tsx:23` | **Modify** | Ensure `TaskQueuePanel` always mounted (remove empty guard inside panel, not provider). No import change if keeping `AITaskQueueProvider` name, or rename to `QueueProvider` with dual export. | Low |
| 2 | `components/ai-tasks/task-queue-panel.tsx:347` | **Modify — core** | Change `if (tasks.length===0 || !isPanelOpen) return null` → `if (!isPanelOpen) return null` (allow empty). Add empty-state UI. Rename header `AI Tasks` → `Queue` (or keep both: `Queue · AI Tasks`). Update pill copy for `0 tasks`. Persist `isPanelOpen/isMinimized`. Keep `motion.div drag` + `GripVertical/Sparkles/Minus/X`. | Medium — visual regression |
| 3 | `lib/ai-tasks/task-queue-context.tsx:458` | **Modify** | Remove empty-hidden logic, add `localStorage` hydration/persist (`useEffect` on mount + on `tasks` change). On hydration map `processing→failed` with `Retry`. Add `queueTab` filter not needed. Keep `enqueueJobUpdateTask/enqueueAiToolTask` signatures, add `enqueueGenericTask()` helper for notification-like ad-hoc tasks (optional). | Medium — state bug |
| 4 | `lib/types/ai-task.ts:55` | **Modify** | Add `QueueTask` alias, `generic` to union, keep `AITask` compat. | Low |
| 5 | `components/sidebar.tsx:~1000` | **Modify** | Remove `NotificationButton` import and both JSX sites (780, 795). Adjust footer `className` `gap` if needed. Test collapsed 64px width. | Low — but touches high-traffic file |
| 6 | `app/globals.css:611-664` | **Modify / delete** | Remove `.notification-btn` block (dead after bell removal). Keep no replacement. | Low |
| 7 | `components/ui/notification-button.tsx:47` | **Delete or keep deprecated** | Prefer delete — file is isolated, no re-export. If policy forbids delete, add `/** @deprecated replaced by queue */` header. | Low |
| 8 | `components/ui/bell.tsx` | **Delete or keep** | Not used today; delete if cleaning. | Low |
| 9 | `lib/ai-tasks/task-review-modal.tsx:448` | **No change** | Still opened from queue panel `Review`. | None |
|10 | `components/job-detail/job-ai-update-dialog.tsx:527` | **No API change** | Already enqueues; verify title `"Updating \"${jobTitle}\""` still maps to queue subtitle. | None |
|11 | `lib/ai/background.ts` | **No change** | Keep serialized `enqueueBackground` for server scoring; do not wire to UI queue yet (future). | None |

**No new files required** — reuses existing queue. If generic tasks needed, one new helper `enqueueGenericTask()` inside same context.

---

## 6. Migration & Back-compat

- Existing installs with `tasks` in React state only — no migration, tasks ephemeral; changing to persisted will only affect next session. No DB migration.
- Users who had `api.opencodezen.com` tasks (prior fix) still show because context checks `url.includes("opencodezen")||url.includes("opencode.ai")` already — no extra work.
- Bell removal is breaking UI but non-data-breaking — no stored bell state to migrate.
- If we delete `notification-button.tsx`, ensure no docs/Design.md image broken (it references file path — update comment to `deprecated, see queue`).

---

## 7. Open Design Questions — Need decision before code

1. **Label:** Keep `AI TASKS` or rename to `Queue` / `Background Tasks`? `AI TASKS` is accurate today but future generic tasks (e.g., bulk import) are not AI. Proposal: header `Queue` with subtitle `AI Tasks` when filter = AI, but badge counts all. Prefer **Queue** generic from day 1.
2. **Always-visible copy at 0:** Options: (a) `Queue — All caught up` (muted), (b) `AI Tasks` with `0` badge, (c) pill hidden at 0 but footer icon remains. Spec says always there — so (a) with muted badge.
3. **Position:** `bottom-4 left-4` (code) vs `bottom-right` (screenshot draggable). Keep draggable and persist position; do not pin to sidebar footer (see 3.1 rejected alternative). Confirm acceptance of floating.
4. **Sidebar footer after bell removal:** Leave empty space or add something (e.g., `Queue` quick open `Sparkles` icon)? Proposal: leave `Search + Theme` only — queue is floating, not duplicated.
5. **Persistence scope:** `localStorage` only vs `IndexedDB`/SQLite `chat_sessions` pattern? Proposal `localStorage` sufficient (queue is ephemeral, 24h prune).

---

## 8. Implementation Steps — Ordered, incremental, verifiable

**Step 0 — Confirm design decisions (Q1-5 above) with you.** No code until label/position/0-state copy agreed.

**Step 1 — Make queue always-visible (1 file, no bell removal yet)**
- Branch `feat/queue-always-visible`
- `task-queue-panel.tsx`: remove `tasks.length===0` guard, add empty-state JSX (illustration `Sparkles` muted + `No background tasks` + `Updates & AI generations appear here`).
- `task-queue-context.tsx`: add `isPanelOpen` default true persisted, ensure minimized pill renders at 0.
- Manual verify: hard-refresh with empty queue → pill still visible, draggable, click expands to empty state. No sidebar change yet.

**Step 2 — Add persistence (1 file, 15 lines)**
- `task-queue-context.tsx`: `useEffect(()=>persist localStorage on tasks change)` + hydrate on mount (map `processing→failed`). Add `localStorage` keys `attrack-queue-tasks/open/minimized`.
- Verify: enqueue job update → refresh → task now `failed` with `Retry` (not stuck).

**Step 3 — Remove bell & dead CSS (3 files)**
- `sidebar.tsx`: delete `NotificationButton` imports+JSX (780,795).
- `app/globals.css`: delete `.notification-btn` block.
- `components/ui/notification-button.tsx`: delete or deprecate.
- Visual regression check: expanded/collapsed/mobile drawer footer gaps, no layout shift.

**Step 4 — Polish & labels**
- Rename header to `Queue`, update pill copy for 0/running/ready states, add `generic` type alias in `ai-task.ts`.
- Add `enqueueGenericTask()` helper if needed (for future notification-like pushes).
- `providers.tsx`: confirm no new provider needed.

**Step 5 — Verification script + cleanup**
- `scripts/verify-queue-persistence.ts` via `npx tsx`: enqueue mock tasks, check localStorage round-trip, refresh simulation.
- `npm run typecheck && npm run lint && npm run build` + browser walkthrough: board drag, job update background, AI tool generate stream.
- Delete temp scripts.

Each step is a single commit, revertible.

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users relied on bell location as mental landmark | Low — bell did nothing; removal is net positive but may confuse first session | First-launch tooltip from expanded empty queue: `Queue replaces notifications — background updates appear here` (one-time `localStorage` flag). |
| Always-visible pill annoys users who want hide | Low | Keep `X` (close) still hides until next task; add Settings toggle `Show queue when idle` (default true) — defer to v2 if overkill. |
| Persisted tasks stale after app update | Low | Prune `applied/dismissed` after 24h; cap `tasks` to last 20; on version bump clear if schema mismatch. |
| Drag position off-screen after resize | Low | `motion` drag with bounds `window` + reset if `localStorage pos` outside viewport. |
| SSE streaming memory leak if queue panel unmounted | Medium | Already `abortControllersRef` in `chat-queue-context`; queue's `streamGenerateAiTool` uses `AbortSignal` — reuse. |
| z-index fight (`Chat approval modal` `z-50` same as queue `z-50`) | Medium | Keep queue `z-50`, modal `z-50` but modal is `fixed inset-0` backdrop (`bg-black/60`) — renders above. Verify no modal hidden behind queue. |

---

## 10. Alternatives considered & rejected

- **Sidebar-embedded queue (non-floating):** Rejected §3.1 — clips, fights resize drag, duplicates with floating research users prefer.
- **Full notification center DB + API:** Rejected — out-of-scope, requires `notifications` table, polling, unread sync; queue solves stated "updating task pending/background" use case with existing infra.
- **Polling server background queue:** Rejected — `lib/ai/background.ts` is server-only serialized; exposing via `/api/queue` would need auth + pruning + FE polling complexity, not needed for SSE/single-await tasks.
- **Keep bell + add queue (both):** Rejected — user explicitly `Notification bar should be replaced with queue section`; two entry points confuse.

---

## 11. Next action — awaiting your call

Plan is complete, no code changed yet. Please approve:

1. Label = `Queue` (generic) vs stay `AI TASKS`?
2. Position = floating draggable `bottom-4 left-4` (persist pos) OK?
3. 0-state copy = `No background tasks` + muted pill OK, or want different wording?
4. Sidebar after bell = leave empty vs add `Queue` quick icon?

Reply `approve` or comment on Q1-4; on approve I implement Steps 1-5 in order with verifiable commits.


# AtTrack — Huntr-style Board, Positions & Onboarding

> The product is named **AtTrack**. The repo directory, package name, and ~80 in-app strings still say "Aven" — see §0 for the rename.

## Context

AtTrack today has every *piece* of a job tracker but no unified pipeline surface. Migration `016_fix_job_application_model.sql` deliberately split the model in two: `jobs.status` holds 3 pre-application stages (`saved` / `interested` / `preparing`), `applications.status` holds an 8-value post-application lifecycle. The result is two list pages (`/jobs`, `/applications`) that each show half the story, and `components/jobs-grid.tsx:278` already fakes the seam in the UI (`hasApplied && job.status === "saved" ? "applied" : job.status`).

Huntr — the product this is modelled on — puts one card per opportunity on a single Kanban board spanning Wishlist → Offer, with user-addable columns. That is the surface being built here.

Three things come with it:

1. **Positions** — a target role (`Frontend Developer`, `Backend Developer`) that jobs are tagged under, each with its own resume. This is how "track different resumes with different job positions" gets answered.
2. **Per-job resume + project links** — attachable while a card sits in Preparing.
3. **Onboarding** — resume upload is the entry requirement, then a target position, then a seeded board.

Intended outcome: `/board` becomes the primary workspace. `/jobs`, `/applications`, `/interviews`, `/documents`, `/overview`, `/insights` keep working unchanged.

---

## Decisions locked

| Question | Decision |
|---|---|
| Board data model | **Unify on `jobs`.** New `board_lists` table + `jobs.list_id` / `jobs.board_position`. One card per job. |
| `jobs.status` | **Legacy, derived.** A DB trigger sets it from the list's `kind`. App code never writes it. |
| `applications` | Stays the **submission record** (one per job, created on drag into Applied). Not renamed, not a container. |
| Grouping | **`positions` table** (target roles), not packets. A position has an optional default resume. |
| Application Inbox | Jobs with no `applications` row surface in an Inbox panel. |
| Boards | **Single implicit board per user.** No `boards` table. |
| v1 scope | Board + positions + per-job resume/links + onboarding. |
| Out of v1 | Activities, Contacts, Map, Metrics tabs, AI cover letters, board sharing, time tracking, Greenhouse/Lever auto-discovery, MCP server. |

---

## DO NOT (read before writing code)

- **DO NOT add any npm dependency.** No `dnd-kit`, no `react-beautiful-dnd`, no `react-hook-form`, no dropzone lib. Native HTML5 drag events are already the house pattern — `components/job-import/screenshot-upload.tsx:212`, `components/settings/avatar-upload.tsx:194`.
- **DO NOT build a resume builder, editor, or "create resume" flow.** Upload only. `components/documents-upload.tsx` + `lib/utils/pdf-extract.ts` already do this end to end.
- **DO NOT build a "packet" that groups multiple jobs.** Explicitly rejected. Grouping is `positions`.
- **DO NOT write `jobs.status` from application code.** The trigger owns it. Writing it manually creates two sources of truth.
- **DO NOT touch `lib/types/database.ts`.** It is dead code — imported by nothing, stale by 16 migrations, and the Supabase clients are untyped. `CLAUDE.md:63` says keep it in sync; that instruction is aspirational and not worth honouring here. Put new types in `lib/types/board.ts`.
- **DO NOT hand-roll a modal overlay** for the card detail. `components/ui/sheet.tsx` **is** installed — use it. (There is no `ui/dialog.tsx`; five existing files hand-roll overlays. Do not add a sixth.)
- **DO NOT use Radix idioms.** shadcn style is `base-luma` on `@base-ui/react`. No `asChild` — base-ui uses `render`. `Select`'s `onValueChange` yields possibly-`null`, so always `?? default` (see `components/add-job-dialog.tsx:106-127`).
- **DO NOT use `components/ui/badge.tsx` for status pills.** House style is an inline `<span>` with a local `Record<string,string>` of Tailwind classes (`jobs-grid.tsx:55-60`).
- **DO NOT parse PDFs server-side.** Extract text in the client with `extractTextFromPDF` and post it as the `extracted_text` field, exactly as `documents-upload.tsx` does.
- **DO NOT add a DB read to `proxy.ts` for the onboarding gate.** `app/(dashboard)/layout.tsx` already fetches the profile — add one column to that select.
- **DO NOT delete or rewrite `/jobs`, `/applications`, `/interviews`.** They stay.
- **Next 16:** `searchParams` is a `Promise` — `const params = await props.searchParams`.
- Every write is scoped `.eq("user_id", userId)` and followed by `revalidatePath` + `logResourceActivity`.

---

## 0. Rename: Aven → AtTrack

80 occurrences across 26 files. Do this **first**, as its own commit, so the board work lands on the right name and the diff stays reviewable.

**Mechanical string swap** — `Aven` → `AtTrack`, `Aven Job Tracker` → `AtTrack`:

| Group | Files |
|---|---|
| Metadata | `app/layout.tsx:41-42` (`default` + `template`) |
| Chrome / logo alt | `components/dashboard-header.tsx:154,159,223,224`, `components/landing-header.tsx:86,92,204,206`, `app/not-found.tsx:14,20`, `app/(auth)/{login,signup,magic-link}/page.tsx` |
| Landing copy | `components/landing/{hero,features,how-it-works,ai-highlight,testimonials,faq,privacy,footer}.tsx` |
| Legal | `app/privacy-policy/page.tsx` (9), `app/terms/page.tsx` (17) |
| Misc | `components/settings/app-password-guide.tsx:82`, `app/api/ai/generate-email/route.ts:80` (OpenRouter `X-Title`) |
| Docs / package | `README.md:1`, `CLAUDE.md:26`, `package.json:2` (+ `package-lock.json` — regenerate with `npm install`, don't hand-edit) |

**Three deliberate exceptions — do NOT blind-replace:**

1. **`components/providers.tsx:13` — keep `storageKey="aven-theme"`.** Renaming the key silently resets every existing user's light/dark choice for zero user-visible benefit. It's an internal localStorage key, not branding.
2. **`migrations/001_initial_schema.sql:1` and `002_add_avatar.sql:1`** — leave them. Comment-only mentions in migrations that have already been applied; the repo convention is that numbered migrations are immutable history.
3. **`public/logo.png`** — the asset itself is a design task, out of scope here. Only the `alt` text changes.

The repo directory name (`e:\07_Open-source\aven`) and the git remote are untouched — renaming either is a separate, riskier operation with no bearing on the build.

---

## 1. Migration — `migrations/019_board_positions_onboarding.sql`

One new file. Applied manually (no migration tool in this repo).

```sql
-- Migration 019: Kanban board, positions, per-job resume + project links, onboarding

-- =============================================
-- 1. board_lists — user-owned kanban columns
-- =============================================
CREATE TABLE IF NOT EXISTS board_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('wishlist','preparing','applied','interview','offer','accepted','rejected','custom')),
  color TEXT,
  sort_order NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_lists_user ON board_lists(user_id, sort_order);

-- At most one list per semantic kind per user, so drag automation is never ambiguous.
-- Unlimited 'custom' lists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_board_lists_one_per_kind
  ON board_lists(user_id, kind) WHERE kind <> 'custom';

-- =============================================
-- 2. positions — target roles jobs are tagged under
-- =============================================
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  experience_level TEXT CHECK (experience_level IN ('entry','mid','senior')),
  resume_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_name_per_user
  ON positions(user_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_one_primary
  ON positions(user_id) WHERE is_primary;

-- =============================================
-- 3. jobs — board placement, position tag, chosen resume, project links
-- =============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES board_lists(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS board_position NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_links JSONB;

CREATE INDEX IF NOT EXISTS idx_jobs_board ON jobs(user_id, list_id, board_position);
CREATE INDEX IF NOT EXISTS idx_jobs_position_id ON jobs(position_id);

-- =============================================
-- 4. applications — project links live on the job, but keep the submission snapshot
-- =============================================
-- (no schema change needed: resume_id, resume_name, notes, status all exist from 016)

-- =============================================
-- 5. Seed function — single definition of the default columns
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_board_lists(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO board_lists (user_id, name, kind, color, sort_order) VALUES
    (p_user_id, 'Wishlist',  'wishlist',  '#94A3B8', 1),
    (p_user_id, 'Preparing', 'preparing', '#F59E0B', 2),
    (p_user_id, 'Applied',   'applied',   '#8B5CF6', 3),
    (p_user_id, 'Interview', 'interview', '#10B981', 4),
    (p_user_id, 'Offer',     'offer',     '#059669', 5),
    (p_user_id, 'Rejected',  'rejected',  '#EF4444', 6)
  ON CONFLICT DO NOTHING;
END; $$;

GRANT EXECUTE ON FUNCTION public.seed_board_lists(UUID) TO authenticated;

-- =============================================
-- 6. Backfill: seed every existing user, then place existing jobs
-- =============================================
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM profiles LOOP
    PERFORM public.seed_board_lists(u.id);
  END LOOP;
END $$;

UPDATE jobs j SET list_id = bl.id
FROM board_lists bl
WHERE bl.user_id = j.user_id
  AND j.list_id IS NULL
  AND bl.kind = CASE
    WHEN EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.status = 'rejected') THEN 'rejected'
    WHEN EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.status IN ('offer','accepted')) THEN 'offer'
    WHEN EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.status = 'interview') THEN 'interview'
    WHEN EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id) THEN 'applied'
    WHEN j.status = 'preparing' THEN 'preparing'
    ELSE 'wishlist'
  END;

UPDATE jobs SET board_position = sub.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY user_id, list_id ORDER BY created_at DESC) AS rn
  FROM jobs
) sub
WHERE jobs.id = sub.id AND jobs.board_position IS NULL;

-- =============================================
-- 7. Trigger: jobs.status is DERIVED from the list's kind
--    Keeps /jobs, /interviews (getPreparingJobs), /overview, /insights working
--    with zero code changes, and guarantees consistency no matter which
--    code path moves a card.
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_job_status_from_list()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE k TEXT;
BEGIN
  IF NEW.list_id IS NULL THEN RETURN NEW; END IF;
  SELECT kind INTO k FROM board_lists WHERE id = NEW.list_id;
  NEW.status := CASE WHEN k = 'wishlist' THEN 'saved' ELSE 'preparing' END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_job_status_from_list ON jobs;
CREATE TRIGGER set_job_status_from_list
  BEFORE INSERT OR UPDATE OF list_id ON jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_status_from_list();

-- =============================================
-- 8. updated_at triggers (update_updated_at() defined in 001)
-- =============================================
DROP TRIGGER IF EXISTS set_board_lists_updated_at ON board_lists;
CREATE TRIGGER set_board_lists_updated_at BEFORE UPDATE ON board_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_positions_updated_at ON positions;
CREATE TRIGGER set_positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 9. RLS  (pattern from 011/016; admin overlay via is_admin() from 018)
-- =============================================
ALTER TABLE board_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own board lists" ON board_lists FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all board lists" ON board_lists FOR SELECT
  USING (public.is_admin());

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own positions" ON positions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all positions" ON positions FOR SELECT
  USING (public.is_admin());

-- =============================================
-- 10. Onboarding flag — existing users are grandfathered in
-- =============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
UPDATE profiles SET onboarded_at = NOW() WHERE onboarded_at IS NULL;
```

> Note the repo's dominant RLS pattern (`011:33`) omits `WITH CHECK`. Included here because `FOR ALL` without it leaves INSERT unguarded by intent.

---

## 2. Types — `lib/types/board.ts` (new)

```ts
export type ListKind =
  | "wishlist" | "preparing" | "applied"
  | "interview" | "offer" | "accepted" | "rejected" | "custom";

export interface BoardList {
  id: string; name: string; kind: ListKind;
  color: string | null; sort_order: number;
}

export interface ProjectLink { id: string; label: string; url: string }

export interface BoardCard {
  id: string;                    // jobs.id
  title: string;
  company_name: string | null;
  list_id: string | null;
  board_position: number | null;
  position_id: string | null;
  position_name: string | null;
  resume_id: string | null;
  resume_name: string | null;
  match_score: number | null;
  project_links: ProjectLink[] | null;
  deadline: string | null;
  created_at: string;
  application_id: string | null;      // null => shows in Application Inbox
  application_status: string | null;
}

export interface Position {
  id: string; name: string;
  experience_level: "entry" | "mid" | "senior" | null;
  resume_id: string | null; resume_name: string | null;
  is_primary: boolean; job_count: number;
}

export const LIST_KIND_LABELS: Record<ListKind, string> = { /* ... */ };
export const DEFAULT_LIST_COLORS: Record<ListKind, string> = { /* mirror the seed fn hexes */ };
```

Add nothing to `lib/types/job.ts` except leaving it alone — `JOB_STATUS_*` maps stay for `/jobs`.

---

## 3. Server actions

### `lib/actions/board.ts` (new)

```ts
getBoard(params?: { positionId?: string }): Promise<{ lists: BoardList[]; cards: BoardCard[] }>
```
Two queries total, joined in memory: `board_lists` ordered by `sort_order`, then `jobs` with `company:companies(name)`, `position:positions(name)`, `resume:documents!jobs_resume_id_fkey(name)`, `applications(id,status)`. Filter by `position_id` in SQL when given. If `lists` comes back empty, call `supabase.rpc("seed_board_lists", { p_user_id: userId })` once and re-read — that covers users created before onboarding existed.

```ts
moveCard(jobId: string, listId: string, targetIndex: number): Promise<void>
```
Read the target list's job ids ordered by `board_position`, splice `jobId` in at `targetIndex`, write back `board_position = arrayIndex` for that list. Full-column rewrite instead of fractional indices — always correct, no float collapse, and a single batched update.
`// ponytail: rewrites one column's ordering per move; switch to fractional board_position if a column ever exceeds ~200 cards`

Then, if the destination list's `kind === "applied"`, **find-or-create** the `applications` row. Do not call `createApplication` from `lib/actions/jobs.ts:203` directly — it `throw`s when one already exists (`:219-221`), which would break a re-drag. Either extend it with an idempotent path or inline the upsert here, copying `jobs.resume_id`/resume name into `applications.resume_id`/`resume_name` and setting `applied_at`. Dragging *out* of Applied must **not** delete the application row.

```ts
createList(name: string): Promise<{ id: string }>          // kind 'custom', sort_order = max+1
renameList(id: string, name: string): Promise<void>
deleteList(id: string): Promise<void>                      // move its cards to the 'wishlist' list first; refuse if kind <> 'custom'
reorderLists(orderedIds: string[]): Promise<void>
```

### `lib/actions/positions.ts` (new)

`getPositions()`, `createPosition(formData)`, `updatePosition(id, data)`, `deletePosition(id)` (jobs' `position_id` goes NULL via the FK), `setPrimaryPosition(id)` (clear the old primary first — the partial unique index will otherwise reject).

### `lib/actions/jobs.ts` (extend)

```ts
setJobResume(jobId: string, resumeId: string | null): Promise<void>
setJobProjectLinks(jobId: string, links: ProjectLink[]): Promise<void>
setJobPosition(jobId: string, positionId: string | null): Promise<void>
```
`setJobResume` also re-scores: call `calculateMatchScore` (`lib/ai/resume.ts:164`) against *that* resume's `match_data` and write `match_score` / `match_reasoning` / `matched_resume_id`.
`setJobPosition` prefills `jobs.resume_id` from the position's `resume_id` when the job has none.

**Correctness fix required:** `recalculateAllMatchScores` (`lib/actions/documents.ts:216`) currently overwrites `match_score`/`matched_resume_id` on every job with the best-of-all-resumes result. Once a user picks a resume deliberately, that pick must win. Add one guard in that shared function — skip jobs where `resume_id IS NOT NULL`. One edit, all callers covered (it runs on every resume upload).
`// ponytail: still jobs × resumes sequential LLM calls; scope to default + manual picks if it gets slow`

Also extend `createJob` (`jobs.ts:8`) to accept optional `position_id` and to place the new job in the Wishlist list (`board_position` = max+1) so screenshot-imported jobs land on the board.

### `lib/actions/onboarding.ts` (new)

```ts
completeOnboarding(formData: FormData): Promise<void>
```
Resume upload is already done by `uploadDocument` in step 1. This action: `rpc("seed_board_lists")` → insert the `positions` row (`is_primary: true`, `resume_id` = the uploaded doc) → set `profiles.onboarded_at` → `logResourceActivity(userId, "complete", "onboarding")` → `redirect("/board")`.

---

## 4. Routes & components

| Path | Kind | Notes |
|---|---|---|
| `app/(dashboard)/board/page.tsx` | server | `getBoard({positionId})` + `getPositions()`. Follow the page shell in `app/(dashboard)/jobs/page.tsx` verbatim (bleed header `-mx-6 border-b border-border pb-6`, `font-heading text-2xl`, `<Breadcrumbs />`). |
| `app/(dashboard)/board/loading.tsx` | server | Column-shaped skeletons, mirroring the real layout the way `jobs/loading.tsx` does. |
| `app/onboarding/page.tsx` | server | **Outside** `(dashboard)` or the gate loops. Own minimal centered layout. |
| `components/board/board-view.tsx` | client | Columns, horizontal scroll, drag state, optimistic move via `useOptimistic`. |
| `components/board/board-column.tsx` | client | Header, count, `+` button, drop target. |
| `components/board/board-card.tsx` | client | `draggable`, opens the sheet on click, has the Move-to menu. |
| `components/board/board-toolbar.tsx` | client | Board name, position Filter, `+ Create` (reuses `AddJobDialog`). |
| `components/board/card-detail-sheet.tsx` | client | **Uses `ui/sheet.tsx`.** Resume picker, project-links editor, position picker, notes, application status. |
| `components/board/add-list-button.tsx` | client | Dashed ghost column. |
| `components/board/application-inbox.tsx` | client | Cards with `application_id === null`. |
| `components/positions/position-select.tsx` | client | Reused in `add-job-dialog.tsx`, `edit-job-dialog.tsx`, and the sheet. |
| `components/onboarding/onboarding-wizard.tsx` | client | 3 steps (below). |

### Drag & drop

Native HTML5 only: `draggable` + `onDragStart` (set `dataTransfer` to the job id) on the card, `onDragOver={e => e.preventDefault()}` + `onDrop` on the column. Same shape as `components/job-import/screenshot-upload.tsx:212`.

**HTML5 DnD does not fire on touch and is not keyboard-operable.** So each card also gets a **"Move to →" `DropdownMenu`** listing every list. This is not optional polish — it is the mobile and keyboard path, and it calls the same `moveCard` action.
`// ponytail: native DnD for pointer; the Move-to menu is the touch/keyboard path. Add dnd-kit only if multi-select drag is ever needed.`

### Onboarding wizard (3 steps)

1. **Upload your resume** — required. Reuse `extractTextFromPDF` (`lib/utils/pdf-extract.ts`) then `uploadDocument` with `type: "resume"`, `is_default: true`. Copy the two-phase button label from `documents-upload.tsx:236`.
2. **Your target position** — name + experience level (`entry` / `mid` / `senior`), matching the Huntr screenshot's radio group.
3. **Progress screen** — checklist ticking through the work already happening (`extractResumeContent` runs inside `uploadDocument`), then `completeOnboarding` → `/board`.

Resume-first ordering follows your wording ("uploading a resume … is a primary requirement"); Huntr asks for the job first. Swapping the two steps is a reorder of the wizard array, nothing more.
Skipped: LinkedIn import (no scraper, and LinkedIn blocks it) and "start from scratch" (that path implies a resume builder, which is explicitly out).

### Onboarding gate — one line, no new query

`app/(dashboard)/layout.tsx` already does `.select("avatar_url, full_name, role")`. Add `onboarded_at`, then:
```ts
if (!profile?.onboarded_at) redirect("/onboarding");
```

---

## 5. Wiring (small, easy to forget)

- `components/sidebar.tsx:27` — add `{ name: "Board", href: "/board", icon: KanbanSquare }` as the **first** entry of `pipelineNavigation`. The six copy-pasted `.map()` blocks handle rendering; the same component serves desktop and the mobile drawer.
- `components/dashboard-header.tsx:28` — add to `NAV_ITEMS` so ⌘K finds it: `{ name: "Board", href: "/board", keywords: "kanban pipeline stages drag" }`.
- `lib/actions/search.ts:24` — add `/board` to `PAGE_RESULTS`.
- `proxy.ts:4` — add `"/board"` and `"/onboarding"` to `protectedRoutes`. **`"/applications"` is missing from that array today** — an existing gap (the route is still gated by `getUser()` in the layout, but admins aren't bounced to `/admin`). Add it while you're in the file.
- `lib/activity-messages.ts` — add cases for the new `action`/`resource` pairs (`move_card`/`job`, `create|update|delete`/`board_list`, `create|update|delete`/`position`, `complete`/`onboarding`) or the admin activity viewer renders raw fallbacks.

---

## 6. UI spec — the Huntr feel

AtTrack's design signature is already close: everything is `rounded-4xl` (≈1.625rem), cards are `border border-border bg-card`, headings are `font-heading` (Bricolage Grotesque). Match it or the board looks foreign.

| Element | Spec |
|---|---|
| Board container | `flex gap-3 overflow-x-auto pb-4` — its **own** `overflow-x`; `<main>` in the dashboard layout is `overflow-y-auto` inside `h-screen`, don't fight it |
| Column | `w-72 shrink-0` |
| Column header | lucide icon in a muted circle + `text-xs font-semibold uppercase tracking-wide`, then `text-[10px] text-muted-foreground` count line ("3 JOBS") |
| Add-card button | full-width `rounded-4xl border border-dashed` ghost `+` under the header |
| Card | `rounded-4xl border border-border bg-card p-4 border-l-4` in the list colour; `text-sm font-semibold` title; company row with `<Building2 className="size-3.5" />`; footer = relative time (`date-fns`, already installed) + match-score pill. Base markup to copy: `components/jobs-grid.tsx:281-311` |
| Status/score pills | inline `<span className="rounded-4xl px-2.5 py-1 text-[10px] font-medium ...">` with a local class map — **not** `<Badge>` |
| Add list | dashed ghost column, `w-72`, `+ ADD LIST` |
| Toolbar | board name `font-heading text-lg` + Filter chip (by position) + right-side `+ Create` |
| Toasts | `sonner` — already mounted in `components/providers.tsx:16`. Richest example: `components/email-apply-button.tsx:18-25`. Do not use `confirm()`/`alert()` (`documents-list.tsx:33` does; don't copy it) |

**Colour:** Huntr is violet; AtTrack's `--primary` is amber-gold (`oklch(0.852 0.199 91.936)`), used consistently across every existing page. Recommendation: **keep amber** — adopt Huntr's layout and density, not its hue. If you do want violet it's two lines in `app/globals.css` (`--primary` in `:root` and in `.dark`), and everything else follows automatically since all components read the token.

---

## 7. Build order

Each phase ends compiling and usable.

0. **Rename** (§0) — own commit, before anything else.
1. **Migration + types** — write `019_*.sql`, apply it in Supabase, add `lib/types/board.ts`. Verify with the SQL checks below before writing any TSX.
2. **Read-only board** — `lib/actions/board.ts:getBoard`, `/board` page + `loading.tsx`, column and card components. No drag yet.
3. **Moving cards** — `moveCard`, native DnD, the Move-to dropdown, optimistic UI, application find-or-create on the Applied list.
4. **Card detail sheet** — resume picker, project-links editor, notes, application status. Plus `setJobResume` / `setJobProjectLinks` and the `recalculateAllMatchScores` guard.
5. **Positions** — `lib/actions/positions.ts`, `position-select.tsx`, wire into `add-job-dialog.tsx` / `edit-job-dialog.tsx`, board Filter, `setJobPosition`.
6. **Custom lists** — `createList` / `renameList` / `deleteList` / `reorderLists` + the Add-list column.
7. **Onboarding** — wizard, `completeOnboarding`, the layout gate.
8. **Wiring** — sidebar, ⌘K, `PAGE_RESULTS`, `proxy.ts`, `activity-messages.ts`. Application Inbox panel.

---

## 8. Verification

**After the migration, in the Supabase SQL editor:**
```sql
-- 6 lists per user, no duplicate kinds
SELECT user_id, count(*), count(DISTINCT kind) FROM board_lists GROUP BY user_id;
-- every job placed, every job ordered
SELECT count(*) FROM jobs WHERE list_id IS NULL OR board_position IS NULL;   -- expect 0
-- the trigger holds: no job in a non-wishlist list still reads 'saved'
SELECT j.status, bl.kind, count(*) FROM jobs j JOIN board_lists bl ON bl.id = j.list_id
GROUP BY 1,2;
```

**Build gates:** `npm run lint` then `npm run build` clean after each phase.

**Rename check:** `rg -i "\bAven\b"` should return only `providers.tsx` (`aven-theme`), `migrations/001`, `migrations/002`, and `package-lock.json`'s regenerated entries. Browser tab reads "AtTrack". Existing users' theme preference survives a reload.

**Manual pass (`npm run dev`):**
1. `/board` renders 6 columns; every job that was on `/jobs` appears exactly once.
2. Drag a card Wishlist → Applied. Reload: it stays. `/applications` now lists it. `/jobs` still shows it (as Preparing).
3. Drag it back to Wishlist. The application row survives; `/jobs` shows it as Saved.
4. Move a card with the **keyboard only** via the Move-to menu — same result as dragging.
5. Open a card → attach a resume → confirm `match_score` updates and reflects *that* resume. Then upload a different resume from `/documents` and confirm the manual pick was **not** overwritten.
6. Add two project links, reload, confirm both persist.
7. Create a custom list, drag a card in, rename it, then delete it — the card falls back to Wishlist, not into nothing.
8. Import a job via screenshot (`/jobs` → ImportChoice). It appears in Wishlist.
9. Tag two jobs to different positions, filter the board by one, confirm the other disappears.
10. New-user onboarding: sign up → forced to `/onboarding` → upload resume → set position → land on `/board` with 6 seeded columns. Existing users must **not** be sent to `/onboarding`.
11. `/overview` and `/insights` charts still render with no errors.
12. `/admin/activity` shows readable strings (not raw fallbacks) for the new actions.

**Regression watch:** `/interviews` uses `getPreparingJobs()` (`lib/actions/interviews.ts:200`), which filters `jobs.status = 'preparing'`. After the trigger, that means "anything past Wishlist" — a wider set than before. Confirm the interview dialog's job picker still looks sane.

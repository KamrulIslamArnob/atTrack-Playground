# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Future features

`FUTURE_FEATURES.md` (repo root) is the user's backlog of features not built yet. Check it at the start of any feature work: verify each listed item against the actual code — if it's already implemented, mark it done or remove it rather than rebuilding it. If the file says empty, it's empty — don't invent or assume pending features. The user adds items themselves when they want something built later; don't add items to it on your own.

## Design

`DESIGN.md` (repo root) documents the brand gradient feature (tokens + utility classes in `app/globals.css`) and when it's allowed to be used. Check it before touching colors/gradients/backgrounds — the app is white/light by default; the gradient is a sparing accent, not a theme.

## Commands

```bash
npm run dev      # start dev server (Next.js, Turbopack)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next)
```

There is no test suite/framework configured in this repo (no `test` script, no jest/vitest config, no `*.test.*` files).

## Architecture

AtTrack is a personal job-application tracker that runs **locally as a native single-user app**: Next.js 16 (App Router) + React 19 + TypeScript, local SQLite for data and the filesystem for uploads, Tailwind v4 + shadcn/ui for UI, OpenRouter for all AI calls. Supabase is gone — only the `lib/supabase/` file paths remain, so call sites did not have to churn.

The product name is **AtTrack**. One intentional exception still reads "aven": the `next-themes` `storageKey` (`"aven-theme"` in `components/providers.tsx` — renaming it would reset every existing user's theme choice).

### The board (`/board`) is the primary surface

The board unifies the pipeline into one Kanban board over `jobs` (originally migration 019, now collapsed into `lib/db/schema.sql` — see below). This supersedes the two-ladder split that came before it:

- **`board_lists`** — user-owned columns. Six are seeded per user by `public.seed_board_lists(uuid)` (Wishlist / Preparing / Applied / Interview / Offer / Rejected); users can add unlimited `kind = 'custom'` ones. A partial unique index on `(user_id, kind) WHERE kind <> 'custom'` guarantees at most one column per semantic kind, so "which column means Applied?" is never ambiguous. **`kind`, not `name`, drives automation** — a renamed column still behaves correctly.
- **`jobs.list_id` / `jobs.board_position`** — where the card sits. One card per job, spanning the whole lifecycle.
- **`jobs.status` is now DERIVED and must never be written from application code.** The `sync_job_status_from_list` trigger sets it from the destination list's `kind` (`wishlist` → `'saved'`, everything else → `'preparing'`). This is what keeps `/jobs`, `/interviews` (`getPreparingJobs()`), `/overview` and `/insights` working unchanged. Writing `status` by hand creates a second source of truth.
- **`applications` is still the submission record**, one per job, created by `ensureApplication()` in `lib/actions/board.ts` when a card reaches a `kind = 'applied'` column. It is deliberately *not* `createApplication()` from `lib/actions/jobs.ts`, which throws on duplicates and would break a re-drag. Dragging back out never deletes the row.
- **`positions`** — target roles ("Frontend Developer") that jobs tag under via `jobs.position_id`, each with its own default `resume_id`. This is the grouping concept; there is no "packet" that contains multiple jobs.
- **`jobs.resume_id`** is the resume the *user* picked; **`jobs.matched_resume_id`** (migration 013) is what the AI picked and overwrites on every rescore. They are different columns on purpose — never conflate them.

Drag-and-drop is native HTML5 (no dnd-kit). Because HTML5 DnD does not fire on touch and is not keyboard-operable, every card also carries a "Move to" dropdown that calls the same `moveCard` action — that is the accessibility path, not optional polish.

### Job Detail Sheet (`components/job-detail/`)

Clicking a card's title opens `job-detail-sheet.tsx` (a wide `Sheet`) instead of navigating; `/jobs/[id]/page.tsx` renders the same `job-detail-content.tsx` server-side for a working deep link — one implementation, not two. `lib/actions/job-detail.ts`'s `getJobDetail(jobId)` is the single fetch backing both (job + company + applications + interviews + contacts + documents + resumes + activity in one call), called directly from the client for the sheet and awaited server-side for the page.

- **`contacts` / `job_contacts`** and **`documents` / `job_documents`** are both many-to-many: a contact or a resume can be attached to more than one job. `lib/actions/contacts.ts` and the `job_documents` helpers in `lib/actions/documents.ts` scope every read through the parent job's `user_id` first — those join tables carry no `user_id` column of their own.
- **`jobs.color`** is a per-job accent override, independent of the list's color; NULL falls back to `DEFAULT_LIST_COLORS`. Write it only via `setJobColor` (`lib/actions/jobs.ts`).
- **`setJobResume`** (`lib/actions/jobs.ts`) is the only place that writes `jobs.resume_id`, and it re-scores just that job against the picked resume. `recalculateAllMatchScores` (`lib/actions/documents.ts`, runs on every resume upload/delete/default-change) skips any job with `resume_id IS NOT NULL` so it can't clobber a manual pick — this guard and `setJobResume` must stay in sync if either changes.
- **AI Tools tab** — 8 email-shaped kinds (`lib/types/ai-tools.ts`) sharing one streaming route, `app/api/ai/generate-ai-tool/route.ts`, parametrized by `kind` (mirrors `generate-email/route.ts`'s SSE shape; only the system prompt's purpose paragraph differs per kind). `lib/ai/ai-tools.ts` holds the client-side `streamGenerateAiTool` helper and re-exports `parseEmailFromStream` from `lib/ai/email.ts` since the `{subject, body}` output shape is identical. `saveAiToolAsDocument`/`sendAiToolEmail` (`lib/actions/ai-tools.ts`) reuse `documents`/`job_documents` and the existing `sendApplicationEmail` rather than new tables or a new send path.
- `components/board/move-to-menu.tsx` (`MoveToMenu`) and `components/job-notes-editor.tsx` (`JobNotesEditor`) are shared UI lifted out of the board card / `AddJobDialog` so the sheet doesn't reimplement either.

### CRM (`/crm`)

Person-centric, not company-nested: `/crm` (`components/crm/crm-view.tsx`) is one page with two `Tabs` views over the same `contacts` rows — **Contacts** (default: flat searchable grid of people, company is a per-card `Select` "tag" you can reassign in place, no drill-down) and **Companies** (the collapsed-row-expands-to-jobs+contacts view, for when grouping *by* company is what's wanted). Company is deliberately not a container a contact must live inside — `getCrmCompanies()` (`lib/actions/companies.ts`) lists every `companies` row with a job count and contact count computed in memory from `jobs.company_id` / `contacts.company_id` (no `GROUP BY` in the query builder), and that's the only thing "company" drives. A company already becomes "common ground" between a job and a contact for free — `createJob()` find-or-creates `companies` by exact name, and `contacts.company_id` points at the same row — the CRM page is purely a new view over an existing link, not a new relationship.

- **`lib/types/contacts.ts`**'s `CONTACT_ROLES` is the fixed relationship list (Recruiter / Hiring Manager / Employee / Alumni / Referral / Other) — a plain `TEXT` column enforced only in the app layer (same pattern as `jobs.employment_type`), not a DB `CHECK`. Every place a contact's role is set or shown goes through this list now, not free text — `contactRoleLabel()` maps a stored value back to its label.
- **`lib/actions/contacts.ts`** has three contact-creation paths now: `createContact(jobId, ...)` (job-detail-sheet's Contacts tab — creates *and* links to that job in one step), `createCompanyContact(companyId, ...)` (Companies-tab "+ Add contact" — company required), and `createPersonContact(formData)` (Contacts-tab "+ Add contact" — `company_id` in the `FormData` is optional, the person-first default). `setContactCompany(contactId, companyId | null)` is the tag-assign/reassign/unassign path, used both by the Contacts tab's per-card company `Select` and by the Companies tab's "link existing" picker (`getOrphanContacts()` feeds that one).
- **AI auto-detects a contact from job postings.** `extractionSchema` (`lib/ai/schema.ts`) carries an optional `contact: {name, email, role}`, filled in only when the posting explicitly names a person (the prompt rule in `lib/ai/prompts.ts` forbids inventing one from a bare `careers@` address). `AddJobDialog` surfaces it as a single dismissible line, not a form field — on submit it rides along as `contact_name`/`contact_email`/`contact_role` in the same `FormData`. `createJob()` (`lib/actions/jobs.ts`) find-or-creates that contact under the job's resolved `company_id` (matched by email first, then name) and links it via `job_contacts`, wrapped in try/catch so a contact-linking failure never blocks saving the job.

### Navigation

Applications and Interviews are off the sidebar/⌘K nav and out of `lib/types/contacts.ts`'s neighbor, `NAV_ITEMS` — **the `/applications` and `/interviews` routes, their server actions, and the `applications`/`interviews` tables are all still live**, just not a primary nav entry right now (`ensureApplication`, the Shortcuts panel's Log Interview, and AI Tools all still depend on them). Don't delete either route or table on the assumption they're dead. "Documents" is user-facing "Resume/CV" everywhere (nav label, page heading, breadcrumb) — the route, storage bucket, and `documents`/`type` column are still named `documents`/`document` internally; only the label changed.

### Data layer: local SQLite (`lib/db/`)

**The backend is local SQLite, not Supabase.** The app runs fully offline; `.env.local` needs no database URL. Nothing in `lib/actions/*` had to change, because `lib/db/` presents a supabase-js-shaped API.

Requires **Node 22.5+** (24+ recommended) for the built-in `node:sqlite`. No database driver dependency.

| File | Role |
|---|---|
| `schema.sql` | **The schema, and the source of truth.** All 19 migrations collapsed and translated. Applied idempotently on first connection — there is no migration step to run. **New tables only** — every statement is `CREATE ... IF NOT EXISTS`, so adding a column to an existing `CREATE TABLE` block here does nothing to a database that already has that table. Also add the column to `sqlite.ts`'s `COLUMN_MIGRATIONS` array (an `ALTER TABLE ADD COLUMN`, swallowing the "duplicate column name" error once applied) — that's what actually reaches an existing database. Both are required in the same change; schema.sql alone only helps a brand-new `.data/`. |
| `sqlite.ts` | `DatabaseSync` singleton, cached on `globalThis` (dev hot-reload would otherwise leak handles). Sets WAL, `foreign_keys=ON`, `busy_timeout`, then `COLUMN_MIGRATIONS` (see above). |
| `query.ts` | The PostgREST-shaped query builder: `from(t).select().eq()…`, embeds, `count`, `range`, `single`. |
| `meta.ts` | JSON/boolean column registry. SQLite has neither type — **add new JSON or boolean columns here in the same change**, or reads hand back raw strings and `0`/`1`. |
| `relations.ts` | Declared embed relationships. A `select("company:companies(name)")` that isn't declared here throws. |
| `local-user.ts`, `auth-api.ts` | Resolve the single local owner (below). No passwords or sessions. |
| `storage.ts` | Filesystem buckets. |
| `selfcheck.ts` | 27 assertions over the query builder. **Run `node lib/db/selfcheck.ts` after touching `query.ts`.** |

Data lives in `.data/` (gitignored): `attrack.db` plus `storage/`. Delete the directory to reset.

Translation rules: `UUID`→`TEXT` (ids generated in app code), `TIMESTAMPTZ`→`TEXT` ISO-8601 UTC, `JSONB`/`BOOLEAN`→`TEXT`/`INTEGER` via `meta.ts`, `NUMERIC`→`REAL`.

Two gotchas in `query.ts`, both fixed the hard way — don't reintroduce them:
- `DbResult` must **not** be generic. With a type parameter defaulting through both the interface and the builder class, `Awaited<>` failed to resolve and `await` inferred `{}`, producing ~60 bogus implicit-any errors in unrelated files.
- `data` is `DbRow[] & DbRow`, not `any`. Plain `any` gives array callbacks no contextual type, so `(rows ?? []).map((r) => …)` trips `noImplicitAny`.

### `user_id` scoping is now the only row filter

Postgres RLS (54 policies) was the second line of defence behind the `.eq("user_id", userId)` filters in `lib/actions`; **SQLite has no row-level security, so those filters stand alone.** Every query against a user-owned table must carry `.eq("user_id", userId)` (or `.eq("id", userId)` for `profiles`).

With a single owner this is no longer a data-leak boundary between people, but it is still load-bearing: a database carried over from the multi-user build can hold other ids, and an unscoped `UPDATE`/`DELETE` reaches every row in the table rather than yours. The SQLite migration required adding scoping to queries that had relied on RLS alone — the search helpers in `applications.ts`/`interviews.ts` and two `UPDATE jobs` writes. Keep the pattern in new code.

### ⚠️ There is no authentication at all

AtTrack is a **native single-user app**. There is no login, no sign-up, no password, no session, and no cookie. `lib/db/local-user.ts` resolves one owner row (creating it on first run, `owner@attrack.local`), and `getUser()` returns it unconditionally — it never redirects and never fails.

**Whoever can reach the process is the owner.** `next dev` binds localhost, but `next start` binds all interfaces — do not expose the port on an untrusted network, and do not deploy this build to a public host. Protecting the machine and the `.data/` directory *is* the security model.

Consequences to keep in mind when editing:
- `getAdminUser()` no longer gates anything; it just calls `getUser()`.
- The owner's profile `role` stays `'user'` on purpose. The sidebar swaps to an **admin-only** navigation when `role === 'admin'`, which would hide Board/Jobs/Documents from the only person using the app. The `/admin` routes remain reachable by URL.
- `profiles.is_banned` is vestigial; `getUser()` always reports `isBanned: false`.
- `users.encrypted_password` is vestigial — nullable in `schema.sql`, written as the literal `'local'` so databases created by the earlier auth build (where it was NOT NULL) still accept inserts. Nothing reads it.
- There is no `proxy.ts` / middleware any more. Route protection was its only job.

### Route groups

- `app/(dashboard)/` — **both** regular pages and admin pages live in this one group. Admin pages are `app/(dashboard)/admin/**`; there is no separate `(admin)` group. `app/(dashboard)/layout.tsx` fetches the profile once (`role`, `avatar_url`, `full_name`, `onboarded_at`) and passes `role` down for role-aware UI.
- `app/page.tsx` is the marketing landing page. Its CTAs point at `/overview`; it is statically rendered because it no longer reads any request state.

### Storage (`lib/db/storage.ts`, `app/api/files/`)

Three filesystem buckets under `.data/storage/`, mirroring the old ones: `documents` and `job-imports` (private), `avatar` (public). Keys keep the `{userId}/...` prefix.

Reads go through `app/api/files/[bucket]/[...key]/route.ts`, which authorizes by **either** an HMAC-signed, time-limited token (`createSignedUrl`) **or** a session whose user id matches the key's first segment. That route is the enforcement point the storage RLS policies used to be; `storage.ts` itself only guarantees a key cannot escape its bucket directory.

### Data clients (`lib/supabase/`)

Kept at their old paths and names so call sites don't churn, but both now return the SQLite client:
- `server.ts` — `createClient()`, request-scoped, wired to Next cookies for the session. Used via `getUser()`.
- `admin.ts` — `createAdminClient()`, session-less. **No longer more privileged than `server.ts`** — with RLS gone, "wrong client" is no longer a contained mistake. Any query here must scope by `user_id` itself unless it genuinely reads across all users (activity logging, admin dashboards).
- The browser client is deleted; SQLite cannot run in a browser.

### Server actions (`lib/actions/*.ts`)

One file per domain (`jobs`, `applications`, `board`, `interviews`, `documents`, `auth`, `smtp`, `admin`, `mcq`, `search`, `insights`, `job-imports`, `email`, `activity-log`, `ai-usage`, `job-detail`, `contacts`, `companies`, `ai-tools`). Standard shape:

```ts
"use server";
// 1. auth: const { supabase, userId } = await getUser();  (or getAdminUser() for admin-only)
// 2. do the Supabase read/write
// 3. audit trail: await logResourceActivity(userId, action, resource, resourceId, metadata)
```

A `"use server"` file may only export async functions. Re-exporting a *type* from one (e.g. `export type { Foo }`) compiles into a runtime action export and fails the Turbopack build — keep types in `lib/types/*` and import them.

`logActivity`/`logResourceActivity`/`logAuthActivity` (`lib/actions/activity-log.ts`) write to `activity_logs` via the **admin** client and swallow their own errors — logging must never break the calling action. `logAiUsage` (`lib/actions/ai-usage.ts`) does the same for `ai_usage_logs`. `lib/activity-messages.ts` / `lib/ai-usage-messages.ts` turn the raw `action`/`resource`/`metadata` rows into human-readable strings for the admin activity/AI-usage viewers — extend these when adding a new `action` string, or it'll render as a raw fallback.

### AI layer (`lib/ai/`)

All AI calls go through the Gemini SDK (`@google/genai`) — `ai.ts` (job-posting extraction via Interactions API), `resume.ts` (resume/job match scoring), `mcq.ts` (practice-question generation), and the streaming routes `app/api/ai/generate-email/route.ts` and `app/api/ai/generate-ai-tool/route.ts` (application email drafting). A shared client lives in `lib/ai/gemini.ts` (`getGeminiClient()`, `MODEL = "models/gemini-2.0-flash"`). Only needs `GEMINI_API_KEY` — `OPENROUTER_API_KEY` is no longer used. `prompts.ts` and `schema.ts` hold shared prompt text and zod response schemas. `logger.ts` is a `pino` logger gated by `LOG_LEVEL`/`NODE_ENV`. Every call site logs to `logAiUsage` on both success and failure paths (tokens, duration) — follow that pattern for new AI calls.

Note: `tasks/todo.md` describes an older plan built around `@google/generative-ai` (a different, now-superseded Gemini package) and a `.env.example` file — neither exists in the current implementation. Treat files under `tasks/` as historical planning notes, not a description of current behavior; verify against actual code.

### `migrations/` and `lib/types/database.ts` are gone

Both were dead Postgres/Supabase artifacts — nothing applied the migrations, and the database types file was imported by nothing. They've been deleted. **Schema changes go in `lib/db/schema.sql`** (plus `lib/db/meta.ts` if the column is JSON or boolean). Row types come from `lib/db/query.ts`; domain types live in `lib/types/*.ts`. References to `migrations/NNN_*.sql` inside `tasks/*.md` and `planning.md` are historical planning notes, not live paths.

### Other conventions

- `lib/encryption.ts` — AES-256-GCM (`SMTP_ENCRYPTION_KEY`), used to encrypt per-user SMTP credentials before storing them via `lib/actions/smtp.ts`.
- `lib/calendar.ts` — builds a Google Calendar "add event" link from interview fields; used by `interviews-table.tsx` and `interview-form.tsx`.
- `lib/actions/jobs-list.ts` — paginated, searchable, sortable job listing backing `/jobs`.
- `components/ui/*` are shadcn/ui components (style `base-luma`, neutral base, lucide icons — see `components.json`); an extra `@react-bits` registry is configured there too (e.g. `components/ShinyText.tsx`). Regenerate/add via the shadcn CLI rather than hand-rolling primitives.
- Tailwind v4 is CSS-driven (no `tailwind.config.*`); theme tokens live in `app/globals.css`. Dark/light mode via `next-themes` (`class` attribute, `storageKey: "aven-theme"`).
- Path alias: `@/*` → repo root (`tsconfig.json`).

### Environment variables

No `.env.example` in the repo. **No database credentials are needed** — the database is a local file.

Required:
- `SMTP_ENCRYPTION_KEY` — AES-256-GCM key for per-user SMTP credentials, and the HMAC key signing storage URLs. The app throws without it when serving files.
- `GEMINI_API_KEY` — all AI calls: job-posting extraction, resume matching, MCQ generation, email drafting.

Optional:
- `SQLITE_PATH` / `SQLITE_DIR` — move the database file (default `.data/attrack.db`).
- `STORAGE_DIR` — move uploaded files (default `.data/storage`).
- `LOG_LEVEL`.

The `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` variables are no longer read by any code and can be deleted from `.env.local`.

**Deployment note:** SQLite needs a persistent writable disk, so serverless targets with an ephemeral filesystem (Vercel, Netlify functions) will lose data between invocations. Deploy to a host with a real volume — a VM, a container with a mounted volume, Fly.io, Railway.

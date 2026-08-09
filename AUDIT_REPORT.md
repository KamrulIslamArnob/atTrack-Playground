# AtTrack Codebase Audit Report

**Date:** 2026-08-09
**Scope:** Full project audit — architecture consistency, dead references, config hygiene, lint/build status

> Note: an earlier audit in this file described a Postgres / `@supabase` /
> `migrations/` codebase. That no longer exists — the app was migrated to a
> local SQLite backend (see `lib/db/`). This report reflects the **current**
> state of the tree.

---

## 1. Architecture (current)

AtTrack is a native, single-user local app:

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript.
- **Data:** local SQLite via `lib/db/` — `schema.sql` is the source of truth, applied idempotently on first connection.
- **Query layer:** `lib/db/query.ts` implements a supabase-js-shaped builder (`from(t).select().eq()…`, embeds, `count`, `range`, `single`) over SQLite, so `lib/actions/*` and `lib/auth.ts` needed no rewrite. `lib/supabase/*` are thin shims that return the SQLite client.
- **Auth:** none. `lib/db/local-user.ts` resolves a single owner row; `getUser()` never fails or redirects.
- **AI:** Gemini for job extraction (`lib/ai/ai.ts`), OpenRouter for everything else (`lib/ai/*`, API routes). Keys from `.env.local` (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `SMTP_ENCRYPTION_KEY`).

---

## 2. Dead References (fixed 2026-08-09)

These were left over from the Postgres/Supabase era and removed:

| Item | Location | Was | Now |
|---|---|---|---|
| `sessions` in `NO_AUTO_ID` | `lib/db/meta.ts` | listed a `sessions` table that no longer exists | removed (only `profiles`, `job_contacts`, `job_documents` remain) |
| `.env.local` dangling line | `.env.local` | bare `xaqahanquywzapsdlucc.supabase.co` with no `=` | removed |
| `.env.local` dead vars | `.env.local` | `KEY_NAME`, `MODEL` (read by nothing) | removed |
| README link | `README.md` | pointed to `IMPLEMENTATION_PLAN.md` (absent) | replaced with a Project Layout section |

The formerly-flagged `@supabase/ssr`, `@supabase/supabase-js`, `migrations/`, and `lib/types/database.ts` were **already gone** before this audit — none are referenced anywhere in the tree.

---

## 3. Schema Vestigial Fields (kept intentionally)

These exist for backward-compat with databases carried over from the earlier build. They are documented in `schema.sql` and are not bugs:

- `users.encrypted_password` — NOT NULL in old files; written as literal `'local'`, never read.
- `profiles.is_banned`, `banned_at` — `getUser()` always reports `isBanned: false`.
- `documents.application_id` — legacy from the original schema; unused by current code.
- `timeline_events`, `notes` — unused by current code ("present for parity").

---

## 4. `updated_at` Triggers

Present for: `profiles`, `jobs`, `applications`, `interviews`, `notes`, `board_lists`, `positions`, `contacts`, `companies`, `documents`, `smtp_config`.

The earlier audit claimed `contacts`, `companies`, `documents`, `smtp_config`, `application_emails` lacked triggers — that was **wrong**; they are all defined in `schema.sql` (lines ~421–431). `application_emails` has no trigger because it is append-only (rows are never updated, only inserted), so there is nothing to stamp.

---

## 5. Security

| Check | Status | Notes |
|---|---|---|
| Authentication | Intentional none | single-user local app — documented |
| Row-level security | N/A | SQLite has no RLS; `user_id` scoping is the only filter |
| UPDATE/DELETE scoped by `user_id` | Pass | verified across all actions |
| Storage route authorization | Pass | HMAC token or session user id match |
| `next start` binds all interfaces | Risk | documented — don't expose on untrusted network |
| Secrets in code | None | all keys via environment variables |

---

## 6. Build / Lint Status (2026-08-09)

- `tsc --noEmit` — **clean** (exit 0).
- `lib/db/selfcheck.ts` — **27/27 checks pass**.
- `next build` — **succeeds** (all 21 routes). ESLint runs during build but does **not** fail it.
- `eslint .` — 9 errors remain (see below), all in admin/landing/email UI components (React hook lint rules + one unescaped apostrophe). None affect runtime; tracked as hygiene.

### Remaining ESLint errors

| File | Rule | Note |
|---|---|---|
| `admin/activity/page.tsx` | `react-hooks/set-state-in-effect` (×2) | `loadLogs()` / user-map effects call setState synchronously |
| `admin/ai-usage/page.tsx` | `react-hooks/set-state-in-effect` (×2) | same pattern |
| `admin/users/[id]/page.tsx` | `react-hooks/set-state-in-effect` (×3) | load + Date.now-in-render |
| `email-composer.tsx` | `react-hooks/set-state-in-effect` | auto-generate effect |
| `job-import/ai-import.tsx` | `react/no-unescaped-entities` | apostrophe in JSX text |
| `landing-header.tsx` | `no-empty-object-type` + `set-state-in-effect` | empty `LandingHeaderProps` interface |

These are stylistic and were left to avoid behaviour changes in working admin screens.

---

## 7. What's Done Right

- **Single source of truth** — `schema.sql` + `lib/db/meta.ts` for JSON/boolean columns.
- **Query builder** — supabase-js-shaped API well-adapted for SQLite, with a selfcheck suite.
- **Activity logging** — comprehensive audit trail via `logResourceActivity`.
- **AI usage tracking** — every AI call logged with tokens, cost, duration.
- **Storage security** — HMAC-signed URLs + path traversal protection.
- **No secrets in code** — all keys via environment variables.

---

*End of report.*

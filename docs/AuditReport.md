# Latest Audit Report

**Date:** 2026-08-09  
**Scope:** Full project audit — architecture consistency, dead references, config hygiene, lint/build status.

This file should contain the latest audit only. When a new audit is performed, replace this report with the new dated summary instead of creating another audit document.

## Current architecture

atTrack is a native, single-user local app:

- **Framework:** Next.js 16 App Router, React 19, TypeScript.
- **Data:** local SQLite through `lib/db/`.
- **Schema source of truth:** `lib/db/schema.sql`, applied idempotently for new databases.
- **Existing database changes:** `COLUMN_MIGRATIONS` in `lib/db/sqlite.ts`.
- **Query layer:** `lib/db/query.ts` implements a Supabase/PostgREST-shaped builder over SQLite.
- **Auth:** no public multi-user auth; `lib/db/local-user.ts` resolves one owner row.
- **AI:** provider-backed local app features; keys are configured outside committed code.
- **Storage:** local filesystem storage through `lib/db/storage.ts` and file-serving API routes.

## Dead references fixed on 2026-08-09

These Postgres/Supabase-era leftovers were removed or corrected:

| Item | Location | Was | Now |
|---|---|---|---|
| `sessions` in `NO_AUTO_ID` | `lib/db/meta.ts` | Listed a table that no longer exists. | Removed. |
| `.env.local` dangling line | `.env.local` | Bare Supabase URL without `=`. | Removed. |
| `.env.local` dead vars | `.env.local` | `KEY_NAME`, `MODEL`. | Removed. |
| README link | `README.md` | Pointed to missing `IMPLEMENTATION_PLAN.md`. | Replaced with project layout/docs guidance. |

Previously flagged `@supabase/ssr`, `@supabase/supabase-js`, `migrations/`, and `lib/types/database.ts` were already gone before the audit and were not referenced by the current tree.

## Intentional vestigial schema fields

These fields remain for compatibility with databases created by earlier builds:

- `users.encrypted_password` — written as a local compatibility value, not used for auth.
- `profiles.is_banned`, `profiles.banned_at` — retained, but `getUser()` reports the local owner as not banned.
- `documents.application_id` — legacy field; current document-job links use `job_documents`.
- `timeline_events`, `notes` — present for parity/history even where not surfaced heavily.

## `updated_at` triggers

Triggers are present for:

- `profiles`
- `jobs`
- `applications`
- `interviews`
- `notes`
- `board_lists`
- `positions`
- `contacts`
- `companies`
- `documents`
- `smtp_config`

`application_emails` is append-only, so it does not need an update trigger.

## Security status

| Check | Status | Notes |
|---|---|---|
| Authentication | Intentional none | Single-user local app. |
| Row-level security | Not applicable | SQLite has no RLS. |
| `UPDATE`/`DELETE` user scoping | Pass | Verified across audited actions. |
| Storage route authorization | Pass | HMAC token or matching owner key path. |
| `next start` network exposure | Risk | Do not expose on untrusted networks. |
| Secrets in committed code | None found | Keys should stay in local config/env/app settings. |

## Build and lint status on 2026-08-09

| Check | Status |
|---|---|
| `tsc --noEmit` | Passed. |
| `lib/db/selfcheck.ts` | Passed, 27/27 checks. |
| `next build` | Passed, all 21 routes. |
| `eslint .` | 9 errors remained. |

## Remaining ESLint errors from audit

| File | Rule | Note |
|---|---|---|
| `admin/activity/page.tsx` | `react-hooks/set-state-in-effect` ×2 | Effects call `setState` synchronously. |
| `admin/ai-usage/page.tsx` | `react-hooks/set-state-in-effect` ×2 | Same pattern. |
| `admin/users/[id]/page.tsx` | `react-hooks/set-state-in-effect` ×3 | Load effects and Date-in-render issue. |
| `email-composer.tsx` | `react-hooks/set-state-in-effect` | Auto-generate effect. |
| `job-import/ai-import.tsx` | `react/no-unescaped-entities` | Apostrophe in JSX text. |
| `landing-header.tsx` | `no-empty-object-type`, `set-state-in-effect` | Empty props interface and state effect. |

These were treated as hygiene issues and left unchanged to avoid behavior changes in working screens.

## Things done well

- SQLite schema and metadata are centralized.
- The query builder keeps old call sites stable while using local SQLite.
- Activity logging is broad and non-blocking.
- AI usage logging is consistently modeled.
- File serving has path traversal protection and authorization checks.
- Secrets are expected outside committed source.

## Follow-up recommendations

1. Fix the remaining ESLint errors in a dedicated PR.
2. Add a root-level `README.md` before public launch if this repo will be browsed on GitHub.
3. Keep docs consolidated under the categories in `docs/README.md`.

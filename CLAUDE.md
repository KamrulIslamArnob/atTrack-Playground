# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Local-first, single-user career workspace for job applications, resumes, interviews, contacts, AI assistance, and email. It is a Next.js 16 App Router application with a React 19/TypeScript frontend, local SQLite data (native `node:sqlite`), and an optional Electron desktop shell. There is intentionally no public authentication or multi-user account UX — the local process runner is the sole owner (`user_id = 'local-user'`, resolved in `lib/auth.ts` / `lib/db/local-user.ts`).

The product is user-facing as **BetterJob**; the repo, internal paths, and this guide keep the `atTrack` name.

Read [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for setup/release details, [`docs/Design.md`](docs/Design.md) before any UI work, [`docs/SECURITY.md`](docs/SECURITY.md) for the trust-boundary/data-handling model, and [`PROJECT.md`](PROJECT.md) for the desktop-hardening subsystem contracts (port negotiation, SQLite safety, AI circuit breaker, SSRF defense).

## Commands

```bash
npm install
npm run dev                  # Next dev server at http://localhost:3788
npm run lint                 # ESLint
npm run typecheck            # tsc --noEmit
npm run build                # Production Next build
npm run start                # Serve the production build
npm run electron:dev         # Production-style Next build + Electron shell (no hot reload)
npm run electron:build:win   # Windows installer/update artifacts into release/
```

Requires Node.js 22.5+ for native `node:sqlite`; Node 24+ recommended. `postinstall` copies the pdf.js worker.

There is no configured test runner. Verification is standalone scripts invoked with `npx tsx scripts/<file>.ts` (e.g. `verify-multi-session-concurrency.ts`, `verify-chat-persistence.ts`, `verify-r6-ai-circuit-breaker.ts`, `test-queue-and-approval-stress.ts`) — check `scripts/` for one covering the area you touched before writing a new one. Always run typecheck + lint + build for every change; use the browser or Electron flow to confirm UI behavior.

## Architecture

### Data layer — local SQLite (`lib/db/`)

A Supabase/PostgREST-shaped query builder (`from(t).select().eq()...`) over native `node:sqlite`, so older call sites read like Supabase. WAL mode with a tuned `busy_timeout`/`wal_autocheckpoint`; FTS5 (`omni_search_index`) powers the global ⌘K search.

- `schema.sql` — source of truth for fresh databases (tables, triggers, views incl. `v_jobs`).
- `sqlite.ts` — connection singleton, pragmas, `COLUMN_MIGRATIONS` runtime auto-migration registry for existing databases, and `closeDb()` (checkpoints before process exit / folder migration).
- `query.ts` — the Supabase-style builder used by all call sites.
- `meta.ts` — JSON/boolean column registry (transparent TEXT/INTEGER parse-serialize).
- `relations.ts` — declared embed relationships for query selects.
- `local-user.ts` — single local owner resolution; every read/write must scope by this `user_id`.
- `storage.ts` — filesystem buckets under `.data/storage/` (Electron: OS user-data dir).

**A schema change requires all of:** update `schema.sql` + add the migration to `COLUMN_MIGRATIONS` in `sqlite.ts` + register new JSON/boolean columns in `meta.ts` + add relations in `relations.ts` if the column is used in an embedded select. Do not reintroduce Postgres/Supabase migrations — this is SQLite-only.

### Server Actions (`lib/actions/`)

Domain-organized async Server Actions, `"use server"` at the top, async exports only; shared types live in `lib/types/`. Typical shape: resolve local user (`getUser()`) → scoped read/write → log activity/AI usage where applicable → `revalidatePath`.

### AI subsystem (`lib/ai/`)

- `providers.ts` — task-routed multi-provider chain (Gemini, Anthropic, OpenAI-compatible), BYOK config in `ai_providers`/`ai_task_routes` tables.
- `background.ts` — serialized background task queue; outputs cached by content hash (`ai_output_cache`, `mcq_question_cache`).
- `circuit-breaker.ts` — per-provider consecutive-failure tracking with cooldown and fast-fail bypass; see `PROJECT.md` for the exact state contract (`recordFailure`/`recordSuccess`/`isAvailable`/`resolveHopTimeout`).
- `tools/` — the tool registry (`registry.ts`) exposed to the chatbot: query-database, search-jobs/contacts/links/memories, get-resume, web-search, write-database, delete-database.

### Chatbot background engine (`lib/ai-chatbot/` + `app/api/chat/`)

Multi-session streaming with route-surviving background queues — see [`PROJECT.md`](PROJECT.md) for interface contracts:

- `chat-queue-context.tsx` — global FIFO queue mounted at root providers; sessions stream in parallel, tasks within a session are FIFO.
- `use-chat.ts` — per-session message/loading state and `AbortController` maps (no cross-session crosstalk).
- `pipeline.ts` — SSE protocol demuxing `tool_calls`, `approval`, `sources`, `choices[0].delta.content`, `reasoning_content`, with partial-chunk buffer preservation and `<think>` extraction.
- Two-tier persistence: a localStorage mirror plus SQLite as the single source of truth (`chat_sessions`/`chat_messages`, monotonic `seq`); mutations await the SQLite write.
- Safety-gated deletion: `lib/ai/tools/delete-database.ts` only *proposes* SQL (never executes it), `db-approval.ts` issues single-use anti-replay tokens with a 60s server TTL, and `components/ai-chatbot/approval-modal.tsx` renders the countdown confirmation.

### Board/jobs model

- `board_lists` define pipeline columns; `jobs.list_id` + `board_position` place cards.
- `jobs.status` is **derived** from `list_id` — never write it directly. Lifecycle state (`active`/`on_hold`/`archived`) lives separately in `jobs.state`.
- Moving a job into an Applied list must create an `applications` row idempotently.
- Drag-and-drop must keep a keyboard-accessible alternative (the existing Move-to / change-state menus).

### License activation and cloud sync

The one exception to "no auth UX": `lib/actions/license.ts` + `components/license/` implement a free device-activation flow that redeems a license key issued by the separate "Better Job - Website" project to unlock a single local device. It is not a hosted account system — no email/password lives here, and the app works fully offline both before and after activation. `lib/actions/cloud-sync.ts`, `lib/actions/gist-sync.ts`, and `lib/actions/full-backup.ts` are opt-in backup paths (Neon/object storage and GitHub Gist) layered on top of the local-first model, not a replacement for it — the local SQLite file stays authoritative.

### Security (`lib/security/`, `middleware.ts`)

`middleware.ts` restricts the Host header to loopback (`127.0.0.1`, `localhost`, `[::1]`). `lib/security/ssrf.ts` centralizes SSRF sanitization (decimal/hex/octal IP encodings, IPv6 mapped/unique-local addresses, cloud metadata endpoints, DNS-rebinding hosts) and must be used by any new scraping or outbound-fetch integration (see `lib/services/firecrawl.ts`, `lib/services/native-scrape.ts` for existing call sites).

### Other surfaces

- `components/resume-builder/` + `lib/resume/` — a frozen `ResumeDoc` schema stored in `documents.builder_data`, an inline rich-text parser, live Letter-size preview, and dual HTML/LaTeX export (`render-tex.ts`).
- `extension/` — Chrome MV3 job clipper; authenticates to `/api/extension/*` via a per-install bearer secret (`extension_config`, `lib/db/extension-secret.ts`) with a TTL/size-capped offline queue for when the desktop app isn't running.
- `electron/` — main/preload processes; single-instance lock, candidate port probing (`[3788..3795]`), synchronized port manifest, and graceful SIGTERM→SIGKILL shutdown. Packaged data lives in the OS user-data dir (e.g. `%APPDATA%\atTrack\` on Windows), never the install dir. Auto-update via `electron-updater` + GitHub Releases.
- `lib/log/` — pino structured logging with AI trace events and a log drain (see `docs/LOGGING.md`).

## Conventions and invariants

- Use the existing TypeScript/React patterns, `@/*` imports, Tailwind CSS v4, and existing `components/ui/` primitives — don't hand-roll a replacement.
- Never add login, signup, sign-out, or account-switching UX beyond the license-activation flow described above. Destructive cleanup is labeled "Delete all data", never "Delete account".
- **All UI follows [`docs/Design.md`](docs/Design.md).** Use design tokens only — never a raw Tailwind palette class (`bg-emerald-500`) or a hex literal in a component. Semantic status goes through `success`/`warning`/`info`/`destructive`; pipeline hues through `--stage-*`. Follow the radius ladder (each child at least one step below its parent: `sm` 4 → `lg` 8 → `xl` 12 → `2xl` 16 (cards default) → `3xl` 20 (dialogs/sheets) → `full`), the light/white default theme, and restrained brand-gradient use (`.bg-gradient-brand` at most once per screen). Use the `.micro-*` motion utilities for animation.
- UX copy follows Design.md §9: sentence case, no exclamation marks, `Couldn't <verb> <noun>` for every error, and the product name shown to users is `BetterJob`.
- Never commit secrets, `.env` files, `.data/`, or generated build/release artifacts (see `docs/SECURITY.md` for the full list, including `SMTP_ENCRYPTION_KEY` and provider API keys).

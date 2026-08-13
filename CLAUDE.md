# atTrack / Aven — Agent Guide

## Overview

Local-first, single-user career workspace for job applications, resumes, interviews, contacts, AI assistance, and email. It is a Next.js 16 App Router application with a React 19/TypeScript frontend, local SQLite data, and an optional Electron desktop shell. There is intentionally no public authentication or multi-user account UX.

Read [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) for the full architecture and product rules. Read [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for deeper implementation and release details; read [`docs/Design.md`](docs/Design.md) before UI work.

## Repository structure

- `app/` — Next.js routes, layouts, pages, and API handlers.
- `components/` — React UI, dashboard modules, board, job detail, import, and resume-builder components; `components/ui/` contains reusable primitives.
- `lib/actions/` — domain-organized async Server Actions.
- `lib/ai/` — provider routing, prompts, background tasks, caching, and usage logging.
- `lib/db/` — native `node:sqlite` connection, schema, query layer, metadata, relations, and local file storage.
- `lib/resume/` — resume parsing, HTML preview, and LaTeX/PDF rendering.
- `lib/types/` — shared domain types.
- `electron/` — Electron main/preload processes and desktop integration.
- `scripts/` — build and packaging helpers.
- `public/` — static assets; `docs/` — contributor and product documentation.
- `.data/` — private local SQLite/uploads (ignored; never commit).

## Commands

```bash
npm install
npm run dev             # Next dev server at http://localhost:3308
npm run lint            # ESLint
npx tsc --noEmit        # Type-check
npm run build           # Production Next build
npm run start           # Serve the production build
npm run electron:dev    # Build and launch Electron locally
npm run build:electron  # Build Windows installer/update artifacts in release/
```

There is no configured automated test script. Run the type-check, lint, and build relevant to every change; use the browser or Electron flow for UI behavior.

## Conventions and invariants

- Use the existing TypeScript/React patterns, `@/*` imports, Tailwind CSS v4, and existing UI primitives. Keep changes focused.
- Server Actions belong in `lib/actions/`, start with `"use server"`, and export async actions only. Put shared types in `lib/types/`.
- Scope user-owned database reads/writes by the local `user_id` (`lib/db/local-user.ts`). Do not add login, signup, sign-out, or account-switching UX.
- Schema changes update `lib/db/schema.sql` and `COLUMN_MIGRATIONS` in `lib/db/sqlite.ts`; register JSON/boolean columns in `lib/db/meta.ts` and relations in `lib/db/relations.ts` when needed.
- `jobs.status` is derived from `jobs.list_id`; do not write it directly. Preserve idempotent application creation when a job enters an Applied list.
- Preserve keyboard-accessible alternatives for drag-and-drop (for example, the existing Move to menu).
- Follow the documented radius ladder, light/white default theme, and restrained brand-gradient usage. Never commit secrets, `.env` files, `.data/`, or generated build/release artifacts.

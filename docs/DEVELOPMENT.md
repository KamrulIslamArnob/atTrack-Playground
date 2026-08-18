# Development Guide

This guide covers local setup, architecture, validation, and Electron development for atTrack.

## Prerequisites

- **Node.js:** 22.5+ required for `node:sqlite`; Node 24+ recommended.
- **npm:** 10+ recommended.

## Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3308` for browser development.

For the desktop shell:

```bash
npm run electron:dev
```

`electron:dev` runs a production-style Next build, prepares the standalone output, and opens the Electron window. It does not hot reload like `npm run dev`.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server (port 3308). |
| `npm run build` | Build the production Next.js app. |
| `npm run start` | Run the production server. |
| `npm run lint` | Run ESLint. |
| `npm run electron:dev` | Test the packaged-style Electron integration locally. |
| `npm run electron:build:win` | Build Windows Electron release assets into `release/`. |
| `npx tsx lib/db/selfcheck.ts` | Run the SQLite query-layer self-check. |

## Architecture overview

atTrack is a local-first, single-user app:

- **App framework:** Next.js 16 App Router, React 19, TypeScript.
- **UI:** Tailwind CSS v4, shadcn/base-ui components, lucide icons, `next-themes`.
- **Data:** local SQLite through `lib/db/`; no hosted database is required.
- **Uploads:** local filesystem buckets under `.data/storage/` or an Electron user-data directory.
- **Desktop:** Electron main process in `electron/`, build preparation scripts in `scripts/`.
- **AI Subsystem:** Task-routed provider chain (`lib/ai/providers.ts`), serialized background queue (`lib/ai/background.ts`), content-hash output caching (`ai_output_cache`, `mcq_question_cache`), and strict schema validation.
- **Resume Engine:** Novorésumé-style interactive editor (`components/resume-builder/`), frozen `ResumeDoc` schema, inline rich text parser (`lib/resume/inline.ts`), live Letter-size preview, and dual HTML/LaTeX export engine (`lib/resume/render-tex.ts`).
- **Email:** SMTP credentials are encrypted before storage.

The app intentionally has no public multi-user auth surface. Whoever can access the local running process is treated as the owner.

## Important folders

```text
app/                  # Next.js routes, page layouts, and API handlers
components/           # React UI components, dashboard widgets, and resume builder
electron/             # Electron main process and desktop integration
lib/actions/          # Server actions organized by domain
lib/ai/               # AI background queue, task router, prompts, output caching, and logging
lib/db/               # SQLite schema, connection singleton, query shim, and storage helpers
lib/resume/           # Resume document parsing, HTML preview renderer, and LaTeX exporter
lib/types/            # Shared TypeScript domain types
public/               # Public static assets
scripts/              # Build and packaging helpers
docs/                 # Project documentation index and category guides
```

## Data layer: local SQLite

The backend is local SQLite, exposed through a Supabase/PostgREST-shaped query builder so older call sites can remain stable.

| File | Role |
|---|---|
| `lib/db/schema.sql` | Source of truth for new database creation. |
| `lib/db/sqlite.ts` | `DatabaseSync` singleton, pragmas, and `COLUMN_MIGRATIONS`. |
| `lib/db/query.ts` | Supabase-shaped query builder: `from(t).select().eq()...`. |
| `lib/db/meta.ts` | JSON and boolean column registry. |
| `lib/db/relations.ts` | Declared embed relationships for query selections. |
| `lib/db/local-user.ts` | Single local owner resolution. |
| `lib/db/storage.ts` | Local filesystem bucket storage. |
| `lib/db/selfcheck.ts` | Query-builder self-check suite. |

### Schema-change checklist

When changing the schema:

1. Update `lib/db/schema.sql` for fresh databases.
2. Add an `ALTER TABLE` entry to `COLUMN_MIGRATIONS` in `lib/db/sqlite.ts` for existing databases.
3. Register new JSON/boolean columns in `lib/db/meta.ts`.
4. Add or update relationships in `lib/db/relations.ts` when using embedded selects.
5. Run `npx tsx lib/db/selfcheck.ts` when touching query behavior.

Do not reintroduce Postgres/Supabase migrations as the live source of truth. Historical migration plans are summarized in `docs/PlanningSummary.md`.

## Security and scoping conventions

- SQLite has no row-level security. App-level `user_id` scoping is the protection pattern for user-owned rows.
- All destructive or updating actions should scope by `user_id` unless they are intentionally cross-user admin/reporting reads.
- `.data/` contains private local databases, logs, and uploaded documents. It must never be committed.
- `SMTP_ENCRYPTION_KEY`, AI provider keys, SMTP credentials, OAuth tokens, and similar values must never be committed.
- Do not expose `next start` on an untrusted network without external protection.

See [`SECURITY.md`](SECURITY.md) for the full security policy.

## Board and jobs model

The board is the primary application pipeline:

- `board_lists` stores user-owned columns.
- `jobs.list_id` and `jobs.board_position` place cards on the board.
- `jobs.status` is derived from list state and should not be written directly by application code.
- `applications` remains the submission record and is created idempotently when a job reaches an Applied list.
- `positions` group target roles and may provide default resumes.
- Accessibility matters: native drag-and-drop must keep a non-drag path such as the `Move to` menu.

## Server actions

Server actions live in `lib/actions/*` and are generally organized by domain.

Common pattern:

```ts
"use server";

// 1. Resolve current user/client.
// 2. Perform scoped read/write.
// 3. Log activity or AI usage when applicable.
// 4. Revalidate affected routes when needed.
```

A `"use server"` file should export async actions only. Put shared types in `lib/types/*`.

## UI conventions

Read [`Design.md`](Design.md) before changing UI. In particular:

- Use the documented radius ladder.
- Keep the app light/white by default.
- Use the brand gradient sparingly.
- Do not add auth/account UI without changing the product model.
- Use existing shadcn/base-ui patterns instead of hand-rolling primitives.

## Electron development

### Local Electron testing

```bash
npm run electron:dev
```

This builds the Next.js app into a standalone output, prepares Electron assets, starts the local server, and opens the desktop window.

### Data persistence in packaged apps

Packaged desktop builds store user data in the OS user-data directory, not inside the application install directory. On Windows this is typically under `%APPDATA%\atTrack\`.

Typical persisted assets:

- SQLite database: `attrack.db`
- Uploaded files/resumes: `storage/`
- Encrypted settings/keys as managed by the app

Updating or reinstalling the app should not delete user data because installer files and user data live in different locations.

### Building release assets

```bash
npm run electron:build:win
```

This produces Windows installer/update assets in `release/`. Do not commit generated release artifacts unless a release workflow explicitly requires them.

### Auto-updates

The app uses `electron-updater` and GitHub Releases metadata. A typical release flow is:

1. Bump `version` in `package.json`.
2. Run `npm run electron:build:win`.
3. Create a GitHub Release tagged with the version.
4. Upload the generated installer and update metadata from `release/`.

## Validation before PRs

Run the most specific relevant checks first, then broader checks:

```bash
npx tsx lib/db/selfcheck.ts
npx tsc --noEmit
npm run lint
npm run build
```

If a command fails because of known pre-existing issues, mention that in the PR and link to [`AuditReport.md`](AuditReport.md). Do not hide new failures caused by your change.

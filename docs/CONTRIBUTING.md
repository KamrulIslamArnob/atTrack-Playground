# Contributing to Aven / AtTrack

Thank you for contributing to **Aven / AtTrack**. This project is intended to be open source and approachable, so please keep changes focused, documented, and safe for users' local data.

## Before you start

1. Read [`README.md`](README.md) for the documentation map.
2. Read [`DEVELOPMENT.md`](DEVELOPMENT.md) for architecture, setup, and validation.
3. Read [`Design.md`](Design.md) before changing UI.
4. Read [`SECURITY.md`](SECURITY.md) before touching local data, credentials, file serving, SMTP, AI providers, or release behavior.
5. Check [`ROADMAP.md`](ROADMAP.md) before feature work so you do not rebuild something already implemented.
6. Check [`PlanningSummary.md`](PlanningSummary.md) if you need historical context from old task plans.
7. Check [`AuditReport.md`](AuditReport.md) before cleanup work so known issues are handled intentionally.

## Local setup

### Prerequisites

- Node.js 22.5+; Node 24+ recommended.
- npm 10+ recommended.

### Install

```bash
git clone https://github.com/kaiumallimon/aven.git
cd aven
npm install
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

For desktop integration testing:

```bash
npm run electron:dev
```

## What must never be committed

| Category | Examples | Why |
|---|---|---|
| Secrets and tokens | `.env.local`, AI provider keys, `SMTP_ENCRYPTION_KEY`, SMTP passwords, OAuth tokens | Exposes accounts and private services. |
| Local databases | `.data/attrack.db`, SQLite WAL/journal files | Contains private job search data and credentials. |
| User uploads | `.data/storage/`, resumes, PDFs, screenshots with personal data | Contains private personal information. |
| Build artifacts | `.next/`, `out/`, `build/`, `release/`, `*.tsbuildinfo`, `node_modules/` | Generated, large, or platform-specific. |
| Local tool state | `.claude/`, `.superpowers/`, `.playwright-mcp/`, `.DS_Store`, logs | Machine-specific noise. |
| Private keys/certs | `*.pem`, `*.key`, private certificates | Security risk. |

If you accidentally commit a real secret or private data, rotate/revoke it immediately and remove it from history before pushing.

## What should be committed

| Category | Examples |
|---|---|
| Source code | `app/`, `components/`, `lib/`, `electron/`, `scripts/` |
| Schema/source-of-truth files | `lib/db/schema.sql`, `lib/db/sqlite.ts`, `lib/db/meta.ts` |
| Public docs | `docs/` |
| Public assets | `public/` assets intended for distribution |
| Configuration | `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `electron-builder.json` |

## Development standards

- Keep changes small and focused.
- Follow existing project patterns before introducing new abstractions.
- Prefer existing dependencies. Add new dependencies only when clearly justified.
- Do not change the local-first/no-auth product model accidentally.
- Scope user-owned database reads and writes by `user_id` unless the code is intentionally cross-user admin/reporting logic.
- For schema changes, update both fresh-database schema and existing-database migrations as described in [`DEVELOPMENT.md`](DEVELOPMENT.md).
- Keep public docs organized under the existing categories. Historical plans should be summarized in `docs/PlanningSummary.md`, not kept as many separate task files.

## UI contribution standards

Before changing UI, read [`Design.md`](Design.md). In particular:

- Use the documented radius ladder.
- Keep the white/light default app feel.
- Use the brand gradient sparingly.
- Preserve accessible alternatives to drag-and-drop.
- Do not add sign-in/sign-up/account switching UI unless the product model changes.

## Verification checklist

Run the checks relevant to your change. For broad PRs, run all of them:

```bash
npx tsx lib/db/selfcheck.ts
npx tsc --noEmit
npm run lint
npm run build
```

If a check fails because of known pre-existing issues, call that out in the PR and reference [`AuditReport.md`](AuditReport.md). Do not introduce new failures.

## Branch and PR guidelines

### Branch names

Use short descriptive names:

- `feature/short-description`
- `fix/short-description`
- `docs/short-description`
- `refactor/short-description`

### Commit messages

Use clear imperative commit messages, for example:

- `Add document export action`
- `Fix email composer state update`
- `Update setup docs`

### Pull requests

A good PR should include:

- What changed.
- Why it changed.
- Screenshots or screen recordings for UI changes.
- Validation commands run and their results.
- Any known follow-up work.
- Linked issues, if applicable.

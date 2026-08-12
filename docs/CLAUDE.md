# CLAUDE.md

This file is the navigation map for Claude Code and other coding agents working in this repository. Keep it short, current, and linked to the canonical docs instead of duplicating everything.

## Canonical docs

| Topic | File | When to read it |
|---|---|---|
| Documentation index | [`docs/README.md`](README.md) | Before changing docs or adding new docs. |
| Development and architecture | [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) | Before changing data, actions, Electron, build scripts, or app architecture. |
| Release checklist | [`docs/RELEASE.md`](RELEASE.md) | Before shipping a new version, building installers, or publishing update artifacts. |
| Design and UI rules | [`docs/Design.md`](Design.md) | Before touching colors, gradients, spacing, radius, board UI, sidebar, sheets, CRM, or copy affected by the no-auth product model. |
| Latest audit | [`docs/AuditReport.md`](AuditReport.md) | Before cleanup work, lint/build fixes, or when checking known issues. Replace with the latest dated audit when a new audit happens. |
| Roadmap / future features | [`docs/ROADMAP.md`](ROADMAP.md) | Before starting feature work. Verify backlog items against code before rebuilding anything. |
| Historical task summaries | [`docs/PlanningSummary.md`](PlanningSummary.md) | When you need context from old implementation plans. Treat as historical and verify against code. |
| Contributing | [`docs/CONTRIBUTING.md`](CONTRIBUTING.md) | Before preparing a PR or changing contributor-facing workflow. |
| Security | [`docs/SECURITY.md`](SECURITY.md) | Before touching auth assumptions, local data, file storage, credentials, AI providers, SMTP, or release/distribution behavior. |

## Repository summary

Aven / AtTrack is a local-first, single-user job application workspace:

- **Framework:** Next.js 16 App Router, React 19, TypeScript.
- **UI:** Tailwind CSS v4, shadcn/base-ui components, lucide icons.
- **Data:** local SQLite via `lib/db/`; uploads live on the local filesystem.
- **Desktop:** Electron wrapper with packaging and update support.
- **AI:** configured provider integrations for job import, resume matching, AI tools, MCQ prep, and email drafting.
- **Security model:** local machine trust boundary; no public multi-user authentication surface.

## Must-know conventions

- The product is currently referred to as **Aven / AtTrack**. Preserve existing naming unless the task explicitly asks for a rename.
- The `next-themes` storage key `"aven-theme"` is intentionally kept for existing users.
- Do **not** add login, signup, sign-out, switch-account, or public-account UX without first changing the product/security model.
- SQLite schema changes require both:
  - `lib/db/schema.sql` for new databases.
  - `COLUMN_MIGRATIONS` in `lib/db/sqlite.ts` for existing databases.
- JSON and boolean SQLite columns must also be registered in `lib/db/meta.ts`.
- User-owned reads/writes should remain scoped by `user_id` unless the code is intentionally cross-user admin/reporting logic.
- `jobs.status` is derived from board list state. Do not write it directly from application code.
- Drag-and-drop board interactions must keep the non-drag accessibility path, usually the existing `Move to` menu.
- A `"use server"` file should export async server actions only. Put shared types in `lib/types/*`.

## Commands

```bash
npm run dev             # Next.js development server (port 3308)
npm run build           # Production Next.js build
npm run start           # Run production build
npm run lint            # ESLint
npm run electron:dev    # Build standalone output and run Electron locally
npm run build:electron  # Build Windows Electron installer assets
npx tsx lib/db/selfcheck.ts
```

## Documentation maintenance

When documentation changes:

1. Keep public docs under the existing categories in `docs/`.
2. Do not create multiple dated audit files. Update `docs/AuditReport.md` with the latest date and summary.
3. Summarize historical implementation plans and agent-generated planning notes in `docs/PlanningSummary.md` instead of adding many task files.
4. Update this file whenever a canonical doc is renamed, added, or removed.

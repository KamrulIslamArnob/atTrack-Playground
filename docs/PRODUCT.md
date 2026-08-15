# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary and currently only user is the developer/owner running atTrack on their own machine (single-user, `id = 'local-user'`, no auth surface by design — see [`CLAUDE.md`](CLAUDE.md)). The situation is an active personal job search: tracking applications through a pipeline, prepping for interviews, managing a resume/document library, and using AI to speed up job-specific writing.

The project is open-sourced (public repo, MIT license) for visibility, but is not currently built or marketed for other people to onboard — there is no signup flow, no multi-tenant story, and no other confirmed audience yet.

## Product Purpose

atTrack is a local-first, single-user career workspace: a Kanban job pipeline, resume builder, interview tracker, contacts CRM, link library, and an AI assistant, all backed by a local SQLite database instead of a hosted service. Success is a faster, less scattered job search for its one user — one place for every job, document, contact, and deadline instead of spreadsheets, browser tabs, and a cloud tracker's UI.

## Positioning

**Local-first + BYOK privacy.** Every other job-tracker in this space (Huntr, Teal, a Notion template) stores the user's resumes, job targets, and application history in someone else's cloud. atTrack keeps everything — the database, uploaded files, logs — on the user's own disk, and AI features run on API keys the user supplies and controls (`ai_providers` table), not a bundled/metered AI subscription. A cloud competitor cannot truthfully copy this without becoming a different product.

## Operating Context

- Runs as a Next.js web app (`localhost:3308` in dev) and as a packaged Windows Electron desktop app; a companion Manifest V3 Chrome extension clips job listings from LinkedIn/Indeed/careers pages straight into the board.
- Core workflow loop: import or clip a job → it lands on the Kanban board → move it through pipeline stages (Wishlist → Preparing → Applied → Interview → Offer → Accepted/Rejected) → track deadlines/interviews/contacts/documents against it → use AI tools (fit scoring, cover letters, cold email, interview prep) along the way.
- AI usage is task-routed and BYOK: the user configures provider credentials and which provider handles which task (`ai_task_routes`), rather than the product picking a single bundled model.
- No account system exists anywhere in the product — see [`CLAUDE.md`](CLAUDE.md) and [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §7.1 for the boundary rules this implies (no login/signup/sign-out UI, ever).

## Capabilities and Constraints

- Full feature inventory (board, job import, job detail sheet, resume builder, CRM, insights, interviews, links, AI chatbot, browser extension, multi-provider AI routing, SMTP outreach) is authoritatively documented in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §2 — treat that as the living capability list rather than duplicating it here.
- Hard constraint: zero-auth, single-user data model. Every read/write is scoped to one local owner row; there is no multi-account or session concept to design around.
- Hard constraint: `jobs.status` is derived from `jobs.list_id`, never written directly — a UI affordance must never imply it's an independent, directly-settable field.
- Terminology: "job" (not "application" until it formally reaches an Applied-stage list, which auto-creates an `applications` record), "board list" or "stage" (not "column" in copy), "state" (`active`/`on_hold`/`archived`, distinct from pipeline `status`).
- Undecided: whether atTrack ever grows a self-hosted multi-user or "other people run this" story. Not building toward that until the audience question above changes.

## Brand Commitments

- Product name is **atTrack** — lowercase `a`, capital `T`, in every user-facing string including sentence starts (see [`docs/Design.md`](docs/Design.md) §9 for the two deliberate on-disk exceptions in Electron packaging metadata).
- Existing brand assets: `public/dark-logo.png`, `public/lite-logo.png`, `public/icon-256.svg`, `public/icon-256-dark.svg` — light/dark logo and icon variants (see `components/ui/theme-logo.tsx`). Treat these as the current confirmed identity; don't propose a new logo without cause.
- Voice: plain, direct, unexcited competent-colleague tone — full rules in [`docs/Design.md`](docs/Design.md) §9. No exclamation marks, sentence case everywhere, `Couldn't <verb> <noun>` for errors.
- License: MIT, copyright "atTrack Contributors."

## Evidence on Hand

None. This is a from-scratch personal project with no users, testimonials, usage numbers, case studies, or press yet. Future work must not fabricate any of these — no invented reviews, no invented adoption metrics, no invented "trusted by" claims.

## Product Principles

1. **Local-first is the product, not a footnote.** Any feature that would require sending user data to a hosted service by default breaks the core promise; BYOK/opt-in is the only acceptable shape for anything that leaves the machine (see the opt-in log drain pattern in [`docs/LOGGING.md`](docs/LOGGING.md) as the template).
2. **One owner, zero auth surface.** Never add login, signup, sign-out, or account-switching UI — there is no account to act on. This is a permanent constraint, not a current-milestone gap.
3. **Derived state stays derived.** `jobs.status` from `jobs.list_id`, `applications` created idempotently on entering an Applied list — the UI must never let a user (or an AI tool) write around a computed value.
4. **Keyboard/non-drag parity is mandatory, not a fallback.** Every drag-and-drop interaction (board cards, resume builder sections) ships an equally capable keyboard path (`MoveToMenu`, move controls) in the same release, not a follow-up.
5. **A dense, single-user workspace optimizes for the returning owner, not a first-time visitor.** Compact type scale, no onboarding funnel, no engagement/retention mechanics — this is a tool used daily by one person who already knows it, not a product acquiring strangers.

## Accessibility & Inclusion

No product-specific requirement beyond the general baseline already enforced in [`docs/Design.md`](docs/Design.md) §10 (labeled icon-only controls, visible focus, color never the sole signal, 4.5:1/3:1 contrast in both themes, keyboard-equivalent for every drag interaction).

# Planning Summary

This file preserves the useful context from the old `tasks/` folder in a concise, contributor-friendly form.

The original task documents were implementation plans generated during earlier development. Most are now historical, partially stale, or refer to architecture that has changed. Contributors should use this summary for context, then verify current behavior against the code before making changes.

## Review result

| Original document | Summary | Keep decision |
|---|---|---|
| `tasks/plan.md` | Planned activity logging, AI usage logging, role-based admin access, ban checks, and admin pages. Useful because the app still has activity/AI usage/admin concepts, but the auth/RBAC pieces are stale for the current single-user local model. | Preserve only as historical context here. Do not follow directly. |
| `tasks/plan-ai-usage-tracking.md` | Planned wiring AI usage logs into AI call sites and the email streaming route. Useful as context for why `ai_usage_logs` and `logAiUsage` exist. Some provider details may be outdated. | Preserve logging intent here; verify call sites before changing. |
| `tasks/plan-interviews.md` | Planned interview status syncing, `/interviews`, interview editing, and MCQ preparation. Useful as feature-origin context, but it references old migrations and status behavior. | Preserve concepts here; current board/job status rules override it. |
| `tasks/todo.md` | Planned screenshot-based Gemini job extraction using an older package and Supabase storage. The feature direction is useful, but implementation details are stale. | Preserve feature intent only. |
| `tasks/archive/2026-08-board-positions-onboarding.md` | Detailed board, positions, per-job resume, and onboarding plan. Many decisions are still important: board is unified on `jobs`, `jobs.status` is derived, `applications` remains the submission record, and positions are the grouping model. | Preserve key decisions here and in `DEVELOPMENT.md` / `CLAUDE.md`. |
| `tasks/archive/superpowers/plans/2026-08-09-ai-provider-settings.md` | Detailed plan for configurable AI providers, encrypted provider keys, task routes, and fallback chains. Useful as future/contextual architecture. | Preserve summary only; verify current provider implementation before acting. |
| `tasks/archive/superpowers/specs/2026-08-09-ai-provider-settings-design.md` | Design spec for AI provider settings and task routing. | Preserve core decisions only. |
| `tasks/archive/superpowers/plans/2026-08-09-crm-contact-cards.md` | Detailed plan for CRM contact popup, card view, contact fields, tag filtering, and job mentions. | Preserve summary only. |
| `tasks/archive/superpowers/specs/2026-08-09-crm-contact-cards-design.md` | Design spec for CRM contact card/popup changes. | Preserve summary only. |
| `tasks/archive/superpowers/plans/2026-08-10-resume-builder-plan.md` | Detailed resume-builder plan, including data shape, editor flow, HTML/LaTeX renderers, PDF export, and self-check strategy. | Preserve architectural summary only. |
| `tasks/archive/superpowers/specs/2026-08-10-resume-builder-design.md` | Design spec for a LaTeX-faithful resume builder. | Preserve decisions and constraints only. |
| `tasks/archive/superpowers/specs/resume-template-reference.tex` | Private/template reference used to seed a resume-builder implementation. | Do not keep as a public docs artifact. Avoid preserving private resume content in docs. |

## Contributor guidance from the old task files

### Current rules that still matter

These are the important decisions worth preserving:

- The app is local-first and currently single-user.
- SQLite schema changes must update both fresh database schema and existing database migration handling.
- User-owned writes should remain scoped by `user_id` unless intentionally cross-user admin/reporting logic.
- `jobs.status` is derived from board/list state and should not be manually written from app code.
- The board is the primary pipeline surface and is unified around `jobs`.
- `applications` remains the submission record, not a replacement for jobs.
- `positions` are target roles and grouping metadata; do not invent a separate packet/container model.
- Native drag-and-drop must keep an accessible non-drag path, such as a `Move to` menu.
- Avoid adding dependencies for features that can be implemented with existing stack patterns.
- AI usage logging should never break the user-facing AI workflow.
- API keys and SMTP credentials must stay encrypted or outside committed code.
- Pure utility logic can use small runnable self-checks instead of introducing a test framework.

### Stale details to avoid copying

These old task details should not guide new implementation without verification:

- Supabase migrations, RLS policies, and Supabase storage bucket instructions.
- Public multi-user auth, login, signup, middleware-based RBAC, or ban-flow assumptions.
- Old `@google/generative-ai` package guidance.
- Old hardcoded OpenRouter-only assumptions.
- References to `migrations/NNN_*.sql` as the live source of truth.
- Instructions that refer to deleted paths such as `lib/types/database.ts`.
- Any private resume/template content from the old LaTeX reference.

## Feature summaries

### Activity logging, AI usage, and admin panels

The old plan proposed:

- `activity_logs` for server-side audit trails.
- `ai_usage_logs` for model usage, tokens, cost, and timestamps.
- Admin pages for activity and AI usage review.
- RBAC and ban logic.

Current contributor takeaway:

- Keep activity/AI usage logging non-blocking.
- Extend human-readable activity messages when adding new activity action strings.
- Do not reintroduce public auth/RBAC assumptions unless the product model changes.

### AI usage logging

The old plan identified key AI call sites and recommended logging:

- Job extraction.
- Resume extraction.
- Resume/job match scoring.
- MCQ generation.
- Email/AI-tool generation.

Current contributor takeaway:

- When adding or changing AI features, capture model, duration, token/cost information when the provider exposes it.
- Logging failures should be swallowed or isolated so AI workflows do not fail because analytics failed.
- Verify current provider abstractions before following old OpenRouter/Gemini-specific examples.

### Interviews and MCQ preparation

The old plan proposed:

- Syncing job/application status for interview states.
- Creating or showing interview records.
- Interview forms with date/time, type, location, interviewer, notes, prep notes, duration, and status.
- MCQ practice generated from job data.

Current contributor takeaway:

- Preserve the distinction between board status, job records, application records, and interview records.
- Verify current status derivation rules before changing interview behavior.
- MCQ generation should remain scoped to the current user/job and should log AI usage where appropriate.

### Screenshot / AI job import

The old plan proposed:

- Uploading screenshots.
- Extracting structured job data with Gemini.
- Pre-filling the add-job form.
- Cleaning up temporary uploads.

Current contributor takeaway:

- Job import can combine screenshot, URL, and pasted text sources.
- Temporary/private uploaded assets must stay user-scoped and cleaned up where practical.
- Do not use old Supabase storage instructions.

### Board, positions, and onboarding

The old board plan established several still-important product decisions:

- `/board` is the primary workspace.
- One card represents one job across the whole lifecycle.
- `board_lists` owns pipeline columns.
- `jobs.list_id` and `jobs.board_position` place cards.
- `jobs.status` is legacy/derived.
- `applications` remains the submission record.
- `positions` group target roles and may have default resumes.
- Do not create a separate packet model.

Current contributor takeaway:

- Treat these decisions as current unless code contradicts them.
- Read `docs/DEVELOPMENT.md` and `docs/CLAUDE.md` before changing the board/data model.

### AI provider settings

The old AI provider plan proposed:

- User-configured AI providers.
- Encrypted provider credentials.
- Task routes for text, image, and scraping.
- Ordered fallback chains.
- Gemini, Anthropic, and OpenAI-compatible providers.
- No new provider SDK dependencies unless necessary.

Current contributor takeaway:

- Provider keys are sensitive and must be encrypted or kept outside committed code.
- Task routing/fallback behavior should be explicit and documented when changed.
- Streaming calls may need simpler behavior than non-streaming calls because mid-stream fallback is difficult.

### CRM contact cards

The old CRM plan proposed:

- Replacing a dense contact table with cards.
- Adding a contact popup/dialog.
- Supporting fields such as position, LinkedIn, GitHub, phone, notes, and tags.
- Filtering by company and tag.
- Supporting job mentions in notes.

Current contributor takeaway:

- Preserve the person-first CRM model.
- Keep company as a tag/linking concept rather than a hard container.
- Use existing UI primitives and design rules for dialogs/cards.

### Resume builder

The old resume-builder plan proposed:

- A structured `ResumeDoc` data shape.
- Builder data stored on `documents` rows.
- HTML/CSS preview and print route.
- `.tex` export.
- PDF export through Electron `printToPDF`.
- Shared parsing so HTML and LaTeX renderers do not drift.

Current contributor takeaway:

- The resume builder now uses one canonical `ResumeDoc` data shape, shared inline parsing, an editable UI, a Letter-size print route, and `.tex` export.
- Keep renderer behavior consistent through shared parsing/formatting utilities.
- Avoid preserving private resume content in public docs.
- Keep the printable resume surface deterministic and light-mode independent.

## What happened to the old task files?

The old `tasks/` documents were consolidated into this file so the repository has one documentation home: `docs/`.

If a future feature needs a detailed implementation plan, place the active plan in `docs/ROADMAP.md` or add a short section here. Avoid adding many separate planning files unless the project genuinely needs them.

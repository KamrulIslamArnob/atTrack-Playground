# AtTrack

Personal career workspace for managing job applications, documents, interviews, and AI-assisted preparation.

## Getting Started

```bash
npm install
npm run dev
```

## Project Layout

- `app/` — Next.js App Router routes (landing, dashboard, admin, API routes).
- `components/` — UI components and `ui/` primitives.
- `lib/db/` — local SQLite layer (schema + a supabase-js-shaped query shim).
- `lib/actions/` — server actions used by the UI.
- `lib/ai/` — AI integration (Gemini for extraction, OpenRouter for the rest).

See `CLAUDE.md` for the full architecture and `planning.md` for historical design notes.

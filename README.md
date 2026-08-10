# AtTrack

Personal career workspace for managing job applications, documents, interviews, and AI-assisted preparation.

## Getting Started

```bash
npm install
npm run dev
```

## Desktop Application & Electron Development

AtTrack is packaged as a native desktop application powered by Electron, Next.js standalone server, and local SQLite.

- **Development Guide**: Read [ELECTRON_DEVELOPMENT.md](file:///e:/07_Open-source/aven/ELECTRON_DEVELOPMENT.md) for a detailed walkthrough of hot-reloading development workflows, data persistence, and auto-updates.
- **Run Local Web Dev**: `npm run dev`
- **Run Local Electron**: `npm run electron:dev`
- **Build Windows Installer**: `npm run build:electron`

## Project Layout

- `app/` — Next.js App Router routes (landing, dashboard, admin, API routes).
- `components/` — UI components and `ui/` primitives.
- `electron/` — Electron main process, preload scripts, and setup dialogs.
- `lib/db/` — local SQLite layer (schema + a supabase-js-shaped query shim).
- `lib/actions/` — server actions used by the UI.
- `lib/ai/` — AI integration (Gemini for extraction, OpenRouter for the rest).

See `CLAUDE.md` for the full architecture, `ELECTRON_DEVELOPMENT.md` for desktop DX, and `planning.md` for historical design notes.

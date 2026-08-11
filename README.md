# 🚀 Aven (AtTrack) — Personal Career Workspace & Job Application Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-43.3-47848F?logo=electron)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Local_First-003B57?logo=sqlite)](https://www.sqlite.org/)

**Aven** (also known as **AtTrack**) is a local-first, privacy-focused career workspace and job application tracker designed to give candidates a supercharged dashboard for managing job listings, applications, documents, interviews, contacts, and AI-assisted application workflows.

Whether run in the browser or as a native cross-platform desktop application via Electron, **Aven** stores all user data locally on your system using embedded SQLite.

---

## ✨ Features

- 💼 **Job Application Pipeline**: KanBan-style application board with drag-and-drop status tracking, match scoring, and custom tags.
- 🤖 **AI-Assisted Job Import**: Extract structured job data automatically from URLs, pasted text, or screenshots using Google Gemini and OpenRouter.
- ✉️ **AI Email Composer & Delivery**: Generate tailored application cover emails matched against your resume and send them directly via encrypted local SMTP.
- 📑 **Document & Resume Management**: Store, preview, and match multiple resumes and cover letters with inline PDF rendering.
- 🎯 **Interview & MCQ Preparation**: Track interview schedules, generate role-specific interview prep questions, and practice with timed MCQ quizzes.
- 👥 **Network CRM**: Keep track of recruiters, hiring managers, company contacts, and communication history.
- 🔒 **Local-First & Encrypted**: All user data stays in your local `.data/` directory. Sensitive credentials like SMTP passwords are encrypted at rest using AES-256-GCM.
- 💻 **Desktop & Web Modes**: Native desktop client powered by Electron with automatic offline database setup and auto-updates.

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v20+
- **npm**: v10+

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/kaiumallimon/aven.git
cd aven
npm install
```

### 2. Run Development Servers

- **Web Development Server**:
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Electron Desktop Client**:
  ```bash
  npm run electron:dev
  ```

### 3. Configure AI & SMTP Settings
Configure your AI providers (Google Gemini, OpenRouter, Anthropic, Ollama, etc.) and SMTP credentials directly inside the application UI under **Settings** (`/settings`).

---

## 🔒 Open Source Pushing & Security Guidelines

When contributing to **Aven**, please follow our open-source security guidelines to prevent accidental credential or private data leakage:

> [!CAUTION]
> **What MUST NOT Be Pushed:**
> - `.env.local` or any files containing actual API keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `SMTP_ENCRYPTION_KEY`).
> - The `.data/` directory (contains your local SQLite database `attrack.db`, private application logs, and uploaded resumes).
> - Compiled releases (`/release/`, `.next/`, `out/`, `build/`).

> [!TIP]
> **What SHOULD Be Pushed:**
> - Application source code (`app/`, `components/`, `lib/`, `electron/`, `scripts/`).
> - Updated database schema definitions (`lib/db/schema.sql`).
> - Public documentation (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/`).

For full details, see [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

---

## 📁 Repository Layout

```
aven/
├── app/                  # Next.js App Router (dashboard, admin, API routes)
├── components/           # React UI components & Shadcn primitives
├── electron/             # Electron main process, IPC handlers, and setup windows
├── lib/
│   ├── actions/          # Server Actions for jobs, applications, CRM, AI, etc.
│   ├── ai/               # AI prompt builders & model extraction logic
│   ├── db/               # Local SQLite schema, migrations & query builder shim
│   └── types/            # TypeScript domain interfaces
├── public/               # Public static assets & branding images
├── scripts/              # Electron build preparation scripts
├── CONTRIBUTING.md       # Open-source contribution & security rules
├── LICENSE               # MIT License
└── SECURITY.md           # Security disclosure & data privacy policy
```

---

## 🧪 Testing & Verification

Run project verification commands before submitting Pull Requests:

```bash
# Type check
npx tsc --noEmit

# ESLint audit (0 errors, 0 warnings)
npm run lint

# Database layer self-check
npx tsx lib/db/selfcheck.ts

# Production build check
npm run build
```

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

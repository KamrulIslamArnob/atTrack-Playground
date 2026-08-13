# PROJECT CONTEXT & ARCHITECTURE DIRECTIVE
> **Product Name:** Aven / AtTrack (v1.5.0)  
> **Repository:** `kaiumallimon/aven` (atTrack)  
> **Target Audience:** Artificial Intelligence Assistants, Coding Agents, LLMs, and Human Developers.  
> **Purpose:** Comprehensive, single-source-of-truth document detailing project vision, total feature breakdown, architectural blueprints, database schemas, design tokens, UI conventions, security boundaries, and strict development rules.

---

## 1. Executive Summary & Product Model

**Aven / AtTrack** is a local-first, single-user personal career workspace built for tracking job applications, managing documents/resumes, organizing interview preparation, networking with professional contacts (CRM), and generating AI-assisted application assets.

### Key Architectural Pillars
1. **Local-First & Offline-Capable:** Runs on local SQLite via Node.js native `DatabaseSync` (`node:sqlite`). Uploaded files, resumes, and logs live on the local file system (`.data/storage/` or Electron user data path).
2. **Zero-Auth Surface (Single-User Owner Model):** The app has **no login, signup, sign-out, or multi-user session management**. The local process runner is implicitly trusted as the sole owner.
3. **Hybrid Web & Desktop Packaging:** Built as a Next.js 16 App Router web application packaged for Windows desktop via Electron (`electron/main.js`, `electron-builder`).
4. **Task-Routed AI Subsystem:** Integrated with Google Gemini (`@google/genai`) for multi-modal job import (screenshots, URLs, raw text), resume-job fit analysis, cover letter drafting, cold outreach generation, and MCQ technical prep quizzes.

---

## 2. Complete Feature Inventory & User Workflows

### 2.1 Kanban Application Board (`/board`)
- **Pipeline Stages:** Seeding 6 primary lists (`Wishlist`, `Preparing`, `Applied`, `Interview`, `Offer`, `Accepted`, `Rejected`) with full support for user-created `custom` board lists (`board_lists` table).
- **Derived Card Status:** Card column placement determines the derived `jobs.status`. Moving a card to an `Applied` list automatically creates an `applications` record idempotently.
- **Card Anatomy & Fit Meter:** Displays company, position/resume pills, relative time, per-job accent swatch, and a `matchScoreBand` fit score meter (visual mini-bar + text band: `Strong`, `Good`, `Moderate`, `Weak`).
- **Drag & Accessibility:** Touch/mouse drag-and-drop powered by pointer events, paired with a mandatory keyboard-accessible **"Move to"** dropdown menu on every card.
- **Interview Lane Highlight:** Subtle light green wash (`.bg-gradient-brand-tint`) applied dynamically to the `Interview` lane when containing active cards.

### 2.2 Unified Job Import Engine (`components/import-choice.tsx`, `lib/ai/ai.ts`)
- **Dual Modal Entry:** Manual entry vs. AI-Assisted Import (`components/job-import/ai-import.tsx`).
- **Multi-Modal AI Ingestion:** Takes any combination of webpage URLs (fetched live via Gemini's built-in `url_context` search/read tool), uploaded listing screenshots, or raw text blurbs in a single unified prompt to extract job details, salary ranges, required skills, and deadlines.

### 2.3 Job Detail Sheet & Deep-Link View (`components/job-detail/`, `/jobs/[id]`)
- **Slide-Over Experience:** Slide-out sheet (`Sheet` right side, 4xl max width) opened from board cards, sharing the identical server-rendered component with the deep-link route (`/jobs/[id]`).
- **8 Tabbed Modules:**
  1. **Insights:** AI match score breakdown, strengths, gaps, recommended actions.
  2. **Edit:** Per-job metadata, custom accent swatch, section deadlines, salary breakdown.
  3. **AI Tools:** One-click generation of cover letters, cold email outreach, interview prep checklists, and customized MCQ quizzes.
  4. **Activities:** System log of status movements, note edits, document attachments.
  5. **Notes:** Shared markdown notes editor (`JobNotesEditor`).
  6. **Contacts:** Attach existing CRM contacts or link recruiters/hiring managers to this job.
  7. **Documents:** Track tailored resumes, cover letters, and reference attachments for the job.
  8. **Company:** Manual company profile enrichment (founded year, location, type, country).

### 2.4 Resume Builder & Rendering Engine (`components/resume-builder/`, `lib/resume/`)
- **Novorésumé-Style Two-Pane Layout:** Left ~55% width holds an interactive editor with click-to-edit fields (`click-to-edit-field.tsx`); right pane holds a sticky, live Letter-size preview (`ResumePreview`).
- **Inline Rich Text Formatting:** Custom inline parser (`inline-rich-text.tsx`) handling bold (`**text**`), italic (`*text*`), links, and bullet separators (` · `).
- **Drag & Reorder:** Section cards and bullet list items reorderable via `@dnd-kit` with keyboard accessible controls.
- **Dual HTML & LaTeX Export:** Renders live HTML for browser preview and compiles clean native LaTeX via `lib/resume/render-tex.ts` for pixel-perfect PDF export.
- **Schema Storage:** Saved as frozen structured `ResumeDoc` JSON in `documents.builder_data`.

### 2.5 Contact Network & CRM (`/crm`)
- **Person-First Data Architecture:** Contacts are individual people; companies act as attributes/tags on contacts rather than nested parent containers.
- **Dual View Modes (`Tabs`):**
  - **Contacts View (Default):** Searchable flat grid of person cards (`rounded-2xl`) with inline `Select` controls for role (`CONTACT_ROLES`: Recruiter, Hiring Manager, Peer, Executive, Referral, Other) and company tagging.
  - **Companies View:** Grouped accordion view displaying company job/contact counts expanding into twin job/contact lists.

### 2.6 Analytics & Insights (`/insights`)
- Aggregate stats on job application velocity, pipeline distribution, fit score averages, weekly application targets, and response rates visualized with `recharts`.

### 2.7 Interview Preparation & MCQ Quizzer (`/interviews`, `/prototypes`)
- Schedule and track upcoming phone screens, technical rounds, behavioral interviews, and panel discussions.
- Interactive multiple-choice question (MCQ) quiz interface for technical domain prep, storing question caches in `mcq_question_cache`.

### 2.8 SMTP & Automated Outreach (`lib/actions/email.ts`, `lib/actions/smtp.ts`)
- Encrypted storage of SMTP credentials (`SMTP_ENCRYPTION_KEY` using AES-256-GCM in `lib/encryption.ts`).
- Direct sending of cover letters and networking emails using `nodemailer`.

---

## 3. Technology Stack & Dependencies

| Layer | Technologies / Libraries |
|---|---|
| **Core Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling & UI** | Tailwind CSS v4, `@tailwindcss/postcss`, `shadcn`/`@base-ui/react`, `lucide-react`, `motion` (Framer Motion v12), `next-themes` |
| **Database** | Node.js native `node:sqlite` (`DatabaseSync`), SQLite WAL mode |
| **Desktop Wrapper** | Electron 43, `electron-builder` 26 |
| **AI Integration** | `@google/genai` (Gemini API v2), Zod v4 schema validation |
| **Document Processing** | `pdfjs-dist`, `sharp`, `@dnd-kit` |
| **Communications** | `nodemailer`, AES-256-GCM encryption |

---

## 4. System Architecture & Directory Layout

```text
atTrack/
├── app/                      # Next.js App Router (pages, layouts, routes, API endpoints)
│   ├── (dashboard)/          # Main application layout (board, crm, jobs, insights, settings)
│   │   ├── board/            # Kanban application board
│   │   ├── crm/              # Person-first CRM contacts view
│   │   ├── jobs/             # Jobs grid and deep-link job detail view ([id])
│   │   ├── applications/     # Submitted applications log
│   │   ├── documents/        # Resume builder & document library
│   │   ├── insights/         # Application analytics & match metrics
│   │   ├── interviews/       # Interview schedule & prep
│   │   ├── settings/         # App preferences, AI providers, SMTP, data export/reset
│   │   └── layout.tsx        # Dashboard shell layout (desktop sidebar + mobile drawer)
│   ├── globals.css           # Tailwind CSS v4 rules, design tokens, brand gradient
│   └── layout.tsx            # Root HTML & theme provider shell
├── components/               # React UI components
│   ├── board/                # Kanban board columns, cards, and move-to menus
│   ├── job-detail/           # Job detail slide-over sheet and tab modules
│   ├── job-import/           # AI Multi-modal job import dialog
│   ├── resume-builder/       # Interactive resume editor, preview, and drag components
│   ├── ui/                   # Base UI & Radix/shadcn primitives
│   └── sidebar.tsx           # Desktop persistent sidebar & mobile command palette launcher
├── electron/                 # Desktop Electron main process, window management, auto-updater
├── lib/                      # Core backend logic, query layer, services, types
│   ├── actions/              # "use server" Server Actions organized by domain
│   ├── ai/                   # Task router, prompt definitions, background task queue, caching
│   ├── db/                   # SQLite connection singleton, query builder, schema, migrations
│   ├── resume/               # Resume inline markup parser, HTML renderer, LaTeX builder
│   ├── types/                # Shared TypeScript domain definitions
│   ├── encryption.ts         # AES-256-GCM credential encryption/decryption
│   └── utils.ts              # Class merging (`cn`), formatting helpers
├── docs/                     # Project documentation (Design.md, DEVELOPMENT.md, CLAUDE.md)
├── .data/                    # Local storage directory (SQLite database, file uploads - GITIGNORED)
└── package.json              # NPM package definitions and scripts
```

---

## 5. Data Layer & SQLite Database Architecture

### 5.1 SQLite Query Engine (`lib/db/`)
The data layer utilizes a custom Supabase-compatible query builder interface (`lib/db/query.ts`) over Node.js native `DatabaseSync` (`node:sqlite`).

- **Singleton & Pragmas:** `lib/db/sqlite.ts` enforces `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.
- **Column Meta Registry:** JSON objects and boolean flags in SQLite (which native SQLite stores as TEXT and INTEGER 0/1) are transparently parsed/serialized via `lib/db/meta.ts`.
- **Schema Source of Truth:** `lib/db/schema.sql` defines new database tables.
- **Live Migrations:** Existing user databases are migrated at runtime via `COLUMN_MIGRATIONS` array in `lib/db/sqlite.ts`.

### 5.2 Core Database Entities (`schema.sql`)
1. `users` & `profiles`: Local owner record (single user row `id = 'local-user'`).
2. `companies`: Company profiles (`name`, `website`, `location`, `founded_year`, `company_type`).
3. `board_lists`: Kanban stages (`wishlist`, `preparing`, `applied`, `interview`, `offer`, `accepted`, `rejected`, `custom`).
4. `jobs`: Core job applications (`title`, `company_id`, `list_id`, `board_position`, `match_score`, `notes`, `skills`, `salary_range`, `section_deadline`, `color`).
5. `applications`: Formally submitted applications tracking submission dates and resume snapshots.
6. `interviews`: Scheduled interview events (`type`, `scheduled_at`, `meeting_url`, `interviewer_name`, `prep_notes`).
7. `contacts` & `job_contacts`: CRM networking contacts linked to jobs and companies.
8. `documents`: Resumes and cover letters (`type`, `file_path`, `builder_data` for resume builder, `match_data`).
9. `positions`: Target career job titles and experience levels (`entry`, `mid`, `senior`).
10. `ai_usage`, `ai_task_logs`, `ai_output_cache`, `mcq_question_cache`: AI token monitoring and output caching.
11. `smtp_settings`: Encrypted user SMTP configuration.

---

## 6. Design Principles & UI Conventions

### 6.1 Radius Ladder (Flat 4px Steps)
Defined in `app/globals.css`, enforcing a strict hierarchy where **child elements must sit at least one radius step below their containing parent**:

| Class | Pixels | Target Components |
|---|---|---|
| `rounded-sm` | 4px | Checkboxes, tiny tag chips |
| `rounded-lg` | 8px | Buttons, text inputs, select triggers, menu rows |
| `rounded-xl` | 12px | Floating dropdown popovers, select containers |
| `rounded-2xl` | 16px | Cards, board columns, list containers (Default container tier) |
| `rounded-3xl` | 20px | Dialog shells, slide-over sheets, modal overlays |
| `rounded-full` | Capsule | Pills, badges, user avatars |

### 6.2 Color Palette & Signature Brand Gradient
- **Light Theme Default:** Clean white/near-white surfaces (`--background` `#ffffff`).
- **Brand Colors:**
  - `--primary` (Primary Lime): `#bef264` (light) / `#a3e635` (dark), foreground `#09090b`.
  - `--ring` (Deep Lime): `#84cc16`.
- **Signature Gradient (`.bg-gradient-brand`):** Lime accent → Deep Lime.  
  *Rule:* Saturated gradient is reserved for high-value focal points (max 1 per screen).
- **Tint Wash (`.bg-gradient-brand-tint`):** Light lime background wash (`#f7fee7`). Used for wider highlight areas (e.g., active Interview board lane).

### 6.3 Desktop & Mobile Layout Architecture
- **Desktop (`md:` and up):** No persistent top header bar. Sidebar (`components/sidebar.tsx`) hosts logo, user profile, theme toggle, and global command palette trigger (⌘K).
- **Mobile (`md:hidden`):** Compact header (`components/dashboard-header.tsx`) with hamburger menu launching a conditionally-mounted slide-over drawer.

---

## 7. Mandatory Rules & Conventions to Follow ("Things to Follow")

When developing or adding code to this project, any AI or human contributor MUST strictly adhere to the following rules:

### 7.1 Security & Product Boundary Rules
1. **NO Auth / Account UI:** Do **NOT** create login, signup, password reset, sign-out, or multi-account interfaces. The app is zero-auth local-first.
2. **Destructive Action Scope:** Workspace cleanup actions must be labeled "Delete all data", **NEVER** "Delete account".
3. **Data Scoping:** All SQL queries and server actions MUST scope reads and writes using the resolved `user_id` (`lib/db/local-user.ts`).

### 7.2 Code Structure & Action Rules
1. **Server Actions Organization:** Server actions live exclusively in `lib/actions/` with `"use server"` directives at top. Export async functions only; shared TypeScript types must reside in `lib/types/`.
2. **Database Schema Modifications:** Every schema change requires modifying **BOTH**:
   - `lib/db/schema.sql` (for fresh database creation).
   - `COLUMN_MIGRATIONS` array in `lib/db/sqlite.ts` (for existing database upgrades).
   - Registration of JSON and boolean columns in `lib/db/meta.ts`.
3. **Derived Board Status:** Never write directly to `jobs.status` from application logic. It is computed dynamically from `jobs.list_id` board state.

### 7.3 UI & Styling Rules
1. **Radius Hierarchy:** Never assign the same border-radius class to a child element as its parent. Always step down according to the Radius Ladder.
2. **Status Badges:** Use inline `<span>` tags with local Tailwind style maps for job statuses. Do **NOT** use standalone badge components for job cards.
3. **Accessibility:** Every drag-and-drop feature MUST provide an explicit keyboard-accessible non-drag menu alternative (e.g., `<MoveToMenu />`).

---

## 8. Common Commands & Developer Cheat Sheet

```bash
# Start Next.js development server (runs on http://localhost:3308)
npm run dev

# Run full Next.js production build
npm run build

# Start production server
npm run start

# Run ESLint validation
npm run lint

# Run Electron desktop shell locally in dev mode
npm run electron:dev

# Build Windows Electron executable installer (.exe) into release/
npm run build:electron
```

---
*End of Project Context Directive. Keep this file updated whenever architecture, data models, or core design rules evolve.*

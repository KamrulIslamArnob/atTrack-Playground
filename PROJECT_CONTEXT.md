# PROJECT CONTEXT & ARCHITECTURE DIRECTIVE
> **Product Name:** atTrack (v1.5.0)  
> **Repository:** `KamrulIslamArnob/atTrack`  
> **Target Audience:** Artificial Intelligence Assistants, Coding Agents, LLMs, and Human Developers.  
> **Purpose:** Comprehensive, single-source-of-truth document detailing project vision, total feature breakdown, architectural blueprints, database schemas, design tokens, UI conventions, security boundaries, and strict development rules.

---

## 1. Executive Summary & Product Model

**atTrack** is a local-first, single-user personal career workspace built for tracking job applications, managing documents/resumes, organizing interview preparation, networking with professional contacts (CRM), managing career links/shortcuts, and utilizing AI-assisted application tools and chatbots.

### Key Architectural Pillars
1. **Local-First & Offline-Capable:** Runs on local SQLite via Node.js native `DatabaseSync` (`node:sqlite`) with WAL mode and SQLite FTS5 Omni-Search indexing. Uploaded files, resumes, and logs live on the local file system (`.data/storage/` or Electron user data path).
2. **Zero-Auth Surface (Single-User Owner Model):** The app has **no login, signup, sign-out, or multi-user session management**. The local process runner is implicitly trusted as the sole owner (`id = 'local-user'`).
3. **Hybrid Web, Desktop & Browser Companion:** Built as a Next.js 16 App Router web application packaged for Windows desktop via Electron 43 (`electron/main.js`, `electron-builder`) and supported by a Manifest V3 browser extension (`extension/`).
4. **Task-Routed Multi-Provider AI Subsystem:** Integrated with Google Gemini (`@google/genai`), Anthropic, and OpenAI-compatible providers for multi-modal job import, resume-job fit analysis, document drafting, cold outreach, grounded chatbot assistance, and long-term memory retrieval.

---

## 2. Complete Feature Inventory & User Workflows

### 2.1 Kanban Application Board (`/board`)
- **Pipeline Stages:** Seeding 6 primary lists (`Wishlist`, `Preparing`, `Applied`, `Interview`, `Offer`, `Accepted`, `Rejected`) with full support for user-created `custom` board lists (`board_lists` table).
- **Derived Card Status:** Card column placement determines the derived `jobs.status`. Moving a card to an `Applied` list automatically creates an `applications` record idempotently via database triggers and server actions.
- **Job Lifecycle States (`jobs.state`):** Supports three operational states:
  - `active`: Normal active job hunt workflow.
  - `on_hold`: Temporarily paused opportunities.
  - `archived`: Concluded or abandoned applications.
  - *Board Layout:* Active jobs render in the main column view; On-Hold and Archived jobs render in collapsible bottom drawers.
- **Card Anatomy & Fit Meter:** Displays company, position/resume pills, relative time, per-job accent swatch, state badges, and a `matchScoreBand` fit score meter (visual mini-bar + text band: `Strong`, `Good`, `Moderate`, `Weak`).
- **Drag & Accessibility:** Touch/mouse drag-and-drop powered by pointer events, paired with a mandatory keyboard-accessible **"Move to"** dropdown menu and **"Change State"** menu on every card.
- **Interview Lane Highlight:** Subtle light green wash (`.bg-gradient-brand-tint`) applied dynamically to the `Interview` lane when containing active cards.

### 2.2 Unified Job Import Engine (`components/import-choice.tsx`, `lib/ai/ai.ts`, `extension/`)
- **Dual Modal Entry:** Manual entry vs. AI-Assisted Import (`components/job-import/ai-import.tsx`).
- **Multi-Modal AI Ingestion:** Takes any combination of webpage URLs (fetched live via Gemini's built-in `url_context` search/read tool), uploaded listing screenshots, or raw text blurbs in a single prompt to extract job title, company, salary ranges, required skills, and deadlines.
- **Browser Extension 1-Click Clip:** Companion Chrome extension (`extension/`) clips job listings directly from LinkedIn, Indeed, and careers pages into atTrack via `/api/extension/add-job` using bearer secret authentication.

### 2.3 Job Detail Sheet & Deep-Link View (`components/job-detail/`, `/jobs/[id]`)
- **Slide-Over Experience:** Slide-out sheet (`Sheet` right side, 4xl max width) opened from board cards, sharing the identical server-rendered component with the deep-link route (`/jobs/[id]`).
- **8 Tabbed Modules:**
  1. **Insights (`InsightsTab`):** AI match score breakdown, strengths, gaps, recommended actions, and fit meter.
  2. **Deadlines & Milestones (`DeadlinesTab`):** Timeline and stage-bound deadline/milestone manager (`job_deadlines` table), with pinning, completion checkboxes, due dates, and stage associations.
  3. **Edit (`EditTab`):** Per-job metadata, custom accent swatch, salary details (`salary_min`, `salary_max`, `salary_currency`, `salary_period`), skills, benefits, work schedule, holiday policy, map URL.
  4. **AI Tools (`AiToolsTab`):** One-click generation of cover letters, cold email outreach, interview prep checklists, and customized MCQ quizzes with caching in `ai_output_cache`.
  5. **Notes (`NotesTab`):** Markdown notes editor with auto-save (`JobNotesEditor`).
  6. **Contacts (`ContactsTab`):** Link existing CRM contacts or create new recruiters/hiring managers connected to this job (`job_contacts` table).
  7. **Documents (`DocumentsTab`):** Track tailored resumes, cover letters, and reference attachments for the job (`job_documents` table).
  8. **Company (`CompanyTab`):** Manual company profile enrichment (founded year, location, type, country) + **Smart Job Deletion** (`deleteJobWithSmartCascade`) with interactive cascade prompt for associated company/contacts.

### 2.4 Resume Builder & Rendering Engine (`components/resume-builder/`, `lib/resume/`)
- **Novorésumé-Style Two-Pane Layout:** Left pane holds an interactive editor with click-to-edit fields (`click-to-edit-field.tsx`); right pane holds a sticky, live Letter-size preview (`ResumePreview`).
- **Inline Rich Text Formatting:** Custom inline parser (`inline-rich-text.tsx`) handling bold (`**text**`), italic (`*text*`), links, and bullet separators (` · `).
- **Drag & Reorder:** Section cards and bullet list items reorderable via `@dnd-kit` with keyboard accessible controls.
- **Dual HTML & LaTeX Export:** Renders live HTML for browser preview and compiles clean native LaTeX via `lib/resume/render-tex.ts` for pixel-perfect PDF export.
- **Schema Storage:** Saved as frozen structured `ResumeDoc` JSON in `documents.builder_data`.

### 2.5 Contact Network & CRM (`/crm`)
- **Person-First Data Architecture:** Contacts are individual people; companies act as attributes/tags on contacts rather than nested parent containers.
- **Dual View Modes (`Tabs`):**
  - **Contacts View (Default):** Searchable flat grid of person cards (`rounded-2xl`) with inline `Select` controls for role (`CONTACT_ROLES`: Recruiter, Hiring Manager, Peer, Executive, Referral, Other), company tagging, and social URLs.
  - **Companies View:** Grouped accordion view displaying company job/contact counts expanding into twin job/contact lists.

### 2.6 Analytics, Insights & Overview (`/insights`, `/overview`)
- **Overview Dashboard (`/overview`):** Top-level metrics, conversion funnels, pipeline velocity, active opportunities, and system performance telemetry.
- **Deep Analytics (`/insights`):** Aggregate stats on application velocity, pipeline distribution, fit score averages, weekly application targets, and response rates visualized with `recharts`.

### 2.7 Interview Preparation & Scheduling (`/interviews`)
- Schedule and track upcoming phone screens, technical rounds, behavioral interviews, and panel discussions (`interviews` table).
- Track interviewer names, meeting links, prep notes, duration, and completion statuses.

### 2.8 Links & Quick Resource Directory (`/links`)
- **Categorized Link Library:** Bookmark career resources, job boards, portfolio items, and interview repositories (`link_categories`, `links` tables).
- **Quick Copy Shortcuts:** Configurable toolbar (`quick_shortcuts` table) with custom icons for 1-click clipboard copying of portfolio URLs, GitHub, LinkedIn, email, and phone numbers.

### 2.9 AI Career Assistant & Chatbot (`/chatbot`, `/ai-builder/chatbot`)
- **Two-Tier Session Persistence:** Instant client-side state hydration + durable SQLite storage (`chat_sessions`, `chat_messages` tables).
- **Workspace Source Permissions:** Dynamic workspace drawer (`connected_source_ids`) allowing users to ground the conversation in specific jobs, resumes, CRM contacts, links, or notes.
- **Tool Calling Subsystem:** Autonomous tool execution for querying the database (`query-database`), searching links (`search-links`), searching GitHub (`search-github`), and retrieving memories (`search-memories`).
- **AI Memory Store (`ai_memories` table):** Persistent memory extraction storing key user facts, preferences, and career background.
- **Evaluation & Feedback Loop (`ai_feedback` table):** Thumbs up/down response rating capturing prompt context, model, persona, and output for continuous tuning.

### 2.10 Companion Browser Extension (`extension/`)
- Manifest V3 Chrome extension communicating with local atTrack instance via `/api/extension/*`.
- Authenticated via per-install bearer secret (`extension_config` table, `lib/db/extension-secret.ts`).
- 1-click job clipping from LinkedIn, Indeed, and web listings directly into the Kanban board.

### 2.11 Multi-Provider AI Routing & Preferences (`/preferences`, `/settings`)
- **Bring Your Own Key (BYOK):** Configure credentials for Google Gemini, Anthropic, and OpenAI-compatible providers (`ai_providers` table).
- **Task-Based Routing:** Map specific AI workloads (text generation, multimodal image parsing, web scraping) to designated providers (`ai_task_routes` table).
- **Custom Tool Prompts:** Customize system prompts for individual AI tools (`ai_tool_prompts` table).

### 2.12 SMTP & Automated Outreach (`lib/actions/email.ts`, `lib/actions/smtp.ts`)
- Encrypted storage of SMTP credentials (`SMTP_ENCRYPTION_KEY` using AES-256-GCM in `lib/encryption.ts`).
- Direct sending of cover letters and networking emails using `nodemailer` (`smtp_config`, `application_emails` tables).

---

## 3. Technology Stack & Dependencies

| Layer | Technologies / Libraries |
|---|---|
| **Core Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling & UI** | Tailwind CSS v4, `@tailwindcss/postcss`, `shadcn`/`@base-ui/react`, `lucide-react`, `motion` (Framer Motion v12), `next-themes`, `sonner` |
| **Database & Search** | Node.js native `node:sqlite` (`DatabaseSync`), SQLite WAL mode, SQLite FTS5 Omni-Search |
| **Desktop Wrapper** | Electron 43, `electron-builder` 26, `electron-updater` |
| **Browser Extension** | Chrome Manifest V3, Web Extension APIs |
| **AI Integration** | `@google/genai` (Gemini API v2), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `ai` SDK, Zod v4 |
| **Visualizations & Charts** | `recharts` |
| **Document Processing** | `pdfjs-dist`, `sharp`, `@dnd-kit` |
| **Communications & Security** | `nodemailer`, AES-256-GCM credential encryption |

---

## 4. System Architecture & Directory Layout

```text
atTrack/
├── app/                          # Next.js App Router (pages, layouts, API endpoints)
│   ├── (dashboard)/              # Main application shell (sidebar + content)
│   │   ├── ai-builder/           # AI Assistant and chatbot builder interfaces
│   │   ├── applications/         # Formally submitted applications log
│   │   ├── board/                # Kanban application board with stage lanes & drawers
│   │   ├── chatbot/              # Standalone AI career assistant conversation interface
│   │   ├── crm/                  # Person-first CRM contacts & company views
│   │   ├── documents/            # Resume builder & document management library
│   │   ├── insights/             # Application analytics & match metrics
│   │   ├── interviews/           # Interview schedule, prep & tracking
│   │   ├── jobs/                 # Jobs grid and deep-link job detail view ([id])
│   │   ├── links/                # Categorized career bookmarks & quick shortcuts
│   │   ├── overview/             # Executive dashboard & system telemetry
│   │   ├── preferences/          # AI prompt customizations & model routes
│   │   ├── settings/             # App preferences, AI providers, SMTP, data reset
│   │   └── layout.tsx            # Dashboard shell layout (desktop sidebar + mobile drawer)
│   ├── api/                      # Backend HTTP endpoints
│   │   ├── ai/                   # AI tool & email generation handlers
│   │   ├── chat/                 # Streaming chatbot endpoint & feedback ingestion
│   │   ├── database/             # Query & schema update endpoints
│   │   ├── extension/            # Browser extension intake endpoints (/add-job, /parse-job-ai)
│   │   └── performance/          # Telemetry & performance metrics
│   ├── globals.css               # Tailwind CSS v4 rules, design tokens, brand gradient
│   └── layout.tsx                # Root HTML, window controls & theme provider shell
├── components/                   # React UI components
│   ├── ai-chatbot/               # Chat canvas, session sidebar, workspace drawer, markdown parser
│   ├── board/                    # Kanban columns, board cards, MoveToMenu, ChangeStateMenu
│   ├── crm/                      # Contact cards, company accordion, contact form dialogs
│   ├── job-detail/               # Job detail slide-over sheet & 8 tab modules
│   │   └── tabs/                 # insights, deadlines, edit, ai-tools, notes, contacts, docs, company
│   ├── job-import/               # AI multi-modal job import modal
│   ├── landing/                  # Marketing landing page components
│   ├── links/                    # Link rows, category manager, quick shortcuts
│   ├── resume-builder/           # Interactive resume editor, preview, LaTeX exporter
│   ├── settings/                 # AI provider dialogs, SMTP config, extension settings
│   ├── ui/                       # Base UI & Radix/shadcn primitives
│   ├── sidebar.tsx               # Desktop persistent sidebar & command palette launcher
│   └── window-titlebar.tsx       # Custom Electron desktop window frame controls
├── docs/                         # Architecture guides, specs, and plans
├── electron/                     # Desktop Electron main process, window management, auto-updater
├── extension/                    # Manifest V3 Chrome companion extension
│   ├── background/               # Extension service worker
│   └── popup/                    # Extension UI popup for job clipping
├── lib/                          # Core backend logic, query layer, services, types
│   ├── actions/                  # "use server" Server Actions organized by domain
│   ├── ai/                       # Multi-provider router, prompts, caching, tool definitions
│   ├── ai-chatbot/               # Chatbot pipeline, intent parser, retrieval, workspace scoping
│   ├── db/                       # SQLite connection singleton, query builder, schema, migrations
│   ├── resume/                   # Resume inline markup parser, HTML renderer, LaTeX builder
│   ├── types/                    # Shared TypeScript domain definitions
│   ├── encryption.ts             # AES-256-GCM credential encryption/decryption
│   └── utils.ts                  # Class merging (`cn`), formatting helpers
├── .data/                        # Local storage directory (SQLite database, file uploads - GITIGNORED)
└── package.json                  # NPM package definitions and scripts
```

---

## 5. Data Layer & SQLite Database Architecture

### 5.1 SQLite Query Engine (`lib/db/`)
The data layer utilizes a custom Supabase-compatible query builder interface (`lib/db/query.ts`) over Node.js native `DatabaseSync` (`node:sqlite`).

- **Singleton & Pragmas (`lib/db/sqlite.ts`):** Enforces `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, `PRAGMA foreign_keys = ON;`, `PRAGMA busy_timeout = 5000;`, and memory optimization pragmas (`cache_size = -64000`, `mmap_size = 268435456`).
- **Column Meta Registry (`lib/db/meta.ts`):** JSON objects and boolean flags in SQLite (stored natively as TEXT and INTEGER 0/1) are transparently parsed and serialized.
- **Schema Source of Truth:** `lib/db/schema.sql` defines all database tables, virtual tables, triggers, and views for fresh databases.
- **Live Auto-Migrations:** Existing user databases are migrated at runtime on connection via the `COLUMN_MIGRATIONS` registry in `lib/db/sqlite.ts`.
- **Omni-Search FTS5 Index:** An SQLite `fts5` virtual table (`omni_search_index`) with automated triggers across jobs, contacts, companies, applications, interviews, documents, deadlines, and positions provides instant O(1) keyword search for the global ⌘K palette.

### 5.2 Core Database Entities (`schema.sql`)
1. `users` & `profiles`: Local owner record (single user row `id = 'local-user'`).
2. `companies`: Company profiles (`name`, `website`, `location`, `founded_year`, `company_type`, `country`, `color`).
3. `board_lists`: Kanban stages (`wishlist`, `preparing`, `applied`, `interview`, `offer`, `accepted`, `rejected`, `custom`).
4. `jobs`: Core job applications (`title`, `company_id`, `list_id`, `board_position`, `match_score`, `status`, `state`, `salary_min`, `salary_max`, `salary_currency`, `salary_period`, `skills`, `benefits`, `work_schedule`, `holiday_policy`, `map_url`, `notes`, `color`, `section_deadline`).
5. `job_deadlines`: Timeline deadlines and stage milestones (`job_id`, `type` ['deadline'|'milestone'], `stage_kind`, `due_date`, `is_pinned`, `is_completed`, `notes`).
6. `applications`: Formally submitted applications tracking submission dates and resume snapshots.
7. `interviews`: Scheduled interview events (`type`, `scheduled_at`, `meeting_url`, `interviewer_name`, `prep_notes`, `status`, `duration_minutes`).
8. `link_categories` & `links`: Categorized career bookmarks, URLs, tags, and notes.
9. `quick_shortcuts`: 1-click clipboard copy buttons with icons for the links directory.
10. `contacts`, `job_contacts`, `job_documents`: Reusable CRM contacts and many-to-many link tables.
11. `documents`: Resumes and cover letters (`type`, `file_path`, `builder_data` for resume builder, `match_data`, `generated_kind`).
12. `positions`: Target career job titles and experience levels (`entry`, `mid`, `senior`).
13. `ai_providers`, `ai_task_routes`, `ai_tool_prompts`: Multi-provider BYOK configurations, task routing rules, and custom system prompts.
14. `ai_memories`: Long-term AI memory facts extracted from user interactions.
15. `chat_sessions`, `chat_messages`, `ai_feedback`: Chatbot conversation histories, connected workspace source IDs, and rating feedback.
16. `ai_usage_logs`, `ai_output_cache`, `mcq_question_cache`: AI token monitoring and output caching.
17. `smtp_config` & `application_emails`: Encrypted SMTP connection settings and outreach audit log.
18. `extension_config`: Per-install shared secret for companion browser extension authorization.
19. `omni_search_index`: SQLite FTS5 full-text search virtual table.
20. `v_jobs`: Pre-joined SQL view providing complete job and company context for AI query tools.

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

### 6.3 Desktop, Mobile & Electron Shell Layout
- **Desktop (`md:` and up):** Persistent sidebar (`components/sidebar.tsx`) hosting logo, user profile, theme toggle, and global command palette trigger (⌘K / Ctrl+K).
- **Desktop Electron Shell:** Custom frameless titlebar (`components/window-titlebar.tsx`) with minimize, maximize/restore, and close window controls.
- **Mobile (`md:hidden`):** Compact header (`components/dashboard-header.tsx`) with hamburger menu launching a conditionally-mounted slide-over drawer.

---

## 7. Mandatory Rules & Conventions to Follow ("Things to Follow")

When developing or adding code to this project, any AI or human contributor MUST strictly adhere to the following rules:

### 7.1 Security & Product Boundary Rules
1. **NO Auth / Account UI:** Do **NOT** create login, signup, password reset, sign-out, or multi-account interfaces. The app is zero-auth local-first.
2. **Destructive Action Scope:** Workspace cleanup actions must be labeled "Delete all data", **NEVER** "Delete account".
3. **Data Scoping:** All SQL queries and server actions MUST scope reads and writes using the resolved `user_id` (`lib/db/local-user.ts`).
4. **Smart Cascade Deletion:** When deleting entities with potential orphans (e.g. jobs attached to companies or contacts), provide smart cascade options to prevent orphaned data while preserving shared CRM entries.

### 7.2 Code Structure & Action Rules
1. **Server Actions Organization:** Server actions live exclusively in `lib/actions/` with `"use server"` directives at top. Export async functions only; shared TypeScript types must reside in `lib/types/`.
2. **Database Schema Modifications:** Every schema change requires modifying **BOTH**:
   - `lib/db/schema.sql` (for fresh database creation).
   - `COLUMN_MIGRATIONS` array in `lib/db/sqlite.ts` (for existing database upgrades).
   - Registration of JSON and boolean columns in `lib/db/meta.ts`.
3. **Derived Board Status:** Never write directly to `jobs.status` from application logic. It is computed dynamically from `jobs.list_id` board state. Use `jobs.state` for lifecycle state management (`active`, `on_hold`, `archived`).

### 7.3 UI & Styling Rules
1. **Radius Hierarchy:** Never assign the same border-radius class to a child element as its parent. Always step down according to the Radius Ladder.
2. **Status Badges:** Use inline `<span>` tags with local Tailwind style maps for job statuses. Do **NOT** use standalone badge components for job cards.
3. **Accessibility:** Every drag-and-drop feature MUST provide an explicit keyboard-accessible non-drag menu alternative (e.g., `<MoveToMenu />`, `<ChangeStateMenu />`).

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

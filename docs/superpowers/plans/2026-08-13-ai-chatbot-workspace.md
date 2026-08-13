# AI Chatbot Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade AI workspace interface with agent switching, mini-scenarios, cross-source data connections, session persistence, and modern ChatGPT-style visual aesthetics.

**Architecture:** Refactor `app/(dashboard)/ai-builder/chatbot/page.tsx` and `components/ai-chatbot/` into modular components. Enhance domain models in `lib/ai-chatbot/` to support dynamic agent personas, mini-scenarios, workspace source toggling, tool status drawers, and streaming responses.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide React, Motion (Framer Motion v12), Sonner, Base UI / Radix primitives.

## Global Constraints

- Aesthetics: Clean white background (`bg-background`), subtle borders (`border-border/40`), soft shadows (`shadow-xs`), lime accent palette (`#bef264` / `#a3e635` / `#84cc16`).
- Zero-Auth: Single-user local workspace model; scope DB/state to local user.
- Local Storage & Persistence: Retain chat sessions across browser reloads.
- Responsive Design: Desktop fixed sidebar + mobile slide-over drawer.

---

### Task 1: Core Domain Definitions, Scenarios & Workspace Context Engine

**Files:**
- Create: `lib/ai-chatbot/types.ts`
- Create: `lib/ai-chatbot/scenarios.ts`
- Modify: `lib/ai-chatbot/sessions.ts`
- Modify: `lib/ai-chatbot/workspace.ts`

**Interfaces:**
- Consumes: DatabaseSync / Local storage workspace metrics
- Produces: `ChatPersona`, `MiniScenario`, `ContextSource`, `ChatSession`, `WorkspaceSnapshot`

- [ ] **Step 1: Create `lib/ai-chatbot/types.ts`**

Define domain interfaces:
```typescript
export interface AIModel {
  id: string;
  name: string;
  provider: "gemini" | "openai" | "anthropic" | "local";
  description: string;
  supportsImages: boolean;
  isReasoning: boolean;
  badge?: string;
  capability?: string;
}

export interface ChatPersona {
  id: string;
  name: string;
  iconName: string;
  description: string;
  systemPrompt: string;
  heading: string;
  subheading: string;
  preferredSources: string[];
}

export interface MiniScenario {
  id: string;
  title: string;
  description: string;
  iconName: string;
  agentId: string;
  starterPrompt: string;
  requiredSources: string[];
}

export interface ContextSource {
  id: string;
  type: "resume" | "jobs" | "contacts" | "github" | "gdrive" | "notion" | "linkedin" | "email" | "projects";
  name: string;
  recordCount: number;
  lastSync: string;
  enabled: boolean;
}

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
}
```

- [ ] **Step 2: Create `lib/ai-chatbot/scenarios.ts`**

Define the 4 predefined mini-scenarios:
```typescript
import { MiniScenario } from "./types";

export const MINI_SCENARIOS: MiniScenario[] = [
  {
    id: "resume-review",
    title: "Resume Review",
    description: "Analyze resume ATS match score and highlight impactful bullet points.",
    iconName: "FileText",
    agentId: "ats_coach",
    starterPrompt: "Review my resume against my target job role and identify the highest-impact improvements for ATS compatibility.",
    requiredSources: ["resume", "jobs"],
  },
  {
    id: "interview-prep",
    title: "Interview Prep",
    description: "Practice behavioral STAR questions & technical domain prep.",
    iconName: "UserCheck",
    agentId: "interviewer",
    starterPrompt: "Help me prepare for my upcoming interview. Ask me realistic interview questions one by one.",
    requiredSources: ["jobs", "resume"],
  },
  {
    id: "cold-outreach",
    title: "Cold Outreach",
    description: "Draft personalized cold LinkedIn/Email messages to recruiters.",
    iconName: "Send",
    agentId: "outreach",
    starterPrompt: "Help me write a concise, compelling cold outreach email to a recruiter for my target position.",
    requiredSources: ["contacts", "jobs"],
  },
  {
    id: "code-review",
    title: "Code Review",
    description: "Inspect code snippets or repos for architecture, performance & bugs.",
    iconName: "Code2",
    agentId: "code_architect",
    starterPrompt: "Review my code snippet for performance, cleanliness, and modern best practices.",
    requiredSources: ["github", "projects"],
  },
];
```

- [ ] **Step 3: Update `lib/ai-chatbot/sessions.ts` with updated personas and model details**

Update `CHAT_PERSONAS` to include dynamic headings and subheadings.

- [ ] **Step 4: Update `lib/ai-chatbot/workspace.ts` for connection sources management**

Enhance `fetchWorkspace()` to return active toggled `ContextSource[]`.

- [ ] **Step 5: Test & Commit**
```bash
git add lib/ai-chatbot/
git commit -m "feat(ai-chatbot): define core domain types, scenarios, and workspace sources"
```

---

### Task 2: Top Navigation & Workspace Connection Drawer

**Files:**
- Create: `components/ai-chatbot/top-navigation.tsx`
- Create: `components/ai-chatbot/workspace-connection-drawer.tsx`
- Modify: `components/ai-chatbot/model-selector.tsx`
- Modify: `components/ai-chatbot/persona-selector.tsx`

**Interfaces:**
- Consumes: `activeSessionId`, `selectedModel`, `selectedPersona`, `workspaceSources`
- Produces: Header bar with clickable workspace drawer and dropdown selectors

- [ ] **Step 1: Create `components/ai-chatbot/workspace-connection-drawer.tsx`**

Build a clean slide-over sheet or modal popover listing connected data sources (`Resume Database`, `Job Applications`, `Contacts CRM`, `GitHub`, `Google Drive`, `Notion`, `LinkedIn`, `Email`, `Projects`) with enable/disable toggles and record counts.

- [ ] **Step 2: Create `components/ai-chatbot/top-navigation.tsx`**

Build compact top navigation bar:
- Left: `[AI Icon] New Chat` or active session title
- Middle: Workspace badge (`Connected to workspace (11 jobs, 4 resumes)`) -> click opens Workspace Connection Drawer
- Right: Model Selector badge/dropdown + Persona Selector badge/dropdown

- [ ] **Step 3: Test & Commit**
```bash
git add components/ai-chatbot/
git commit -m "feat(ai-chatbot): add top navigation bar and workspace connection drawer"
```

---

### Task 3: Sidebar Redesign & Date Grouped Chat History

**Files:**
- Modify: `components/ai-chatbot/chat-session-sidebar.tsx`

**Interfaces:**
- Consumes: `ChatSession[]`, `activeSessionId`, `onSelectSession`, `onNewChat`, `onRenameSession`, `onDeleteSession`
- Produces: Date-grouped chat list (`TODAY`, `YESTERDAY`, `PREVIOUS 7 DAYS`, `OLDER`) with search filtering and prominent `+ New Chat` button.

- [ ] **Step 1: Refactor `components/ai-chatbot/chat-session-sidebar.tsx`**

- Add search filter state (`searchQuery`).
- Group sessions by date using `date-fns` (`isToday`, `isYesterday`, `differenceInDays`).
- Style `+ New Chat` with lime gradient (`bg-primary text-primary-foreground hover:bg-primary/90 font-medium`).
- Add item hover dropdown menu: Rename, Delete, Archive.
- Add bottom account/workspace footer section.

- [ ] **Step 2: Test & Commit**
```bash
git add components/ai-chatbot/chat-session-sidebar.tsx
git commit -m "feat(ai-chatbot): redesign chat session sidebar with date grouping and search"
```

---

### Task 4: Dynamic Empty State & Mini-Scenarios System

**Files:**
- Modify: `components/ai-chatbot/empty-chat-state.tsx`

**Interfaces:**
- Consumes: `selectedPersona`, `workspace`, `onSelectPersona`, `onSelectScenario`, `onSelectPrompt`
- Produces: Modern onboarding Hero UI with dynamic persona headline, agent pills, and 4 scenario cards.

- [ ] **Step 1: Refactor `components/ai-chatbot/empty-chat-state.tsx`**

- Display dynamic title & description based on `selectedPersona.heading` and `selectedPersona.subheading`.
- Render connected workspace metrics pill with clickable trigger for the workspace drawer.
- Render horizontal agent selector pills with smooth selection highlight (`motion`).
- Render 4 mini-scenario cards (`Resume Review`, `Interview Prep`, `Cold Outreach`, `Code Review`). Clicking a scenario invokes `onSelectScenario(scenario)`.

- [ ] **Step 2: Test & Commit**
```bash
git add components/ai-chatbot/empty-chat-state.tsx
git commit -m "feat(ai-chatbot): implement dynamic empty state hero and mini-scenarios system"
```

---

### Task 5: Composer Toolbar, Model/Persona Selectors & File Uploads

**Files:**
- Modify: `components/ai-chatbot/chat-input.tsx`

**Interfaces:**
- Consumes: `input`, `handleInputChange`, `handleSubmit`, `isLoading`, `stop`, `selectedModel`, `selectedPersona`, `onSelectModel`, `onSelectPersona`
- Produces: Anchored bottom composer with auto-grow input, inline toolbar selectors, file attachments, and send/stop actions.

- [ ] **Step 1: Refactor `components/ai-chatbot/chat-input.tsx`**

- Auto-growing `<textarea>` with Enter to send and Shift+Enter for newlines.
- Bottom toolbar inside composer box:
  - Agent dropdown trigger (`[Agent ▾]`)
  - Model dropdown trigger (`[Model ▾]`)
  - `+` file attachment button & preview chips
  - Tools/Search mode toggle pill
  - Send button (`↑`) with loading spinner and stop control during generation.
- Drag-and-drop overlay for dropping files directly into composer.

- [ ] **Step 2: Test & Commit**
```bash
git add components/ai-chatbot/chat-input.tsx
git commit -m "feat(ai-chatbot): update chat composer with embedded agent/model selectors and file uploads"
```

---

### Task 6: Messages Display, Syntax Highlighting, Tool Status & Citations

**Files:**
- Create: `components/ai-chatbot/tool-execution-status.tsx`
- Modify: `components/ai-chatbot/chat-messages.tsx`
- Modify: `components/ai-chatbot/markdown.tsx`

**Interfaces:**
- Consumes: `messages`, `isLoading`, `toolSteps`, `sourcesUsed`, `onRegenerate`, `onEditMessage`
- Produces: Chat message feed with author avatars, syntax highlighting, tool execution steps drawer, copy/edit/regenerate actions, and citation source chips.

- [ ] **Step 1: Create `components/ai-chatbot/tool-execution-status.tsx`**

Build collapsible tool execution drawer showing progress (`Analyzing context... ✓ Resume ✓ Job Description ✓ GitHub`).

- [ ] **Step 2: Refactor `components/ai-chatbot/chat-messages.tsx`**

- Markdown parsing with code copy buttons and clean table formatting.
- Integrated `ToolExecutionStatus` component during generation.
- Render "Sources used" chip at bottom of assistant responses with expandable list of grounding data sources.
- Action toolbar for each message: Copy, Regenerate, Edit message, Thumbs up/down feedback.

- [ ] **Step 3: Test & Commit**
```bash
git add components/ai-chatbot/
git commit -m "feat(ai-chatbot): implement message feed, markdown highlighting, tool execution steps, and citations"
```

---

### Task 7: AI Chat Page Integration & Server Streaming

**Files:**
- Modify: `app/(dashboard)/ai-builder/chatbot/page.tsx`
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: All UI components & AI provider API
- Produces: Full interactive workspace page supporting session switching, scenario execution, workspace source filtering, and real-time text streaming.

- [ ] **Step 1: Refactor `app/(dashboard)/ai-builder/chatbot/page.tsx`**

- Wire top navigation bar, sidebar drawer, dynamic empty state, chat message feed, anchored composer, and workspace connection drawer.
- Implement scenario handler `handleSelectScenario(scenario)`:
  1. Sets active persona to `scenario.agentId`.
  2. Prepares starter prompt.
  3. Activates relevant workspace sources.
  4. Triggers chat submit or pre-fills composer.
- Wire local storage and SQLite database session saving.

- [ ] **Step 2: Update `app/api/chat/route.ts`**

- Parse `model`, `persona`, `workspaceContext`, and `activeSources` from request body.
- Pass context grounding into `generateTextStream()`.

- [ ] **Step 3: Verification & Build Check**
```bash
npm run build
npm run lint
```

- [ ] **Step 4: Commit**
```bash
git add app/
git commit -m "feat(ai-chatbot): integrate chatbot workspace page, scenario handler, and streaming API"
```

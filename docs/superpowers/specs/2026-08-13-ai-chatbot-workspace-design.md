# AI Chatbot Workspace UI/UX Specification

**Date:** 2026-08-13  
**Status:** Approved  
**Target Module:** `app/(dashboard)/ai-builder/chatbot/` & `components/ai-chatbot/`

---

## 1. Executive Summary

Transform the existing AI Chatbot into a modern, production-grade conversational workspace (ChatGPT + AI Agents + Workspace Context Engine). The application features dynamic persona switching, mini-scenario shortcuts, cross-source data context grounding, model selection, live session persistence, and visual aesthetics aligned with a clean white palette and primary lime accents (`#bef264` / `#a3e635` / `#84cc16`).

---

## 2. Layout & Visual System Architecture

### 2.1 Workspace Shell (`components/ai-chatbot/layout/`)
- **Main Container:** Clean 4-region layout consisting of Left Sidebar, Top Navigation Bar, Main Content Area (Empty State or Chat Messages), and Anchored Bottom Composer.
- **Color Palette & Design Tokens:**
  - Background: Clean white `#ffffff` / light neutral `--background`.
  - Borders: 1px subtle borders (`border-border/40`).
  - Accent Color: Lime green gradient & highlights (`#bef264` / `#a3e635` / `#84cc16`).
  - Shadows: Soft, restrained elevation (`shadow-xs`, `shadow-sm`).
  - Radius Hierarchy: `rounded-lg` for inputs/buttons, `rounded-xl` for cards & popovers, `rounded-2xl` for containers, `rounded-full` for chips/pills.

### 2.2 Left Sidebar (`components/ai-chatbot/chat-session-sidebar.tsx`)
- **Prominent Action:** High-visibility `+ New Chat` button with lime accent styling.
- **Search & Filter:** Real-time debounced search input filtering session titles and message contents.
- **Grouped Sessions:** Time-bucketed categorization (`TODAY`, `YESTERDAY`, `PREVIOUS 7 DAYS`, `OLDER`).
- **Session Item Actions:** Selected active state indicator, hover context menu for Renaming, Archiving, and Deleting conversations.
- **Footer Section:** Workspace status & Account metadata summary.
- **Responsiveness:** Persistent on desktop; slide-over drawer on mobile viewports.

### 2.3 Top Navigation Bar (`components/ai-chatbot/top-navigation.tsx`)
- **Left Region:** Active conversation title or `[AI Icon] New Chat` indicator.
- **Center/Context Region:** `[Connected Workspace]` badge with summary count (e.g. `11 jobs · 4 resumes · 4 contacts`), opening the Workspace Connection Drawer on click.
- **Right Region:** `[Model Selector]` dropdown badge (Gemini 3.6 Flash, GPT-4o, Claude 3.5 Sonnet) and `[Agent Persona Selector]` dropdown badge.

---

## 3. Empty Chat Onboarding State (`components/ai-chatbot/empty-chat-state.tsx`)

When no messages exist in the current session:
1. **Dynamic Onboarding Headline & Subtitle:**
   - Adapts headline text to the active persona:
     - *General Assistant:* "What can I help you with?"
     - *ATS & Resume Coach:* "Let's improve your next application."
     - *Interview Prep Coach:* "Ready for your next interview?"
     - *Outreach Specialist:* "Let's draft high-impact networking outreach."
     - *Code Architect:* "Let's design something robust."
2. **Workspace Connection Chip:**
   - Displays real data metrics (`Connected to your workspace · 11 jobs, 4 resumes, 4 contacts, 2 repos`).
3. **Agent Persona Selector Pills:**
   - Horizontal pill selector for `General Assistant`, `ATS & Resume Coach`, `Interview Prep Coach`, `Outreach Specialist`, and `Code Architect`.
4. **Mini-Scenario Action Cards Grid:**
   - 4 prominent scenario cards:
     - `Resume Review` (Icons + description)
     - `Interview Prep`
     - `Cold Outreach`
     - `Code Review`
   - Clicking a scenario sets the optimal agent, connects relevant workspace context, inserts a starter prompt, and initializes the conversation.

---

## 4. Cross-Source Context Engine & Workspace Integration (`lib/ai-chatbot/workspace.ts`)

### 4.1 Connected Data Sources
- **Sources Supported:** Resume Database, Job Applications, Contacts/CRM, GitHub Repositories, Google Drive, Notion, LinkedIn, Email, Projects.
- **Workspace Drawer Component (`components/ai-chatbot/workspace-connection-drawer.tsx`):**
  - Shows connectivity status per source, total records, last sync timestamp, and toggle switches.
  - Allows user to enable/disable specific data sources from being injected into the AI context window.

### 4.2 Citation & Execution Drawer (`components/ai-chatbot/tool-execution-status.tsx`)
- **Generation Phase:** Displays real-time context retrieval steps:
  `Analyzing context... ✓ Resume ✓ Job Description ✓ GitHub Repos`
- **Post-Generation:** Shows collapsible `Sources used: Resume • Job Description • GitHub` badge under assistant responses, with clickable detail sheet to view grounding snippets.

---

## 5. Chat Composer & Response Streaming (`components/ai-chatbot/chat-input.tsx` & `chat-messages.tsx`)

### 5.1 Chat Composer (`components/ai-chatbot/chat-input.tsx`)
- **Textarea:** Auto-growing textarea handling `Enter` for send and `Shift + Enter` for line breaks.
- **Inline Controls Toolbar:**
  - `[Agent Selector ▾]` dropdown
  - `[Model Selector ▾]` dropdown
  - `[+ Attach / Context]` file & source picker
  - `[Tools / Web Search]` toggle
  - `[Send / Stop]` button with spinner during generation and stop button during streaming.
- **Attachment Preview Chips:** Drag-and-drop file upload with removable preview chips.

### 5.2 Conversational Messages (`components/ai-chatbot/chat-messages.tsx`)
- **Message Cards:** author icon/avatar, timestamp, formatted markdown content, syntax-highlighted code blocks with copy-to-clipboard buttons, tables, and lists.
- **Message Action Bar:** Copy text, Regenerate response, Edit message, Thumbs up/down feedback controls.
- **Continuity:** Retains conversation context when switching agents mid-session, showing a subtle system marker: `Switched to Interview Prep Coach`.

---

## 6. Model & Persona Configurations (`lib/ai-chatbot/sessions.ts`)

### 6.1 Available AI Models
- `Gemini 3.6 Flash` (Fast · Efficient)
- `GPT-4o` (General purpose · Multi-modal)
- `Claude 3.5 Sonnet` (Strong reasoning · Writing)
- `Local / Provider Fallback` (Configured in Settings)

### 6.2 Agent Personas
1. **General Assistant**: General career, productivity, & task assistance.
2. **ATS & Resume Coach**: Prioritizes resumes, job descriptions, skills, ATS keyword matching.
3. **Interview Prep Coach**: Prioritizes job specs, candidate experience, STAR format prep, behavioral questions.
4. **Outreach Specialist**: Prioritizes contacts, recruiters, company background, networking emails.
5. **Code Architect**: Prioritizes GitHub repositories, code snippets, system design, PR/code reviews.

---

## 7. Verification & Testing Plan

1. **Scenario Workflows:** Test scenario buttons (`Resume Review`, `Interview Prep`, `Cold Outreach`, `Code Review`) to verify agent switching, starter prompt insertion, and workspace grounding.
2. **Workspace Connection Drawer:** Verify enabling/disabling sources updates the context passed to `/api/chat`.
3. **Session Persistence:** Verify creating, renaming, filtering, switching, and deleting chat sessions persists in local storage / database.
4. **Responsive Layout:** Verify mobile sidebar drawer and compact controls on small viewports.
5. **Build & Type Checking:** Execute `npm run build` and `npm run lint` to guarantee clean compilation.

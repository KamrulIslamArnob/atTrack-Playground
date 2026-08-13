# AI Chatbot UI & Brand Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the AI Chatbot frontend to 100% atTrack brand design system compliance (Light & Dark themes, lime primary accents) and equip it with a full suite of power features: persona system prompts, slash command autocomplete, side-by-side artifact canvas, text-to-speech, collapsible reasoning, and chat export options.

**Architecture:** Refactor `app/(dashboard)/ai-builder/chatbot/page.tsx` and modularize `components/ai-chatbot/` components. Add `chat-persona-selector.tsx` and `chat-canvas.tsx`. Standardize state management in `lib/ai-chatbot/sessions.ts` and update `/api/chat` system prompt handling.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4 (atTrack brand design tokens), Lucide Icons, Framer Motion (`motion/react`), Sonner toasts.

## Global Constraints

- **Design Tokens:** Use semantic CSS variables (`bg-background`, `bg-card`, `bg-muted`, `border-border`, `text-foreground`, `--primary: #bef264` / `#a3e635`). No hardcoded `bg-neutral-900` or `bg-emerald-950`.
- **Radius Ladder:** `rounded-3xl` (Canvas/Dialogs), `rounded-2xl` (Input Card/Chat Bubbles), `rounded-xl` (Popovers/Dropdowns), `rounded-lg` (Buttons/Inputs), `rounded-full` (Pills/Badges).
- **Single-User / Zero-Auth:** Keep session storage local via `localStorage` helper functions in `lib/ai-chatbot/sessions.ts`.

---

### Task 1: Enhance Session Data Model & Export Utilities

**Files:**
- Modify: `lib/ai-chatbot/sessions.ts`

**Interfaces:**
- Consumes: Existing `ChatSession`, `Message`, `AIModel` types
- Produces: Updated `Message` with `thinking` and `personaId`, `ChatPersona` definitions, `exportSessionToMarkdown`, `exportSessionToJSON`

- [ ] **Step 1: Update `lib/ai-chatbot/sessions.ts` with persona definitions & export helpers**

Add `CHAT_PERSONAS` array and export utilities:

```typescript
export interface ChatPersona {
  id: string;
  name: string;
  badge: string;
  description: string;
  systemPrompt: string;
}

export const CHAT_PERSONAS: ChatPersona[] = [
  {
    id: "general",
    name: "General Assistant",
    badge: "Versatile",
    description: "All-purpose career, coding, and productivity assistant",
    systemPrompt: "You are AtTrack AI, a helpful, precise, and professional career & software engineering assistant.",
  },
  {
    id: "ats_coach",
    name: "ATS & Resume Coach",
    badge: "Resume",
    description: "Optimizes resumes, impact bullet points, and ATS match keywords",
    systemPrompt: "You are an elite Resume & ATS Optimization Specialist. Provide constructive, impact-driven bullet point enhancements, formatting advice, and keyword targeting.",
  },
  {
    id: "interviewer",
    name: "Interview Prep Coach",
    badge: "Interview",
    description: "Conducts STAR-method mock behavioral & technical interviews",
    systemPrompt: "You are a Senior Tech Hiring Manager conducting a realistic mock interview. Ask one question at a time using the STAR method and provide sharp feedback.",
  },
  {
    id: "outreach",
    name: "Outreach Specialist",
    badge: "Networking",
    description: "Drafts high-converting cold LinkedIn messages & recruiter emails",
    systemPrompt: "You are a Cold Outreach & Professional Networking Strategist. Draft concise, high-impact messages that get responses from recruiters and hiring managers.",
  },
  {
    id: "code_architect",
    name: "Code Architect",
    badge: "Code",
    description: "Reviews, refactors, and debugs code with modern TypeScript & React practices",
    systemPrompt: "You are a Principal Software Architect. Analyze code for performance, edge cases, type safety, and readability. Return clean markdown code blocks.",
  },
];

export function exportSessionToMarkdown(session: ChatSession): string {
  let md = `# ${session.title}\n\n`;
  md += `*Exported from AtTrack AI Chatbot on ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  session.messages.forEach((msg) => {
    const roleName = msg.role === "user" ? "User" : "AtTrack AI";
    md += `### ${roleName}\n${msg.content}\n\n`;
  });
  return md;
}

export function exportSessionToJSON(session: ChatSession): string {
  return JSON.stringify(session, null, 2);
}
```

- [ ] **Step 2: Commit Task 1**

```bash
git add lib/ai-chatbot/sessions.ts
git commit -m "feat(chatbot): add persona definitions and export utilities to sessions model"
```

---

### Task 2: Build `chat-persona-selector.tsx` Component

**Files:**
- Create: `components/ai-chatbot/chat-persona-selector.tsx`

**Interfaces:**
- Consumes: `CHAT_PERSONAS`, `ChatPersona` from `@/lib/ai-chatbot/sessions`
- Produces: `<ChatPersonaSelector selectedPersonaId={id} onSelectPersona={cb} />`

- [ ] **Step 1: Create `components/ai-chatbot/chat-persona-selector.tsx`**

Implement popover UI with atTrack design tokens (`bg-popover`, `border-border`, `rounded-xl` container, `rounded-lg` items).

- [ ] **Step 2: Commit Task 2**

```bash
git add components/ai-chatbot/chat-persona-selector.tsx
git commit -m "feat(chatbot): create persona selector dropdown component"
```

---

### Task 3: Build `chat-canvas.tsx` Side-by-Side Artifact Panel

**Files:**
- Create: `components/ai-chatbot/chat-canvas.tsx`

**Interfaces:**
- Consumes: `content: string | null`, `title?: string`, `onClose: () => void`
- Produces: `<ChatCanvas content={codeOrMarkdown} title={title} onClose={handleClose} />`

- [ ] **Step 1: Create `components/ai-chatbot/chat-canvas.tsx`**

Implement slide-over drawer with syntax highlight block, line numbers, copy button, and file download action (`rounded-3xl` outer shell).

- [ ] **Step 2: Commit Task 3**

```bash
git add components/ai-chatbot/chat-canvas.tsx
git commit -m "feat(chatbot): create side-by-side artifact preview canvas"
```

---

### Task 4: Overhaul `model-selector.tsx` and Fix Duplicated Badges

**Files:**
- Modify: `components/ai-chatbot/model-selector.tsx`

**Interfaces:**
- Consumes: `selectedModelId`, `onSelectModel`, `availableModels`
- Produces: Refactored model dropdown with brand design tokens and clean provider tags.

- [ ] **Step 1: Refactor `components/ai-chatbot/model-selector.tsx`**

Update styling from hardcoded dark green tint to atTrack `bg-popover border-border rounded-xl` and clean badge rendering (preventing `groq-qwen groq-qwen` duplication).

- [ ] **Step 2: Commit Task 4**

```bash
git add components/ai-chatbot/model-selector.tsx
git commit -m "fix(chatbot): align model selector popover with brand design tokens"
```

---

### Task 5: Refactor `empty-chat-state.tsx` Hero Screen

**Files:**
- Modify: `components/ai-chatbot/empty-chat-state.tsx`

**Interfaces:**
- Consumes: `onSelectPrompt`, `selectedPersonaId`, `onSelectPersona`
- Produces: Updated empty state with brand hero layout, persona picker cards, and category prompt buttons.

- [ ] **Step 1: Update `components/ai-chatbot/empty-chat-state.tsx`**

Use atTrack brand lime gradient (`.text-gradient-brand`, `.bg-gradient-brand`), semantic cards (`bg-card border-border rounded-2xl`), and interactive starter prompt pills.

- [ ] **Step 2: Commit Task 5**

```bash
git add components/ai-chatbot/empty-chat-state.tsx
git commit -m "style(chatbot): refactor empty state hero screen with brand gradients and persona cards"
```

---

### Task 6: Refactor `chat-session-sidebar.tsx` with Date Grouping & Brand Tokens

**Files:**
- Modify: `components/ai-chatbot/chat-session-sidebar.tsx`

**Interfaces:**
- Consumes: `sessions`, `activeSessionId`, `onSelectSession`, `onNewChat`, `onDeleteSession`, `onRenameSession`, `onTogglePinSession`, `onExportSession`
- Produces: Brand-aligned sidebar with date-grouped sections (Today, Yesterday, Previous 7 Days), search, and pinned notebooks.

- [ ] **Step 1: Refactor `components/ai-chatbot/chat-session-sidebar.tsx`**

Replace `bg-emerald-950` with atTrack tokens (`bg-card/80 border-r border-border`, active thread `bg-accent border-primary/30 text-accent-foreground`). Add thread date categorization logic.

- [ ] **Step 2: Commit Task 6**

```bash
git add components/ai-chatbot/chat-session-sidebar.tsx
git commit -m "style(chatbot): overhaul session sidebar with brand theme tokens and date grouping"
```

---

### Task 7: Refactor `chat-input.tsx` Floating Card & Add Slash Commands

**Files:**
- Modify: `components/ai-chatbot/chat-input.tsx`

**Interfaces:**
- Consumes: `input`, `onInputChange`, `onSubmit`, `isLoading`, `onStop`, `model`, `onSelectModel`, `availableModels`, `selectedPersona`, `onSelectPersona`
- Produces: Floating input card (`rounded-2xl bg-card/90 border-border/80 shadow-2xl`), slash command autocomplete menu (`/resume`, `/interview`, `/cold-email`, `/code`), voice recording, attachment strip.

- [ ] **Step 1: Refactor `components/ai-chatbot/chat-input.tsx`**

Replace hardcoded `bg-neutral-900` box with adaptive `bg-card border-border/80 shadow-xl rounded-2xl focus-within:ring-2 focus-within:ring-primary/40`. Add slash command popup popover when typing `/`.

- [ ] **Step 2: Commit Task 7**

```bash
git add components/ai-chatbot/chat-input.tsx
git commit -m "feat(chatbot): overhaul chat input card with brand tokens and slash commands popover"
```

---

### Task 8: Refactor `chat-messages.tsx` & Message Actions

**Files:**
- Modify: `components/ai-chatbot/chat-messages.tsx`

**Interfaces:**
- Consumes: `messages`, `isLoading`, `onRetry`, `onOpenCanvas`
- Produces: Brand message bubbles (`bg-primary text-primary-foreground` for user, `bg-card border-border` for assistant), markdown code block syntax highlighting, collapsible thinking accordion, text-to-speech play action, canvas pop-out trigger button.

- [ ] **Step 1: Refactor `components/ai-chatbot/chat-messages.tsx`**

Add text-to-speech (`window.speechSynthesis`), canvas trigger button when code/markdown is present, and collapsible `<details>` / Framer Motion accordion for reasoning text.

- [ ] **Step 2: Commit Task 8**

```bash
git add components/ai-chatbot/chat-messages.tsx
git commit -m "feat(chatbot): overhaul message stream with reasoning accordion, text-to-speech, and canvas trigger"
```

---

### Task 9: Update `/api/chat/route.ts` for Persona System Prompts

**Files:**
- Modify: `app/api/chat/route.ts`

**Interfaces:**
- Consumes: `messages`, `model`, `personaId`
- Produces: Streamed AI response with active persona system prompt injected.

- [ ] **Step 1: Update `app/api/chat/route.ts`**

Include persona system prompt in API request payloads to Google Gemini / OpenAI / Anthropic handlers.

- [ ] **Step 2: Commit Task 9**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chatbot): incorporate persona system prompts in chat API route"
```

---

### Task 10: Wire Layout & Verify in `app/(dashboard)/ai-builder/chatbot/page.tsx`

**Files:**
- Modify: `app/(dashboard)/ai-builder/chatbot/page.tsx`

**Interfaces:**
- Consumes: All updated subcomponents & session helpers
- Produces: Complete AI Chatbot page with side-by-side canvas, persona selector, header export options.

- [ ] **Step 1: Integrate all components in `page.tsx`**

Wire `canvasContent`, `selectedPersona`, export to Markdown/JSON, clear conversation, and layout header.

- [ ] **Step 2: Verify build**

Run: `npm run build` to confirm zero TypeScript / lint errors.

- [ ] **Step 3: Commit Task 10**

```bash
git add app/(dashboard)/ai-builder/chatbot/page.tsx
git commit -m "feat(chatbot): complete AI Assistant Studio page integration and layout"
```

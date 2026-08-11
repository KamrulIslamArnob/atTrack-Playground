# Resume Builder Interaction + Component Architecture Plan

> **Target**: Novoresume-style click-to-edit, inline rich editing, drag-reorder, live preview.
> **Constraint**: `ResumeDoc` schema stays unchanged. No migration. Ship incrementally.
> **Stack**: Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn-ui + base-ui, lucide icons, sonner toasts.

---

## 1. Component Tree

```
components/resume-builder/
├── resume-builder-editor.tsx        # REFACTOR — shell: state provider, two-pane layout, save/export bar
├── interactive/
│   ├── click-to-edit-field.tsx      # NEW — InlineEditor (contentEditable wrapper, click-to-activate)
│   ├── inline-rich-text.tsx         # NEW — RichTextEditor for summary/bullets (lightweight, no RTE dep)
│   ├── date-field.tsx               # NEW — Month/year picker for right2 dates
│   ├── draggable-section.tsx        # NEW — @dnd-kit wrapper for section + entry reordering
│   ├── entry-card.tsx               # NEW — Entry container with hover toolbar (move up/down, delete)
│   ├── hover-toolbar.tsx            # NEW — Floating action bar on entry hover (lucide icons)
│   ├── bullet-list-editor.tsx       # NEW — Replaces BulletEditor; inline-editable bullets + drag
│   └── validation-hint.tsx          # NEW — Inline error/warning under fields
├── sections/
│   ├── subheading-section.tsx       # REFACTOR — SubheadingSectionEditor → interactive entry cards
│   ├── project-section.tsx          # REFACTOR — ProjectSectionEditor → interactive entry cards
│   ├── skills-section.tsx           # REFACTOR — SkillsEditor → inline-editable rows
│   ├── header-section.tsx           # REFACTOR — Header fields → click-to-edit
│   └── appearance-section.tsx       # KEEP — AppearanceEditor unchanged (visual-only, no interaction)
└── [existing]
    └── (LinkGroup, Field, Visibility, ColorField, etc. — kept as internal helpers)
```

**Rules**:
- All interactive editing lives under `interactive/` — reusable across sections.
- Section editors (`sections/`) are thin composition layers; they pass `ResumeDoc` slices down.
- `resume-builder-editor.tsx` becomes the orchestrator: owns reducer state, keyboard shortcuts, auto-save timer.

---

## 2. State Management

### Where `ResumeDoc` lives

```
resume-builder-editor.tsx
  └── <ResumeProvider>              # Context + useReducer
        ├── HeaderSection
        ├── SubheadingSection (experience, education)
        ├── ProjectSection (projects, training, awards, certifications, leadership)
        ├── SkillsSection
        └── ResumePreview (consumer — reads from context)
```

### `useReducer` shape

```tsx
// lib/state/resume-builder-reducer.ts
interface ResumeBuilderState {
  doc: ResumeDoc;
  past: ResumeDoc[];      // undo stack (cap 50)
  future: ResumeDoc[];    // redo stack
  dirty: boolean;         // unsaved changes pending
  lastSavedAt: number | null;
}

type ResumeAction =
  | { type: "PATCH_HEADER"; payload: Partial<ResumeHeader> }
  | { type: "PATCH_SUBHEADING"; section: "experience" | "education"; id: string; payload: Partial<SubheadingEntry> }
  | { { type: "PATCH_PROJECT"; section: ProjectSection; id: string; payload: Partial<ProjectEntry> } }
  | { type: "PATCH_SKILLS"; payload: Partial<{ rows: SkillRow[]; callout: string }> }
  | { type: "PATCH_APPEARANCE"; payload: Partial<ResumeAppearance> }
  | { type: "REORDER_ENTRIES"; section: string; fromIndex: number; toIndex: number }
  | { type: "ADD_ENTRY"; section: string; entry: SubheadingEntry | ProjectEntry | SkillRow }
  | { type: "REMOVE_ENTRY"; section: string; id: string }
  | { type: "TOGGLE_VISIBILITY"; section: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; payload: ResumeDoc }
  | { type: "MARK_SAVED" };
```

### Undo/redo

- Every mutating action pushes current `doc` to `past` before applying.
- `UNDO`: pop `past` → push current to `future` → set `doc`.
- `REDO`: reverse.
- Cap stacks at 50 entries to bound memory.
- Keyboard: `Ctrl/Cmd+Z` = undo, `Ctrl/Cmd+Shift+Z` (or `Ctrl+Y`) = redo.

### Optimistic save

```tsx
// lib/hooks/use-resume-autosave.ts
function useResumeAutoSave(id: string, state: ResumeBuilderState) {
  // Debounced 800ms after last mutation
  // Calls saveResumeBuilderDocument(id, name, doc) via server action
  // On success: dispatch MARK_SAVED, toast "Saved"
  // On failure: toast.error(error.message), keep dirty=true
  // Manual save button still available (Ctrl/Cmd+S)
}
```

- Auto-save runs in a `useEffect` keyed on `state.doc` with 800ms debounce.
- Manual save (`Ctrl/Cmd+S`) skips debounce, saves immediately.
- Preview is always live from `state.doc` — no save needed to see changes.

---

## 3. Drag-and-Drop

### Library choice: `@dnd-kit`

| Concern              | @dnd-kit                        | Native HTML5 DnD            |
|----------------------|---------------------------------|----------------------------- |
| Accessibility        | Built-in keyboard sensor        | None — must hand-roll        |
| Touch support        | Yes (TouchSensor)               | No                           |
| Bundle size          | ~6kb gzipped                    | 0kb                          |
| React 19 compat      | Yes                             | Yes                          |

**Decision**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`.

### Implementation

```tsx
// components/resume-builder/interactive/draggable-section.tsx
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

// Wraps entries in a section. Each entry uses useSortable.
```

### Keyboard alternative (move up/down)

- **Hover toolbar buttons**: `ChevronUp` / `ChevronDown` lucide icons on each entry card.
- **Keyboard**: focus entry → `Alt+ArrowUp` / `Alt+ArrowDown` to reorder.
- **ARIA**: Each entry card has `aria-roledescription="sortable item"`, `aria-label="Entry N: [title]"`.

```tsx
// Inside entry-card.tsx
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); onMove(index, index - 1); }
  if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); onMove(index, index + 1); }
}
```

---

## 4. Inline Editing

### Click-to-edit pattern

```tsx
// components/resume-builder/interactive/click-to-edit-field.tsx
interface ClickToEditFieldProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
}
```

**Behavior**:
1. Display state: renders value as styled `<span>` with subtle hover bg (`hover:bg-muted/50`).
2. Click → activate: swaps to controlled `<input>` or `<Textarea>` (shadcn), auto-focuses.
3. Blur or `Enter` (single-line) → commit: call `onChange`, revert to display.
4. `Escape` → cancel: discard edits, revert to display.
5. `Tab` → commit + move to next field.

**DOM contract**:
```html
<!-- Inactive -->
<span
  role="button"
  tabIndex={0}
  aria-label="Full name: John Doe. Click to edit."
  className="cursor-text rounded px-1 -mx-1 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
  onActivate={handleActivate}  // click or Enter/Space
>
  John Doe
</span>

<!-- Active -->
<input
  aria-label="Edit full name"
  autoFocus
  defaultValue="John Doe"
  onBlur={commit}
  onKeyDown={handleKeydown}
/>
```

### Rich-text for summary/bullets

**No heavy RTE.** Use lightweight inline markup — the existing `lib/resume/inline.ts` grammar (`**bold**`, `*italic*`, `[live](url "label")`, etc.) is the source of truth.

```tsx
// components/resume-builder/interactive/inline-rich-text.tsx
interface InlineRichTextProps {
  value: string;          // raw markup string: "**Senior** Engineer"
  onChange: (value: string) => void;
  multiline?: boolean;
}
```

**Behavior**:
- Display mode: renders parsed `InlineNode[]` via `ResumeInline` (from `render-html.tsx`).
- Edit mode: `<Textarea>` with raw markup source.
- **Toolbar**: small floating bar above selection with B/I/separator buttons.
  - Bold: wrap selection with `**` `**`
  - Italic: wrap selection with `*` `*`
  - Separator: insert ` | `
  - Badge: dropdown to insert `[live](url "label")` template
- **Live preview**: split view — left textarea (source), right mini-preview (parsed).

```tsx
// Toolbar button pattern
function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  // update state, restore cursor
}
```

---

## 5. Date / Number Inputs

### Fields using date pickers

| Field                  | Component          | Format              |
|------------------------|--------------------|---------------------|
| `SubheadingEntry.right2` (experience) | `DateField` | "Jan 2023 – Present" or "Jan 2023 – Mar 2024" |
| `SubheadingEntry.right2` (education)  | `DateField` | "2018 – 2022" |
| `ProjectEntry.right` (awards, certs)   | `DateField` | "2024" or "Jun 2024" |

### `DateField` component

```tsx
// components/resume-builder/interactive/date-field.tsx
interface DateFieldProps {
  value: string;          // free-form text, parsed for hints
  onChange: (value: string) => void;
}
```

**Implementation**: Two `<select>` dropdowns (Month + Year) + "Present" checkbox.

- Month: Jan–Dec + empty (for year-only).
- Year: current year ± 10.
- "Present" checkbox → end date becomes "Present".
- Output: `"Jan 2023 – Present"`, `"2018 – 2022"`, `"Jun 2024"`.
- **Free-text override**: small "Custom" link switches to raw text input for edge cases (e.g., "Expected May 2025").

### Number fields

| Field                          | Constraints                |
|-------------------------------|----------------------------|
| `ResumeAppearance.fontSize`   | 8–14, step 0.5             |
| `ResumeAppearance.pageMargins`| 0.3–1.2in, step 0.05       |

Use shadcn `<Input type="number" min max step>`. Validate on blur, clamp to range, show validation-hint if out of bounds.

---

## 6. Accessibility Contract

### Roles and landmarks

```
<div role="region" aria-label="Resume editor">
  <section aria-label="Header">...</section>
  <section aria-label="Work Experience" aria-describedby="work-exp-desc">...</section>
  ...
</div>

<aside aria-label="Live preview" aria-live="polite">
  <ResumePreview />
</aside>
```

### ARIA live regions

| Region                   | Attribute                  | Purpose                              |
|--------------------------|----------------------------|--------------------------------------|
| Auto-save status         | `aria-live="polite"`       | "Saving…" / "Saved" / "Error"        |
| Validation errors        | `aria-live="assertive"`    | Field-level errors announced         |
| Preview pane             | `aria-live="polite"`       | Content changes on edit              |
| Entry count per section  | `aria-label="Work Experience, 3 entries"` | Section heading context |

### Keyboard handlers (global)

| Key                  | Action                                 |
|----------------------|----------------------------------------|
| `Ctrl/Cmd+S`         | Save immediately                       |
| `Ctrl/Cmd+Z`         | Undo                                   |
| `Ctrl/Cmd+Shift+Z`   | Redo                                   |
| `Escape`             | Cancel current edit, close any popover |
| `Tab` / `Shift+Tab`  | Move between fields                    |
| `Alt+ArrowUp`        | Move focused entry up                  |
| `Alt+ArrowDown`      | Move focused entry down                |
| `Ctrl+Enter`         | Add new entry to current section       |

### Focus management

- **Click-to-edit**: activating a field `autoFocus`es the input; blurring returns focus to the display span (which has `tabIndex={0}`).
- **Adding entry**: after `ADD_ENTRY`, auto-focus the first field of the new entry.
- **Removing entry**: focus moves to the previous entry (or section heading if first).
- **Modal dialogs** (badge picker): use shadcn `<Dialog>` with focus trap.
- **DnD keyboard**: `@dnd-kit`'s `KeyboardSensor` handles `Space` (pick up), `ArrowKeys` (move), `Space` (drop), `Escape` (cancel).

### Reduced motion

- Disable drag animations when `prefers-reduced-motion: reduce`.
- No parallax or transition effects on preview update.

---

## 7. Two-Pane Responsive Layout

### Breakpoints

```
< xl (1280px)     Stack vertically: editor on top, preview below (collapsed accordion)
≥ xl (1280px)     Side-by-side: editor (left, ~9fr) | preview (right, ~11fr, sticky)
≥ 1536px (2xl)    Wider preview, font-size controls visible without overflow
```

### Layout structure

```tsx
// resume-builder-editor.tsx (shell)
<div className="flex flex-col gap-5 xl:flex-row xl:gap-6">
  {/* Editor pane */}
  <div className="min-w-0 flex-1 space-y-4 xl:max-w-[60%] xl:overflow-y-auto xl:max-h-[calc(100vh-8rem)]">
    <HeaderSection />
    {SECTIONS.map(section => <SectionEditor key={section.key} />)}
  </div>

  {/* Preview pane */}
  <aside className="xl:sticky xl:top-4 xl:self-start xl:flex-1 xl:max-w-[40%]">
    <div className="rounded-2xl border border-border bg-muted/40 p-3 overflow-auto max-h-[calc(100vh-8rem)]">
      <ResumePreview document={state.doc} />
    </div>
  </aside>
</div>
```

### Mobile preview toggle

- Below `xl`: preview hidden by default.
- Floating action button (FAB) bottom-right: "Preview" toggle.
- Tapping expands preview as a full-screen `<Sheet>` (shadcn) or slide-over.
- Auto-close sheet on save.

### Preview scaling

- Preview renders at fixed `8.5in` width (print size).
- Container uses `transform: scale(calc(100vw / 8.5in * 0.9))` or container query to fit.
- Alternative: CSS `zoom` property on `.resume-preview` wrapper to fit pane width.

---

## 8. Visual Specs

### Empty / placeholder state

```html
<!-- Field placeholder (no value) -->
<span class="text-muted-foreground italic">Click to add name…</span>

<!-- Section empty state -->
<div class="rounded-xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
  No work experience yet.
  <button class="text-primary underline">Add first entry</button>
</div>
```

- Empty fields show muted-foreground placeholder text (e.g., "Click to add…").
- Empty sections show dashed-border empty state with CTA.
- First-time users see `seedResumeDoc()` data as example (existing behavior).

### Hover toolbar

```
┌─────────────────────────────────────────────────────────┐
│  [↕ drag]  [↑ move up]  [↓ move down]  [+]  [🗑 delete] │
│                                                         │
│  Entry content here…                                    │
└─────────────────────────────────────────────────────────┘
```

- Toolbar appears on entry hover (desktop) or focus-within (keyboard).
- Position: top-right of entry card, `absolute`, `opacity-0 group-hover:opacity-100`.
- Buttons: lucide `GripVertical` (drag handle), `ChevronUp`, `ChevronDown`, `Plus`, `Trash2`.
- Each button: `size="icon" variant="ghost"`, `aria-label` describing action.

### Validation hints

```html
<div class="flex items-center gap-1.5 text-xs text-destructive mt-1">
  <AlertCircle class="size-3.5" aria-hidden="true" />
  <span role="alert">Please enter a valid year (2010–2030).</span>
</div>
```

- Inline below field (not toast).
- Field border turns `border-destructive` on error.
- `role="alert"` triggers screen reader announcement.
- Errors clear on next valid input.

### Auto-save indicator

```
┌────────────────────────────────────────┐
│  [● Saved]          (idle, clean)      │
│  [◌ Saving…]        (pending write)    │
│  [● Saved • 2s ago] (just saved)       │
│  [✕ Error — retrying] (write failed)   │
└────────────────────────────────────────┘```

- Position: top of editor pane, sticky.
- Status values: `idle` | `dirty` | `saving` | `saved` | `error`.
- Uses `aria-live="polite"` so screen readers announce state changes.
- Sonner toast only on explicit save action or unrecoverable error.

---

## 9. Migration: No Schema Changes

### Invariants

- `ResumeDoc` interface in `lib/types/resume-builder.ts` — **unchanged**.
- `saveResumeBuilderDocument` action — **unchanged**.
- `getResumeBuilderDocument` action — **unchanged**.
- `ResumePreview` (`render-html.tsx`) — **unchanged** (reads `ResumeDoc`, outputs HTML).
- `renderResumeTex` (`.tex` export) — **unchanged** (reads `ResumeDoc`, outputs LaTeX).
- `parseInline` (`inline.ts`) — **unchanged** (shared grammar source of truth).

### What changes

| Layer        | Before                          | After                                |
|--------------|---------------------------------|--------------------------------------|
| Editor state | `useState<ResumeDoc>` + scattered setters | `useReducer` with undo/redo + context |
| Field editing| `<Input>` / `<Textarea>` always visible | Click-to-edit: display ↔ input toggle |
| Reordering   | Not supported                   | @dnd-kit + keyboard move             |
| Save         | Manual button only              | Auto-save + manual + dirty indicator |
| Bullets      | Always-visible `<Textarea>`     | Inline-editable + rich-text toolbar  |
| Dates        | Free-text `<Input>`             | Structured month/year selects        |

### Data flow (unchanged)

```
saveResumeBuilderDocument(id, name, ResumeDoc)
        ↓
  supabase builder_data jsonb column
        ↓
getResumeBuilderDocument(id) → ResumeDoc
        ↓
ResumePreview / renderResumeTex
```

No migration script. No column changes. Interactive layer is purely a UI concern.

---

## 10. Phased Build Order

### Phase 0 — Foundation (shippable: existing editor still works)

- [ ] Create `lib/state/resume-builder-reducer.ts` (reducer + types).
- [ ] Create `components/resume-builder/resume-builder-editor.tsx` wrapper that uses reducer but keeps existing field components.
- [ ] Add `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` undo/redo (functional even with old UI).
- [ ] Add auto-save hook with dirty indicator.
- [ ] **Ship**: undo/redo + auto-save working with existing form UI.

### Phase 1 — Click-to-edit core (shippable: inline editing live)

- [ ] Build `click-to-edit-field.tsx` (display ↔ input toggle).
- [ ] Build `inline-rich-text.tsx` (summary/bullets with toolbar).
- [ ] Replace `Field` usage in header + section editors with `ClickToEditField`.
- [ ] Replace `BulletEditor` with `BulletListEditor` using inline-rich-text.
- [ ] **Ship**: all fields are click-to-edit; rich-text toolbar for summary/bullets.

### Phase 2 — Reordering (shippable: drag + keyboard reorder live)

- [ ] Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- [ ] Build `draggable-section.tsx` and `entry-card.tsx` with hover toolbar.
- [ ] Wire `REORDER_ENTRIES` action into reducer.
- [ ] Add `Alt+ArrowUp/Down` keyboard reorder.
- [ ] Add `KeyboardSensor` for accessible DnD.
- [ ] **Ship**: entries reorderable by drag or keyboard.

### Phase 3 — Date pickers + polish (shippable: date UX complete)

- [ ] Build `date-field.tsx` (month/year selects + "Present" + custom override).
- [ ] Build `validation-hint.tsx` component.
- [ ] Add date pickers to `right2` fields and `ProjectEntry.right`.
- [ ] Add validation-hint for fontSize, year ranges, empty-required fields.
- [ ] **Ship**: structured date entry + inline validation.

### Phase 4 — Responsive + a11y hardening (shippable: production-ready)

- [ ] Implement responsive two-pane layout (stack <xl, side-by-side ≥xl).
- [ ] Add mobile preview Sheet/toggle.
- [ ] Add all ARIA roles, live regions, keyboard handlers per §6.
- [ ] Add `prefers-reduced-motion` handling.
- [ ] Screen reader test (VoiceOver / NVDA) + keyboard-only navigation test.
- [ ] **Ship**: accessible, responsive, production-ready.

### Phase 5 — Delight (optional, incremental)

- [ ] Entry card animations (layout shift on reorder via `@dnd-kit`).
- [ ] Template switcher (preserve content, change appearance preset).
- [ ] Section collapse/expand with animation.
- [ ] Export progress toast for large `.tex` generation.

---

## Appendix A: File Inventory (new vs modified)

### New files

| Path                                                                  | Purpose                               |
|-----------------------------------------------------------------------|---------------------------------------|
| `lib/state/resume-builder-reducer.ts`                                | Reducer + action types                |
| `lib/hooks/use-resume-autosave.ts`                                   | Debounced save hook                   |
| `lib/hooks/use-resume-keyboard.ts`                                   | Global keyboard shortcuts              |
| `components/resume-builder/interactive/click-to-edit-field.tsx`       | Click-to-edit field                   |
| `components/resume-builder/interactive/inline-rich-text.tsx`          | Rich-text toolbar + editor            |
| `components/resume-builder/interactive/date-field.tsx`                | Month/year date picker                |
| `components/resume-builder/interactive/draggable-section.tsx`         | @dnd-kit wrapper                      |
| `components/resume-builder/interactive/entry-card.tsx`                | Entry with hover toolbar              |
| `components/resume-builder/interactive/hover-toolbar.tsx`             | Floating action bar                   |
| `components/resume-builder/interactive/bullet-list-editor.tsx`        | Inline bullet editor                  |
| `components/resume-builder/interactive/validation-hint.tsx`           | Inline error display                  |
| `components/resume-builder/sections/subheading-section.tsx`           | Refactored subheading editor          |
| `components/resume-builder/sections/project-section.tsx`              | Refactored project editor             |
| `components/resume-builder/sections/skills-section.tsx`               | Refactored skills editor              |
| `components/resume-builder/sections/header-section.tsx`               | Refactored header editor              |

### Modified files

| Path                                    | Change                                              |
|-----------------------------------------|-----------------------------------------------------|
| `components/resume-builder/resume-builder-editor.tsx` | Shell: reducer provider, layout, save bar, keyboard |
| `lib/types/resume-builder.ts`           | **Unchanged** (reference only)                      |
| `lib/resume/render-html.tsx`            | **Unchanged** (reference only)                      |
| `lib/resume/inline.ts`                  | **Unchanged** (reference only)                      |
| `lib/actions/resume-builder.ts`         | **Unchanged** (reference only)                      |

---

## Appendix B: Interaction Contracts (quick reference)

### ClickToEditField

```
Props: { value, onChange, multiline?, placeholder?, ariaLabel, className? }
States: "display" | "editing"
Activation: click, Enter, or Space on display span
Commit: blur, Enter (single-line), Tab
Cancel: Escape
```

### EntryCard

```
Props: { entry, index, onMove(from, to), onDelete, onAddAfter, children }
Keyboard: Alt+ArrowUp (move up), Alt+ArrowDown (move down)
Hover: toolbar appears with drag handle, move, delete
Aria: role="group", aria-roledescription="entry", aria-label="Entry N: [title]"
```

### DateField

```
Props: { value, onChange }
Sub-state: { startMonth, startYear, endMonth, endYear, present, custom }
Output format: "Mon Year – Mon Year" | "Mon Year – Present" | "Year – Year"
Override: custom mode → raw text input
```

### InlineRichText

```
Props: { value, onChange, multiline? }
Toolbar: Bold, Italic, Separator, Badge dropdown
Display: parses via parseInline → ResumeInline
Edit: raw markup textarea + mini-preview side-by-side
```

---

*Plan version: 1.0 — Ready for implementation.*

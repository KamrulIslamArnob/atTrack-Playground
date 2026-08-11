# Resume Builder — Interactive Editor Prompt

**Status:** Implementation prompt for a Frontend Developer agent.
**Target file:** `components/resume-builder/resume-builder-editor.tsx` (replace the existing plain-form editor).
**Reference implementation:** [Novoresume](https://novoresume.com/) — click-to-edit blocks, inline rich text, drag-to-reorder, live preview.

---

## 0. Non-Negotiable Constraints

| Constraint | Rule |
|---|---|
| **Data shape** | `ResumeDoc` in `lib/types/resume-builder.ts` is **frozen**. Do not add, remove, or rename any field. The editor must read and write the exact same shape. |
| **Migration** | Zero migration. Existing `builder_data` JSON in the `documents` table must remain valid as-is. |
| **Multi-user / auth** | No change. Single-user, local-first, Supabase-backed via the existing `lib/actions/resume-builder.ts` server actions. |
| **Print / PDF** | `app/print/resume/[id]/page.tsx` and `lib/resume/render-tex.ts` are untouched. The editor must not break the print route or `.tex` export. |
| **Inline grammar** | `lib/resume/inline.ts` (`parseInline`, `InlineNode`) is the single source of truth for `**bold**`, `*italic*`, `[live](url "label")`, `[cat](label)`, ` · ` separators. The editor's rich-text mode must emit strings that this parser consumes — never bypass it. |
| **Stack** | Next.js 16, React 19, TypeScript (strict), Tailwind v4, shadcn/ui components only. No new npm dependencies without approval. |
| **Deliverable** | A single client component exported as `ResumeBuilderEditor` from `components/resume-builder/resume-builder-editor.tsx`, plus any sub-components colocated in `components/resume-builder/`. |

---

## 1. Layout & Panes

### 1.1 Two-Pane Desktop (≥`xl` / 1280px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Top bar (sticky) — document name · save indicator · action buttons  │
├────────────────────────────┬─────────────────────────────────────────┤
│                            │                                         │
│  LEFT: Interactive editor  │  RIGHT: Live preview                    │
│  (scrollable, ~55% width)  │  (sticky, letter-page 8.5in × 11in)     │
│                            │                                         │
└────────────────────────────┴─────────────────────────────────────────┘
```

- **Left pane** (`role="main"`): scrollable editor surface. All interactive blocks live here.
- **Right pane** (`role="complementary"`, `aria-label="Resume preview"`): renders `<ResumePreview document={resume} />` from `lib/resume/render-html.tsx`. Sticky at `top-4`, `self-start`.
- Grid: `xl:grid-cols-[minmax(0,1fr)_minmax(620px,1.1fr)]` (preserve existing proportions).

### 1.2 Single-Column Mobile (<`xl`)

- Stack vertically: editor first, preview below.
- Preview collapses into a toggleable "Preview" accordion (default: collapsed on mobile to save viewport).
- Top bar actions collapse into an overflow menu (`DropdownMenu` from shadcn).

### 1.3 Top Bar (sticky, full width)

Contains, left to right:

1. **Document name** — inline `<input>` (plain text), `aria-label="Document name"`. Updates `name` state on change (debounced 400ms before save).
2. **Save indicator** — status text + icon:
   - `Saved` (green check) — last save confirmed by server.
   - `Saving…` (spinner) — `useTransition` pending.
   - `Unsaved changes` (yellow dot) — dirty state, not yet saved.
   - `Error: <message>` (red) — server action rejected.
3. **Action buttons** (right-aligned):
   - `Save` — triggers `saveResumeBuilderDocument`. Disabled when no changes.
   - `Download .tex` — triggers `exportResumeBuilderTex`.
   - `Print / Save PDF` — `<Link href={`/print/resume/${id}`} target="_blank">`.

---

## 2. Interaction Model

### 2.1 Click-to-Edit Text Blocks

Every text field in the current form (`Field` component) becomes a **click-to-edit block**:

**Visual states:**

| State | Appearance |
|---|---|
| **Empty + not focused** | Dashed border, light background, placeholder text in italic muted color (e.g., "Click to add summary…"). |
| **Empty + focused** | Solid accent border, white background, blinking cursor, placeholder still visible until first keystroke. |
| **Has value + not focused** | No border, transparent background. Text rendered as-is. Hover: subtle `bg-muted/40` + 2px padding to signal editability. |
| **Has value + focused** | Solid accent border, white background, text selected if entering via Tab (see §5). |

**Behavior:**

- Click → focus. The block becomes a `<textarea>` (multi-line) or `<input>` (single-line) mounted in place.
- Click outside / Escape / Enter (single-line only) → commit, return to display mode.
- The component **must not** unconditionally render an `<input>` for every field. Inputs mount only on click (or programmatic focus). This is critical for performance with large resumes.

**Component contract:**

```tsx
interface ClickToEditProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  ariaLabel: string;
  className?: string;
  // When true, the block renders inline markup preview (see §2.3) instead of raw text.
  richText?: boolean;
}
```

### 2.2 Drag-to-Reorder

Applies to: entries within a section (experience entries, project entries, skill rows), and bullets within an entry.

**Drag handle:**

- A `⋮⋮` grip icon (`GripVertical` from `lucide-react`) at the left edge of each reorderable item.
- `aria-label="Drag to reorder <item description>"` (e.g., "Drag to reorder experience entry: Acme Inc").
- Visible on hover and when the item is focused (not permanently visible to reduce visual noise).

**Drag behavior:**

- Uses native HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). No external DnD library.
- Drag ghost: semi-transparent clone of the item.
- Drop indicator: a 2px accent-color line that appears between items showing where the drop will land.
- On drop: reorder array in state, then trigger auto-save (debounced).

**Keyboard alternative (accessibility — see §4):**

Each item also has `Move up` / `Move down` buttons (icon buttons, `aria-label="Move <item> up/down"`). These are always visible (not hover-dependent) so keyboard-only users can reorder without drag.

### 2.3 Rich-Text Inline Editing

For fields that support the inline grammar (`summary`, `right1`, `right2`, `left`, `right`, `note`, `bullets`, `callout`, `skill value`):

**Display mode (not focused):**
- Render the field value through `parseInline()` → `<ResumeInline>` (from `lib/resume/render-html.tsx`). The user sees formatted text with badges, bold, italic, separators — exactly as it will appear in the resume.

**Edit mode (focused):**
- Render a `<textarea>` showing the **raw markup string** (e.g., `**Led** a team of 5`).
- Below the textarea, a **mini toolbar** with:
  - `B` (bold) — wraps selection in `**…**`.
  - `I` (italic) — wraps selection in `*…*`.
  - `·` (separator) — inserts ` | ` at cursor.
  - `Badge` — dropdown to insert `[live](url "Label")`, `[repo](url "Label")`, `[api](url "Label")`, `[cred](url "Label")`, `[port](url "Label")`.
  - `Chip` — dropdown to insert `[cat](label)` or `[type](label)`.
- Toolbar buttons are `<button type="button">` with `aria-pressed` state.
- Selecting text and clicking `B` → wraps in `**`. If already bold, unwrap.

**Validation (inline, non-blocking):**

- After commit (on blur or Enter), run `parseInline(value)` in a try/catch.
- If the parser throws or returns unexpected nodes, show a subtle yellow warning icon (`AlertTriangle` from lucide) with `title="Some formatting could not be parsed"`. Do **not** block save.

### 2.4 Date Fields

Fields that represent dates (`right2` in subheading entries, `right` in project entries when it's a year/date):

- Render as a **month/year picker** when focused:
  - Two `<select>` dropdowns side by side: Month (Jan–Dec + "Present") and Year (current year down to 1950).
  - Store as a formatted string: `"Jan 2023"` or `"Present"`.
  - Allow free-text override: a small "Custom" link that swaps the selects for a plain `<input>`.
- Display mode: show the formatted string (no date styling if it's clearly not a date — e.g., "3.8 GPA" stays as text).

### 2.5 Number Inputs

`appearance.fontSize` (and any future numeric appearance field):

- Render as an `<input type="number">` with `min`, `max`, `step` attributes.
- Show a subtle `+` / `−` stepper button on hover.
- Live preview updates within 100ms of change (debounced state, not debounced save).

### 2.6 Color Pickers

Already implemented in the existing `ColorField` component. **Preserve as-is.** No changes needed.

---

## 3. Section Structure

### 3.1 Accordion Sections

Each resume section (`experience`, `skills`, `projects`, `education`, `training`, `awards`, `certifications`, `leadership`) is a collapsible accordion:

```tsx
<section aria-labelledby="<section>-heading">
  <h3 id="<section>-heading">
    <button aria-expanded={open} aria-controls="<section>-panel">
      {title}
      <ChevronDown className={open ? "rotate-180" : ""} />
    </button>
    <VisibilityToggle checked={visible} onChange={…} />  {/* preserve existing */}
  </h3>
  <div id="<section>-panel" role="region" hidden={!open}>
    {/* entries */}
  </div>
</section>
```

- Default open: `experience`, `skills`, `projects`, `education`. Others collapsed.
- Accordion state is **local to the session** (not persisted). Use `useState`.
- Only one section can be expanded at a time (optional — implement as "accordion" pattern, not "disclosure" pattern). When a new section opens, the previous one collapses.

### 3.2 Section Visibility Toggle

The existing `Visibility` checkbox (label: "Show section") is preserved. When unchecked:

- The section's entries are **not rendered** in `<ResumePreview>`.
- The accordion still shows but displays a muted "(hidden)" badge next to the title.
- The `SectionState.visible` boolean is written to `ResumeDoc` as before.

### 3.3 Adding / Removing Entries

- Each section has an `+ Add <item>` button at the bottom (`Button variant="outline" size="sm"`).
- New entries get `crypto.randomUUID()` as `id` (preserve existing pattern).
- Each entry has a `Remove` button (`Trash2` icon, `aria-label="Remove <description>"`).
- **Minimum of 0 entries** — sections can be empty. Show an empty-state message: "No <items> yet. Click '+ Add <item>' to get started."

---

## 4. Accessibility Contract

### 4.1 ARIA Roles & Labels

| Element | Role / Attribute |
|---|---|
| Editor pane | `role="main"`, `aria-label="Resume editor"` |
| Preview pane | `role="complementary"`, `aria-label="Resume preview"` |
| Section accordion header | `aria-expanded`, `aria-controls` pointing to panel `id` |
| Section panel | `role="region"`, `aria-labelledby` pointing to heading `id` |
| Click-to-edit block | `aria-label` describing the field (e.g., "Summary", "Organization for experience entry 1") |
| Drag handle | `aria-label="Drag to reorder <description>"`, `aria-describedby` pointing to instructions text |
| Move up/down buttons | `aria-label="Move <description> up"` / `"down"` |
| Save indicator | `role="status"`, `aria-live="polite"` |
| Validation error | `role="alert"`, `aria-live="assertive"` |
| Add/Remove buttons | `aria-label` with descriptive text |

### 4.2 Focus Management

- When an accordion opens, move focus to the first editable field inside the panel.
- When an entry is added, move focus to the first field of the new entry.
- When an entry is removed, move focus to the `+ Add <item>` button of that section (or the previous entry's first field if it was the last one).
- When a click-to-edit block commits (blur or Escape), return focus to the display-mode element that was clicked.
- **Focus trap:** none. The editor is a standard page, not a modal.

### 4.3 Keyboard Reorder (Alternative to Drag)

Each reorderable item has:

- `Move up` button — `aria-label="Move <description> up"`. Disabled if first.
- `Move down` button — `aria-label="Move <description> down"`. Disabled if last.

These buttons are **always visible** (not hover-gated) so they're reachable by Tab navigation and screen readers.

### 4.4 Screen-Reader Announcements

Use a visually-hidden `aria-live="polite"` region (single instance, global) to announce:

- "Section <title> expanded/collapsed"
- "Entry moved from position N to M"
- "Entry added to <section>"
- "Entry removed from <section>"
- "Saved" / "Saving…" / "Error: <message>"

---

## 5. Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl/Cmd + S` | Trigger save | Global (when editor focused) |
| `Tab` | Move to next editable field | Within editor |
| `Shift + Tab` | Move to previous editable field | Within editor |
| `Escape` | Cancel current edit, revert to last committed value | Within a focused click-to-edit block |
| `Enter` | Commit single-line edit, move focus to next field | Single-line `<input>` |
| `Ctrl/Cmd + Enter` | Commit multi-line edit | `<textarea>` |
| `Ctrl/Cmd + Z` | Undo | Global (see §6) |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo | Global (see §6) |
| `Delete` or `Backspace` on a focused entry's remove button | Remove entry | When remove button is focused |
| `Alt + ArrowUp` | Move current entry up | When inside a reorderable item |
| `Alt + ArrowDown` | Move current entry down | When inside a reorderable item |

**Implementation notes:**

- Keyboard shortcuts must **not** fire when focus is inside a native `<textarea>` (except `Escape`, `Ctrl/Cmd+Enter`, `Ctrl/Cmd+S`).
- `Ctrl/Cmd+S` must `preventDefault()` to avoid the browser's save dialog.
- Show a small "Keyboard shortcuts" `?` button in the top bar that opens a `Dialog` listing all shortcuts.

---

## 6. Undo / Redo Stack

### 6.1 Design

- Maintain a **history stack** of `ResumeDoc` snapshots (not diffs — full snapshots are acceptable for this data size).
- Stack size: **50 entries** maximum. Drop oldest when exceeded.
- Pointer: index into the stack. Undo decrements, redo increments.
- Any new action after an undo truncates the redo branch.

### 6.2 What Triggers a History Push

- Any committed change to `ResumeDoc` (field edit, add/remove entry, reorder, visibility toggle, appearance change).
- **Not** triggered by: focus changes, accordion open/close, drag hover (only the final drop).

### 6.3 What Does NOT Trigger History

- Drag hover state.
- Accordion expand/collapse.
- Preview-only state (appearance changes DO trigger history — they're part of the doc).

### 6.4 UI

- Two icon buttons in the top bar: `Undo` (`Undo2` icon) and `Redo` (`Redo2` icon).
- Disabled state when stack is exhausted.
- `aria-label` includes the description of the action that will be undone (e.g., "Undo: edit summary") if you can derive it; otherwise generic "Undo last change".

---

## 7. Auto-Save

### 7.1 Behavior

- After any state change, start a **1500ms debounce timer**.
- When the timer fires, call `saveResumeBuilderDocument(id, name, resume)` via `startTransition`.
- If another change resets the timer, the previous pending save is abandoned.
- Manual `Save` button click → save immediately (cancel pending debounce).

### 7.2 Indicator State Machine

```
[dirty] --(1500ms)--> [saving] --(server response)--> [saved] or [error]
   ^                                                        |
   └──────────────── (new change) ──────────────────────────┘
```

- `dirty`: yellow dot + "Unsaved changes"
- `saving`: spinner + "Saving…"
- `saved`: green check + "Saved <time ago>" (e.g., "Saved just now", "Saved 1 min ago")
- `error`: red X + "Error: <message>"

---

## 8. Visual Design Specifications

### 8.1 Empty-State Placeholders

```css
/* Conceptual — use Tailwind utilities */
border: 1px dashed hsl(var(--muted-foreground) / 0.4);
background: hsl(var(--muted) / 0.15);
color: hsl(var(--muted-foreground) / 0.6);
font-style: italic;
padding: 0.5rem 0.75rem;
border-radius: 0.5rem;
```

Text examples:
- Summary: "Click to write a 2-3 sentence professional summary…"
- Experience entry: "Click to add a work experience entry…"
- Skills: "Click to add a skill category…"

### 8.2 Hover Toolbar (for entries)

On hover over an entry card, reveal a toolbar at the top-right of the card:

- Drag handle (`GripVertical`)
- Move up / Move down (`ChevronUp` / `ChevronDown`)
- Remove (`Trash2`)

Toolbar has `bg-card` background with `border-border` border, `rounded-md`, `shadow-sm`.

### 8.3 Selection Outline

- Focused click-to-edit block: `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Focused entry card: `ring-2 ring-ring`.

### 8.4 Drag Affordance

- On `dragStart`: the dragged item gets `opacity-50`.
- Drop target area gets a 2px `bg-accent` line (above or below the target item, depending on drag direction).
- `dragOver` target gets `bg-accent/10` background highlight.

### 8.5 Validation States

| Condition | Visual | Message |
|---|---|---|
| `header.name` empty | Red border on name field | "Name is required" (below field, `role="alert"`) |
| `header.title` empty | Red border on title field | "Professional title is required" |
| URL field with invalid format | Yellow border | "URL should start with https://" |
| Date field with unparseable date | Yellow border | "Date format not recognized" |

Validation runs on blur (not on every keystroke). Errors are non-blocking — save still works.

---

## 9. Data Flow

```
User interaction
       │
       ▼
  setState (React)  ──►  ResumeDoc updated
       │                      │
       │                      ▼
       │               <ResumePreview document={resume} />
       │                      (live, no debounce)
       │
       ▼
  History stack push
       │
       ▼
  Debounce timer (1500ms)
       │
       ▼
  startTransition → saveResumeBuilderDocument(id, name, resume)
       │
       ▼
  Update save indicator
```

**Critical:** The preview updates on every keystroke (no debounce). The server save is debounced. History is pushed on commit (blur/Enter), not on every keystroke.

---

## 10. Component Breakdown

Suggested file structure (all in `components/resume-builder/`):

| File | Purpose |
|---|---|
| `resume-builder-editor.tsx` | Main component — layout, state, panes, top bar, keyboard shortcuts |
| `click-to-edit.tsx` | ClickToEdit component (§2.1) |
| `rich-text-toolbar.tsx` | Mini toolbar for rich-text fields (§2.3) |
| `date-picker.tsx` | Month/year date picker (§2.4) |
| `entry-card.tsx` | Wrapper for each entry with drag handle, move up/down, remove (§2.2, §8.2) |
| `section-accordion.tsx` | Accordion section wrapper (§3.1) |
| `live-region.tsx` | Visually-hidden `aria-live` region for screen-reader announcements (§4.4) |
| `use-resume-history.ts` | Custom hook for undo/redo stack (§6) |
| `use-auto-save.ts` | Custom hook for debounced save + indicator state (§7) |

Existing files to **reuse without modification**:
- `lib/resume/render-html.tsx` — `<ResumePreview>`.
- `lib/resume/inline.ts` — `parseInline`, `InlineNode`.
- `lib/actions/resume-builder.ts` — `saveResumeBuilderDocument`, `exportResumeBuilderTex`.
- `lib/types/resume-builder.ts` — all types.

---

## 11. Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| User closes tab with unsaved changes | `beforeunload` event fires if `dirty` is true. Show browser-native confirmation dialog. |
| Server save fails | Show error in save indicator. Keep dirty state. Retry on next change or manual Save. |
| Rapid typing in a field | Preview updates immediately. History pushes on blur. Save debounces. |
| Dragging an entry onto itself | No-op. |
| Removing the last entry in a section | Show empty-state message. Section still renders (if visible) with zero entries. |
| Empty document (no seed data) | All sections show empty-state placeholders. Name field shows "Untitled resume". |
| Very long bullet text | `<textarea>` grows with content (`field-sizing: content` or equivalent). Max height 300px, then scroll. |
| Paste into rich-text field | Paste raw markup. If paste contains HTML, strip to plain text (no HTML parsing). |
| `Ctrl/Cmd+Z` with empty undo stack | No-op, button disabled. |

---

## 12. Performance Requirements

- **First paint:** Editor pane must render within 500ms of component mount (even with 50+ entries).
- **Typing latency:** <16ms from keystroke to preview update (60fps).
- **Drag feedback:** Drop indicator must update within one frame of `dragOver`.
- **History snapshots:** Each `ResumeDoc` snapshot is ~2-5KB. 50 entries = ~250KB max. Acceptable.

---

## 13. Out of Scope (Do Not Implement)

- Multi-user collaboration or real-time sync.
- Authentication changes.
- New server actions or API routes.
- Print layout changes.
- LaTeX export changes.
- New database schema or migrations.
- Mobile-native gestures (pinch, swipe).
- AI-generated content suggestions.
- Export to PDF directly (the print route already handles this via browser print dialog).
- Import from LinkedIn or other formats.

---

## 14. Acceptance Criteria

The implementation is complete when:

1. [ ] Every text field in the editor is click-to-edit (not a permanently rendered input).
2. [ ] Entries can be reordered via drag-and-drop AND via move up/down buttons.
3. [ ] Rich-text fields show formatted preview in display mode and raw markup in edit mode.
4. [ ] The live preview updates on every keystroke without debounce.
5. [ ] Auto-save fires 1500ms after the last change; manual save works immediately.
6. [ ] Undo/redo works for all document mutations (50-step stack).
7. [ ] All keyboard shortcuts in §5 work as specified.
8. [ ] The page is fully keyboard-navigable (Tab order is logical, all interactive elements reachable).
9. [ ] Screen-reader announcements fire for section expand/collapse, entry add/remove, reorder, and save state.
10. [ ] Validation errors appear on blur for required fields and URL format.
11. [ ] Mobile (<`xl`) layout stacks editor above preview with collapsible preview toggle.
12. [ ] Existing `ResumeDoc` shape is unchanged; existing saved documents load and save correctly.
13. [ ] Print route (`/print/resume/[id]`) and `.tex` export still work with no changes.
14. [ ] No new npm dependencies added.
15. [ ] TypeScript compiles with zero errors under `strict` mode.

---

## 15. Implementation Order (Suggested)

1. Layout shell: top bar, two-pane grid, mobile stack.
2. `ClickToEdit` component — single-line and multi-line.
3. Wire existing `ResumePreview` into the right pane.
4. `SectionAccordion` with visibility toggle.
5. `EntryCard` with add/remove.
6. Drag-and-drop reorder.
7. Move up/down keyboard alternative.
8. Rich-text toolbar + `parseInline` integration.
9. Date picker component.
10. Undo/redo hook.
11. Auto-save hook + indicator.
12. Keyboard shortcuts.
13. ARIA labels, focus management, live region.
14. Validation states.
15. Empty-state placeholders and polish.
16. Edge cases (§11) and performance pass.

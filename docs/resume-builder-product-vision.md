# Editable Resume Template — Product Vision & UX

> **Product**: Aven Resume Builder
> **Reference**: Novorésumé (click-to-edit, inline rich text, drag-reorder, live preview)
> **Status**: Implementation-ready

---

## 1. Product Vision

### What it is
A local-first, privacy-respecting resume editor that feels like a modern SaaS product (Novorésumé, Yobs, Reactive Resume) but stores everything locally in SQLite. No accounts, no cloud lock-in, no AI training on your data.

### Who it's for
- **Primary**: Tech professionals (SDE, Full-Stack, ML/AI) who want full control over their resume layout and content
- **Secondary**: Students & job seekers who want to maintain multiple resume versions for different roles
- **Differentiator vs Novorésumé**: 100% local data, LaTeX export, no subscription walls, keyboard-first workflow

### Core differentiators
1. **Local-first**: All data in SQLite, no server dependency for core editing
2. **LaTeX-faithful**: Export to `.tex` that compiles identically to the on-screen preview
3. **Keyboard-first**: Every action doable without a mouse (Alt+Arrows for reorder, Tab for navigation)
4. **UndoTurbo**: 50-step undo stack with full snapshots
5. **Privacy**: No telemetry, no accounts, no data leaves the machine

---

## 2. User Personas

### Persona A: "Power User Kamrul"
- Knows what he wants on his resume
- Wants to reorder sections by dragging
- Types fast, hates clicking "edit" buttons
- Uses keyboard shortcuts for everything
- Exports to LaTeX for Overleaf compilation

### Persona B: "Quick Apply Fatima"
- Has a base resume, tailors it per application
- Clicks into fields, types, moves on
- Wants live preview to look exactly like the PDF
- Saves multiple versions for different job types
- Uses print-to-PDF for final output

### Persona C: "Student Ravi"
- Building his first resume
- Needs guidance on what to write
- Uses the seed data as a starting point
- Experiments with appearance (colors, fonts)
- Exports to .tex for academic applications

---

## 3. User Journey

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ENTRY                                                     │
│    User clicks "Build from template" on /documents          │
│    → New document created with seedResumeDoc()               │
│    → Redirect to /documents/builder/[id]                     │
├─────────────────────────────────────────────────────────────┤
│ 2. ORIENT                                                    │
│    Two-pane layout: editor (left) + live preview (right)     │
│    Top bar: doc name, save indicator, action buttons         │
│    All sections collapsed except "Document and heading"      │
├─────────────────────────────────────────────────────────────┤
│ 3. EDIT HEADER                                               │
│    Click "Full name" → inline input appears                  │
│    Type → preview updates instantly                          │
│    Tab → move to next field                                  │
│    Add/remove links via "Add link" button                    │
├─────────────────────────────────────────────────────────────┤
│ 4. EDIT EXPERIENCE                                           │
│    Click "Work experience" accordion → expands               │
│    Click organization name → inline input                     │
│    Click date field → month/year picker appears               │
│    Hover entry → toolbar appears (drag, move up, delete)     │
│    Drag entry to reorder → drop indicator shows target       │
│    Alt+ArrowUp → move entry up (keyboard alternative)        │
│    Type bullets → rich-text toolbar for bold/italic/badge     │
├─────────────────────────────────────────────────────────────┤
│ 5. TAILOR SECTIONS                                           │
│    Toggle visibility per section (eye icon)                   │
│    Reorder entries within each section                       │
│    Add new entries with "+ Add experience" button            │
│    Delete entries with trash icon                            │
├─────────────────────────────────────────────────────────────┤
│ 6. CUSTOMIZE APPEARANCE                                      │
│    Expand "Resume appearance" accordion                      │
│    Change font family, size, colors                          │
│    All changes reflect instantly in preview                  │
├─────────────────────────────────────────────────────────────┤
│ 7. SAVE                                                      │
│    Ctrl+S or "Save resume" button                           │
│    Auto-save fires 1500ms after last change                  │
│    Save indicator: dirty → saving → saved                    │
├─────────────────────────────────────────────────────────────┤
│ 8. EXPORT                                                    │
│    "Print / Save PDF" → opens print route in new tab         │
│    "Download .tex" → downloads LaTeX source                  │
│    Browser print dialog → save as PDF                        │
├─────────────────────────────────────────────────────────────┤
│ 9. EXIT                                                      │
│    If dirty changes → beforeunload confirmation              │
│    Navigate back to /documents                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Interaction Model Summary

| Interaction | Behavior |
|---|---|
| Click field | Activate inline input (click-to-edit) |
| Click empty area | Show dashed placeholder "Click to add…" |
| Hover entry | Reveal toolbar (drag, move, delete) |
| Drag entry | Reorder with drop indicator |
| Alt+ArrowUp/Down | Move focused entry |
| Ctrl+Z / Ctrl+Shift+Z | Undo / Redo |
| Ctrl+S | Save immediately |
| Escape | Cancel edit, revert |
| Tab | Commit + next field |
| Ctrl+Enter | Commit multiline |

---

## 5. State Machine

```
[Editor State]
  ├── doc: ResumeDoc              # current document
  ├── history: ResumeDoc[]        # undo stack (max 50)
  ├── future: ResumeDoc[]         # redo stack
  ├── dirty: boolean              # unsaved changes
  ├── saveStatus: idle|dirty|saving|saved|error
  └── pendingSave: Timeout|null   # debounce timer

[Per-field State (ClickToEdit)]
  ├── value: string               # current value
  ├── isActive: boolean           # editing mode
  └── initialValue: string        # for Escape revert

[Per-section State]
  ├── isOpen: boolean             # accordion expanded
  └── isDragging: boolean         # drag in progress
```

---

## 6. Data Flow

```
User types in field
  → onChange(value)
  → setDoc(updateResumeDoc(doc, path, value))
  → Preview re-renders immediately (no debounce)
  → Save debounce timer resets (1500ms)
  → History stack NOT pushed (only on commit/blur)

User blurs field (commits)
  → pushHistory(doc)  # snapshot for undo
  → Reset redo stack
  → dirty = true
  → Start save debounce

Save debounce fires (1500ms)
  → saveStatus = "saving"
  → await saveResumeBuilderDocument(id, name, doc)
  → saveStatus = "saved" or "error"
```

---

## 7. Accessibility Requirements

- All interactive elements keyboard-reachable
- ARIA live regions for: save status, section expand/collapse, entry add/remove
- Focus management: new entry → focus first field; removed entry → focus add button
- prefers-reduced-motion: disable drag animations
- Color contrast ≥ 4.5:1 for all text

---

## 8. Performance Budgets

- First paint: < 500ms (even with 50+ entries)
- Typing latency: < 16ms (60fps preview update)
- Drag feedback: < 1 frame drop indicator update
- History: 50 snapshots × ~5KB = ~250KB max

---

*Vision version: 1.0 — Aligned with docs/resume-builder-interaction-plan.md and docs/resume-builder-interactions-prompt.md*

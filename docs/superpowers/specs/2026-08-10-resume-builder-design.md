# Resume Builder — LaTeX-faithful template editor

Date: 2026-08-10
Status: Approved

## Problem

`/documents` (Resume/CV) only accepts uploaded PDFs. The user maintains a hand-tuned
LaTeX resume (`resume-template-reference.tex` in this directory) and wants to author it
inside AtTrack instead of an external editor, without losing the template's exact look.

## Decisions

| Question | Decision |
|---|---|
| Output | HTML/CSS replica for editing + preview, PDF export into storage, **and** `.tex` export for byte-exact pdflatex compilation |
| Seed | Pre-filled with the user's real content from the reference `.tex` |
| Bullet authoring | Markdown-ish inline tokens, one parser feeding both renderers |
| Sections | The template's 8, fixed order, each with a `visible` toggle. No rename, no reorder, no custom sections |
| Storage | New `documents.builder_data` JSON column — a built resume *is* a `documents` row |
| PDF | Electron IPC → `webContents.printToPDF` on a chrome-free print route. No new npm dependency |

Explicitly not built: section reorder/rename, multiple templates, in-app LaTeX
compilation, PDF-to-builder import.

## Architecture

```
lib/types/resume-builder.ts   ResumeDoc — the single data shape
lib/resume/seed.ts            the user's content as a ResumeDoc
lib/resume/inline.ts          parseInline(src) -> InlineNode[]     <- the anti-drift seam
lib/resume/render-tex.ts      ResumeDoc -> .tex string (verbatim preamble + generated body)
lib/resume/render-html.tsx    ResumeDoc -> React tree (preview AND print route)
lib/resume/plain-text.ts      ResumeDoc -> plain text (feeds documents.content / AI matching)
app/resume.css                document-only stylesheet, forced light, Letter geometry
app/print/resume/[id]/page.tsx    chrome-free render target for printToPDF
app/(dashboard)/documents/builder/[id]/page.tsx   two-pane editor
lib/actions/resume-builder.ts     create / get / save / savePdf / exportTex
electron/preload-main.js + main.js  printToPDF bridge
```

`parseInline` is the load-bearing seam: HTML and LaTeX both consume its node array, so a
formatting feature cannot exist in one renderer and not the other.

## Data flow

**Create** — `/documents` → "Build from template" → `createBuiltResume()` inserts a
`documents` row (`type='resume'`, `builder_data` = seed, `content` = plain-text flatten,
`file_path=''`) → redirect to the editor.

**Edit** — editor holds `ResumeDoc` in React state; debounced `saveBuiltResume` writes
`builder_data` + refreshed `content`. Preview re-renders from the same state, so it is
never stale relative to the form.

**Export PDF** — `window.attrack.printResumePdf(id)` → main process opens a hidden
`BrowserWindow` on `/print/resume/<id>` → `printToPDF` → base64 → `saveRenderedPdf`
writes `.data/storage/documents/<userId>/...` and sets `file_path`. Then, and only then,
`recalculateAllMatchScores` runs (it is N jobs × M resumes of Gemini calls — never on
autosave).

**Export .tex** — `exportTex(id)` returns a string; the client downloads it as a Blob.

## Error handling

- No `window.attrack` (browser dev) → open the print route in a new tab and call
  `window.print()`; toast explains the PDF is not saved into the library in this mode.
- `printToPDF` rejection → toast with the message, `file_path` untouched.
- A `documents` row whose `builder_data` is NULL is an uploaded PDF; the editor route
  404s rather than seeding over it.
- Autosave failure → toast, state preserved, retry on the next edit. No silent loss.

## Testing

No test framework in this repo (per CLAUDE.md). Following the existing `lib/db/selfcheck.ts`
convention, each pure module ships one runnable assert-based self-check:

- `lib/resume/inline.selfcheck.ts` — grammar, escaping, malformed input
- `lib/resume/render-tex.selfcheck.ts` — emitted body against reference `.tex` fragments
- `node --experimental-strip-types <file>` runs them (same as `node lib/db/selfcheck.ts`)

Whole-feature verification: `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus a
manual pass in `npm run dev` (seed, edit, both exports).

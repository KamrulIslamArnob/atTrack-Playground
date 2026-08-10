# Implementation Plan — Resume Builder (LaTeX template)

Spec: `docs/superpowers/specs/2026-08-10-resume-builder-design.md`
Reference template: `docs/superpowers/specs/resume-template-reference.tex` (**read this file — it is the visual and structural source of truth**)

## Global Constraints

These bind every task. Violating one is a defect regardless of what a task says.

1. **Repo conventions** — `CLAUDE.md` and `DESIGN.md` at repo root govern. Read them.
   Notably: `"use server"` files may only export async functions (never a type);
   domain types live in `lib/types/*`; every query against a user-owned table carries
   `.eq("user_id", userId)`; the radius ladder in `DESIGN.md` (a child is always at
   least one tier below its container).
2. **No new npm dependencies.** Everything needed is installed: `lucide-react`,
   `next/font/google`, `sonner`, shadcn primitives under `components/ui/`, `zod`.
3. **The resume document surface is always light.** It reproduces a printed page. It
   must not respond to the app's dark mode. Hard-code the template hex values; set
   `color-scheme: light` on the document root. App chrome around it (editor form,
   toolbar) *does* follow the app theme normally.
4. **Exact template colors** — use these hex values verbatim, no substitutes:

   | Token | Hex | Role |
   |---|---|---|
   | `cvDarkGrey` | `#333333` | section titles, rules, meta text, separators |
   | `wdOrange` | `#FF6600` | the name in the header, AI callout border/icon |
   | `wdDarkOrange` | `#CC5200` | `roundbtn`/`repobtn` border+text, `categorybtn` text |
   | `aiLight` | `#FFF8F2` | `contactbtn`/`roundbtn`/`repobtn`/`categorybtn` fill, AI callout fill |
   | `wdLightGreen` | `#E8F5E9` | `livebtn` fill |
   | `wdDarkGreen` | `#2E7D32` | `livebtn` border+text |
   | `apiLight` | `#F3E5F5` | `apibtn` fill |
   | `apiDark` | `#6A1B9A` | `apibtn` border+text |
   | `portLight` | `#FFE0CC` | `portbtn` fill |
   | `portDark` | `#B34700` | `portbtn` border+text |
   | body text | `#000000` | black, per `\color{black}` |

5. **Exact page geometry**, derived from the reference's `\addtolength` calls:
   Letter 8.5in × 11in, **0.5in padding on all four sides**, 7.5in content width,
   10in content height. Base font size **11pt**.
6. **Exact LaTeX 11pt size ladder** (use these in CSS, in `pt`):
   `tiny 6` · `scriptsize 8` · `footnotesize 9` · `small 10` · `normalsize 11` ·
   `large 12` · `Large 14.4` · `LARGE 17.28` · `huge 20.74` · `Huge 24.88`
7. **Fixed section order**, never reordered or renamed:
   Work Experience → Skills → Projects → Education → Professional Training →
   Honors & Awards → Certifications → Leadership.
8. **`documents.status`-style derived-field discipline**: `jobs.status` is derived and
   must never be written from app code. This feature does not touch `jobs.status`.
9. **UI quality bar** (from the ui-ux-pro-max rule set, all binding on Task 7):
   - Every input has a **visible `<label>`**, never placeholder-only.
   - Icon-only buttons carry `aria-label`.
   - Interactive targets ≥ 44×44px effective hit area, ≥ 8px apart.
   - Async buttons disable and show a spinner while running; success/failure both
     produce a toast (`sonner`, already wired).
   - Transitions 150–300ms, `transform`/`opacity` only, wrapped so
     `prefers-reduced-motion: reduce` disables them.
   - Visible focus ring on every interactive element; tab order matches visual order.
   - Body copy ≥ 14px in app chrome; no horizontal page scroll at 375px.
   - Spacing on a 4/8px scale. Dense-dashboard rhythm (8/12/16/24/32), matching the
     rest of the app.
   - Long forms auto-save (this one does); destructive actions confirm first.
10. **Self-checks over frameworks.** There is no test runner in this repo. Pure modules
    get one runnable assert-based self-check file, run the same way `lib/db/selfcheck.ts`
    is run (`node lib/resume/<name>.selfcheck.ts`). Do not add a test framework.
11. **Verification before reporting DONE**: `npx tsc --noEmit` and `npm run lint` must
    pass clean for the files you touched. Report the actual command output.

---

## Task 1: Data layer, types, and seed content

**Goal.** Add the storage column and define `ResumeDoc` — the shape every later task
consumes — plus the user's real resume content as the seed value.

### 1a. Database column (three files, all required — see CLAUDE.md)

- `lib/db/schema.sql` — add `builder_data TEXT,          -- JSON: resume-builder document, NULL for uploaded PDFs` to the `documents` CREATE TABLE, next to `match_data`.
- `lib/db/sqlite.ts` — append to `COLUMN_MIGRATIONS`:
  `{ table: "documents", column: "builder_data", ddl: "ALTER TABLE documents ADD COLUMN builder_data TEXT" }`
- `lib/db/meta.ts` — add `"builder_data"` to `JSON_COLUMNS.documents`.

`schema.sql` alone does nothing to an existing database; `COLUMN_MIGRATIONS` is what
reaches one. Both are required.

Also relax `documents.file_path`: a built resume has no file until its first PDF export.
Do **not** change the column definition (it is `NOT NULL` and existing databases keep it);
instead the create action writes `''`. Note this in a comment where the type is defined.

### 1b. `lib/types/resume-builder.ts`

Plain types only, no runtime code. Exact shape:

```ts
export type BadgeKind = "live" | "repo" | "api" | "cred" | "port";
export type ChipKind = "cat" | "type";
export type ContactIcon = "github" | "linkedin" | "mappin" | "envelope" | "phone" | "globe";

/** A pill in the header. `variant` picks the LaTeX macro: portbtn vs contactbtn. */
export interface ResumeLink {
  id: string;
  variant: "port" | "contact";
  icon: ContactIcon;
  label: string;
  /** Absent -> rendered as a plain pill with no link (e.g. the "Dhaka" location pill). */
  url?: string;
}

export interface ResumeHeader {
  name: string;
  title: string;
  summary: string;
  /** Right side of row 1 (next to the name). */
  topLinks: ResumeLink[];
  /** Right side of row 2 (next to the job title). */
  bottomLinks: ResumeLink[];
}

/** Maps to \resumeSubheading{left1}{right1}{left2}{right2}. Used by Experience + Education. */
export interface SubheadingEntry {
  id: string;
  left1: string;   // org / school      — bold black
  right1: string;  // meta / GPA        — bold dark grey, inline-parsed
  left2: string;   // role / degree     — italic small
  right2: string;  // dates             — italic small
  bullets: string[];  // inline-parsed
}

/** Maps to \resumeProjectHeading{left}{right}. Used by Projects, Training, Awards,
 *  Certifications, Leadership. */
export interface ProjectEntry {
  id: string;
  left: string;    // inline-parsed
  right: string;   // inline-parsed (badges, or a year)
  bullets: string[];  // inline-parsed
  /** Unbulleted small paragraph under the heading (\item[] in the reference).
   *  Only Professional Training uses it. */
  note?: string;
}

export interface SkillRow {
  id: string;
  label: string;   // "Languages & Frameworks"
  value: string;   // inline-parsed, may contain [cat](...) chips
}

export interface SectionState { visible: boolean }

export interface ResumeDoc {
  header: ResumeHeader;
  experience:     SectionState & { entries: SubheadingEntry[] };
  skills:         SectionState & { rows: SkillRow[]; callout: string };
  projects:       SectionState & { entries: ProjectEntry[] };
  education:      SectionState & { entries: SubheadingEntry[] };
  training:       SectionState & { entries: ProjectEntry[] };
  awards:         SectionState & { entries: ProjectEntry[] };
  certifications: SectionState & { entries: ProjectEntry[] };
  leadership:     SectionState & { entries: ProjectEntry[] };
}

/** Fixed order + display titles. Never reordered or renamed. */
export const SECTION_ORDER = [
  ["experience",     "Work Experience"],
  ["skills",         "Skills"],
  ["projects",       "Projects"],
  ["education",      "Education"],
  ["training",       "Professional Training"],
  ["awards",         "Honors & Awards"],
  ["certifications", "Certifications"],
  ["leadership",     "Leadership"],
] as const;
```

`SECTION_ORDER` is a const, so this file is `lib/types/resume-builder.ts` with a value
export — that is fine (it is not a `"use server"` file).

### 1c. `lib/resume/seed.ts`

`export function seedResumeDoc(): ResumeDoc` — returns a **fresh** object each call
(never a shared mutable singleton), with `id`s from `crypto.randomUUID()`.

Content comes verbatim from `docs/superpowers/specs/resume-template-reference.tex`,
translated into the inline grammar defined in Task 2. Translation rules:

- `\textbf{X}` → `**X**`; `\emph{X}` / `\textit{X}` → `*X*`
- `\textcolor{cvDarkGrey}{$|$}` → ` | ` (space-pipe-space)
- `\href{URL}{\livebtn{Label}}` → `[live](URL "Label")`; same for `repo`/`api`/`cred`/`port`
  (`\roundbtn` → `cred`, `\repobtn` → `repo`, `\apibtn` → `api`, `\portbtn` → `port`)
- `\categorybtn{X}` → `[cat](X)`; `\typebtn{X}` → `[type](X)`
- `\&` → `&`, `\%` → `%`, `\#` → `#`, `\_` → `_`, `$\sim$` → `~`
- `` ``X'' `` → `"X"`
- `\textbf{--}` in a date range → `–` (U+2013 en dash)
- `\hspace{Npt}` between a badge and text → a single space
- Inside a `\resumeProjectHeading` left arg, the literal `|` characters inside an
  `\emph{...}` tech list (e.g. `\emph{LangChain | LangGraph | Python}`) are **plain
  pipes inside one italic run**, not separators. Keep them as `*LangChain | LangGraph | Python*`
  — the ` | ` separator rule only applies outside emphasis markers, and Task 2's parser
  must honour that (see Task 2).

All 8 sections start `visible: true`. Expected counts, as a completeness check:
1 experience entry (3 bullets), 6 skill rows + 1 callout, 3 projects (1 bullet each),
3 education entries (2 bullets on the first, 0 on the other two), 1 training entry
(note, no bullets), 4 awards, 3 certifications, 5 leadership entries.

Header: name `Kamrul Islam Arnob`, title `Software Engineer`, the summary paragraph
verbatim; `topLinks` = Portfolio (port/globe, https://arnob.codes), GitHub
(contact/github), LinkedIn (contact/linkedin), Dhaka (contact/mappin, **no url**);
`bottomLinks` = email (contact/envelope, `mailto:connect.arnob@gmail.com`) and phone
(contact/phone, `tel:8801984933215`).

### 1d. `lib/resume/plain-text.ts`

`export function resumeToPlainText(doc: ResumeDoc): string` — flattens the document to
readable plain text for `documents.content` (what AI match-scoring reads). Strip all
inline markup: bold/italic markers gone, badges reduced to their label text, ` | ` to
` | `. Section titles from `SECTION_ORDER`, hidden sections omitted. Keep it simple —
this feeds a language model, not a parser.

### Verification

- `npx tsc --noEmit` clean.
- `node lib/db/selfcheck.ts` passes (the query-builder assertions still hold).
- Delete `.data/` is NOT required; confirm the ALTER runs against an existing db by
  starting `npm run dev` once and confirming no SQLite error in the console, then stop it.

---

## Task 2: Inline token parser

**Goal.** `lib/resume/inline.ts` — one parser whose node array both renderers consume.
This is the seam that stops the HTML and LaTeX outputs from drifting apart.

### Grammar

| Source | Meaning |
|---|---|
| `**text**` | bold |
| `*text*` | italic |
| ` \| ` (space, pipe, space) | dark-grey separator, **only outside `*…*` and `**…**` runs** |
| `[live](URL "Label")` | green pill, globe icon |
| `[repo](URL "Label")` | orange pill, github icon |
| `[api](URL "Label")` | purple pill, code icon |
| `[cred](URL "Label")` | orange pill, link icon |
| `[port](URL "Label")` | deep-orange pill, globe icon, bold |
| `[cat](Label)` | soft chip, no link, no icon |
| `[type](Label)` | outlined chip, no link, no icon |
| anything else | literal text |

Badge forms: `[kind](url "label")` is the linked form. `[kind](label)` with no quoted
part is the unlinked form — for `cat`/`type` that is the *only* form; for the five link
kinds it means "render the pill, no anchor". A badge whose label is omitted falls back to
the URL's host.

### Node type

```ts
export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "sep" }
  | { type: "badge"; kind: BadgeKind | ChipKind; label: string; url?: string };

export function parseInline(src: string): InlineNode[];
```

Bold and italic nest (`**a *b* c**` works). Badges never nest. `sep` is emitted only at
the top level of the node list.

### Requirements

- Unterminated markers are literal: `**abc` produces the text `**abc`, never a dangling
  bold node and never a thrown error.
- `**` binds before `*` (so `**bold**` is one bold node, not italic-italic).
- Empty `src` returns `[]`. `parseInline` never throws for any string input.
- No regex-only implementation that breaks on nesting — a small hand-written scanner is
  expected and preferred over a clever regex.

### Self-check — `lib/resume/inline.selfcheck.ts`

Assert-based, runnable with `node lib/resume/inline.selfcheck.ts`, exits non-zero on
failure and prints a pass count on success. Must cover at minimum:

1. plain text → one text node
2. `**bold**` → one bold node containing one text node
3. `*italic*` → one italic node
4. nesting: `**a *b***`
5. unterminated `**abc` → literal text, no throw
6. `[live](https://x.com "site")` → badge node with kind/label/url
7. `[cat](RDBMS)` → badge with kind `cat`, label `RDBMS`, no url
8. ` | ` at top level → `sep` node
9. `*LangChain | LangGraph | Python*` → ONE italic node whose text still contains the
   pipes (the separator rule must not fire inside emphasis)
10. `parseInline("")` → `[]`
11. a real bullet from the seed round-trips to the expected node kinds

---

## Task 3: LaTeX emitter

**Goal.** `lib/resume/render-tex.ts` — `export function renderTex(doc: ResumeDoc): string`
producing a complete `.tex` file that compiles under pdflatex to the reference layout.

### Preamble

Everything in `docs/superpowers/specs/resume-template-reference.tex` from the first line
through `\color{black}` (inclusive) is emitted **verbatim** as a `String.raw` template
literal constant. Verify by eye that it contains no backtick and no `${` sequence — it
does not, so `String.raw` is safe. The reference file has already been normalized so that
`\typebtn` is defined in the preamble rather than mid-document; keep it there.

The file ends with `\end{document}`.

### Body generation

Generated between the preamble and `\end{document}`, in `SECTION_ORDER`. Hidden sections
and empty sections emit nothing at all (not an empty `\section`).

Match the reference's structure exactly, including its `\vspace` values:

- **Header**: `\noindent` block; name in `\textbf{\Huge \sffamily \textcolor{wdOrange}{...}}`,
  `\hfill`, then `topLinks`; `\\ \vspace{4pt}`; `\textbf{\large TITLE}` `\hfill` then
  `bottomLinks`; `\\ \vspace{8pt}`; `\color{cvDarkGrey}\textit{\footnotesize SUMMARY} \vspace{8pt}`.
  A `ResumeLink` with a url becomes `\href{url}{\contactbtn{\faIcon \hspace{2pt} LABEL}}`
  (or `\portbtn{LABEL}` for `variant: "port"`); without a url, the bare macro. Icon map:
  github→`\faGithub`, linkedin→`\faLinkedin`, mappin→`\faMapPin`, envelope→`\faEnvelope`,
  phone→`\faPhone`, globe→`\faGlobe`. Links are separated by ` \ ` exactly as in the reference.
- **Subheading sections** (experience, education): `\section{TITLE}`, `\vspace{3pt}`,
  `\resumeSubHeadingListStart`, then per entry `\resumeSubheading{left1}{right1}{left2}{right2}`
  followed by (when bullets exist) `\resumeItemListStart` / `\resumeItem{...}` / `\resumeItemListEnd`,
  then `\resumeSubHeadingListEnd`.
- **Skills**: the `\item{\small ...}` block with `\textbf{LABEL:}{ VALUE} \\ \vspace{3pt}`
  per row (no trailing `\\ \vspace{3pt}` after the last row), then — only when
  `callout` is non-empty — the `tcolorbox` verbatim from the reference with
  `\small \textcolor{aiBorder}{\faRobot} ` prefixed to the parsed callout content.
- **ProjectHeading sections** (projects, training, awards, certifications, leadership):
  `\resumeProjectHeading{left}{right}`; then `note` as
  `\resumeItemListStart \item[] {\small NOTE} \resumeItemListEnd`, or bullets as
  `\resumeItemListStart` / `\resumeItem{...}` / `\resumeItemListEnd`, or nothing.

### Inline node → LaTeX

| Node | Emission |
|---|---|
| `text` | escaped (below) |
| `bold` | `\textbf{...}` |
| `italic` | `\emph{...}` |
| `sep` | ` \textcolor{cvDarkGrey}{$|$} ` |
| badge `live`/`repo`/`api`/`cred`/`port` | `\livebtn{L}` / `\repobtn{L}` / `\apibtn{L}` / `\roundbtn{L}` / `\portbtn{L}`, wrapped in `\href{URL}{...}` when a url is present |
| badge `cat`/`type` | `\categorybtn{L}` / `\typebtn{L}` |

### Escaping (text nodes and badge labels only — never macro output)

`\` → `\textbackslash{}` (do this first), then
`&` → `\&`, `%` → `\%`, `$` → `\$`, `#` → `\#`, `_` → `\_`, `{` → `\{`, `}` → `\}`,
`~` → `$\sim$`, `^` → `\textasciicircum{}`, `–` (U+2013) → `\textbf{--}`,
`"…"` straight double quotes → `` ``…'' `` (opening/closing by parity).

URLs inside `\href{}` get a **different** escape: only `#` → `\#`, `%` → `\%`,
`&` → `\&`, `_` → `\_`. Do not run the text escaper over a URL — it would destroy it.

### Self-check — `lib/resume/render-tex.selfcheck.ts`

Runnable with `node lib/resume/render-tex.selfcheck.ts`. Assert at minimum:

1. `renderTex(seedResumeDoc())` starts with `\documentclass[letterpaper,11pt]{article}`
   and ends with `\end{document}`
2. it contains `\section{Work Experience}` … `\section{Leadership}`, all 8, in order
   (assert the index of each is increasing)
3. every `\begin{...}` in the output has a matching `\end{...}` count, and braces balance
   overall
4. a section with `visible: false` emits neither its `\section{}` nor its entries
5. escaping: a bullet containing `C# & 50% _x_ {y}` round-trips to
   `C\# \& 50\% \_x\_ \{y\}`
6. `~90` becomes `$\sim$90`
7. a `[repo](https://github.com/a_b#c "Repository Link")` badge emits
   `\href{https://github.com/a\_b\#c}{\repobtn{Repository Link}}`
8. the emitted preamble matches the reference file's preamble byte-for-byte (read the
   reference `.tex` with `fs.readFileSync` in the self-check and compare the slice up to
   and including `\color{black}`)

---

## Task 4: HTML renderer and document stylesheet

**Goal.** Reproduce the reference PDF's appearance in the browser. This is what the user
sees while editing and what Chromium rasterizes.

### `app/resume.css`

A standalone stylesheet imported by both the print route and the editor preview. All
class names prefixed `rz-` so nothing collides with Tailwind or app tokens. **Do not use
Tailwind utility classes for the document itself** — this stylesheet is the template, and
keeping it in one file is what makes it auditable against the `.tex`.

Required:

```css
@page { size: letter; margin: 0; }
.rz-page {
  color-scheme: light;
  width: 8.5in; min-height: 11in; padding: 0.5in;
  background: #fff; color: #000;
  font-size: 11pt; line-height: 1.24;
  font-family: var(--font-source-sans), "Source Sans 3", "Segoe UI", system-ui, sans-serif;
}
```

Define the ten template colors as CSS custom properties on `.rz-page` using the exact hex
values from Global Constraint 4, then reference them. Sizes come from the 11pt ladder in
Global Constraint 6, expressed in `pt`.

Component styles to write, each matched against the reference macro:

- `.rz-section-title` — `12pt` (`\large`), bold, uppercase, color `#333333`, followed by
  a horizontal rule that fills the remaining width and is **vertically centred on the
  text's x-height**, reproducing `\leaders\hrule height 0.6ex depth -0.45ex\hfill`. Use a
  flex row: title, then a `flex:1` element with `border-top: 0.15ex solid #333333` and
  `align-self: center`. Small top margin, tight bottom margin.
- `.rz-name` — `24.88pt`, bold, color `#FF6600`.
- `.rz-title` — `12pt`, bold, black.
- `.rz-summary` — `9pt`, italic, color `#333333`.
- `.rz-head-row` — flex, `justify-content: space-between`, `align-items: baseline`,
  `flex-wrap: wrap`, `gap: 4pt`.
- Pills — one base `.rz-pill` (inline-flex, `align-items: center`, `gap: 3pt`,
  `border-radius: 4pt`, `padding: 2pt 6pt`, `white-space: nowrap`) plus modifiers:

  | Class | Font | Fill | Border | Text |
  |---|---|---|---|---|
  | `.rz-pill--contact` | 10pt | `#FFF8F2` | none (radius 5pt, padding `3pt 6pt`) | `#333333` |
  | `.rz-pill--port` | 8pt bold | `#FFE0CC` | `0.2pt solid #B34700` | `#B34700` |
  | `.rz-pill--cred`, `.rz-pill--repo` | 8pt | `#FFF8F2` | `0.1pt solid #CC5200` | `#CC5200` |
  | `.rz-pill--live` | 8pt | `#E8F5E9` | `0.1pt solid #2E7D32` | `#2E7D32` |
  | `.rz-pill--api` | 8pt | `#F3E5F5` | `0.1pt solid #6A1B9A` | `#6A1B9A` |
  | `.rz-pill--cat` | 10pt | `#FFF8F2` | none (padding `2pt 5pt`) | `#CC5200` |
  | `.rz-pill--type` | 8pt | transparent | `0.2pt solid #333333` | `#333333` |

- `.rz-entry-row` — the two-column `tabular*` rows: flex, `justify-content: space-between`,
  `gap: 8pt`, left column `flex: 1 1 auto` and right column `flex: 0 0 auto; text-align: right`.
  Line 1 of a subheading is `11pt` bold (left black, right `#333333`); line 2 is `10pt`
  italic black on both sides.
- `.rz-bullets` — `list-style: disc`, `10pt`, left padding to match
  `leftmargin=0.15in` plus the itemize indent (≈ `0.32in` total from the page's content
  edge); tight `margin`/`padding` so bullets sit close, matching the reference's
  `\vspace{-2pt}` rhythm.
- `.rz-note` — `10pt`, no bullet marker, aligned with bullet text.
- `.rz-callout` — the `tcolorbox`: `background #FFF8F2`, `border: 0.5pt solid #FF6600`,
  `border-radius: 4pt`, `padding: 4pt`, `10pt`, full content width, with a `#FF6600`
  bot icon inline before the text.
- `.rz-sep` — the ` | ` separator: color `#333333`, `padding: 0 4pt`.
- `.rz-skill-row` — `10pt`, label bold black, value black, `3pt` gap between rows.
- `a` inside `.rz-page` — `color: inherit; text-decoration: none` (matching
  `urlcolor=cvDarkGrey, pdfborder={0 0 0}`).
- `@media print { .rz-page { margin: 0; box-shadow: none; } }` and
  `-webkit-print-color-adjust: exact; print-color-adjust: exact;` on `.rz-page` — without
  this Chromium drops every pill background.

### Font

In `app/layout.tsx`, add to the existing `next/font/google` imports:

```ts
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});
```

and add `sourceSans.variable` to the `<html>`/`<body>` className list alongside the
existing font variables. `next/font` self-hosts at build time, so this stays offline.
Source Sans 3 is the maintained continuation of the reference's `sourcesanspro` package.

### `lib/resume/render-html.tsx`

Pure presentational React. No `"use client"`, no hooks, no data fetching — it must render
in a server component (the print route) and inside a client component (the editor preview).

```tsx
export function ResumeDocument({ doc }: { doc: ResumeDoc }): React.ReactElement
export function InlineNodes({ nodes }: { nodes: InlineNode[] }): React.ReactElement
```

`ResumeDocument` renders one `.rz-page`. Iterate `SECTION_ORDER`; skip hidden sections and
sections with no entries. `InlineNodes` maps `parseInline` output to spans, `<strong>`,
`<em>`, `.rz-sep`, and pills. A pill with a url renders as `<a href … target="_blank"
rel="noopener noreferrer">`; without, a `<span>`. Icons come from `lucide-react`:

| Badge/icon | lucide component |
|---|---|
| `live`, `port`, `globe` | `Globe` |
| `repo`, `github` | `Github` |
| `api` | `Code` |
| `cred` | `Link` |
| `linkedin` | `Linkedin` |
| `envelope` | `Mail` |
| `phone` | `Phone` |
| `mappin` | `MapPin` |
| callout | `Bot` |
| `cat`, `type` | *no icon* |

Size icons with `size={11}` (`live`/`repo`/`api`/`cred`/`port`) and `size={13}` (header
contact pills) and give each `aria-hidden`, since the adjacent label carries the meaning.

### Verification

`npx tsc --noEmit` and `npm run lint` clean. No self-check file for this task (it is
presentational); Task 9 verifies it visually.

---

## Task 5: Server actions and print route

**Goal.** The read/write layer plus the chrome-free render target for PDF generation.

### `lib/actions/resume-builder.ts`

`"use server"` — **async function exports only**, no type re-exports (Turbopack build
failure otherwise; see CLAUDE.md). Follow the shape used by `lib/actions/documents.ts`:
`const { supabase, userId } = await getUser()`, scope every query with
`.eq("user_id", userId)`, then `logResourceActivity`.

```ts
createBuiltResume(): Promise<{ documentId: string }>
```
Inserts a `documents` row: `user_id`, `name: "My Resume"`, `type: "resume"`,
`file_path: ""`, `content: resumeToPlainText(seed)`, `is_default: false`,
`builder_data: seedResumeDoc()`. Log `create` / `document` with `{ source: "builder" }`.
`revalidatePath("/documents")`.

```ts
getBuiltResume(id: string): Promise<{ id: string; name: string; doc: ResumeDoc } | null>
```
Returns `null` when the row is missing, not owned, or `builder_data` is NULL (i.e. an
uploaded PDF — never seed over one).

```ts
saveBuiltResume(id: string, doc: ResumeDoc, name?: string): Promise<void>
```
Writes `builder_data`, `content: resumeToPlainText(doc)`, `updated_at`, and `name` when
given. Ownership-checked. Does **not** revalidate (autosave path, would thrash) and does
**not** touch match scores.

```ts
saveRenderedPdf(id: string, base64: string): Promise<void>
```
Decodes to a Buffer, uploads to the `documents` bucket at
`${userId}/resume-${id}.pdf` (upsert — re-exporting replaces, it must not accumulate a
file per export), sets `file_path`, `revalidatePath("/documents")` and `"/jobs"`, then
runs the same match-score recalculation an upload triggers. Reuse the existing
`recalculateAllMatchScores` in `lib/actions/documents.ts` — do not copy it, and keep its
existing `resume_id IS NOT NULL` guard intact. Note it currently takes
`(supabase, userId)` and lives in a `"use server"` file, where every export becomes a
server action and a client-passed `supabase` argument would be nonsense. Move the
function into a plain module (e.g. `lib/resume/../actions` is wrong — use a non-`"use server"`
helper module such as `lib/match-scores.ts`) and have both `documents.ts` and
`resume-builder.ts` import it. That keeps one implementation and one guard.

```ts
exportResumeTex(id: string): Promise<{ filename: string; tex: string }>
```
`filename` is the document name slugified + `.tex`.

Reject a `base64` payload over 20 MB and a non-PDF magic number (`%PDF`) in
`saveRenderedPdf` — it is a trust boundary between the Electron main process and the
filesystem.

### `app/print/resume/[id]/page.tsx`

Outside the `(dashboard)` group so it inherits no sidebar or header. A server component:
fetch via `getBuiltResume`, `notFound()` when null, render `<ResumeDocument doc={doc} />`.
Import `app/resume.css`. Body must have no margin and no background of its own — add a
tiny inline `<style>` or a route-scoped class; do not modify `app/globals.css` for this.

Add `export const dynamic = "force-dynamic"` so the hidden Electron window always gets the
freshly saved document rather than a cached render.

### Verification

`npx tsc --noEmit`, `npm run lint`. Start `npm run dev`, call `createBuiltResume` (via a
scratch `node` script or by hitting the route once the entry point exists in Task 8 — if
Task 8 is not done yet, insert a row with a scratch script and delete it after), then
load `/print/resume/<id>` and confirm the page renders the seeded resume with no app
chrome. Report what you saw.

---

## Task 6: Electron print-to-PDF bridge

**Goal.** Give the renderer a way to ask Chromium for a real PDF of the print route.

### `electron/preload-main.js` (new)

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("attrack", {
  printResumePdf: (path) => ipcRenderer.invoke("resume:print-pdf", path),
});
```

`path` is a **relative** app path (`/print/resume/<id>`), never a full URL — the main
process owns the origin. This keeps the renderer from pointing the print window at an
arbitrary site.

### `electron/main.js` (edit)

1. Give `mainWindow` a preload:
   ```js
   webPreferences: {
     preload: path.join(__dirname, "preload-main.js"),
     contextIsolation: true,
   },
   ```
   `nodeIntegration` stays off (the Electron default). Do not enable it.
2. Register the handler after `url` is known (it needs the port). Register it once,
   before `mainWindow.loadURL(url)`:

   ```js
   ipcMain.handle("resume:print-pdf", async (_event, appPath) => {
     if (typeof appPath !== "string" || !/^\/print\/resume\/[A-Za-z0-9-]+$/.test(appPath)) {
       throw new Error("Invalid print path");
     }
     const win = new BrowserWindow({
       show: false,
       webPreferences: { offscreen: true, javascript: true },
     });
     try {
       await win.loadURL(url + appPath);
       // Let webfonts settle before rasterizing — printToPDF does not wait for them.
       await new Promise((r) => setTimeout(r, 400));
       const buffer = await win.webContents.printToPDF({
         printBackground: true,
         preferCSSPageSize: true,
         pageSize: "Letter",
         margins: { marginType: "none" },
       });
       return buffer.toString("base64");
     } finally {
       if (!win.isDestroyed()) win.destroy();
     }
   });
   ```

   The `finally` is required: an early return or a throw must not leak a hidden window.

Validate the path with the regex above **in the main process**, not only in the preload —
the preload is renderer-side and not a trust boundary.

### Verification

`npm run electron:dev` builds and launches. In the app's devtools console,
`typeof window.attrack?.printResumePdf` returns `"function"`. Report the result. (An
end-to-end PDF is verified in Task 9 once the export button exists.)

---

## Task 7: The builder editor

**Goal.** `/documents/builder/[id]` — a two-pane editor: form on the left, live Letter-page
preview on the right. This is the task Global Constraint 9's UI bar applies to hardest.

### Route

- `app/(dashboard)/documents/builder/[id]/page.tsx` — server component. `getBuiltResume`,
  `notFound()` on null, render `<ResumeBuilder id name doc />`.
- `components/resume-builder/resume-builder.tsx` — `"use client"`, owns the `ResumeDoc`
  state and the autosave.
- Split the section forms into their own files under `components/resume-builder/` rather
  than one giant component: `header-form.tsx`, `subheading-section.tsx` (drives Experience
  and Education), `project-section.tsx` (drives the five ProjectHeading sections),
  `skills-section.tsx`, `bullet-field.tsx`, `entry-card.tsx`. Keep each file focused.

### Layout

- Desktop (`lg:` and up): a two-column grid, form scrolls independently in the left column,
  preview is `sticky top-*` in the right column. The preview is a `.rz-page` scaled with
  `transform: scale(...)` inside a fixed-width wrapper so a 8.5in page fits the column —
  use a wrapper with an explicit height so the scale does not leave a gap
  (`height: calc(11in * scale)`), and `transform-origin: top left`.
- Below `lg:`: single column, a `Tabs` toggle between **Edit** and **Preview**. The
  preview must never cause horizontal page scroll at 375px — scale it down to fit.
- Sticky toolbar at the top of the editor column: the document name as an inline-editable
  input (visible label, `sr-only` is acceptable here since the field's content is
  self-evident and it carries a placeholder plus `aria-label`), a save-status indicator,
  **Export PDF**, **Export .tex**, and a link back to `/documents`.

### Editing behaviour

- **Autosave**, debounced 800ms after the last keystroke, calling `saveBuiltResume`.
  Status indicator has three states: `Saved` (muted, with a check), `Saving…` (with a
  spinner), `Not saved` (destructive color, with the error message in a tooltip and a
  Retry button). Never fail silently.
- Every section is a collapsible panel (progressive disclosure) with a header showing the
  section title, an entry count, and a visibility toggle (`Switch` from `components/ui/`,
  labelled `Show in resume`). Hiding a section greys its panel and removes it from the
  preview immediately.
- Entries: add, delete (with a confirm — it is destructive and unrecoverable), and
  move up/down within the section using icon buttons with `aria-label`s. No drag-and-drop;
  this is not a reorderable-sections feature, only entry ordering inside a section.
- Bullets: a `Textarea` per bullet, auto-growing, plus add/delete/move buttons.
- **`bullet-field.tsx` carries the formatting help**: a small "Formatting" popover
  (`components/ui/popover` if it exists, else a `Dialog`) listing the grammar from Task 2
  with one example each, and a row of insert buttons that wrap the current selection —
  Bold (`**`), Italic (`*`), Separator (` | `), and a badge inserter that drops
  `[live](https://  "Label")` etc. at the cursor. Buttons manipulate the textarea's
  `selectionStart`/`selectionEnd`; do not reach for a rich-text library.
- Header form: name, title, summary (`Textarea`), and two link lists. A link row is
  variant (`Select`: Portfolio pill / Contact pill), icon (`Select` over the six
  `ContactIcon` values), label, and url (optional, with helper text saying an empty url
  renders a plain pill).
- Skills: label/value rows, plus a `Textarea` for the AI callout with helper text noting
  that clearing it removes the box.

### Validation

Inline, on blur, not on keystroke. Only two real rules:
- Header `name` must not be empty (it is the document's identity) — show the error below
  the field and keep the last valid value in the preview.
- A url field that is non-empty and does not parse as a URL (`new URL()` in a try/catch,
  allowing `mailto:` and `tel:`) shows an error below the field. It does not block saving —
  the document is the user's; a malformed url is their problem to fix, not a reason to
  lose work.

### Verification

`npx tsc --noEmit`, `npm run lint`. Then in `npm run dev`: open the builder for a seeded
document, type in a bullet and confirm the preview updates, toggle a section off and
confirm it vanishes from the preview, reload and confirm the edit persisted. Check 375px
width for horizontal scroll. Report what you did and saw.

---

## Task 8: Entry point and export wiring

**Goal.** Make the feature reachable and make both exports work.

### `/documents` entry point

Replace `components/documents-upload-inline.tsx`'s single Upload button with a
`DropdownMenu` (`components/ui/dropdown-menu`) trigger labelled **New** (`Plus` icon):

- **Upload PDF** (`Upload` icon) — opens the existing `DocumentsUpload` dialog, unchanged.
- **Build from template** (`FileText` icon) — calls `createBuiltResume()`, then
  `router.push('/documents/builder/' + documentId)`. Disabled with a spinner while the
  action runs.

Keep the dropdown item hit areas ≥ 44px and give the trigger an accessible name.

### `components/documents-list.tsx`

A row whose `builder_data` is present is editable: add an **Edit** action linking to the
builder. Getting `builder_data` to the list means adding it to the `select(...)` in
`getDocuments` — select only a boolean-ish presence flag if that is cleaner, but do not
ship the whole JSON blob to the client for every row. Prefer adding
`builder_data IS NOT NULL`-style detection in the action and exposing
`is_builder: boolean` on the `Document` interface.

Also handle the empty-`file_path` case: a built resume that has never been exported has
no PDF, so the existing download/preview affordance must be disabled with a tooltip
("Export a PDF first"), not render a broken link.

### Export wiring (in the builder toolbar from Task 7)

**Export .tex** — `exportResumeTex(id)`, then a `Blob` + object-URL download. Revoke the
object URL after the click.

**Export PDF** —
```ts
const bridge = (window as unknown as { attrack?: { printResumePdf(p: string): Promise<string> } }).attrack;
if (bridge) {
  // save first so the print route renders current content, then rasterize
  await saveBuiltResume(id, doc);
  const base64 = await bridge.printResumePdf(`/print/resume/${id}`);
  await saveRenderedPdf(id, base64);
  toast.success("PDF saved to your Resume/CV library");
} else {
  await saveBuiltResume(id, doc);
  window.open(`/print/resume/${id}`, "_blank");
  toast.info("Opened a print view — use your browser's Save as PDF. Running in the desktop app saves it to your library automatically.");
}
```
The button disables and shows a spinner for the whole sequence; failures produce
`toast.error(message)` and leave `file_path` untouched.

### Verification

`npx tsc --noEmit`, `npm run lint`, and `npm run build` must all pass. In `npm run dev`,
create a resume from the dropdown, land in the builder, export `.tex` and confirm the
downloaded file opens with the correct preamble. Report the output.

---

## Task 9: Whole-feature verification

**Goal.** Prove the feature works end to end. This task writes no new features; it fixes
what it finds and reports honestly.

Run and report the real output of each:

1. `node lib/resume/inline.selfcheck.ts`
2. `node lib/resume/render-tex.selfcheck.ts`
3. `node lib/db/selfcheck.ts`
4. `npx tsc --noEmit`
5. `npm run lint`
6. `npm run build`

Then a manual pass in `npm run dev`:

7. `/documents` → New → Build from template → lands in the builder with the seeded content
   visible in the preview.
8. Compare the preview against `docs/superpowers/specs/resume-template-reference.tex`
   section by section. Check specifically: the orange name, the section-title rules
   sitting at x-height, all five pill colors, the AI callout box, the two-column entry
   rows aligning left/right, and the `~90` rendering as a tilde not `$\sim$`.
9. Edit a bullet, add an entry, hide a section — preview tracks all three. Reload; the
   edits persisted.
10. Export `.tex`; confirm the preamble matches the reference byte-for-byte and the body
    contains all 8 sections.
11. `npm run electron:dev`; export a PDF; confirm a row in `/documents` now has a working
    download and the PDF visually matches the preview (pill backgrounds present — that is
    the `printBackground`/`print-color-adjust` check).
12. 375px width: no horizontal scroll in the builder.
13. Toggle app dark mode: the editor chrome follows it, the resume page stays white.

Fix anything broken. If something cannot be verified (e.g. no display for the Electron
step), say so explicitly rather than claiming it passed.

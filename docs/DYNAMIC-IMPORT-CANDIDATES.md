# Dynamic import candidates

Where `next/dynamic` (and plain `await import()`) would pay off in atTrack, ranked,
with the exact edit site for each. Written 2026-08-17 against `main`.

**Current state: the repo contains zero dynamic imports.** Every component and every
library is statically imported, so every route ships everything its import graph
touches.

```bash
grep -rn "next/dynamic" app components lib
```

returns nothing today.

---

## 1. Why this matters here, and why it matters less than usual

atTrack is local-first. In dev it serves from `localhost:3308`; packaged, `electron/main.js`
boots the `.next/standalone` server and calls `loadURL` against localhost. **Chunks never
cross a network.** So the usual dynamic-import pitch — "save your users a 300 KB download
on 4G" — does not apply.

What still applies, and is the real reason to do this:

- **Parse + compile + execute time.** A 300 KB JS chunk costs main-thread time on every
  cold route load whether it came from a CDN or from `127.0.0.1`. That is the actual
  latency the user feels when Documents takes a beat to become interactive.
- **Memory.** Electron holds every evaluated module for the life of the window. pdf.js
  parsed and resident on the Documents *list* page is pure waste.
- **Module side effects at import time.** `lib/utils/pdf-extract.ts:7` and
  `components/pdf-viewer.tsx:8` both run `GlobalWorkerOptions.workerSrc = ...` as a
  top-level statement. That fires the moment the module is imported, not when a PDF is
  opened.

Treat the wins below as interactivity and memory wins, not bandwidth wins. That framing
also decides the ranking: a chunk that loads on a *user action* (open a dialog) is worth
splitting; a chunk that loads on *route entry anyway* is often not.

---

## 2. Constraints that shape every fix below

**`ssr: false` is illegal in a Server Component.** Next 16 App Router throws
`ssr: false is not allowed with next/dynamic in Server Components`. Three of the highest-value
targets — `app/(dashboard)/overview/page.tsx`, `app/(dashboard)/admin/page.tsx`,
`app/(dashboard)/documents/[id]/page.tsx` — are `async` Server Components. For those the
options are:

- `dynamic(() => import(...))` **without** `ssr: false` — legal in a Server Component,
  still emits a separate chunk, but the component still server-renders. Partial win.
- Add a thin `"use client"` wrapper that owns the `dynamic(..., { ssr: false })` call.
  Full win, one extra file.

Prefer the wrapper only where `ssr: false` actually buys something (canvas/chart code that
cannot render on the server anyway). Do not add a wrapper reflexively.

**A non-component module does not need `next/dynamic` at all.** `next/dynamic` is a React
component loader. For a plain async function like `extractTextFromPDF`, a bare
`await import()` inside the function body is smaller, has no React coupling, and fixes
every caller at once. That is the shape used in candidate #1.

**Always give `loading:` for anything above the fold.** A dynamic component renders `null`
until its chunk resolves. Without a skeleton the layout jumps. `components/ui/spinner.tsx`
and the existing skeleton patterns in `app/(dashboard)/board/loading.tsx` are the house
style.

---

## 3. Ranked candidates

| # | Target | Weight | Trigger | Edit shape | Confidence |
|---|--------|--------|---------|-----------|------------|
| 1 | `pdfjs-dist` inside `lib/utils/pdf-extract.ts` | ~305 KB min | user picks a PDF file | `await import()` in one file | High |
| 2 | `components/pdf-viewer.tsx` | ~305 KB min | route is a PDF doc | client wrapper + `ssr:false` | High |
| 3 | `recharts` in `components/overview-charts.tsx` | see §4.3 | scroll to charts | split file + `dynamic` | High |
| 4 | `recharts` in `components/admin-charts.tsx` | same lib | admin route only | `dynamic` | Medium |
| 5 | `components/documents-add-dialog.tsx` (602 lines) | pulls #1 | click "Add Resume" | `dynamic` + mount gate | High |
| 6 | `components/documents-upload.tsx` | pulls #1 | click upload in job tab | `dynamic` + mount gate | High |
| 7 | `components/job-import/ai-import.tsx` (313 lines) | — | click "Import with AI" | `dynamic` | Medium |
| 8 | `components/links/csv-import-dialog.tsx` (377 lines) | — | click "Import CSV" | `dynamic` | Medium |
| 9 | `components/crm/contact-form-dialog.tsx` (766 lines) | — | click "Add contact" | `dynamic` | Medium |
| 10 | `components/resume-builder/*` | large subtree | `/documents/builder/[id]` only | probably skip, see §5 | Low |

Weights marked "~N KB min" are measured from `node_modules` on disk, not from a build.
**None of these are route-bundle numbers.** Measure before and after — see §6.

---

## 4. The candidates in detail

### 4.1 `pdfjs-dist` in `lib/utils/pdf-extract.ts` — do this one first

**Site:** [lib/utils/pdf-extract.ts:3](lib/utils/pdf-extract.ts:3)

```ts
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

Both statements are top-level, so importing this module drags 305 KB of minified pdf.js in
and immediately mutates global worker config.

**Who pays:** [components/documents-add-dialog.tsx:6](components/documents-add-dialog.tsx:6)
and [components/documents-upload.tsx:6](components/documents-upload.tsx:6). The first is
reached from [components/documents-upload-inline.tsx:5](components/documents-upload-inline.tsx:5),
which the **Documents list page** renders unconditionally. So pdf.js loads on every visit to
`/documents`, whether or not the user ever opens the upload dialog.

**Fix — one file, both callers fixed:**

```ts
"use client";

export async function extractTextFromPDF(file: File): Promise<string> {
  // pdf.js is ~300 KB minified and sets GlobalWorkerOptions at module scope, so a
  // static import made every route that can *offer* an upload pay for it. Loaded
  // here it costs nothing until a file is actually chosen.
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  // ...unchanged
}
```

No `next/dynamic`, no component changes, no call-site changes. Setting `workerSrc` inside the
function is idempotent, so repeated calls are fine.

**Risk:** first extraction gains a chunk-load delay. The dialog already shows a pending state
during extraction, so this is invisible.

### 4.2 `components/pdf-viewer.tsx`

**Site:** [app/(dashboard)/documents/[id]/page.tsx:5](app/(dashboard)/documents/[id]/page.tsx:5)

That page is an `async` Server Component. It statically imports both `PdfViewer` and
`TextDocumentViewer`, then picks one at runtime (`isTextDocument`). **Both client bundles
ship on both branches** — a text document still pays for pdf.js.

The viewer is canvas-driven and useless on the server, so this is a legitimate `ssr: false`
case, which means it needs a client wrapper:

```tsx
// components/pdf-viewer-lazy.tsx
"use client";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

// pdf.js renders into a canvas and reads window — there is nothing for the server to
// produce, and a static import made text-only documents pay for it too.
export const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <Spinner /> }
);
```

Then point the page at `@/components/pdf-viewer-lazy`. Note `pdf-viewer.tsx` repeats the
`workerSrc` assignment at [components/pdf-viewer.tsx:8](components/pdf-viewer.tsx:8); consider
routing both files through one shared setup helper while you are in there.

### 4.3 `recharts` in `components/overview-charts.tsx`

**Site:** [app/(dashboard)/overview/page.tsx:7](app/(dashboard)/overview/page.tsx:7)

`overview-charts.tsx` exports five components but only three touch recharts:

| Export | Uses recharts | Rendered at |
|---|---|---|
| `PipelineStages` | no — plain CSS bars | page.tsx:267, above the fold |
| `BreakdownBar` | no — plain CSS bars | page.tsx:361, 365 |
| `ApplicationTrendChart` | **yes** | page.tsx:286 |
| `MatchScoreDistributionChart` | **yes** | page.tsx:354 |
| `McqScoreChart` | **yes** | page.tsx:394 |

Because they share one module, importing `PipelineStages` — the first thing on the page —
pulls recharts in. The split is therefore two steps:

1. Move the three recharts components into `components/overview-charts-recharts.tsx`.
   `PipelineStages` and `BreakdownBar` stay put and stay static.
2. Re-export the three through a `dynamic` client wrapper with a fixed-height skeleton
   (charts have known heights, so a skeleton fully prevents layout shift).

Only step 1 is required for the win; step 2 adds the deferral. Doing step 2 without step 1
achieves nothing.

**Measured on disk:** `node_modules/recharts/es6` is 1.2 MB of source, the single-file UMD
build is 593 KB. What actually lands in the route bundle after tree-shaking is somewhere well
below that and **must be measured** — see §6.

### 4.4 `recharts` in `components/admin-charts.tsx`

**Site:** [app/(dashboard)/admin/page.tsx:12](app/(dashboard)/admin/page.tsx:12)

Same library, cleaner case: all three exports (`UsersTrendChart`, `AiTrendChart`,
`JobsStageChart`) use recharts, so no file split is needed — wrap the whole module.

Lower priority than #3: admin is one route reached by one role, and per
`app/(dashboard)/layout.tsx` an admin is redirected *into* `/admin` and never sees the
overview page. The two chart bundles never load in the same session, so fixing #3 alone
already keeps recharts off the non-admin path.

### 4.5–4.9 Dialogs mounted eagerly

The house pattern is a controlled dialog rendered unconditionally with an `open` prop:

```tsx
<DocumentsAddDialog open={open} onOpenChange={setOpen} defaultTab={activeTab} />
```

— [components/documents-upload-inline.tsx:74](components/documents-upload-inline.tsx:74),
[components/job-detail/tabs/documents-tab.tsx:213](components/job-detail/tabs/documents-tab.tsx:213),
and the same shape in `components/links/links-view.tsx:8-10` and
`components/crm/crm-view.tsx:22`.

The dialog's own internals are cheap to *render* when closed, but the **module is always in
the route bundle**. For the big ones that is worth deferring:

```tsx
const DocumentsAddDialog = dynamic(
  () => import("@/components/documents-add-dialog").then((m) => m.DocumentsAddDialog)
);
// ...
{open && <DocumentsAddDialog open onOpenChange={setOpen} defaultTab={activeTab} />}
```

Two things to get right:

- **The mount gate matters as much as `dynamic`.** Leaving `<Dialog open={open}>` mounted
  unconditionally makes Next fetch the chunk on hydration anyway. Gate on `open &&`.
- **Gating on `open` discards dialog state on close.** Check each dialog: any that keeps
  draft form state across an accidental close will regress. `csv-import-dialog.tsx` holds
  parse results mid-flow — verify before gating that one.

`components/job-import/ai-import.tsx` (#7) is already conditionally *rendered*
([components/import-choice.tsx:22](components/import-choice.tsx:22)) but statically
imported — that one needs only the `dynamic` half, no gating change.

---

## 5. Deliberate non-candidates

Splitting these would cost more than it saves. Recorded so nobody re-litigates them:

- **`motion/react`** — imported by dozens of `components/ui/*.tsx` animated icons plus board
  and chat surfaces. It is ~1 MB installed but small when bundled, and it sits in the shared
  chunk precisely *because* everything uses it. Splitting it produces a waterfall, not a win.
- **`lucide-react`** — 21 MB installed, but per-icon imports tree-shake to a few hundred bytes
  each. Nothing to defer.
- **`components/sidebar.tsx`** (1137 lines) and `dashboard-header.tsx` — rendered by
  `app/(dashboard)/layout.tsx` on every route. Deferring the thing that is always needed just
  adds a round trip. The command palette *inside* it could be split if it ever grows a heavy
  dependency; today it does not have one.
- **`@assistant-ui/react`** (11 MB installed) via `components/thread.tsx` — imported by
  `app/(dashboard)/ai-builder/chatbot/page.tsx:45`. It is the chat page's primary content, so
  the chunk is needed immediately on route entry. Deferring it delays the page's whole reason
  for existing. Revisit only if the chat page grows a meaningful non-chat first paint.
- **`components/resume-builder/*`** — lives on its own route
  (`/documents/builder/[id]`). App Router already route-splits, so it is not in any other
  route's bundle. Nothing to gain.
- **`components/ai-chatbot/markdown.tsx`** (937 lines) — reached from `thread.tsx` and
  `preferences/memories-tab.tsx:14`. On the chat page it is first-paint content. Splitting it
  only for the memories tab is not worth two code paths.
- **Everything under `lib/actions/`** — Server Actions never reach the client bundle.

---

## 6. Verify, do not estimate

Every number above is from `node_modules` on disk. Route-bundle numbers require a build, and
a build must not be run while `npm run dev` holds `.next`.

```bash
npm run build
```

Read the per-route **First Load JS** table it prints, before and after each change. One
candidate at a time — batching them makes the attribution useless.

Then, per `CLAUDE.md`:

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

And exercise the real flow in the browser or Electron, because a broken dynamic import
type-checks perfectly and fails only at runtime:

- `/documents` → Add Resume → upload a PDF → text extraction still populates
- `/documents/[id]` for a PDF doc *and* for a text doc → correct viewer, no console error
- `/overview` → charts paint, no layout shift as they arrive
- `/admin` → all three charts paint

---

## 7. Adjacent finding, not a dynamic-import issue

Both pdf.js sites load the worker from a public CDN:

```ts
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

— [lib/utils/pdf-extract.ts:7](lib/utils/pdf-extract.ts:7) and
[components/pdf-viewer.tsx:8](components/pdf-viewer.tsx:8). The comment above it cites
"Vercel serverless compatibility", which does not describe this app: atTrack is local-first
and ships as an Electron desktop build.

**Consequence: PDF viewing and PDF text extraction both fail with no network.** The worker is
1 MB and already sits in `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`; copying it to
`public/` and pointing `workerSrc` at `/pdf.worker.min.mjs` makes both paths work offline and
removes a third-party runtime dependency from a local-first app.

Worth fixing, but it is a separate change from anything in §3 — don't bundle it into a
dynamic-import commit.

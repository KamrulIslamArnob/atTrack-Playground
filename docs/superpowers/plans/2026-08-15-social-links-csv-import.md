# Social Links: CSV Bulk Import + Category Dropdown Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user bulk-add social links via CSV (file upload OR paste) inside the existing Add Link dialog, parsing/AI-formatting rows and writing them to the correct category — and fix the category dropdown showing a UUID instead of the category name.

**Architecture:** Pure front-end + a thin server action that reuses the EXISTING `createLink`/`createCategory` server actions and the EXISTING AI provider chain (`resolveProviderChain` + `generateText`). No new DB tables, no schema migration. A new `CsvImportDialog` is opened from the Add Link dialog; it parses input client-side, optionally asks the AI to normalize malformed rows (gracefully degrading to a heuristic parser if no provider key is set), lets the user map a target category (defaults to the one they clicked), then bulk-creates links through the shared server action.

**Tech Stack:** Next.js 15 (App Router, RSC), React 18, Base UI `@base-ui/react` Select, `sonner` toasts, existing `lib/actions/links.ts`, existing `lib/ai/providers.ts` chain.

**Spec:** This plan (user request: each category keeps an Add Link button; the dialog's category field must show names not UUIDs; add a "CSV Import" button offering file-upload + paste; auto-detect/AI-format rows; add to the chosen category; multiple links at once; frontend-only view change; no DB structure change).

## Global Constraints
- No database schema change — only reuse `createLink`/`createCategory` server actions from `lib/actions/links.ts`.
- Reuse the existing AI provider chain (`resolveProviderChain(userId, "text")` + `generateText`) — do NOT add a new provider/SDK or dependency.
- Preserve all existing Add Link / Edit Link / category behavior (don't change data flow in `links-view.tsx`, `link-dialog.tsx` beyond the dropdown fix + the CSV button entry point).
- Each category column keeps its own "Add Link" button (already present in `category-panel.tsx`).
- AI formatting is OPTIONAL/best-effort: if no AI key is configured, fall back to a deterministic heuristic parser so CSV import still works offline.
- TypeScript strict; must pass `next build` / `tsc --noEmit`.

---

### Task 1: Fix category dropdown showing the UUID

**Files:**
- Modify: `components/links/link-dialog.tsx` (Category Dropdown block, ~lines 199-212)

**Problem (root cause):** Base UI `SelectValue` renders the raw `value` (the UUID) when given no label child and no `items` prop. Fix by passing a function child that resolves the category name from the `categories` list, with a placeholder fallback.

- [ ] **Step 1: Replace the `SelectValue` usage** so it resolves the name:

```tsx
// BEFORE
<Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
  <SelectTrigger id="category" className="rounded-lg">
    <SelectValue placeholder="Select a category" />
  </SelectTrigger>
  <SelectContent className="rounded-xl">
    {categories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// AFTER
<Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
  <SelectTrigger id="category" className="rounded-lg">
    <SelectValue placeholder="Select a category">
      {(value: string | null) =>
        value
          ? categories.find((c) => c.id === value)?.name ?? value
          : "Select a category"
      }
    </SelectValue>
  </SelectTrigger>
  <SelectContent className="rounded-xl">
    {categories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 2: Verify** the build (`npm run build` or `npx tsc --noEmit`) compiles and the dropdown now shows the category name. (Manual check: open Add Link from a category, confirm the field shows e.g. "Recruitment Portals", not a UUID.)

- [ ] **Step 3: Commit** `git commit -m "fix(social-links): show category name instead of UUID in Add Link dialog"`

---

### Task 2: Add CSV row + import-result types

**Files:**
- Modify: `lib/types/links.ts` (append after `CreateQuickShortcutInput`)

**Interfaces:** A single normalized row the UI and server share.

- [ ] **Step 1: Append these types** to `lib/types/links.ts`:

```ts
/** A normalized link row parsed from a CSV / pasted block (pre-import). */
export interface CsvLinkRow {
  /** Stable client id for list keys. */
  id: string;
  title: string;
  url: string;
  /** Category name (display) — resolved to category_id at import time. */
  categoryName?: string;
  notes?: string;
  tags?: string[];
  /** True when title/url were heuristically recovered (missing/garbage). */
  needsReview?: boolean;
}

/** Result of the (optional) AI normalization step. */
export interface FormatLinksResult {
  rows: CsvLinkRow[];
  /** Free-text notes from the model, e.g. what it guessed. */
  notes?: string;
}
```

- [ ] **Step 2: Commit** `git commit -m "feat(social-links): add CSV link row types"`

---

### Task 3: CSV parsing + AI formatting server action

**Files:**
- Create: `lib/actions/links-import.ts`
- Reuses: `resolveProviderChain`, `generateText` from `@/lib/ai/providers`, `getOrCreateLocalUser` from `@/lib/db/local-user`, `createLink`/`createCategory` from `@/lib/actions/links` (same file's exported funcs)

**Interfaces:**
- Exports: `parseCsvRaw(text: string): CsvLinkRow[]` (heuristic fallback, pure, runs client OR server).
- Exports: `formatLinksWithAi(rawText: string, userId: string): Promise<FormatLinksResult>` — calls the AI chain to normalize messy input into `CsvLinkRow[]`.
- Exports: `importLinks(rows: CsvLinkRow[], categoryMap: Record<string,string>, fallbackCategoryId: string): Promise<{ created: number; failed: number; errors: string[] }>` — resolves category_id by name and calls `createLink` per row (creating unknown categories on the fly via `createCategory`).

**CSV format accepted (flexible):**
- Header row optional. Columns recognized (case-insensitive): `title`, `name`, `url`, `link`, `category`, `cat`, `notes`, `note`, `tags`.
- TSV (tab) and pasted "Title — url" lines also supported by the heuristic parser.
- If no header, assume `title,url,category,notes,tags`.

- [ ] **Step 1: Create `lib/actions/links-import.ts`** with:
  - `splitLines`, `detectDelimiter`, `parseCsvRaw` (heuristic, no AI).
  - `formatLinksWithAi(rawText, userId)`: build a strict system prompt instructing the model to return ONLY a JSON array of `{title,url,categoryName?,notes?,tags?}`; parse with the same JSON-extraction helper style used in `lib/ai/ai.ts` (`parseExtraction`-like). On ANY failure, return `null` (caller falls back to `parseCsvRaw`).
  - `importLinks(rows, categoryMap, fallbackCategoryId)`: for each row, look up `categoryName` → existing category id via `categoryMap` (built by caller from `categories`), else use `fallbackCategoryId`; call `createLink`; tally created/failed.

- [ ] **Step 2: Verify** with `npx tsc --noEmit` (no type errors).

- [ ] **Step 3: Commit** `git commit -m "feat(social-links): CSV parse + AI format + bulk import server action"`

---

### Task 4: CSV Import dialog component

**Files:**
- Create: `components/links/csv-import-dialog.tsx`
- Reuses: `Dialog`, `Input`, `Textarea`, `Button` from `@/components/ui`, `LinkCategory`/`CsvLinkRow`/`FormatLinksResult` types, `parseCsvRaw`/`formatLinksWithAi`/`importLinks` from `@/lib/actions/links-import`, `toast` from `sonner`.

**Interfaces:**
- Props: `{ open, onOpenChange, categories, initialCategoryId?, onDone: (created: number) => void }`.
- UI: two tabs — **Upload** (drag-drop + file input, reads `.csv`/`.txt` as text) and **Paste** (textarea). A "Format with AI" checkbox (default on; auto-disabled if no key — we just attempt and fall back). A preview table of parsed rows with an editable target-category `<Select>` per row (default = `initialCategoryId` or first category). An "Import N links" button that calls `importLinks` and toasts the result, then `onDone`.

**Behavior / edge cases (no placeholders):**
- Empty input → disable Import, show hint "Paste CSV or upload a file."
- AI returns nothing usable → silently use `parseCsvRaw` on the raw text and flag rows `needsReview` when title/url missing.
- Row with no URL or no title after parsing → excluded from import, shown in a "skipped" list with reason.
- Unknown category name in a row → create it via `createCategory` (so it just works) OR map to the selected target; implement: create on the fly inside `importLinks`.
- Massive paste (e.g. 500 rows) → preview is virtualized by simple slice (show first 50 + "and N more") to avoid jank; full set still imports.

- [ ] **Step 1: Create `components/links/csv-import-dialog.tsx`** implementing the two-tab dialog + preview + import, per the Interfaces/Behavior above. Keep it self-contained.

- [ ] **Step 2: Verify** `npx tsc --noEmit`.

- [ ] **Step 3: Commit** `git commit -m "feat(social-links): CSV import dialog (upload + paste, AI format, preview)"`

---

### Task 5: Wire CSV Import into the Add Link dialog + bulk flow

**Files:**
- Modify: `components/links/link-dialog.tsx` — add a "CSV Import" button next to the form header/footer (per spec, the prompt's main area should have a CSV Import button). Opening it passes `initialCategoryId={categoryId}`.
- Modify: `components/links/links-view.tsx` — render `<CsvImportDialog>` and a way to open it. Simplest: also expose CSV Import from the top-right "Add Link" area? Spec says CSV Import lives in the Add Link prompt. So: the `LinkDialog` hosts the "CSV Import" button; clicking it opens `CsvImportDialog` (rendered in `links-view.tsx`, passed `categories` + `scopedCatId`). After import, `links-view` refreshes via the same optimistic/refresh path (re-fetch or rely on `revalidatePath` + `router.refresh()`).

**Interfaces:**
- `links-view.tsx` holds `csvOpen` state; passes `onOpenCsv` to `LinkDialog` as a prop; renders `<CsvImportDialog open={csvOpen} ... onDone={() => { setCsvOpen(false); router.refresh(); }} />`.
- `LinkDialog` gets optional `onOpenCsv?: () => void` and renders a secondary "CSV Import" button (e.g. in the header row, right side, or above the form) that calls it.

- [ ] **Step 1: Add `onOpenCsv` prop + button to `LinkDialog`** (place a clear "CSV Import" button in the dialog — e.g. a ghost button under the header or in the footer row). Keep `+ New Category` and all existing controls intact.

- [ ] **Step 2: In `links-view.tsx`, add `csvOpen` state, `<CsvImportDialog>`, and pass `onOpenCsv={() => setCsvOpen(true)}` to `<LinkDialog>`. On `onDone`, call `router.refresh()` (import `useRouter` from `next/navigation`) so the new links appear.

- [ ] **Step 3: Verify** `npm run build` succeeds and (manual) the Add Link dialog shows a CSV Import button that opens the import modal, which imports rows into the correct category.

- [ ] **Step 4: Commit** `git commit -m "feat(social-links): wire CSV import button into Add Link dialog + bulk import flow"`

---

### Task 6: Build + self-review

- [ ] **Step 1: Run `npm run build`** (or `npx tsc --noEmit` if build is heavy) and ensure zero errors.
- [ ] **Step 2: Self-review against spec:**
  - [ ] Each category still has its own Add Link button? (yes — untouched in `category-panel.tsx`)
  - [ ] Category dropdown shows names, not UUID? (Task 1)
  - [ ] Add Link dialog has a CSV Import button? (Task 5)
  - [ ] CSV Import supports file upload AND paste? (Task 4)
  - [ ] Auto-detects/AI-formats malformed rows, degrades offline? (Task 3)
  - [ ] Adds to the chosen category, multiple at once? (Task 3 `importLinks`)
  - [ ] No DB schema change? (only reuses existing actions)
- [ ] **Step 3: Commit** if any fix was needed, else mark done.

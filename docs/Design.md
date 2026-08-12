# Design

## Radius

One ladder, defined in `app/globals.css`'s `@theme` block, flat **4px per step** (not proportional to `--radius`, so the gap between two tiers is always the same physical size regardless of which two you pick):

| Token | Px | Use it for |
|---|---|---|
| `rounded-sm` | 4 | checkboxes, tiny tags |
| `rounded-md` | 6 | reserved |
| `rounded-lg` | 8 | **buttons, inputs, textareas, select triggers, menu/select rows** — anything you click that's roughly button-sized |
| `rounded-xl` | 12 | **dropdown/select popovers** — the floating surface a `rounded-lg` row lives inside |
| `rounded-2xl` | 16 | **cards, board columns/cards, list rows, small bordered containers** — this is the default "container" tier; it's what `rounded-4xl` used to mean everywhere before the ladder existed |
| `rounded-3xl` | 20 | **dialogs, sheets, centered modal shells** (`fixed inset-0` overlay panels) |
| `rounded-4xl` | 24 | reserved — a rare hero/feature panel, not a default |
| `rounded-full` | — | pills/badges/avatars, anything meant to read as a capsule or circle |

**Rule: a nested element always sits at least one tier below its container.** A button (`lg`, 8px) inside a card (`2xl`, 16px) is an 8px gap; a button inside a dialog (`3xl`, 20px) is a 12px gap. Never give a child the same tier as its parent — that's what erased the visual hierarchy before this ladder existed, when buttons, cards, and dialogs were all `rounded-4xl` regardless of size. When in doubt, pick the tier one step below whatever directly contains the element, not `rounded-4xl` out of habit.

## No auth surface

AtTrack is a native single-user app. **There are no `/login` or `/signup` screens** — they were deleted along with the session model, and so were the sign-out control in the sidebar and the "Account" card in Settings.

What this means for UI work:

- **Never add a sign-in, sign-up, sign-out, or "switch account" affordance.** There is no account to act on. The sidebar footer holds the theme switcher only.
- **Landing CTAs go to `/overview`.** They read "Open AtTrack" / "Dashboard", not "Get started free" / "Sign in". There is exactly one CTA per section — when both buttons pointed at the same place, the second was removed rather than kept for visual balance.
- **Copy must not imply an account.** No "create your free account", no "no credit card required" (replaced with "No account needed"). The privacy policy and terms describe local-only storage; keep them accurate if the storage model changes.
- **Settings' destructive action is "Delete all data", not "Delete account"**, confirmed by typing the profile name. It empties the workspace and keeps the owner row.

## Sidebar & header

The dashboard has no persistent top header bar on desktop (`md:` and up) — `app/(dashboard)/layout.tsx` gives that vertical space back to `<main>`. Logo, global search (⌘K command palette), and the notification bell live at the top of `components/sidebar.tsx` instead, above the user profile block. The search overlay is portalled to `document.body` (`createPortal`) so it always covers the full viewport regardless of which `<Sidebar>` instance rendered it — the persistent desktop one or the mobile drawer's — since the drawer's slide transform would otherwise clip a `position: fixed` overlay to the drawer panel.

`components/dashboard-header.tsx` is now mobile-only (`md:hidden`): logo + hamburger opening a slide-over drawer. The drawer's `<Sidebar>` is conditionally mounted (`{mobileNavOpen && <Sidebar ... />}`), not just CSS-hidden — mounting it unconditionally would double up the sidebar's ⌘K listener and search state against the persistent desktop instance.

## Board (`/board`)

Huntr-inspired Kanban, later re-skinned from an AtTrack-specific Claude Design import ("Kanban board redesign" project, `AtTrack Board.dc.html`) that also set the app's current green `--primary` (see "Brand gradient" below) — density/layout came from Huntr, hue comes from this import. Everything below reuses existing tokens; no new CSS variables were added beyond what the import already matched.

The board header's "Add Job" button is `components/import-choice.tsx` (same component `/jobs` uses), not a bare `AddJobDialog` — one feature, one entry point, two ways in: Enter Manually, or Import with AI (`components/job-import/ai-import.tsx`). Import with AI takes a screenshot, a source link (career page, LinkedIn post, Facebook post), pasted text — any combination — in the same dialog. All of it goes into one combined `extractJob()` call (`lib/ai/ai.ts`) rather than separate extractions reconciled in code; the model merges sources itself, including fetching the link via Gemini's built-in `url_context` tool (no per-site scraper needed). This is also how a short social-post blurb and a fuller career-page listing for the same job end up as one complete result instead of two conflicting ones. Column-level "+ Add job" ghost buttons stay manual-only — they're a quick add tied to a specific list, not the primary entry point.

### Structure

| Element | Spec |
|---|---|
| Scroll container | `-mx-6 overflow-x-auto px-6 pb-4 no-scrollbar` — the board owns its horizontal scroll, scrollbar hidden (`.no-scrollbar` in `app/globals.css`). The dashboard `<main>` is `overflow-y-auto` inside `h-screen`; never make the page body scroll sideways. |
| Toolbar row | One row above the columns holds `<Breadcrumbs />`, a static "Group: stage" label, a client-only "Sort: Recent / Fit score" toggle (re-sorts cards by `match_score` within each list, not persisted — "Recent" is just each list's own `board_position` drag order), and the pager — matching the reference's single combined row instead of a standalone breadcrumb row plus a separate pager row. `board-view.tsx` renders `<Breadcrumbs />` itself for this page only; every other page still renders it standalone from its own `page.tsx`. |
| Pager | A joined prev/next button pair (`rounded-lg`, radius-ladder button tier), right end of the toolbar row, only rendered when the board actually overflows. It used to float `absolute` over the first/last column's own header and collide with the title text once a board had 6+ columns — moving it off the column surface entirely was the fix, not repositioning the overlap. |
| Column | `flex-1 basis-0 min-w-[240px]`, `rounded-2xl`, **dashed** border (`border-dashed border-border/70`) at rest, switching to `border-solid border-primary/50 bg-primary/5` while it is an active drop target. The dashed outline is what gives each column a visible compartment — before it, columns were separated by flex `gap` alone and read as one continuous surface. Flexes to fill when the 6 seeded columns + the "Add list" ghost column (≤7 slots) fit the viewport; clamps to the 240px minimum and overflows into (hidden-scrollbar) horizontal scroll once more custom columns are added. |
| Board panning | Once overflowing: drag the column header's title block (pointer events, `touch-none`, pointerId-guarded — not the icon, not the "..." menu, not the rename input) to scroll the board, or the pager above. |
| Column header | lucide icon in a `size-5` circle tinted with the list colour at 20% alpha, then name and count on **one line** (`WISHLIST 1`, not a name line plus a separate "1 JOB" line) — the full "N jobs" phrasing stays on the `<section>`'s `aria-label` for screen readers only. |
| Add-card | **Wishlist only** — every other list is reached by dragging/moving a card into it, never by creating one there directly, so only Wishlist gets the affordance. It's a compact icon button (`size-6`, `Plus`) inline in the column header next to the name/count, not a separate button row — `createJob()` already defaults `list_id` to Wishlist when none is passed, so this is the only place a new job can be born on the board. |
| Add-list | `rounded-lg border border-dashed border-border`, muted text, `hover:bg-muted/50` — button tier, one step below the column's own `rounded-2xl` |
| Card | `rounded-2xl border border-l-4 border-border bg-card p-3`, left edge in the column's colour, `hover:shadow-md`. The whole card is clickable (`role="button" tabIndex={0}`, Enter/Space) to open the job detail sheet, matching the reference — not just the title. The "Move to" trigger sits inside its own `onClick={stopPropagation}` wrapper so it doesn't also open the sheet. |
| Card meta | company (`Building2` `size-3`) and the position/resume pills share **one wrapped row**, not two stacked rows — pills are `rounded-full bg-muted`, not `rounded-2xl`, so they read as chips rather than mini-cards. Relative time via `date-fns` on its own footer row with the match band. |
| Fit meter | A `h-[3px]` `.bg-gradient-brand` mini bar (width = match score %) sits directly before the match-score pill, matching the reference's card-level fit bar — decorative only, `aria-hidden`. The pill (`matchScoreBand()`, word + number) stays the accessible source of truth; the bar doesn't replace it. |
| Empty column | `rounded-lg` dashed panel, one short phrase ("Drag a card here", no trailing period) — button tier, not card tier, since it's a secondary affordance inside the column |

### Colour

List colours live in the **database** (`board_lists.color`, seeded by `public.seed_board_lists()`), with `DEFAULT_LIST_COLORS` in `lib/types/board.ts` mirroring those hexes as the fallback for custom lists. They are applied as inline `style` (arbitrary per-user values can't be Tailwind classes) and used only for the icon tint and the card's left edge — never for text, so contrast never depends on them.

Match-score bands come from `matchScoreBand()` in `lib/types/board.ts` and reuse the 80/50 thresholds already used by `getInsights()`, so the board and `/insights` can never disagree. Each band carries a **word plus the number** ("Strong 84"), never colour alone.

### Rules

- Status pills stay inline `<span>`s with a local class map — the house pattern from `jobs-grid.tsx`. `components/ui/badge.tsx` is installed but unused in feature code; don't start now.
- Motion is limited to `transition-shadow` / `transition-colors` at the default duration (~200ms) plus `opacity-40` on the dragged card. No layout-animating transitions on a scroll container.
- Every icon-only control has an `aria-label`; the column is a `<section>` labelled "`{name}, {n} jobs`".
- Drag is pointer-only by nature, so each card also exposes a **"Move to" dropdown**. Treat it as a required affordance, not a fallback — it is the only keyboard and touch path.
- Focus rings are explicit (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`) because cards are draggable divs rather than native controls.
- The saturated brand gradient (`.bg-gradient-brand`, below) is still **not** used on the board — a pipeline of equal-weight columns has no single focal point, and one gradient card would read as a false priority. The one exception is the **Interview lane's tint wash**: `board-column.tsx` applies `.bg-gradient-brand-tint` (the light wash, not the saturated gradient) whenever that lane holds at least one job, as a quiet "these are hot" signal — this is a lane-level state, not a per-card highlight, so it doesn't create a false single focal point the way a gradient card would.

## Job Detail Sheet (`components/job-detail/`)

Huntr-style: a wide `Sheet` (`side="right"`, `className="w-full sm:max-w-4xl"` — overrides the `ui/sheet.tsx` default `sm:max-w-sm`, which stays correct for the mobile nav drawer) opened from a board card's title, holding tabs (Insights, Edit, AI Tools, Activities, Notes, Contacts, Documents, Company) plus an always-visible right-hand Shortcuts/Timeline panel. `/jobs/[id]/page.tsx` renders the exact same `job-detail-content.tsx` server-side as a full page, so a deep link works without the board — one implementation, two entry points (`job-detail-sheet.tsx` for the board, `job-detail-refresh.tsx` as the page's thin client wrapper for `onRefresh`).

Status pill and match-score band keep the board's own inline-`<span>` + hex-`style` pattern — no `badge.tsx`. The per-job accent swatch (Edit tab) is a fixed 8-hex row plus a "use list color" (null) option, not a color picker; falls back to the list's `DEFAULT_LIST_COLORS` when unset.

`components/board/move-to-menu.tsx` (`MoveToMenu`) is the one "Move to" dropdown implementation, used by both the board card and the sheet header — pass `renderTrigger` (a base-ui `render`-prop element, not a plain child) so the trigger element itself carries the styling instead of being nested inside an extra `<button>`. `components/job-notes-editor.tsx` (`JobNotesEditor`) is the same pattern for the notes UI, shared by `AddJobDialog`, the (now-deleted) `EditJobDialog`, the sheet's Edit tab, and its Notes tab.

## CRM (`/crm`)

Person-first, not company-nested: contacts are people you know, and a company is a tag on a person, not a folder they live inside. One page, no sub-route, split by `Tabs` into two views over the same `contacts` data:

- **Contacts (default)** — flat grid of person cards (`rounded-2xl`), search + a company filter (`all` / `unassigned` / one company). Each card carries two small `Select`s: role (`CONTACT_ROLES`) and company — reassigning the company `Select` re-tags the person in place, no drill-down required. "+ Add contact" is a top-level inline form; company is one optional field in it, not a precondition.
- **Companies** — the original collapsed-row view (job/contact counts, expands in place to a two-column jobs/contacts panel) for when sorting *by* company is what's wanted. Same `contacts` rows, same actions, just grouped.

Contact role is always a `Select` over `CONTACT_ROLES` (`lib/types/contacts.ts`), never free text — shown as plain muted text/pill, not a colored badge, since six roles don't carry the same "which one matters" signal a status pill does. Inline add/link forms reuse the same bordered-box pattern as the job-detail-sheet's tabs (Contacts, Documents) rather than a new dialog.

## Resume Builder (`components/resume-builder/`)

Novorésumé-inspired local interactive editor with two-pane layout:

- **Desktop Layout (`xl:` grid)**: Left pane (~55% width) holds the scrollable interactive editor; right pane holds the sticky Letter-size live preview (`ResumePreview`).
- **Inline Click-to-Edit**: Fields use `click-to-edit-field.tsx` for immediate in-place editing without modal dialogs.
- **Rich Text & Formatting**: Summary and bullet points use `inline-rich-text.tsx` emitting standard inline markup (`**bold**`, `*italic*`, links, ` · ` separators) consumed identically by the HTML preview and LaTeX export (`lib/resume/render-tex.ts`).
- **Drag & Reorder**: Section cards and list bullets utilize `@dnd-kit` wrappers (`draggable-section.tsx`) with keyboard accessible move fallback controls.

## Brand gradient

Signature accent gradient (lime → olive-lime → deep green), matching `--primary`/`--ring` below — the gradient's `-to` endpoint is literally `--primary`'s green, `-from` is `--ring`'s lime. Defined once in [app/globals.css](app/globals.css) as CSS custom properties + utility classes, so it's used consistently instead of re-picked per component.

*(Superseded three times this round — a green Kanban-import palette, a pastel gold→sage swatch, a teal/lime poster reference — before landing on this named 6-swatch brand palette (Primary Lime / Lime Accent / Deep Green / Dark Green / Light Lime / Off White) as the one actually in use now. `git log -p app/globals.css` has the trail if an earlier one needs resurrecting.)*

**Default is white/light.** The app's base theme (`--background`, `--card`, etc. in `app/globals.css`) stays plain white/near-white surfaces. `--primary` is Primary Lime (`#bef264` light / `#a3e635` dark, dark foreground `#09090b`) and `--ring` is `#84cc16`.

`--sidebar-primary`/`--sidebar-primary-foreground` drive the active nav item (`components/sidebar.tsx`): `bg-sidebar-primary text-sidebar-primary-foreground` — Primary Lime fill (`#bef264`) with dark text (`#09090b`), both modes.

### Tokens (`app/globals.css`)

| Token | Value (light) | Purpose |
|---|---|---|
| `--gradient-brand-from` | `#bef264` | Primary Lime, gradient start — same value as `--primary` (light mode) |
| `--gradient-brand-via` | `#a3e635` | Lime Accent, gradient midpoint |
| `--gradient-brand-to` | `#84cc16` | Deep Lime, gradient end — same value as `--ring` |
| `--gradient-brand-tint` | `#f7fee7` | Light Lime wash — for backgrounds, not the gradient itself; also `--sidebar-primary`'s fill |
| `--gradient-brand-tint-strong` | `#ecfccb` | Lime Accent wash — hover/selected state on a tinted surface |

In `.dark`, `-from`/`-via`/`-to` stay the same (brand color shouldn't shift), only the two tint tokens flip to a dark-mix so they don't paint a bright block on a dark page.

### Utility classes

- `.bg-gradient-brand` — full saturated gradient. CTA buttons, a hero focal point, a feature badge. At most one per screen.
- `.bg-gradient-brand-tint` / `.bg-gradient-brand-tint-strong` — the "very light, light" wash. Safe for wider use: card/section backgrounds, hover states, subtle highlights — this is what should show up most often, since the app is light-mode-first.
- `.text-gradient-brand` — gradient-filled text for a headline word or two. Sparingly, same rule as `.bg-gradient-brand`.

### Rules

- Don't apply `.bg-gradient-brand` to `body`, a full page, or more than one element per view — it's an accent, not a theme.
- `--primary` and the gradient coexist rather than compete now that both are green: `--primary` is still the everyday interactive color (buttons, links, focus rings, checked states); the gradient/tint marks a specific highlighted place (e.g. an AI-related CTA, a featured card, the board's Interview lane) when a place actually calls for it — it doesn't replace `--primary` anywhere.
- Prefer the tint utilities over the full gradient when in doubt — the light wash is the "safe default" for this feature, the saturated gradient is the exception.
- One live usage so far: the board's Interview lane (`.bg-gradient-brand-tint`, see "Board" above). Apply the rest only when a specific place is asked for, not preemptively across existing components.

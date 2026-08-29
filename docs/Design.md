# atTrack Design System

The single source of truth for how atTrack looks and moves. Read this before any UI work.

**The one rule:** *if a value isn't in this document, don't invent it — extend the system instead.* Every colour, radius, duration, and shadow already has a token. Reaching for a raw Tailwind palette class (`bg-emerald-500`) or a hex literal in a component is how the app ended up with three competing palettes; see [Known drift](#known-drift) for the cleanup in progress.

**Where things live**

| Layer | File | What it holds |
|---|---|---|
| Tokens | [`app/globals.css`](../app/globals.css) | Every CSS custom property + the `@theme inline` block that turns them into Tailwind utilities |
| Primitives | [`components/ui/`](../components/ui/) | 23 unstyled-ish building blocks (Button, Input, Dialog, …) built on `@base-ui/react` |
| Feature UI | `components/<feature>/` | Composed screens; consumes tokens and primitives, defines no new colours |
| Stage colours | [`lib/types/board.ts`](../lib/types/board.ts) + `board_lists.color` | Per-user pipeline hues, stored in the database |

---

## 1. Colour

### 1.1 Base tokens

Light is the default theme; `.dark` overrides the same names. Never hardcode a hex in a component — use the token.

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--background` | `#ffffff` | `#09090b` | Page ground |
| `--foreground` | `#09090b` | `#f8fafc` | Body text |
| `--card` | `#ffffff` | `#121215` | Card / panel surface |
| `--popover` | `#ffffff` | `#121215` | Floating surfaces |
| `--primary` | `#0ea5e9` | `#38bdf8` | **Everyday interactive colour** — buttons, links, focus rings, checked states |
| `--primary-foreground` | `#ffffff` | `#082f49` | Text on a primary fill |
| `--secondary` | `#f0f9ff` | `#0c4a6e` | Secondary button fill |
| `--muted` | `#f4f4f5` | `#18181b` | Recessed surface, hover ground |
| `--muted-foreground` | `#64748b` | `#94a3b8` | Secondary text, icon default |
| `--accent` | `#e0f2fe` | `#0c4a6e` | Selected/active row tint |
| `--border` / `--input` | `#e4e4e7` | `#27272a` | Hairlines, input outlines |
| `--ring` | `#0ea5e9` | `#38bdf8` | Focus ring |
| `--chart-1…5` | sky ramp | sky ramp | Recharts series, **in order** — don't cherry-pick |

The brand is **sky blue**, not green. Older revisions of this file described a lime palette that no longer exists in `globals.css`; `--primary` has been `#0ea5e9` since the sky re-skin. Lime survives only as the *Interview* stage hue and inside the `.pushable-match-strong` badge.

### 1.2 Semantic status colours

Four families, four slots each. **These replace raw palette classes.** Writing `bg-emerald-500` for a success pill is a bug — it won't follow a theme change and it won't match the pill three screens over.

| Family | Token set | Means |
|---|---|---|
| Success | `success`, `-foreground`, `-surface`, `-border` | Completed, saved, healthy, positive delta |
| Warning | `warning`, `-foreground`, `-surface`, `-border` | Due soon, needs attention, degraded |
| Info | `info`, `-foreground`, `-surface`, `-border` | Neutral notice, tips, AI-generated notes |
| Destructive | `destructive`, `-foreground`, `-surface`, `-border` | Errors, rejection, irreversible actions |

Slot meanings are identical across families:

- **`<name>`** — solid fill, icon colour, or strong text on a plain background.
- **`<name>-foreground`** — text/icon sitting *on* the solid fill.
- **`<name>-surface`** — tinted background for pills, banners, callouts.
- **`<name>-border`** — the hairline on that tinted surface.

```tsx
// ✅ Tinted pill — the default for inline status
<span className="rounded-full border border-success-border bg-success-surface px-2 py-0.5 text-xs font-medium text-success">
  Applied
</span>

// ✅ Solid — reserve for a single emphatic element
<span className="rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">Due today</span>

// ❌ Never
<span className="bg-emerald-500/20 text-emerald-600">Applied</span>
```

**Colour is never the only signal.** Every status carries a word or an icon too — `matchScoreBand()` returns `"Strong"` *and* the number for exactly this reason.

### 1.3 Pipeline stage colours

Stage hues are **per-user data**, not design tokens: they live in `board_lists.color`, are seeded by `public.seed_board_lists()`, and are mirrored by `DEFAULT_LIST_COLORS` in `lib/types/board.ts` for custom lists. `globals.css` now mirrors them a third time as `--stage-*` so class-based UI can reach them without a hex literal.

| Stage | Hue | Token |
|---|---|---|
| Wishlist | `#38bdf8` | `--stage-wishlist` |
| Preparing | `#fbbf24` | `--stage-preparing` |
| Applied | `#c084fc` | `--stage-applied` |
| Interview | `#84cc16` | `--stage-interview` |
| Offer | `#14b8a6` | `--stage-offer` |
| Accepted | `#a3e635` | `--stage-accepted` |
| Rejected | `#f87171` | `--stage-rejected` |

**Change all three places together** (database seed, `DEFAULT_LIST_COLORS`, `--stage-*`) or the board and the rest of the app will disagree.

Rules: a stage colour tints an icon, a left edge, or a dot — **never text**, because a user-chosen hex has no contrast guarantee. Since a user can rename and recolour a list, code must read the colour from data and use `--stage-*` only as the fallback.

### 1.4 Brand gradient

Signature accent (sky → light sky → deep sky), matching `--primary`/`--ring`. Defined once in `globals.css` so it is never re-picked per component.

| Token | Light | Purpose |
|---|---|---|
| `--gradient-brand-from` | `#0ea5e9` | Gradient start — same as `--primary` |
| `--gradient-brand-via` | `#38bdf8` | Midpoint |
| `--gradient-brand-to` | `#0284c7` | End |
| `--gradient-brand-tint` | `#f0f9ff` | Light wash for backgrounds |
| `--gradient-brand-tint-strong` | `#e0f2fe` | Hover/selected on a tinted surface |

In `.dark`, `-from`/`-via`/`-to` stay put (brand colour shouldn't shift); only the two tints flip to a dark mix so they don't paint a bright block on a dark page.

Utilities: `.bg-gradient-brand` (full saturation), `.bg-gradient-brand-tint` / `-tint-strong` (washes), `.text-gradient-brand` (gradient text).

**Rules**

- **At most one `.bg-gradient-brand` per screen.** Never on `body` or a full page — it's an accent, not a theme.
- Prefer the **tints**; the app is light-first and the wash is the safe default. The saturated gradient is the exception.
- The gradient marks a *specific highlighted place* (an AI CTA, a featured card, the board's Interview lane). It does not replace `--primary` for ordinary interaction.
- `.text-gradient-brand` follows the same one-per-screen rule as `.bg-gradient-brand`.

---

## 2. Typography

`--font-sans` is **Inter** and is applied to `<html>` in the base layer — you never need to write `font-sans`.

| Class | Family | Use for |
|---|---|---|
| *(default)* | Inter | All body copy, labels, controls |
| `font-heading` / `font-display` | Bricolage Grotesque | Page titles, section headings, empty-state headlines |
| `font-mono` | Geist Mono | IDs, file paths, keyboard shortcuts, code, token values, numeric tables |

Two serif families (Cormorant Garamond, Crimson Text) are still loaded in `app/layout.tsx` but have no `font-*` utility bound to them. **Don't reach for them** — either bind and document a serif role or drop them from the font loader; an unused webfont is pure payload.

### Type scale

atTrack is a dense workspace app: `text-xs` and `text-sm` carry the bulk of the UI, and that's intentional. Don't "fix" it by bumping everything up a step.

| Class | Size | Role |
|---|---|---|
| `text-xs` | 12px | Metadata, pills, table cells, timestamps, helper text |
| `text-sm` | 14px | **Default body and control text** |
| `text-base` | 16px | Emphasised body, dialog body copy |
| `text-lg` | 18px | Card titles, dialog titles |
| `text-xl` / `text-2xl` | 20 / 24px | Section headings |
| `text-3xl` / `text-4xl` | 30 / 36px | Page titles, marketing hero |
| `text-5xl` | 48px | Landing hero only |

Weights: `font-medium` for controls and labels, `font-semibold` for headings and primary buttons, `font-bold` only inside the pushable 3D badges. Skip `font-normal` — it's the default.

---

## 3. Spacing & layout

Tailwind's default 4px scale, unmodified. The useful convention is *which* step means what:

| Step | Px | Use for |
|---|---|---|
| `gap-1` / `gap-1.5` | 4 / 6 | Icon-to-label inside a control |
| `gap-2` | 8 | Related controls in a row, pill clusters |
| `gap-3` | 12 | Fields within a form group; card internals |
| `gap-4` | 16 | Cards in a grid, form groups |
| `gap-6` | 24 | Page sections |
| `p-3` | 12 | Compact card (board card) |
| `p-4` / `p-5` | 16 / 20 | Standard card |
| `p-6` | 24 | Page padding, dialog padding |

**Never use arbitrary spacing** (`p-[13px]`) — round to the nearest step. The two sanctioned arbitrary values in the codebase are `min-w-[240px]` (board column floor) and `h-[3px]` (fit meter), both structural rather than rhythmic.

Control heights are fixed by the Button size scale and must match across a row: `h-6` (xs), `h-8` (sm), `h-9` (default), `h-10` (lg). Inputs sit at `h-9` to line up with default buttons.

---

## 4. Radius

One ladder, defined in `globals.css`'s `@theme` block, flat **4px per step** — not proportional to `--radius`, so the gap between two tiers is always the same physical size regardless of which two you pick.

| Token | Px | Use it for |
|---|---|---|
| `rounded-sm` | 4 | Checkboxes, tiny tags |
| `rounded-md` | 6 | Reserved |
| `rounded-lg` | 8 | **Buttons, inputs, textareas, select triggers, menu/select rows** — anything you click that's roughly button-sized |
| `rounded-xl` | 12 | **Dropdown/select popovers** — the floating surface a `rounded-lg` row lives inside |
| `rounded-2xl` | 16 | **Cards, board columns/cards, list rows, small bordered containers** — the default "container" tier |
| `rounded-3xl` | 20 | **Dialogs, sheets, centred modal shells** (`fixed inset-0` overlay panels) |
| `rounded-4xl` | 24 | Reserved — a rare hero/feature panel, not a default |
| `rounded-full` | — | Pills, badges, avatars — anything meant to read as a capsule or circle |

**Rule: a nested element always sits at least one tier below its container.** A button (`lg`, 8px) inside a card (`2xl`, 16px) is an 8px gap; a button inside a dialog (`3xl`, 20px) is a 12px gap. Never give a child the same tier as its parent — that's what erased the visual hierarchy before this ladder existed, when buttons, cards, and dialogs were all `rounded-4xl`. When in doubt, pick the tier one step below whatever directly contains the element, not `rounded-4xl` out of habit.

---

## 5. Elevation

Shadows are quiet in this app — depth mostly comes from the border and the radius ladder. Four steps, defined as `--shadow-e1…e4` and available as `shadow-e1`…`shadow-e4`.

| Token | Use for |
|---|---|
| `shadow-e1` | Resting card, if it needs any lift at all (usually it doesn't — a border is enough) |
| `shadow-e2` | Hover state on an interactive card; what `.micro-hover-lift` applies |
| `shadow-e3` | Dropdowns, popovers, tooltips |
| `shadow-e4` | Dialogs, sheets |

Rules: **borders before shadows.** A resting card gets `border border-border`, not a shadow; add elevation only when the surface actually floats above something. Never stack a shadow on a `bg-muted` recessed surface — recessed and raised are contradictory signals.

---

## 6. Motion

Grounded in Apple's fluid-interface principles and Emil Kowalski's animation standards. Motion in atTrack is **feedback, not decoration**: it confirms an action landed, shows where a surface came from, and covers a state change. If an animation doesn't answer "what just happened?", cut it.

### 6.1 Duration scale

| Token | Value | Tailwind | Use for |
|---|---|---|---|
| `--duration-instant` | 100ms | `duration-100` | Colour-only changes, hover tints |
| `--duration-fast` | 140ms | `duration-140` | **Press feedback**, tactile scale |
| `--duration-base` | 200ms | `duration-200` | **Default** — hover lift, most transitions |
| `--duration-slow` | 300ms | `duration-300` | Popover/dropdown enter, accordion |
| `--duration-slower` | 450ms | `duration-450` | Sheets, drawers, full-surface slides |

**Exits are faster than entrances** — roughly 0.7×. A dropdown enters at 160ms and leaves at 110ms. Users wait for things to appear; they don't want to wait for things to leave.

Nothing in the UI should exceed 450ms. If it feels like it needs longer, the element is moving too far.

### 6.2 Easing

| Token | Curve | Use for |
|---|---|---|
| `--ease-out-quint` | `cubic-bezier(0.23, 1, 0.32, 1)` | **The default.** Anything entering or responding to input — fast start, soft settle |
| `--ease-in-out-smooth` | `cubic-bezier(0.77, 0, 0.175, 1)` | Symmetric moves: a thing travelling A→B where both ends matter |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets and drawers only — the iOS-style panel curve |

Never use `ease-in` alone on an entrance (it arrives late and feels broken) and never `linear` on anything but a progress bar or a looping shimmer.

### 6.3 The four micro-interaction utilities

Composable classes in `globals.css`. Prefer these over per-component transitions — that's the whole point of them existing.

| Class | Behaviour | Apply to |
|---|---|---|
| `.micro-press` | `scale(0.97)` on `:active`, 140ms `--ease-out-quint`, plus colour/border/shadow at the same duration | Every clickable surface: buttons, cards, list rows, badges, sidebar items |
| `.micro-hover-lift` | `translateY(-1px)` + `shadow-e2` on hover, 200ms | Interactive cards, link rows, shortcut pills |
| `.micro-icon-spring` | Child `svg` scales to `1.1` and rises `0.5px` on hover, 180ms | Containers with an embedded Lucide icon (pair with `group`) |
| `.micro-popover-origin` | `transform-origin: var(--transform-origin)` | Dropdowns, selects, popovers — makes them grow *from their trigger* |

Both hover utilities are gated behind `@media (hover: hover) and (pointer: fine)`, so touch devices never get a stuck hover state.

```tsx
// Standard interactive card
<div className="group micro-press micro-hover-lift micro-icon-spring rounded-2xl border border-border bg-card p-4">
```

### 6.4 What animates and what doesn't

| Surface | Motion |
|---|---|
| Button / badge / row press | `.micro-press` — nothing else |
| Card hover | `.micro-hover-lift` (+ `.micro-icon-spring` if it has an icon) |
| Dropdown / select / popover | `.micro-popover-origin` + `zoom-in-95` fade, 160ms in / 110ms out |
| Dialog | Fade + `scale(0.96)→1`, 200ms, `--ease-out-quint`; backdrop fades alone |
| Sheet / drawer | Slide from edge, 450ms, `--ease-drawer` |
| Tab switch | Content fades up 3px over 250ms; the trigger bounces via `tab-select` |
| Toast (`sonner`) | Library defaults — don't override |
| Skeleton / loading | Opacity pulse only (`.shimmer-icon`, 3s). Never a moving gradient sweep |
| Drag | `opacity-40` on the dragged item. No layout-animating transition on a scroll container |
| **Command palette (⌘K)** | **None.** High-frequency actions get zero entrance animation |
| **Page/route change** | **None.** |
| **List reorder, table sort, filtering** | **None.** Reflowing rows is noise, not feedback |

### 6.5 Performance

Animate **`transform` and `opacity` only**. Both are compositor-driven and won't trigger layout. Animating `width`, `height`, `top`, `left`, or `margin` is a bug — reach for `scale`/`translate` instead.

Never animate a scroll container's layout while it's scrolling. Add `will-change` only to an element that is *currently* animating (the pushable buttons do this deliberately); leaving it on permanently costs memory for nothing.

`motion` (Framer Motion) is a dependency and appears in 18 files. Use it for orchestration CSS genuinely can't express — staggered lists, layout projection, gesture-driven drags. **Anything a CSS transition can do should be a CSS transition.**

### 6.6 Reduced motion

`globals.css` already neutralises the micro-interaction utilities under `@media (prefers-reduced-motion: reduce)`, replacing transforms with a plain opacity/colour fade. **Any new keyframe animation you add must be covered by that block too** — the existing override lists classes explicitly, so a new one isn't protected automatically.

Reduced motion means *no movement*, not *no feedback*. Keep the colour and opacity change; drop the travel.

### 6.7 Legacy decorative animations

`globals.css` also carries a set of ported Uiverse effects: `.notification-btn` (bell ring), `.radio-tab-trigger` (bounce + particle burst), and the `.pushable-*` family (3D press for Move/Apply buttons and status/match badges).

They're in use and staying, but they are **not the system** — they hardcode their own hexes and durations. Don't extend the pattern to new components, and don't copy their hexes. New work uses the `.micro-*` utilities.

---

## 7. Components

### 7.1 Primitives (`components/ui/`)

23 primitives on `@base-ui/react`. **Check this list before building anything** — the most common design-system failure here is a hand-rolled dropdown next to an existing `dropdown-menu.tsx`.

`accordion` · `avatar` · `badge` · `breadcrumb` · `button` · `card` · `command` · `confirm-dialog` · `dialog` · `dropdown-menu` · `input` · `label` · `notification-button` · `select` · `separator` · `sheet` · `skeleton` · `spinner` · `table` · `tabs` · `tag-input` · `textarea` · `tooltip`

### 7.2 Button — the reference implementation

Every other primitive should look like this one: `cva` variants, token-only colours, `data-slot` for styling hooks, motion baked into the base class.

| Variant | Use when |
|---|---|
| `default` | The one primary action on the screen |
| `outline` | Secondary actions; the default for toolbar controls |
| `secondary` | Supporting action on a tinted surface |
| `ghost` | Icon buttons, low-emphasis row actions |
| `destructive` | Delete/remove — tinted, not solid red |
| `link` | Inline navigation inside prose |

| Size | Height | Use for |
|---|---|---|
| `xs` | 24px | Inline in a card header or a dense row |
| `sm` | 32px | Toolbars, filter bars |
| `default` | 36px | Everything else |
| `lg` | 40px | Hero/landing CTA |
| `icon-xs` / `icon-sm` / `icon` / `icon-lg` | 24/32/36/40 square | Icon-only |

**One `default` variant per view.** Two primary buttons side by side means neither is primary. Icon-only buttons always need an `aria-label`.

### 7.3 States every interactive component must define

Missing states are the most common gap in an audit. All seven, every time:

| State | Requirement |
|---|---|
| Default | Token colours only |
| Hover | Gated behind `(hover: hover)`; ≤200ms |
| Active | `.micro-press` scale, 140ms |
| Focus-visible | `focus-visible:ring-3 ring-ring/30` — **never remove the ring**; on non-native controls (draggable divs) set it explicitly with `outline-2 outline-offset-2 outline-primary` |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none`; never colour alone |
| Loading | `spinner.tsx`, control keeps its width so the layout doesn't jump |
| Error | `aria-invalid` + `border-destructive`, plus a text message — colour is never the only signal |

### 7.4 House patterns that aren't primitives

Deliberate conventions. Follow them; don't "upgrade" them to a component without a reason.

- **Status pills are inline `<span>`s** with a local class map (the `jobs-grid.tsx` pattern). `badge.tsx` is installed but unused in feature code — don't start now.
- **`MoveToMenu`** (`components/board/move-to-menu.tsx`) is the one "Move to" implementation, shared by the board card and the detail sheet. Pass `renderTrigger` (a base-ui `render`-prop element, not a plain child) so the trigger carries the styling instead of nesting inside an extra `<button>`.
- **`JobNotesEditor`** (`components/job-notes-editor.tsx`) is the single notes UI, shared by the add dialog and both sheet tabs.
- **Inline forms use the bordered-box pattern** from the detail sheet's Contacts/Documents tabs — not a new dialog.
- **Tooltips replace `title=""`** everywhere: `tooltip.tsx` on `@base-ui/react/tooltip`, glassmorphic (`backdrop-blur-md`, `rounded-2xl`), with colour-coded stage badges and 3-column grids for multi-option guides.

---

## 8. Patterns

**Forms** — `Label` above `Input`, `gap-3` between fields, `gap-4` between groups. Errors sit below the field in `text-xs text-destructive` with `aria-invalid` on the control. Submit is `default` variant, right-aligned, `Cancel` as `ghost` to its left.

**Empty states** — Lucide icon in a `size-10` muted circle, `font-heading` headline, one `text-sm text-muted-foreground` line, one action. Copy is a short phrase with no trailing period ("Drag a card here").

**Destructive confirmation** — `confirm-dialog.tsx`. Name the specific thing being deleted and say it can't be undone. The workspace-wide action is **"Delete all data"**, not "Delete account", and requires typing the profile name.

**Loading** — `skeleton.tsx` matching the real content's shape for first paint; `spinner.tsx` inside a control for an action in flight. Never swap a populated view for a full-page spinner.

**Toasts** — `sonner`, one line, past tense ("Job saved"). Errors get a retry action where one exists.

---

## 9. Voice & copy

atTrack talks like a competent colleague: plain, direct, unexcited. It's a private tool on the user's own machine, not a service trying to delight them.

**The product name is `atTrack`** — lowercase `a`, capital `T`, in every user-facing string, at the start of a sentence included. The only exceptions are deliberate on-disk identities that must not churn: `app.setName("AtTrack")` in `electron/main.js` and `"productName": "AtTrack"` in `electron-builder.js` determine the userData folder and installer name for existing installs.

### Rules

1. **Sentence case everywhere** — headings, buttons, dialog titles, menu items. Not Title Case.
2. **No exclamation marks.** Ever. "Job saved" — not "Job saved!".
3. **No terminal period on a one-line toast, label, or empty-state phrase.** Full sentences in dialog descriptions and helper text do take periods.
4. **Drop "successfully."** If it saved, saying so *is* the success. "Document updated", not "Document updated successfully".
5. **Contractions are fine** — "can't", "couldn't", "won't". They read like a person.
6. **Say the thing, not the mechanism.** "Couldn't save note", not "PATCH /api/notes returned 500".

### Message patterns

| Kind | Pattern | Example |
|---|---|---|
| Success toast | Past tense, subject first | `Note saved` · `Link copied to clipboard` |
| Error toast | **`Couldn't <verb> <noun>`** | `Couldn't save note` · `Couldn't load deadlines` |
| Error + recovery | Add the fix as a second sentence | `Couldn't send email. Check your SMTP settings.` |
| Validation | `Please <do the thing>` — the user must act, nothing failed | `Please select a due date` |
| Blocked precondition | Name what's missing and where | `Please attach a resume in the Documents tab first` |

**`Couldn't` is the only error prefix.** "Failed to" is banned (it blames the user's machine and reads like a stack trace), and so is the longer "Could not". This was previously split three ways across ~45 strings; don't reintroduce a fourth.

### Buttons and CTAs

Start with a verb and name the object: `Save changes`, `Delete document`, `Add job`. Never `OK`, `Submit`, or `Yes`. Cancel stays `Cancel`.

Landing CTAs point at `/overview` and read `Open atTrack` or `Dashboard` — never `Sign in` or `Get started free`, because there is no account (§12).

### Destructive confirmations

Four parts, always:

```tsx
confirm({
  title: "Delete this document?",              // question, sentence case, names the type
  description: `"${name}" will be permanently deleted. This can't be undone.`,
  confirmText: "Delete document",              // repeats the verb + object
  variant: "destructive",
})
```

- **Never "Are you sure you want to…"** — it asks the user to supply the stakes. State the consequence instead.
- **Always name the specific item** in the description, in quotes.
- **Always say "This can't be undone"** when it's true, and don't say it when it isn't.
- **The confirm button repeats the action** (`Delete document`), never `Confirm` or `Yes`. `confirm-dialog.tsx` takes only `description` — the old `message` alias is gone.
- Cascades get spelled out: deleting a job that's a company's last says so before it happens.

### Empty states

*What this is → why it's empty → how to start.* One short phrase, no trailing period, one action: "No documents yet. Upload a resume to get started."

### Loading

Set an expectation rather than narrating internals: `Reading the job posting…` beats `Executing extraction pipeline…`. Use a real ellipsis character (`…`), not three periods.

---

## 10. Accessibility baseline

Non-negotiable, and never the thing that gets simplified away.

- Every icon-only control has an `aria-label`; every region has a label (board columns are `<section aria-label="{name}, {n} jobs">`).
- Focus is always visible. Non-native interactive elements (draggable cards) get explicit `focus-visible:outline-2 outline-offset-2 outline-primary`.
- **Drag always has a keyboard path.** `MoveToMenu` is a required affordance, not a fallback — it's the only route for keyboard and touch. Same for the resume builder's move controls.
- Colour is never the only carrier of meaning: status pills carry a word, match scores carry a number, the fit meter is `aria-hidden` decoration behind an accessible pill.
- Body text meets 4.5:1, large text 3:1, in **both** themes. User-chosen stage hexes never colour text.
- Custom keyboard interactions match native ones: Enter/Space activate, Escape closes, Tab order follows visual order.

---

## 11. Adding something new

1. **Does a primitive already do this?** Check the 23 in `components/ui/`.
2. **Does a house pattern cover it?** (§7.4)
3. **Colours:** base token → semantic status token → stage token. If none fit, you're adding a *sixth* palette — stop and extend §1.2 instead.
4. **Radius:** one tier below the container (§4).
5. **Spacing:** a scale step, never arbitrary (§3).
6. **Motion:** compose `.micro-*` (§6.3). New keyframes must be added to the reduced-motion block (§6.6).
7. **States:** all seven (§7.3).
8. **Accessibility:** §10.
9. **Document it here** if it introduces a reusable pattern.

---

## 12. Product constraints that shape the UI

### No auth surface

atTrack is a native single-user app. **There are no `/login` or `/signup` screens** — they were deleted along with the session model, and so were the sign-out control in the sidebar and the "Account" card in Settings.

- **Never add a sign-in, sign-up, sign-out, or "switch account" affordance.** There is no account to act on. The sidebar footer holds the theme switcher only.
- **Landing CTAs go to `/overview`** and read "Open atTrack" / "Dashboard", not "Get started free" / "Sign in". One CTA per section.
- **Copy must not imply an account** — no "create your free account", no "no credit card required" (use "No account needed"). The privacy policy and terms describe local-only storage; keep them accurate if the storage model changes.

### Sidebar & header

No persistent top header on desktop (`md:` and up) — `app/(dashboard)/layout.tsx` gives that vertical space to `<main>`. Logo, global search (⌘K), and the notification bell sit at the top of `components/sidebar.tsx`, above the profile block. The search overlay is portalled to `document.body` so it covers the viewport regardless of which `<Sidebar>` rendered it — a mobile drawer's slide transform would otherwise clip a `position: fixed` overlay.

`components/dashboard-header.tsx` is mobile-only (`md:hidden`): logo + hamburger opening a slide-over drawer. The drawer's `<Sidebar>` is conditionally mounted, not CSS-hidden — mounting it unconditionally would double up the ⌘K listener against the desktop instance.

---

## 13. Feature patterns

### Board (`/board`)

Huntr-inspired Kanban. Everything below reuses existing tokens; no new CSS variables.

The header's "Add Job" button is `components/import-choice.tsx` (the same component `/jobs` uses), not a bare `AddJobDialog` — one feature, two ways in: Enter Manually, or Import with AI. Import with AI takes a screenshot, a source link, and pasted text in any combination, all in one `extractJob()` call (`lib/ai/ai.ts`) rather than separate extractions reconciled in code — the model merges sources itself, fetching links via Gemini's `url_context` tool. Column-level "+ Add job" ghost buttons stay manual-only.

| Element | Spec |
|---|---|
| Scroll container | `-mx-6 overflow-x-auto px-6 pb-4 no-scrollbar` — the board owns its horizontal scroll. The dashboard `<main>` is `overflow-y-auto` inside `h-screen`; never make the page body scroll sideways |
| Toolbar row | One row holds `<Breadcrumbs />`, a static "Group: stage" label, a client-only Recent/Fit-score sort toggle, and the pager. `board-view.tsx` renders `<Breadcrumbs />` itself for this page only |
| Pager | Joined prev/next pair (`rounded-lg`), right end of the toolbar, only when the board overflows. It used to float `absolute` over the first/last column header and collide with the title at 6+ columns |
| Column | `flex-1 basis-0 min-w-[240px]`, `rounded-2xl`, **dashed** border (`border-dashed border-border/70`) at rest → `border-solid border-primary/50 bg-primary/5` as an active drop target. The dashed outline is what makes each column a visible compartment |
| Board panning | Drag the column header's title block (pointer events, `touch-none`, pointerId-guarded — not the icon, menu, or rename input), or use the pager |
| Column header | Icon in a `size-5` circle tinted with the list colour at 20% alpha, then name and count on **one line** (`WISHLIST 1`). The full "N jobs" phrasing lives on the `<section>`'s `aria-label` |
| Add-card | **Wishlist only** — every other list is reached by moving a card into it. Compact `size-6` `Plus` inline in the header; `createJob()` already defaults `list_id` to Wishlist |
| Card | `rounded-2xl border border-l-4 border-border bg-card p-3`, left edge in the column's colour. The whole card is clickable (`role="button" tabIndex={0}`, Enter/Space); the "Move to" trigger sits in its own `stopPropagation` wrapper |
| Card meta | Company and the position/resume pills share **one wrapped row**. Pills are `rounded-full bg-muted` so they read as chips, not mini-cards |
| Match score | A `rounded-full` pill (`matchScoreBand()`, word + number) in the footer row, with a tooltip giving the percentage and what was evaluated. An earlier revision of this file described a `h-[3px]` gradient "fit meter" bar — it isn't in `board-card.tsx`; the pill is the only match-score affordance |
| Card state | Archived/on-hold cards render `grayscale contrast-90 opacity-75`, returning to full colour on hover. State changes go through the "Move to" menu's **Change state** submenu, not a separate control |
| Empty column | `rounded-lg` dashed panel, one short phrase, no trailing period — button tier, not card tier |

Match-score bands come from `matchScoreBand()` (`lib/types/board.ts`) and reuse the 80/50 thresholds from `getInsights()` so the board and `/insights` can never disagree.

The saturated brand gradient is **not** used on the board — a pipeline of equal-weight columns has no focal point, and one gradient card would read as false priority. The exception is the **Interview lane's tint wash**: `board-column.tsx` applies `.bg-gradient-brand-tint` when that lane holds at least one job. That's a lane-level state, not a per-card highlight.

### Job detail sheet (`components/job-detail/`)

A wide `Sheet` (`side="right"`, `className="w-full sm:max-w-4xl"` — overriding `ui/sheet.tsx`'s `sm:max-w-sm` default, which stays correct for the mobile nav drawer).

**Four domains, not eight tabs.** One job is one entity; splitting it across eight peer tabs ranked a rare action (Edit) level with a constant one (Insights) and overflowed the trigger strip onto a second row. Each domain answers one question:

| Trigger | Answers | Component |
|---|---|---|
| `Overview` | "What is this job, and am I a fit?" | `tabs/overview-tab.tsx` |
| `Timeline` | "What happened, and what's due?" | `tabs/deadlines-tab.tsx` |
| `AI studio` | "Write the thing for me" | `tabs/ai-tools-tab.tsx` |
| `Network` | "Who and what do I send?" | `tabs/network-tab.tsx` |

Rules that keep it that way:

- **Overview is read-only.** It is the only two-pane domain: the posting on the left, atTrack's opinion in a right rail (`lg:` and up; the rail stacks *first* below that, so the fit score always lands in the first viewport). Editing opens `edit-drawer.tsx`, a nested `Sheet` that confirms before discarding unsaved edits. Inspecting a job must never put the user inside a form.
- **The match score renders once.** The header carries a glanceable `matchScoreBand()` chip; the Overview rail carries the ring, the bar and the reasoning. No other surface repeats it.
- **The strip is `tabs.tsx`'s `variant="line"`, not the legacy `.radio-*` CSS.** Centred, underlined in `--primary`, `overflow-x: auto` so a trigger that doesn't fit scrolls sideways rather than wrapping to a second row. If a fifth domain is ever needed, the question it answers has to be genuinely different from these four.
- **The header is flat.** Status and fit read as `rounded-full` token chips and every control is a `Button` variant — no `.pushable-*` 3D badges on this screen. Four labelled facts (location, salary, job type, work mode) open Overview as a divided meta bar; each icon tint is a semantic token, never a palette class.
- **Rare and destructive actions live in the header's `⋯` menu** — `Edit company`, `Copy details as JSON`, `Delete job` — never next to routine controls. `Network` composes the contacts, documents and notes sections; each keeps its own state and server actions.

`/jobs/[id]/page.tsx` renders the same `job-detail-content.tsx` server-side as a full page, so a deep link works without the board — one implementation, two entry points (`job-detail-sheet.tsx`, and `job-detail-refresh.tsx` as the page's thin client wrapper).

### CRM (`/crm`)

Person-first, not company-nested: contacts are people, and a company is a tag on a person, not a folder they live in. One page, no sub-route, split by `Tabs` over the same `contacts` data:

- **Contacts (default)** — flat grid of person cards (`rounded-2xl`), search plus a company filter. Each card carries role and company `Select`s; reassigning company re-tags in place, no drill-down. "+ Add contact" is a top-level inline form.
- **Companies** — collapsed rows (job/contact counts) expanding in place to a two-column panel, for when sorting *by* company is what's wanted.

Role is always a `Select` over `CONTACT_ROLES` (`lib/types/contacts.ts`), never free text — rendered as plain muted text, not a coloured badge, since six roles don't carry the "which one matters" signal a status pill does.

### Resume builder (`components/resume-builder/`)

Novorésumé-inspired local editor, two panes:

- **Desktop (`xl:` grid)** — left pane (~55%) is the scrollable editor, right pane is the sticky Letter-size live preview (`ResumePreview`).
- **Inline click-to-edit** — `click-to-edit-field.tsx`, no modal dialogs.
- **Rich text** — `inline-rich-text.tsx` emits standard inline markup (`**bold**`, `*italic*`, links, ` · `) consumed identically by the HTML preview and the LaTeX export (`lib/resume/render-tex.ts`).
- **Drag & reorder** — `@dnd-kit` wrappers (`draggable-section.tsx`) with keyboard-accessible move controls.

---

## Known drift

Honest state of the system as of this revision. Fix opportunistically; don't add to it.

| Issue | Scale | Fix |
|---|---|---|
| Raw Tailwind palette classes in feature code (`bg-blue-500`, `bg-emerald-500`, `text-lime-400`, `bg-amber-500`, …) | **~1,270 instances** | Map to the §1.2 semantic tokens. Highest-value cleanup in the codebase |
| Hardcoded hex literals in `.tsx` (`#8B5CF6`, `#6B7280`, `#F59E0B`, …) | ~190 instances | Replace with tokens; keep hexes only where they're genuinely user data (stage colours) |
| Arbitrary type sizes below the scale (`text-[10px]`, `text-[11px]`, `text-[10.5px]`) | 10 in `board-card.tsx` alone | The board card genuinely needs a step below `text-xs`. Either add an `xxs` (11px) token to the scale and use it, or accept `text-xs` — but stop hand-picking pixel values per element |
| Two serif webfonts loaded, zero utilities bound | 2 families | Bind a role or remove from `app/layout.tsx` |
| Legacy Uiverse effects hardcode their own hexes and durations | `.pushable-*`, `.radio-tab-*`, `.notification-btn` | Leave in place; don't extend |
| `badge.tsx` installed but unused | 1 primitive | Either adopt it for status pills everywhere, or delete it |
| Scrollbars hidden globally via `* { scrollbar-width: none !important }` | Global | Intentional for the Electron shell, but it means keyboard/trackpad users get no scroll affordance anywhere — revisit if scroll discoverability is ever reported |

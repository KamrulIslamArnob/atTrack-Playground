# Component Kit import — implementation plan

Source: claude.ai/design project `0fd41341-4a3a-485a-b192-52b49f30fb46`,
file `Component Kit.dc.html` ("Job tracking app redesign kit"). Fetched and
read in full via the DesignSync MCP this session.

## Global constraints (bind every task)

- Token names do not change. Only the light/dark *values* of `--primary`,
  `--primary-foreground`, `--ring`, `--gradient-brand-from/via/to` change.
  `--gradient-brand-tint`/`-tint-strong`, `--secondary*`, `--destructive*`
  are already close enough to the kit and stay untouched.
- Per Design.md 1.4, `--gradient-brand-from/via/to` never change between
  `:root` and `.dark` — only `--primary`/`--ring`/`--primary-foreground` get
  separate dark values. Do not add dark-mode overrides for the gradient
  stops.
- Never hardcode a hex/oklch literal inside a component — tokens/utility
  classes only (`docs/Design.md`).
- Button radius bumps from `rounded-lg` (8px) to `rounded-xl` (12px) for
  `default`/`xs`/`sm`/`lg` sizes, and every `icon*` size becomes fully
  circular (`rounded-full`) per the kit's icon-only example. This is scoped
  to `components/ui/button.tsx` only — do not touch the global radius scale
  (`app/globals.css`'s `@theme` block) or any other component's radius.
- Do not touch `components/board/*` (board-card.tsx, board-column.tsx,
  board-view.tsx, move-to-menu.tsx) — the kanban drag/drop system is out of
  scope for both tasks. The board's "Add job" button already renders via
  the shared `Button` component, so it picks up this change with zero edits
  there.
- Do not add a `success` or `ai` Button variant — out of scope for this kit
  (it only documents default/secondary/outline/ghost/destructive/icon-only,
  matching Design.md 7.2's existing canonical list minus `link`, which the
  kit doesn't address and which stays untouched).
- Do not change the font (`--font-sans` stays Inter). The kit's own body
  uses Plus Jakarta Sans, but that's the showcase page's own presentational
  choice — the kit's stated goal is "buttons, cards and tables," not
  typography, and it never documents type as a deliverable token the way
  color is. Out of scope.
- The kit's "02 · Animated" section shows a continuously-looping
  `background-position` gradient animation and says to "use it everywhere
  the primary action button appears." Do not implement this — permanent
  idle motion on every primary button in a dense dashboard fails Design.md's
  motion restraint and the accessibility guidance both reviewed this
  session (reduced-motion should be able to kill it entirely; a
  perpetual-loop button is also flagged as an anti-pattern by
  `ui-ux-pro-max`'s `excessive-motion`/`opacity-threshold` guidance). Use
  the kit's other, hover-only primary treatment (section "03 · Six buttons
  with proper hover") instead — lift + shadow-deepen on hover, flat at
  rest.
- The kit's nav links to a `#table` section that is never actually defined
  in the fetched HTML (content jumps from Cards straight to the footer).
  There is no table spec to implement — do not invent one. Skip.
- Verification per task: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Exact token values (computed and contrast-checked this session via a
canvas sRGB round-trip in the live browser preview — WCAG AA verified,
≥4.5:1 for white/dark text on the solid fills)

Light (`:root`):
```
--primary: oklch(0.53 0.19 252);          /* was #0ea5e9 — contrast vs white text 5.23:1 */
--primary-foreground: #ffffff;             /* unchanged */
--ring: oklch(0.53 0.19 252);
--gradient-brand-from: oklch(0.46 0.19 262);  /* kit's exact value */
--gradient-brand-via: oklch(0.58 0.21 254);   /* kit's exact value */
--gradient-brand-to: oklch(0.70 0.16 230);    /* kit's exact value */
```

Dark (`.dark`):
```
--primary: oklch(0.72 0.17 252);           /* was #38bdf8 — contrast vs dark bg 7.88:1, vs its own fg 7.46:1 */
--primary-foreground: oklch(0.18 0.04 252);
--ring: oklch(0.72 0.17 252);
```

---

## Task 1: Foundation tokens

**Files:** `app/globals.css` only.

Edit `:root` block:
- Line ~112-113: `--primary: #0ea5e9;` → `--primary: oklch(0.53 0.19 252);` (keep `--primary-foreground: #ffffff;` as-is)
- Line ~129: `--ring: #0ea5e9;` → `--ring: oklch(0.53 0.19 252);`
- Lines ~145-147:
  ```
  --gradient-brand-from: #0ea5e9;
  --gradient-brand-via: #38bdf8;
  --gradient-brand-to: #0284c7;
  ```
  →
  ```
  --gradient-brand-from: oklch(0.46 0.19 262);
  --gradient-brand-via: oklch(0.58 0.21 254);
  --gradient-brand-to: oklch(0.70 0.16 230);
  ```
  (leave `--gradient-brand-tint`/`-tint-strong` on the next two lines untouched)

Edit `.dark` block:
- Line ~204-205: `--primary: #38bdf8;` → `--primary: oklch(0.72 0.17 252);`; `--primary-foreground: #082f49;` → `--primary-foreground: oklch(0.18 0.04 252);`
- Line ~221: `--ring: #38bdf8;` → `--ring: oklch(0.72 0.17 252);`
- Do not touch `--gradient-brand-tint`/`-tint-strong` in `.dark` (lines ~236-237) — they already flip correctly and are untouched by this kit.

**Test:** `npx tsc --noEmit`, `npm run build`. This is a pure CSS custom-property value swap — no component logic changes, so there's no unit test to add. Visual check: open `/overview` in both themes, confirm no build/type errors and that primary-colored elements (buttons, links, focus rings, chart-1) render the new blue without visual breakage (nothing turns transparent/black — that's the failure mode for a typo'd oklch() string).

---

## Task 2: Button component — kit-matched variants

**Depends on Task 1** (uses the new token values). **Files:**
`components/ui/button.tsx`, `app/globals.css` (the existing `.btn-cta` block
and its reduced-motion override only — do not touch any other rule in the
file).

### 2a. `components/ui/button.tsx`

In the `buttonVariants` cva base string, change the radius:
- `"group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform] duration-160 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:transition-transform [&_svg]:duration-160 [&_svg]:ease-out group-hover/button:[&_svg]:scale-105"`
  → same string with `rounded-lg` replaced by `rounded-xl` (everything else identical, single word swap).

Replace the `variant` object's `default`, `outline`, and `destructive` entries (leave `secondary`, `ghost`, `link` exactly as they are — they already match the kit closely enough):

```
default: "btn-cta bg-gradient-brand text-primary-foreground font-semibold",
outline:
  "border-[1.5px] border-primary bg-background text-primary hover:bg-primary/10 aria-expanded:bg-primary/10 dark:bg-transparent dark:hover:bg-primary/15",
destructive:
  "border-[1.5px] border-destructive/30 bg-background text-destructive hover:border-destructive hover:bg-destructive hover:text-white focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-transparent dark:border-destructive/40 dark:hover:bg-destructive dark:hover:text-white",
```

(`default` drops `shadow-2xs` — the new `.btn-cta` CSS below supplies its own
colored shadow, so the flat one would double up. `bg-gradient-brand` is the
existing utility from `docs/Design.md` §1.4, already defined in
`app/globals.css` — do not redefine the gradient inline.)

In the `size` object, append ` rounded-full` to all four icon sizes so they
override the base `rounded-xl` (the shared `cn()` helper is
clsx+tailwind-merge, so a later `rounded-full` wins over the base
`rounded-xl` for the same element — this is the same override mechanism
already used for `[&_svg:not([class*='size-'])]:size-3` in `icon-xs`):

```
icon: "size-9 rounded-full",
"icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
"icon-sm": "size-8 rounded-full",
"icon-lg": "size-10 rounded-full",
```

Everything else in the file (imports, the `Button` function body, exports)
stays unchanged.

### 2b. `app/globals.css` — replace `.btn-cta`

Find the block starting at the comment `/* 6. Primary CTA sweep — ... */`
through the end of its `@media (hover: hover) and (pointer: fine) { ... }`
block (the `.btn-cta { position: relative; overflow: hidden; }` rule plus
the `::before`/`::after` corner-notch rules added earlier this session).
Replace the **entire** comment + `.btn-cta` block with:

```css
/* 6. Primary CTA lift — Button component's `default` variant only (see
   components/ui/button.tsx). Matches the atTrack Component Kit (claude.ai
   design project 0fd41341-4a3a-485a-b192-52b49f30fb46, "03 · Six buttons
   with proper hover"): flat --gradient-brand fill at rest with a quiet
   colored shadow, lifts 2px and deepens the glow on hover, settles back
   down with a quick scale on press. Replaces this session's earlier
   corner-peel sweep now that the kit is the standard reference. Hover
   deepen/lift is hover-capable-pointer only; reduced motion keeps the
   shadow change and drops the transform (see override below). */
.btn-cta {
  box-shadow: 0 4px 12px -4px color-mix(in oklch, var(--gradient-brand-via) 45%, transparent);
  transition: transform 200ms var(--ease-out-quint, cubic-bezier(0.23, 1, 0.32, 1)),
              box-shadow 200ms var(--ease-out-quint, cubic-bezier(0.23, 1, 0.32, 1));
}
@media (hover: hover) and (pointer: fine) {
  .btn-cta:hover,
  .btn-cta:focus-visible {
    transform: translateY(-2px);
    box-shadow: 0 12px 22px -6px color-mix(in oklch, var(--gradient-brand-via) 55%, transparent);
  }
}
.btn-cta:active {
  transform: translateY(0) scale(0.98);
}
```

Then find the reduced-motion override block (`@media (prefers-reduced-motion:
reduce) { ... }`) and replace its `.btn-cta::before, .btn-cta::after { ... }`
+ `.btn-cta:hover::before, .btn-cta:focus-visible::before { ... }` rules
(there is no `::after` hover rule to remove — check what's actually there)
with:

```css
  .btn-cta,
  .btn-cta:hover,
  .btn-cta:focus-visible,
  .btn-cta:active {
    transform: none !important;
    transition: box-shadow 150ms ease-out !important;
  }
```

Do not touch any other rule in either media block (the `.micro-press`/
`.micro-hover-lift`/etc. rules immediately above stay exactly as they are).

**Test:** `npx tsc --noEmit`, `npm run lint`, `npm run build`. No unit
tests exist for CSS/component styling in this repo (see CLAUDE.md — "no
configured automated test script"); verification is build/type/lint clean
plus a manual pass: open the running dev server, check a `default` button
(hover shows lift+glow, no corner artifacts), an `outline` button (blue
border/text, hover tints), a `destructive` button (red outline at rest,
solid red fill on hover), and one `icon`-size button (fully circular, not
squircle) in both light and dark themes. Also confirm `prefers-reduced-motion`
removes the lift but keeps a visible hover cue (shadow deepens).

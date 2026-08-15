# Design Handoff

How to spec a screen or component before building it, so implementation doesn't become a series of guesses.

Read [`Design.md`](Design.md) first — it holds the tokens, the ladders, and the rules. This file is the **format** for describing one piece of UI against that system, plus a worked example.

**Two rules**

1. **Reference tokens, never values.** Write `rounded-2xl`, `--stage-interview`, `duration-200` — not `16px`, `#84cc16`, `200ms`. A spec full of raw values silently forks the system the moment a token changes.
2. **If it isn't specified, it will be guessed.** Empty, loading, error, and overflow states are the ones that get skipped, and they're the ones users hit.

---

## Template

Copy this into the issue, PR description, or plan before writing code.

```markdown
## Handoff: [Name]

### Overview
What this is, who hits it, and what they're trying to do.

### Layout
Container, structure, and how it responds. Name the breakpoints that change something.

### Tokens
| Token | Applied to |
|---|---|
| `rounded-2xl` | Container |
| `--muted-foreground` | Metadata text |

### Components used
| Component | Variant / size | Notes |
|---|---|---|
| `Button` | `outline` / `sm` | |

### States
| State | Appearance | Behaviour |
|---|---|---|
| Default | | |
| Hover | | |
| Active | | |
| Focus-visible | | |
| Disabled | | |
| Loading | | |
| Error | | |
| Empty | | |

### Motion
| Element | Trigger | Change | Duration | Easing |
|---|---|---|---|---|

### Content rules
Character limits, truncation, pluralisation, fallbacks for missing data.
Copy follows Design.md §9 — `Couldn't <verb> <noun>` for errors, sentence case, no exclamation marks.

### Edge cases
- Empty:
- Very long text:
- Maximum items:
- Missing data:
- Slow / failed request:

### Accessibility
- Role and label:
- Focus order:
- Keyboard:
- Screen-reader announcement:
- Non-colour signal for any colour-coded state:
```

---

## Worked example: board card

The spec below describes [`components/board/board-card.tsx`](../components/board/board-card.tsx) as it actually exists. Use it as the reference for how much detail is enough.

### Overview

One job on the `/board` Kanban. The user is scanning a pipeline, so the card has to carry title, company, stage, freshness, and fit at a glance, and stay legible at a 240px column width. The whole card opens the job detail sheet.

### Layout

Single column, `p-3`, inside a `rounded-2xl` board column. No internal breakpoints — the card reflows by wrapping, not by media query, because its width is driven by the column, not the viewport.

Three stacked rows plus an optional banner:

1. **Deadline banner** (conditional) — bleeds to the card edge via `-mx-3 -mt-3`, with a bottom border.
2. **Title row** — title (`flex-1 min-w-0`) + "Move to" trigger.
3. **Meta row** — company and the position/resume pills, **one wrapping row**, not stacked.
4. **Footer row** — relative time on the left; link count, deadline, and match pill on the right.

### Tokens

| Token | Applied to |
|---|---|
| `rounded-2xl` | Card container — the container tier, one step above the `rounded-lg` controls inside it |
| `border-l-4` + list colour (inline `style`) | Left edge — stage identity |
| `--card` / `--border` | Surface and hairline |
| `--muted` | Position and resume pills (`rounded-full`) |
| `--muted-foreground` | Company, timestamp, icon meta |
| `--primary` | Hover border (`/60`), focus outline |
| `duration-160`, `ease-out` | Border, shadow, and transform transitions |

The left-edge colour comes from `board_lists.color` (per-user data) with `DEFAULT_LIST_COLORS` as fallback — never a hardcoded hex, and never applied to text.

### Components used

| Component | Variant / size | Notes |
|---|---|---|
| `MoveToMenu` | `renderTrigger` prop | The shared implementation; the trigger element itself carries the styling |
| `Tooltip` | `side="top"` | On link count, deadline, and match pill — all three are `cursor-help` |
| `DropdownMenuSub` | — | "Change state" submenu: Active / On Hold / Archive, current state disabled |

### States

| State | Appearance | Behaviour |
|---|---|---|
| Default | `border-border`, no shadow | `cursor-grab` |
| Hover | `border-primary/60`, `-translate-y-0.5`, `shadow-md`; "Move to" trigger fades in | Gated behind `[@media(hover:hover)]` so touch never sticks |
| Active | `scale-[0.98]`, `cursor-grabbing` | — |
| Focus-visible | `outline-2 outline-offset-2 outline-primary` | Set explicitly — this is a `div`, not a native control |
| Dragging | `opacity-40` | Source card only; the column shows the drop target |
| Archived / on hold | `grayscale contrast-90 opacity-75` | Returns to full colour on hover, 300ms |
| Empty column | Dashed `rounded-lg` panel, "Drag a card here" | Handled by the column, not the card |

There is no loading or error state on the card itself — the board loads as a whole, and state changes are optimistic with a toast on failure (`Couldn't update job state`).

### Motion

| Element | Trigger | Change | Duration | Easing |
|---|---|---|---|---|
| Card | Hover | `translateY(-0.5)` + `shadow-md` + border colour | 160ms | `ease-out` |
| Card | Press | `scale(0.98)` | 160ms | `ease-out` |
| Inactive card | Hover | Grayscale → full colour | 300ms | default |
| "Move to" trigger | Card hover / focus | `opacity` 0 → 1 | default | default |

No layout-animating transition on the card: the board is a horizontal scroll container, and animating layout inside one causes jank. Reordering after a drop is instant by design.

### Content rules

- **Title** — `break-words`, no clamp. A long title grows the card rather than truncating, because the title is the primary identifier.
- **Company** — `truncate`; falls back to `"Unknown company"` when null.
- **Resume pill** — `max-w-[8.5rem]` then `truncate`.
- **Link count** — pluralised in the tooltip (`1 attached project link` / `2 attached project links`).
- **Timestamp** — `formatDistanceToNow` with suffix, `tabular-nums` so the column doesn't jitter.
- **Match score** — `matchScoreBand()` renders the word *and* the rounded number ("Strong 84"); the tooltip carries the percentage and what was evaluated.

### Edge cases

- **No company** — renders "Unknown company", never an empty row.
- **No match score** — the pill is omitted entirely; nothing is reserved.
- **No deadline** — both the banner and the footer chip are omitted.
- **Very long title** — wraps to as many lines as needed; the card grows.
- **All optional fields present** — meta and footer rows wrap (`flex-wrap`, `gap-y`), so the card gets taller and never overflows horizontally. `overflow-hidden` on the container is the backstop.
- **Narrow column (240px floor)** — the layout is wrap-driven, so this is the tested worst case.

### Accessibility

- **Role and label** — `role="button" tabIndex={0}` on the card; the "Move to" trigger has `aria-label="Move {title} to another list"`.
- **Keyboard** — Enter and Space open the detail sheet (`preventDefault` so Space doesn't scroll). The "Move to" menu is the **required** keyboard and touch path for moving a card; drag is pointer-only and is never the sole route.
- **Focus order** — card, then its "Move to" trigger. The footer tooltip triggers are in a `stopPropagation` wrapper so activating them doesn't also open the sheet.
- **Non-colour signal** — the match band carries a word and a number, not just a colour; the stage colour is decorative (left edge only) and duplicated by the column the card sits in.
- **Decorative icons** — every Lucide glyph is `aria-hidden="true"`.

### Known gaps in this component

Real drift, listed so it isn't mistaken for intent:

- 10 arbitrary type sizes (`text-[10px]`, `text-[11px]`, `text-[10.5px]`) sit below the documented scale.
- `text-amber-500` on the tooltip's `Sparkles` icon is a raw palette class; it should be `text-warning`.
- The "Change state" menu items use emoji (🟢 ⏸️ 📦) rather than Lucide icons, which is inconsistent with every other menu in the app.

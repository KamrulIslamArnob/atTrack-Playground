# 001 — Fix Toolbar Search Input Width Layout Shift & Transition-All

- **Status**: TODO
- **Commit**: cd19788
- **Severity**: HIGH
- **Category**: Performance & Purpose
- **Estimated scope**: 1 file (`components/jobs-toolbar.tsx`)

## Problem

In `components/jobs-toolbar.tsx:93`, the search input uses `transition-all duration-200` with `w-36 focus-visible:w-52`. Animating `width` triggers browser layout recalculations on every frame and shifts adjacent toolbar dropdown buttons (`Status:`, `Sort by:`) whenever the user focuses or blurs the search input.

```tsx
/* components/jobs-toolbar.tsx:93 — current */
<Input
  value={search}
  onChange={(e) => handleSearch(e.target.value)}
  placeholder="Search..."
  className="h-7 w-36 rounded-lg border border-border bg-card pl-7 pr-2 text-xs shadow-xs placeholder:text-muted-foreground/60 focus-visible:w-52 transition-all duration-200"
/>
```

## Target

Replace dynamic width expansion with a stable container width (`w-44` or `w-48`) and target transition properties to GPU-friendly `border-color`, `box-shadow`, and `outline-color` instead of layout `width`.

```tsx
/* target */
<Input
  value={search}
  onChange={(e) => handleSearch(e.target.value)}
  placeholder="Search jobs..."
  className="h-7 w-44 rounded-lg border border-border bg-card pl-7 pr-2 text-xs shadow-xs placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] duration-150 ease-out focus-visible:ring-1 focus-visible:ring-ring"
/>
```

## Repo conventions to follow

- Duration budget for form inputs: `150ms`.
- Custom easing token: `var(--ease-out-quint)` / `ease-out`.
- Targeted transition classes instead of `transition-all`.

## Steps

1. Edit `components/jobs-toolbar.tsx` at line 93.
2. Replace `w-36 focus-visible:w-52 transition-all duration-200` with `w-44 transition-[border-color,box-shadow] duration-150 ease-out`.

## Boundaries

- Do NOT change the search logic or event handlers.
- Do NOT alter surrounding toolbar dropdown markup.

## Verification

- **Mechanical**: Run `npx tsc --noEmit` and `npm run build`.
- **Feel check**: Click into search input; verify adjacent buttons stay completely still with 0 layout shift.
- **Done when**: Search input focuses cleanly without moving surrounding UI elements.

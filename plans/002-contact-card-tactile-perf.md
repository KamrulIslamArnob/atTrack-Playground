# 002 — Optimize Contact Card Transitions & Add Tactile Press Scale

- **Status**: TODO
- **Commit**: cd19788
- **Severity**: HIGH
- **Category**: Performance & Physicality
- **Estimated scope**: 1 file (`components/crm/contact-card.tsx`)

## Problem

In `components/crm/contact-card.tsx:118`, CRM contact cards use untargeted `transition-all` on hover and lack `active:scale-[0.98]` tactile press feedback when clicked.

```tsx
/* components/crm/contact-card.tsx:118 — current */
<div className="group relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:bg-slate-50 dark:hover:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md">
```

## Target

Target GPU-accelerated transition properties and add subtle active press scale (`active:scale-[0.98]`) with responsive duration:

```tsx
/* target */
<div className="group relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:bg-slate-50 dark:hover:bg-zinc-900/60 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md active:scale-[0.985]">
```

## Repo conventions to follow

- Physical press feedback convention: `active:scale-[0.98]` or `active:scale-[0.985]` as seen in `components/board/board-card.tsx`.
- Duration: 200ms `ease-out`.

## Steps

1. Edit `components/crm/contact-card.tsx` at line 118.
2. Replace `transition-all` with `transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.985]`.

## Boundaries

- Do NOT touch internal contact card note editing or avatar markup.

## Verification

- **Mechanical**: Run `npx tsc --noEmit`.
- **Feel check**: Click on a CRM contact card; verify instant tactile press response on pointer-down.
- **Done when**: Contact cards respond instantly to mouse clicks with physical depth feedback.

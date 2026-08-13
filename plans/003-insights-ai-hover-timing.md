# 003 — Fix AI Keyword Button Sluggish Hover Timing

- **Status**: TODO
- **Commit**: cd19788
- **Severity**: HIGH
- **Category**: Easing & Duration
- **Estimated scope**: 1 file (`components/job-detail/tabs/insights-tab.tsx`)

## Problem

In `components/job-detail/tabs/insights-tab.tsx:344` & `:363`, the "Extract AI Keywords" button and its icon use `duration-500` and `duration-700` with `ease-in-out`. Durations of 500ms–700ms feel sluggish for simple hover interactions, exceeding the 150–250ms duration budget from AUDIT.md.

```tsx
/* components/job-detail/tabs/insights-tab.tsx:344,363 — current */
"group relative inline-flex items-center justify-center gap-3 rounded-full px-7 py-3 text-xs font-semibold tracking-wide border-0 outline-hidden transition-all duration-500 ease-in-out cursor-pointer select-none mx-auto"

<svg className="text-[#AAAAAA] transition-all duration-700 ease-in-out group-hover:scale-125 group-hover:text-white">
```

## Target

Reduce duration to 200ms with fast-starting `ease-out` timing, and target GPU properties (`transform`, `background-color`, `box-shadow`):

```tsx
/* target */
"group relative inline-flex items-center justify-center gap-3 rounded-full px-7 py-3 text-xs font-semibold tracking-wide border-0 outline-hidden transition-[background-color,box-shadow,transform] duration-200 ease-out cursor-pointer select-none mx-auto active:scale-[0.97]"

<svg className="text-[#AAAAAA] transition-[transform,color] duration-200 ease-out group-hover:scale-115 group-hover:text-white">
```

## Repo conventions to follow

- Button hover duration budget: `150–250ms`.
- Custom easing: `ease-out`.
- Press scale feedback: `active:scale-[0.97]`.

## Steps

1. Open `components/job-detail/tabs/insights-tab.tsx`.
2. Update line 344: replace `transition-all duration-500 ease-in-out` with `transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]`.
3. Update line 363: replace `transition-all duration-700 ease-in-out group-hover:scale-125` with `transition-[transform,color] duration-200 ease-out group-hover:scale-115`.

## Boundaries

- Do NOT alter AI extraction logic or state management.

## Verification

- **Mechanical**: Run `npx tsc --noEmit`.
- **Feel check**: Hover over AI button in Job Detail Insights tab; verify crisp, responsive feedback without lag.
- **Done when**: AI button hover transition responds in under 200ms.

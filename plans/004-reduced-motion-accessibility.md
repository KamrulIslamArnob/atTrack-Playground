# 004 — Add Global Reduced-Motion Accessibility Overrides

- **Status**: TODO
- **Commit**: cd19788
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`app/globals.css`)

## Problem

`app/globals.css` does not include a global `@media (prefers-reduced-motion: reduce)` block to neutralize transform scale/translate shifts for users who have requested reduced motion in their OS preferences, as required by AUDIT.md Category 6.

## Target

Add a global reduced-motion media query in `app/globals.css` that disables transform animations and sets transition durations to near-zero while preserving essential opacity/color state indicators:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Repo conventions to follow

- Place in `@layer base` or at the bottom of `app/globals.css`.

## Steps

1. Edit `app/globals.css`.
2. Append the `@media (prefers-reduced-motion: reduce)` CSS block at the end of the file.

## Boundaries

- Do NOT remove existing `--ease-*` variables or `@keyframes` definitions.

## Verification

- **Mechanical**: Run `npm run build`.
- **Feel check**: Open Chrome DevTools > Rendering > Emulate CSS media feature `prefers-reduced-motion: reduce`. Confirm UI interactions (modals, buttons) update without spatial movement.
- **Done when**: Reduced motion emulation disables spatial transitions system-wide.

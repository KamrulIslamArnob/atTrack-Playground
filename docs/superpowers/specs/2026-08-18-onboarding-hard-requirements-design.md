# Design Specification: Onboarding Hard Requirements, Avatar Upload & Persistent Getting-Started Reminder

**Date:** 2026-08-18
**Status:** Approved

## Overview

Three related tightenings to first-run onboarding in `components/onboarding/onboarding-wizard.tsx` and the Overview dashboard's `GettingStartedWidget`:

1. **Step 1 (Profile) becomes hard-required.** Name, email, and target role must be filled before advancing. The global "Skip setup" escape hatch is hidden while on Step 1, since it currently bypasses everything via `skipOnboarding()`.
2. **Avatar upload added to Step 1**, optional, with a spring + ring-pulse success animation.
3. **The Getting Started card on Overview stops being permanently dismissible** while resume or AI provider is still missing — those two are the only wizard steps that are skippable *during* onboarding but must eventually be completed for the app to be useful (resume for match scoring, AI provider for Ask Tracky chat).

Steps 2 (Resume), 3 (AI Engine), and 4 (First Try / demo-vs-fresh) remain skippable inside the wizard exactly as today — the enforcement for those two moves to the persistent Overview reminder instead of blocking the wizard.

---

## 1. Step 1 — required fields

### 1.1 Fields
- **Name** — existing `fullName` state/input, unchanged except for validation.
- **Email** — new input, `type="email"`. Initialized from the `userEmail` prop, which is already threaded into `OnboardingWizard` from `app/(dashboard)/layout.tsx` but currently unused (`components/onboarding/onboarding-wizard.tsx:108`, flagged by the existing lint warning).
- **Target role** — existing `targetRole` state/input, unchanged except for validation.
- **Experience level** stays as-is (always has a default value of `"mid"`, nothing new to require).

### 1.2 Validation
- A field counts as filled when `.trim().length > 0`.
- Email additionally must match a basic `type="email"` pattern, and a value ending in `@attrack.local` (the placeholder `OWNER_EMAIL` default set by `lib/db/local-user.ts` on first run) counts as **not filled** — otherwise the requirement is satisfied by a placeholder nobody typed.
- Validation is evaluated on every render as a derived `step1Errors` object, but only *displayed* after a blocked Continue click (`step1Touched` state set to `true` the first time Continue is clicked while invalid). This avoids red borders appearing before the user has typed anything, matching Design.md's inline-validation guidance.
- Continue button at Step 1 gets `disabled={step === 1 && !isStep1Valid}`. Clicking it while invalid sets `step1Touched(true)` and does not advance; it does not need a toast, the inline field errors are enough.
- Field errors render as `text-xs text-destructive` directly below the input, with `aria-invalid="true"` on the input while invalid — per Design.md §Forms.

### 1.3 "Skip setup"
- The top-right "Skip setup" button (calls `skipOnboarding()`, closes the wizard with nothing saved) is hidden while `step === 1`. It reappears for steps 2–4, where skipping is still legitimate.

---

## 2. Avatar upload (Step 1, optional)

### 2.1 UI
- A circular preview (uploaded image, or initials fallback matching the existing `AvatarUpload` pattern in `components/settings/avatar-upload.tsx`) with a small camera-icon button, placed above the Name field in Step 1.
- Clicking opens the native file picker directly (no intermediate "choose file" dialog-in-a-modal like Settings has — unnecessary nesting inside the wizard's own modal). Selecting a file uploads immediately.
- Same constraints as Settings: JPG/PNG/GIF, max 500KB, client-validated before the upload call with a `toast.error` on rejection.
- Not required to advance Step 1; Continue's disabled state does not depend on it.

### 2.2 Server action
`uploadAvatar` in `lib/actions/auth.ts` currently ends with `redirect("/settings?...")` on every path (success and error), which would tear the user out of the onboarding modal. Its storage + DB-write logic is extracted into a new non-redirecting helper:

```ts
// lib/actions/auth.ts
export async function saveAvatar(formData: FormData): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  // the existing validation + supabase.storage.upload + profiles.upsert body,
  // returning a result instead of redirecting
}

export async function uploadAvatar(formData: FormData) {
  const result = await saveAvatar(formData);
  if (!result.success) {
    redirect("/settings?error=" + encodeURIComponent(result.error ?? "Failed to upload avatar."));
  }
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/overview");
  redirect("/settings?message=" + encodeURIComponent("Avatar uploaded successfully."));
}
```

The Settings page keeps calling `uploadAvatar` (unchanged behavior). The wizard calls `saveAvatar` directly, reads the returned `avatarUrl`, and handles its own toast/animation instead of a redirect.

### 2.3 Animation
On a successful `saveAvatar` call inside the wizard:
- The initials/placeholder cross-fades out while the new photo scales in with a spring transition (`type: "spring", stiffness: 300, damping: 15` — the same spring already used for the celebration icon in `getting-started-widget.tsx:180`, for motion consistency across the app).
- A one-shot ring pulses outward and fades around the avatar circle at the same time (a duplicate absolutely-positioned ring element animating `scale: [1, 1.4]`, `opacity: [0.6, 0]` over ~500ms, `motion/react`, already a project dependency).
- No animation on failure — just the existing toast pattern.

---

## 3. Getting Started card — persistent reminder

`components/onboarding/getting-started-widget.tsx` already tracks `hasResume` and `hasAiProvider` as two of its five checklist items, and already has a permanent-dismiss button (`X`, writes `localStorage["attrack-getting-started-dismissed"] = "true"`, never re-shown). That dismiss is what lets someone hide the card before those two are actually done.

### 3.1 Change
- `const isDismissible = hasResume && hasAiProvider;`
- While `!isDismissible`: the `X` button is not rendered at all (not merely disabled — avoids a dead control). The collapse/chevron toggle is unaffected, since collapsing is a local display fold, not a permanent hide.
- `handleDismiss` only writes the localStorage flag and sets `dismissed(true)` when `isDismissible` is true (belt-and-suspenders even though the button is hidden).
- On mount, the effective dismissed state is `storedFlag && isDismissible` — so an install where someone already dismissed the card under the old behavior, but still hasn't added a resume or AI provider, sees the card reappear once this ships. This is a one-line change to the existing mount `useEffect`.
- The `jobs` and `tracky` (chat) checklist items are untouched — still freely contribute to `completedCount` and the celebration state, but are not part of the dismiss gate. They were never part of this request.

### 3.2 Not in scope
- No change to the celebration/all-complete state, progress bar, or the "Clear demo data" control.
- No change to which five items are tracked — only to when the card can be permanently hidden.

---

## 4. Error handling

- Step 1 validation failures are inline, non-blocking-toast (per §1.2) — consistent with existing wizard patterns (e.g. resume extraction errors use `toast.error`, but field-level issues elsewhere in the codebase are inline).
- Avatar upload failures (`saveAvatar` returns `{ success: false, error }`) surface via `toast.error(result.error)`, matching the existing `AvatarUpload` component's error handling.
- `completeOnboarding`'s existing try/catch and `{ success, error }` return shape is unchanged; email is added to the payload it already accepts and writes to `users.email` using the same `UPDATE users SET email = ? WHERE id = ?` pattern `updateProfile` already uses (`lib/actions/auth.ts:39`), guarded the same way (`if (email && email.trim())`).

## 5. Testing

No test framework in this repo (per `CLAUDE.md`). Verification is manual, via the browser-preview + scratch-script pattern already used for the two prior onboarding fixes in this session:
1. Reset onboarding on the local dev DB via a throwaway script calling `resetOnboarding()`.
2. Walk Step 1 in the browser: confirm Continue is blocked with empty fields, confirm the `@attrack.local` placeholder email is treated as unset, confirm "Skip setup" is absent on Step 1 and present from Step 2 on.
3. Upload an avatar, confirm the animation and that Continue stays enabled either way.
4. On Overview, confirm the Getting Started card's `X` is absent while resume/AI provider are missing, and appears once both are set; confirm a pre-existing `localStorage` dismiss flag doesn't hide the card while either is still missing.
5. Restore onboarding/profile state afterward and delete any scratch scripts, same as the previous two fixes — no leftover files, real data untouched.
6. `npx tsc --noEmit` and `npm run lint` on touched files, same bar as the previous fixes in this session.

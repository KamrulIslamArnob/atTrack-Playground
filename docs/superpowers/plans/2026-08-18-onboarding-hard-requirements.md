# Onboarding Hard Requirements, Avatar Upload & Persistent Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make onboarding Step 1 (name, email, target role) hard-required, add an optional avatar upload with a success animation to Step 1, and stop the Overview "Getting Started" card from being permanently dismissible while resume or AI provider is still missing.

**Architecture:** Four small, independent edits — a new non-redirecting `saveAvatar` helper in `lib/actions/auth.ts`, one new field on the existing `completeOnboarding` payload in `lib/actions/onboarding.ts`, client-side validation + an avatar field added to `components/onboarding/onboarding-wizard.tsx`'s existing Step 1, and a one-boolean dismiss gate in `components/onboarding/getting-started-widget.tsx`. No schema changes, no new tables, no new dependencies — `motion/react` is already a project dependency.

**Tech Stack:** Next.js 16 App Router server actions, React 19 client component state, `motion/react` for the avatar animation, native `node:sqlite` via the existing `lib/db/` query layer.

## Global Constraints

- No automated test framework in this repo — verification is `npx tsc --noEmit`, `npx eslint <files>`, and a manual browser walkthrough (per `CLAUDE.md`).
- UI tokens only — never a raw Tailwind palette class or hex literal in a component (`CLAUDE.md`, `docs/Design.md`).
- Field errors render as `text-xs text-destructive` below the input, with `aria-invalid` on the control (`docs/Design.md`).
- Server Actions live in `lib/actions/`, start with `"use server"`, export async actions only (`CLAUDE.md`).
- An email ending in `@attrack.local` (the `OWNER_EMAIL` placeholder default in `lib/db/local-user.ts`) counts as **not filled** for Step 1 validation.
- Avatar success animation uses `type: "spring", stiffness: 300, damping: 15` — the same spring already used in `components/onboarding/getting-started-widget.tsx:180`, for motion consistency.
- Any scratch verification script goes in `scripts/_*.ts` (gitignored-by-convention throwaway prefix used earlier this session), is deleted after use, and any real local data it touches (onboarding status, `users.email`) is restored to its original value afterward.

---

### Task 1: Extract a non-redirecting `saveAvatar` helper

**Files:**
- Modify: `lib/actions/auth.ts:63-102`

**Interfaces:**
- Produces: `saveAvatar(formData: FormData): Promise<{ success: boolean; avatarUrl?: string; error?: string }>` — exported, used by Task 4.
- `uploadAvatar(formData: FormData)` keeps its existing signature and redirect behavior, now implemented in terms of `saveAvatar`.

`uploadAvatar` currently ends in `redirect("/settings?...")` on every path (success and error). That's unusable from the onboarding wizard's modal, which needs to stay open and animate the result. Extracting the body into a helper that returns instead of redirecting.

- [ ] **Step 1: Replace `uploadAvatar` with `saveAvatar` + a thin redirecting wrapper**

In `lib/actions/auth.ts`, replace the existing `uploadAvatar` function (lines 63-102) with:

```ts
export interface SaveAvatarResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

/** Validates, stores, and links an avatar file to the current user's profile
 *  without redirecting — shared by the Settings form (`uploadAvatar` below,
 *  which redirects) and the onboarding wizard (which stays in its own modal
 *  and animates the result instead of navigating away). */
export async function saveAvatar(formData: FormData): Promise<SaveAvatarResult> {
  const { supabase, userId } = await getUser();

  const file = formData.get("avatar") as File;

  if (!file || file.size === 0) {
    return { success: false, error: "No file selected." };
  }

  if (file.size > 500 * 1024) {
    return { success: false, error: "File size must be less than 500KB." };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { success: false, error: "Failed to upload avatar." };
  }

  const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_url: urlData.publicUrl }, { onConflict: "id" });

  if (updateError) {
    return { success: false, error: "Failed to update profile with avatar." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/overview");

  return { success: true, avatarUrl: urlData.publicUrl };
}

export async function uploadAvatar(formData: FormData) {
  const result = await saveAvatar(formData);

  if (!result.success) {
    redirect("/settings?error=" + encodeURIComponent(result.error ?? "Failed to upload avatar."));
  }

  redirect("/settings?message=" + encodeURIComponent("Avatar uploaded successfully."));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Verify `saveAvatar` works outside a redirect context**

Create `scripts/_verify-save-avatar.ts`:

```ts
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { saveAvatar } from "../lib/actions/auth.ts";

async function main() {
  getOrCreateLocalUser();

  // 1x1 transparent PNG, just enough bytes to exercise the upload path.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const file = new File([png], "test-avatar.png", { type: "image/png" });
  const formData = new FormData();
  formData.append("avatar", file);

  const result = await saveAvatar(formData);
  console.log(JSON.stringify(result));
  if (!result.success || !result.avatarUrl) {
    throw new Error("Expected saveAvatar to succeed with an avatarUrl");
  }
  console.log("saveAvatar OK — did not redirect, returned a result");
}
main();
```

Run: `npx --yes tsx scripts/_verify-save-avatar.ts`
Expected: prints a JSON result with `"success":true` and an `avatarUrl`, then `saveAvatar OK — did not redirect, returned a result`. No `NEXT_REDIRECT` error (that would mean it's still redirecting instead of returning).

- [ ] **Step 4: Clean up and commit**

```bash
rm scripts/_verify-save-avatar.ts
git add lib/actions/auth.ts
git commit -m "refactor: extract non-redirecting saveAvatar helper"
```

---

### Task 2: Add `email` to the onboarding payload

**Files:**
- Modify: `lib/actions/onboarding.ts:12-26` (interface), `lib/actions/onboarding.ts:38-48` (write)

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `OnboardingPayload.email?: string`, written to `users.email` inside `completeOnboarding`. Task 3's wizard passes this field.

- [ ] **Step 1: Add `email` to the payload type**

In `lib/actions/onboarding.ts`, in the `OnboardingPayload` interface (currently lines 12-26):

```ts
export interface OnboardingPayload {
  fullName?: string;
  email?: string;
  targetRole?: string;
  experienceLevel?: "entry" | "mid" | "senior";
  resumeText?: string;
  resumeFileName?: string;
  aiProvider?: {
    name: string;
    providerType: ProviderType;
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  seedDemoData?: boolean;
}
```

- [ ] **Step 2: Write the email through in `completeOnboarding`**

Immediately after the existing full-name update block (currently `lib/actions/onboarding.ts:39-48`, ending `db.prepare("UPDATE profiles SET onboarded_at = ?, updated_at = ? WHERE id = ?").run(now, now, userId);` in the `else` branch), insert:

```ts
    // 1b. Update email — lives on `users`, not `profiles` (see lib/db/local-user.ts).
    // Same pattern updateProfile() already uses in lib/actions/auth.ts.
    const trimmedEmail = (payload.email || "").trim();
    if (trimmedEmail) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(trimmedEmail, userId);
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Verify the write, then restore the real email**

Create `scripts/_verify-onboarding-email.ts`:

```ts
import { getDb } from "../lib/db/sqlite.ts";
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { completeOnboarding } from "../lib/actions/onboarding.ts";

async function main() {
  const user = getOrCreateLocalUser();
  const originalEmail = user.email;

  const res = await completeOnboarding({ email: "verify-onboarding-email@example.com" });
  console.log("completeOnboarding result:", JSON.stringify(res));
  if (!res.success) throw new Error("Expected completeOnboarding to succeed");

  const row = getDb().prepare("SELECT email FROM users WHERE id = ?").get(user.id) as { email: string };
  console.log("email after completeOnboarding:", row.email);
  if (row.email !== "verify-onboarding-email@example.com") {
    throw new Error(`Expected email to be updated, got ${row.email}`);
  }

  // Restore — this touches the real local user's row.
  getDb().prepare("UPDATE users SET email = ? WHERE id = ?").run(originalEmail, user.id);
  const restored = getDb().prepare("SELECT email FROM users WHERE id = ?").get(user.id) as { email: string };
  console.log("email restored to:", restored.email);
  if (restored.email !== originalEmail) throw new Error("Failed to restore original email");

  console.log("email write-through verified and restored");
}
main();
```

Run: `npx --yes tsx scripts/_verify-onboarding-email.ts`
Expected: prints the updated email, then confirms it was restored to the original value, ending with `email write-through verified and restored`.

- [ ] **Step 5: Clean up and commit**

```bash
rm scripts/_verify-onboarding-email.ts
git add lib/actions/onboarding.ts
git commit -m "feat: persist email during onboarding"
```

---

### Task 3: Step 1 required-field validation + hide Skip setup

**Files:**
- Modify: `components/onboarding/onboarding-wizard.tsx`

**Interfaces:**
- Consumes: `OnboardingPayload.email` from Task 2.
- Produces: `email` state, `isStep1Valid: boolean`, `step1Touched: boolean` — Task 4 reads `fullName`/`email` state for the avatar initials fallback; no other task depends on this one's new names.

- [ ] **Step 1: Add `email` state and Step 1 validation**

In `components/onboarding/onboarding-wizard.tsx`, in the Step 1 state block (currently lines 116-119):

```ts
  // Step 1: Profile & Target Role
  const [fullName, setFullName] = useState(profileName || "");
  const [email, setEmail] = useState(userEmail || "");
  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<"entry" | "mid" | "senior">("mid");
  const [step1Touched, setStep1Touched] = useState(false);
```

Immediately after (still before `handleFileSelect`), add the validation derivation:

```ts
  const isPlaceholderEmail = (value: string) => value.trim().toLowerCase().endsWith("@attrack.local");
  const isValidEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const step1Errors = {
    fullName: fullName.trim() ? null : "Enter your name",
    email: !email.trim()
      ? "Enter your email"
      : isPlaceholderEmail(email) || !isValidEmailFormat(email)
      ? "Enter a valid email address"
      : null,
    targetRole: targetRole.trim() ? null : "Enter your target role",
  };
  const isStep1Valid = !step1Errors.fullName && !step1Errors.email && !step1Errors.targetRole;
```

- [ ] **Step 2: Add the email field, and error UI on all three Step 1 fields**

In the Step 1 body (currently lines 378-403), replace the "Your name" and "Target job title" field blocks with (email field inserted between them):

```tsx
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Kamrul Islam"
                    aria-invalid={step1Touched && Boolean(step1Errors.fullName)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.fullName ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.fullName && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Your email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. kamrul@example.com"
                    aria-invalid={step1Touched && Boolean(step1Errors.email)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.email ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.email && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Target job title <span className="text-muted-foreground font-normal">(Primary role)</span>
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Senior Full Stack Engineer, Product Designer"
                    aria-invalid={step1Touched && Boolean(step1Errors.targetRole)}
                    className={`w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                      step1Touched && step1Errors.targetRole ? "border-destructive" : "border-border"
                    }`}
                  />
                  {step1Touched && step1Errors.targetRole && (
                    <p className="mt-1 text-xs text-destructive">{step1Errors.targetRole}</p>
                  )}
                </div>
```

The "Experience level" block that follows (currently lines 405-430) is unchanged.

- [ ] **Step 3: Gate the Continue button on Step 1, and hide Skip setup on Step 1**

In the footer actions (currently lines 902-910), replace the Step<4 Continue button:

```tsx
            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !isStep1Valid) {
                    setStep1Touched(true);
                    return;
                  }
                  setStep((s) => (s + 1) as Step);
                }}
                className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg shadow-xs"
              >
                <span>Continue</span>
                <ChevronRight className="size-4" />
              </button>
            ) : (
```

The button stays clickable (not `disabled`) so a click while invalid still fires and reveals the field errors — a disabled button would give no feedback about why it won't advance.

In the top header (currently lines 319-325), wrap the "Skip setup" button so it only renders from Step 2 onward:

```tsx
          {step > 1 && (
            <button
              onClick={handleSkipAll}
              disabled={submitting}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors px-2 py-1 rounded-md hover:bg-muted"
            >
              Skip setup
            </button>
          )}
```

- [ ] **Step 4: Pass `email` through on finish**

In `handleFinish` (currently the `completeOnboarding` call around lines 259-267), add `email`:

```ts
      const res = await completeOnboarding({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
        experienceLevel,
        resumeText: resumeText.trim() || undefined,
        resumeFileName: resumeFileName || undefined,
        aiProvider: aiPayload,
        seedDemoData,
      });
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint components/onboarding/onboarding-wizard.tsx`
Expected: only the pre-existing unused-import warnings already present before this change (no new errors).

- [ ] **Step 6: Browser-verify Step 1 gating**

Create `scripts/_reset-onboarding.ts`:

```ts
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { resetOnboarding } from "../lib/actions/onboarding.ts";

async function main() {
  getOrCreateLocalUser();
  await resetOnboarding();
  console.log("onboarding reset");
}
main();
```

Run: `npx --yes tsx scripts/_reset-onboarding.ts`

Then, with the dev server running (`preview_start` with the `dev` launch config — skip if another session's dev server already owns port 3308, in which case rely on that session's live reload instead of starting a second server):
1. Navigate to `/overview`. The wizard should open on Step 1.
2. Click Continue with all three fields empty. Expected: stays on Step 1, three red "Enter your ..." messages appear below Name/Email/Target role, "Skip setup" is not visible in the header.
3. Fill Name and Target role, leave Email empty. Click Continue. Expected: only the email error remains.
4. Type an email ending in `@attrack.local` (or leave the prefilled placeholder as-is if `userEmail` happens to be one). Click Continue. Expected: "Enter a valid email address" error.
5. Replace it with a real address (e.g. `test@example.com`). Click Continue. Expected: advances to Step 2, "Skip setup" is now visible in the header.

Create `scripts/_restore-onboarding.ts`:

```ts
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { skipOnboarding } from "../lib/actions/onboarding.ts";

async function main() {
  getOrCreateLocalUser();
  await skipOnboarding();
  console.log("onboarding restored");
}
main();
```

Run: `npx --yes tsx scripts/_restore-onboarding.ts` to put the real account back into "onboarded" state (this only sets `onboarded_at`, it doesn't touch the email/name/role you may have typed during the walkthrough — check `SELECT full_name FROM profiles`, `SELECT email FROM users` and revert by hand with a one-off `UPDATE` if the walkthrough left test values in place).

- [ ] **Step 7: Clean up and commit**

```bash
rm -f scripts/_reset-onboarding.ts scripts/_restore-onboarding.ts
git add components/onboarding/onboarding-wizard.tsx
git commit -m "feat: require name, email, and target role on onboarding step 1"
```

---

### Task 4: Avatar upload with success animation (Step 1)

**Files:**
- Modify: `components/onboarding/onboarding-wizard.tsx`

**Interfaces:**
- Consumes: `saveAvatar` from Task 1 (`lib/actions/auth.ts`); `fullName`/`email` state from Task 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports**

At the top of `components/onboarding/onboarding-wizard.tsx`, add to the existing import block:

```ts
import { motion, AnimatePresence } from "motion/react";
import { saveAvatar } from "@/lib/actions/auth";
```

Add `Camera` to the existing `lucide-react` import list (alongside `User`, `Briefcase`, etc.).

- [ ] **Step 2: Add avatar state and upload handler**

Near the other Step 1 state (after the `step1Errors`/`isStep1Valid` block added in Task 3):

```ts
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarJustUploaded, setAvatarJustUploaded] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a JPG, PNG, or GIF image");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("File size must be less than 500KB");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await saveAvatar(formData);
      if (result.success && result.avatarUrl) {
        setAvatarPreview(result.avatarUrl);
        setAvatarJustUploaded(true);
        setTimeout(() => setAvatarJustUploaded(false), 700);
      } else {
        toast.error(result.error || "Couldn't upload avatar");
      }
    } catch {
      toast.error("Couldn't upload avatar");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };
```

- [ ] **Step 3: Add the avatar UI to Step 1**

At the top of the Step 1 body, immediately after the header block (`<h3>Tell us about yourself</h3>...`) and before the `<div className="space-y-3.5 pt-1">` field block from Task 3:

```tsx
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-medium text-primary-foreground ring-4 ring-background">
                    <AnimatePresence mode="wait">
                      {avatarPreview ? (
                        <motion.img
                          key="photo"
                          src={avatarPreview}
                          alt="Your avatar"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className="size-full object-cover"
                        />
                      ) : (
                        <motion.span
                          key="initials"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {(fullName || "U").trim().charAt(0).toUpperCase()}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  {avatarJustUploaded && (
                    <motion.span
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-card text-foreground ring-2 ring-background transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {avatarUploading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Profile photo</p>
                  <p className="text-[11px] text-muted-foreground">Optional — JPG, PNG or GIF, max 500KB</p>
                </div>
              </div>
```

Not part of `isStep1Valid` — Continue works with or without a photo.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint components/onboarding/onboarding-wizard.tsx`
Expected: only pre-existing warnings.

- [ ] **Step 5: Browser-verify the upload and animation**

Reuse `scripts/_reset-onboarding.ts` from Task 3 (recreate it if already deleted) and run it, then open `/overview` so the wizard is on Step 1.

Browser `<input type="file">` can't be driven by an OS file dialog through the automation tools available in this session, so trigger the change event directly with a synthetic file (this also proves `handleAvatarSelect` end-to-end without relying on a manual click):

```js
(function () {
  const input = document.querySelector('input[type="file"][accept*="image/jpeg"]');
  const png = Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
  ), c => c.charCodeAt(0));
  const file = new File([png], "test-avatar.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return "dispatched";
})();
```

Expected after a moment: the avatar circle shows the uploaded image instead of the initial, and no error toast appeared. Confirm via:

```js
document.querySelector('img[alt="Your avatar"]')?.src ?? "not found"
```

Expected: a `data:` or `/storage/...` URL, not `"not found"`.

Run `scripts/_restore-onboarding.ts` (recreate from Task 3 if deleted) afterward to restore the onboarded state, and manually revert `profiles.avatar_url` for the real account if the walkthrough set it to the test image (`UPDATE profiles SET avatar_url = NULL WHERE id = '<real user id>'` via a one-off script, or leave it if the account had no avatar before — check first with `SELECT avatar_url FROM profiles`).

- [ ] **Step 6: Clean up and commit**

```bash
rm -f scripts/_reset-onboarding.ts scripts/_restore-onboarding.ts
git add components/onboarding/onboarding-wizard.tsx
git commit -m "feat: add optional avatar upload with success animation to onboarding"
```

---

### Task 5: Persistent Getting Started reminder

**Files:**
- Modify: `components/onboarding/getting-started-widget.tsx`

**Interfaces:**
- Consumes: existing `hasResume`, `hasAiProvider` props (already passed by `app/(dashboard)/overview/page.tsx:245-252`, no caller change needed).
- Produces: nothing consumed by other tasks (independent of Tasks 1-4).

- [ ] **Step 1: Add the dismiss gate**

In `components/onboarding/getting-started-widget.tsx`, immediately after `const [celebrating, setCelebrating] = useState(false);` (currently line 50), add:

```ts
  // The card must stay reachable until the two hard-required items are done —
  // resume for match scoring, AI provider for Ask Tracky chat. Jobs/chat stay
  // freely dismissible, they were never part of that requirement.
  const isDismissible = hasResume && hasAiProvider;
```

- [ ] **Step 2: Make the mount effect retroactive**

Replace the existing mount effect (currently lines 64-67):

```ts
  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(isDismissed && isDismissible);
  }, [isDismissible]);
```

This means an install where the card was already dismissed under the old (permanent) behavior, but resume or AI provider is still missing, shows the card again once this ships — not just future dismiss attempts.

- [ ] **Step 3: Guard `handleDismiss`**

Replace the existing `handleDismiss` (currently lines 132-135):

```ts
  const handleDismiss = () => {
    if (!isDismissible) return;
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };
```

- [ ] **Step 4: Hide the X button while not dismissible**

In the standard checklist header (currently lines 255-261), wrap the dismiss button:

```tsx
                  {isDismissible && (
                    <button
                      onClick={handleDismiss}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                      title="Dismiss guide"
                    >
                      <X className="size-4" />
                    </button>
                  )}
```

The collapse/chevron button just above it is unchanged — collapsing is a local fold, not a permanent hide, so it stays available regardless of `isDismissible`.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint components/onboarding/getting-started-widget.tsx`
Expected: no new errors.

- [ ] **Step 6: Browser-verify against the real account state**

Create `scripts/_check-onboarding-status.ts`:

```ts
import { getOrCreateLocalUser } from "../lib/db/local-user.ts";
import { getOnboardingStatus } from "../lib/actions/onboarding.ts";

async function main() {
  getOrCreateLocalUser();
  const status = await getOnboardingStatus();
  console.log(JSON.stringify(status, null, 2));
}
main();
```

Run: `npx --yes tsx scripts/_check-onboarding-status.ts` — read-only, nothing to restore.

Note the printed `hasResume` and `hasAiProvider`. In the browser, navigate to `/overview` (clear `localStorage.removeItem("attrack-getting-started-dismissed")` via the JS console first, so any leftover flag from earlier testing doesn't hide the card outright):
- If either value is `false`: confirm the Getting Started card's dismiss `X` is **absent** (only the collapse chevron shows).
- If both are `true`: confirm the `X` **is** present, click it, confirm the card goes away, then confirm `localStorage.getItem("attrack-getting-started-dismissed")` is `"true"`.

- [ ] **Step 7: Clean up and commit**

```bash
rm -f scripts/_check-onboarding-status.ts
git add components/onboarding/getting-started-widget.tsx
git commit -m "fix: keep getting-started reminder until resume and AI provider are set"
```

---

### Task 6: Full walkthrough and final verification

**Files:** none (verification-only).

**Interfaces:** none.

- [ ] **Step 1: Full type-check and lint pass**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint lib/actions/auth.ts lib/actions/onboarding.ts components/onboarding/onboarding-wizard.tsx components/onboarding/getting-started-widget.tsx`
Expected: zero `error`-level results. `warning`-level unused-import/unused-variable results are fine if they point at code this plan didn't touch (check with `git log -p -1 -- <file>` before Task 1 if unsure whether a given warning predates this plan) — only warnings on lines this plan added are worth fixing.

- [ ] **Step 2: End-to-end browser walkthrough**

With a dev server available (start one with `preview_start` if no session already has port 3308 open):

1. Recreate and run a reset script equivalent to `scripts/_reset-onboarding.ts` (Task 3), then open `/overview`.
2. Confirm Step 1 blocks Continue on empty fields, accepts a real name/email/role, and that the avatar upload (synthetic file per Task 4 Step 5) animates in.
3. Advance through Steps 2-4 using "Skip setup" or Continue as convenient, finish onboarding.
4. On `/overview`, confirm the Getting Started card reflects the real `hasResume`/`hasAiProvider` state and its dismiss `X` visibility matches Task 5's rule.
5. Restore onboarding/profile/email state to what it was before this session's testing (skip onboarding back to "done", revert any test name/email/avatar left over from the walkthrough) using the same restore pattern from Tasks 3-4.

- [ ] **Step 3: Confirm no stray files**

Run: `git status --short`
Expected: only the five files this plan modified (`lib/actions/auth.ts`, `lib/actions/onboarding.ts`, `components/onboarding/onboarding-wizard.tsx`, `components/onboarding/getting-started-widget.tsx`) plus this plan and its spec doc — no leftover `scripts/_*.ts` scratch files.

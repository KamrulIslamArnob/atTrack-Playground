# CRM Contact Popup + Card View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRM Contacts tab's table + inline create form with a popup dialog (name, email, company, position, phone, free-text tag, LinkedIn, GitHub, notes with `@job` mentions) and a card grid, filterable by company and tag.

**Architecture:** Three new small modules (a hand-written `Dialog` UI primitive mirroring the existing `Sheet`, a `lib/mentions.ts` parser for the `@[title](job:id)` token, and a shared `ContactFormDialog`/`ContactCard` pair) plug into the existing `lib/actions/contacts.ts` server actions (extended with 3 new columns) and replace the relevant chunk of `components/crm/crm-view.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@base-ui/react` (already a dependency, used by `Sheet`), Tailwind v4, local SQLite (`lib/db/`). No test framework in this repo — verification is `npm run lint`, `npm run build`, `node lib/db/selfcheck.ts`, and manual dev-server checks, matching repo convention.

## Global Constraints

- No test framework exists (no jest/vitest, no `*.test.*`) — do not add one. Follow the repo's plain-`assert` self-check pattern (`lib/db/selfcheck.ts`) for the one piece of non-trivial parsing logic (Task 2).
- New JSON/boolean columns must be registered in `lib/db/meta.ts` — not applicable here, all three new columns are plain `TEXT`.
- New columns require **both** `lib/db/schema.sql` (`CREATE TABLE IF NOT EXISTS`, harmless on existing DBs) **and** an entry in `COLUMN_MIGRATIONS` in `lib/db/sqlite.ts` (the `ALTER TABLE` that actually reaches an existing `.data/attrack.db`).
- `components/ui/*` are meant to be shadcn-style primitives; `Dialog` is hand-written using `@base-ui/react/dialog` mirroring `components/ui/sheet.tsx` exactly (same primitive, centered instead of side-anchored) — this stays consistent with the repo's actual pattern without depending on shadcn CLI network access.
- Every `contacts` table write must stay scoped by `.eq("user_id", userId)` (no RLS in this SQLite build) — follow the existing pattern in every function touched.
- Single free-text tag per contact (reuses the `role` column, not renamed). No new tags table, no multi-tag support.
- `@` mentions are real links (`@[Job Title](job:jobId)` embedded in the `notes` TEXT column), not plain text.
- Card grid fully replaces the Contacts-tab table. The Companies-tab nested `ContactsPanel` list layout is unchanged — only its create form becomes the shared dialog.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/db/schema.sql` | modify | add `position`, `linkedin_url`, `github_url` to `contacts` |
| `lib/db/sqlite.ts` | modify | `COLUMN_MIGRATIONS` entries for the 3 columns |
| `lib/mentions.ts` | create | `parseNoteMentions()` / `insertMentionToken()` — the `@[title](job:id)` token format |
| `lib/mentions.selfcheck.ts` | create | runnable assert-based check for the parser |
| `lib/actions/contacts.ts` | modify | `Contact` interface + all reads/writes gain the 3 columns; `updateContact` gains `company_id` |
| `lib/actions/jobs-list.ts` | modify | add `getJobsForMention()` |
| `components/ui/dialog.tsx` | create | centered modal primitive, sibling to `sheet.tsx` |
| `components/crm/contact-form-dialog.tsx` | create | the popup — all fields, tag `<datalist>`, `@mention` popover |
| `components/crm/contact-card.tsx` | create | one contact as a card, renders notes with mention links |
| `components/crm/crm-view.tsx` | modify | `ContactsView` table → card grid + tag filter; `ContactsPanel` create form → shared dialog |

---

### Task 1: `contacts` table gains position / LinkedIn / GitHub

**Files:**
- Modify: `lib/db/schema.sql:233-244`
- Modify: `lib/db/sqlite.ts:54-62`

**Interfaces:**
- Produces: three new nullable `TEXT` columns on `contacts` — `position`, `linkedin_url`, `github_url` — that every later task reads/writes.

- [ ] **Step 1: Add the columns to the table definition**

In `lib/db/schema.sql`, the `contacts` table currently reads:

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

Change it to:

```sql
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  position TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```

- [ ] **Step 2: Add the ALTER TABLE migrations**

In `lib/db/sqlite.ts`, `COLUMN_MIGRATIONS` currently ends with:

```ts
  { table: "documents", column: "updated_at", ddl: "ALTER TABLE documents ADD COLUMN updated_at TEXT" },
];
```

Add three entries before the closing `];`:

```ts
  { table: "documents", column: "updated_at", ddl: "ALTER TABLE documents ADD COLUMN updated_at TEXT" },
  { table: "contacts", column: "position", ddl: "ALTER TABLE contacts ADD COLUMN position TEXT" },
  { table: "contacts", column: "linkedin_url", ddl: "ALTER TABLE contacts ADD COLUMN linkedin_url TEXT" },
  { table: "contacts", column: "github_url", ddl: "ALTER TABLE contacts ADD COLUMN github_url TEXT" },
];
```

- [ ] **Step 3: Verify against a real database**

Run:

```bash
node lib/db/selfcheck.ts
```

Expected: all assertions pass (it opens its own throwaway DB via `SQLITE_PATH`, exercising `open()` → `addMissingColumns()`, so a typo in the DDL fails loudly here).

Then confirm the running app's own `.data/attrack.db` (if it exists) still opens without error:

```bash
node -e "process.env.SQLITE_PATH='.data/attrack.db'; import('./lib/db/sqlite.ts').then(m => { m.getDb(); console.log('ok'); })"
```

Expected: prints `ok` (or, on a fresh checkout with no `.data/` yet, creates one and prints `ok`).

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.sql lib/db/sqlite.ts
git commit -m "feat(crm): add position/linkedin_url/github_url columns to contacts"
```

---

### Task 2: `@job` mention token parser

**Files:**
- Create: `lib/mentions.ts`
- Create: `lib/mentions.selfcheck.ts`

**Interfaces:**
- Produces: `insertMentionToken(title: string, jobId: string): string`, `parseNoteMentions(note: string): NoteSegment[]`, `interface NoteSegment { text: string; jobId?: string }` — consumed by Task 5 (writing mentions) and Task 6 (rendering them).

- [ ] **Step 1: Write `lib/mentions.ts`**

```ts
// A contact's note can embed a link to a saved job, written inline as
// @[Job Title](job:jobId) — no separate mentions table, the token lives in
// the plain-text `notes` column. This module is the only place that knows
// the token's shape: writers call insertMentionToken, readers call
// parseNoteMentions.

const MENTION_PATTERN = /@\[([^\]]+)\]\(job:([^)]+)\)/g;

export interface NoteSegment {
  text: string;
  /** Present only on the segment that is a mention; absent on plain text. */
  jobId?: string;
}

export function insertMentionToken(jobTitle: string, jobId: string): string {
  return `@[${jobTitle}](job:${jobId})`;
}

export function parseNoteMentions(note: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let lastIndex = 0;

  for (const match of note.matchAll(MENTION_PATTERN)) {
    const [full, title, jobId] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: note.slice(lastIndex, index) });
    segments.push({ text: title, jobId });
    lastIndex = index + full.length;
  }

  if (lastIndex < note.length) segments.push({ text: note.slice(lastIndex) });
  return segments;
}
```

- [ ] **Step 2: Write the self-check**

```ts
// Run with: node lib/mentions.selfcheck.ts
// Plain asserts, no framework — matches lib/db/selfcheck.ts's convention.

import assert from "node:assert/strict";

const { parseNoteMentions, insertMentionToken } = await import("./mentions.ts");

// Plain text, no mention.
assert.deepEqual(parseNoteMentions("Met at the career fair."), [
  { text: "Met at the career fair." },
]);

// Mention in the middle.
const token = insertMentionToken("Frontend Engineer", "job-123");
assert.equal(token, "@[Frontend Engineer](job:job-123)");
assert.deepEqual(parseNoteMentions(`Referred me for ${token} last week.`), [
  { text: "Referred me for " },
  { text: "Frontend Engineer", jobId: "job-123" },
  { text: " last week." },
]);

// Mention at the very start and very end, two mentions.
const a = insertMentionToken("A", "1");
const b = insertMentionToken("B", "2");
assert.deepEqual(parseNoteMentions(`${a} and ${b}`), [
  { text: "A", jobId: "1" },
  { text: " and " },
  { text: "B", jobId: "2" },
]);

// Empty note.
assert.deepEqual(parseNoteMentions(""), []);

console.log("lib/mentions.ts self-check: all assertions passed");
```

- [ ] **Step 3: Run it**

```bash
node lib/mentions.selfcheck.ts
```

Expected: `lib/mentions.ts self-check: all assertions passed`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/mentions.ts lib/mentions.selfcheck.ts
git commit -m "feat(crm): add @job mention token parser for contact notes"
```

---

### Task 3: Server actions — contacts gain the 3 fields, + `getJobsForMention`

**Files:**
- Modify: `lib/actions/contacts.ts`
- Modify: `lib/actions/jobs-list.ts`

**Interfaces:**
- Consumes: nothing new (same `getUser()`/`supabase` shim as every other action file).
- Produces: `Contact` interface gains `position: string | null`, `linkedin_url: string | null`, `github_url: string | null`. `updateContact(id, formData)` now also writes `company_id`. `getJobsForMention(): Promise<{ id: string; title: string; company_name: string | null }[]>` in `lib/actions/jobs-list.ts`.

- [ ] **Step 1: Extend the `Contact` and `RawContactRow` shapes**

In `lib/actions/contacts.ts`, replace:

```ts
export interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  company_id: string | null;
  company_name: string | null;
}

interface RawContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  company_id: string | null;
  company: { name: string } | null;
}

function toContact(row: RawContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    company_id: row.company_id,
    company_name: row.company?.name ?? null,
  };
}
```

with:

```ts
export interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  notes: string | null;
  company_id: string | null;
  company_name: string | null;
}

interface RawContactRow {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  notes: string | null;
  company_id: string | null;
  company: { name: string } | null;
}

function toContact(row: RawContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    position: row.position,
    linkedin_url: row.linkedin_url,
    github_url: row.github_url,
    notes: row.notes,
    company_id: row.company_id,
    company_name: row.company?.name ?? null,
  };
}
```

- [ ] **Step 2: Add the 3 columns to every `select()` call**

Four call sites in the same file select the same column list:
`"id, name, role, email, phone, notes, company_id, company:companies(name)"`
(in `getContacts`, `getJobContacts`'s embedded `contact:contacts(...)`, `getCompanyContacts`, `getOrphanContacts`).

Replace each occurrence of that exact string with:

```
"id, name, role, email, phone, position, linkedin_url, github_url, notes, company_id, company:companies(name)"
```

(In `getJobContacts` it appears inside `"contact:contacts(...)"` — same substring, same replacement, just nested.)

- [ ] **Step 3: `createContact` gains the 3 fields**

Replace:

```ts
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create contact.");

  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contact.id });
```

with:

```ts
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to create contact.");

  await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contact.id });
```

- [ ] **Step 4: `updateContact` gains the 3 fields plus `company_id`**

Replace the whole function:

```ts
export async function updateContact(id: string, formData: FormData): Promise<void> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update contact.");
  await logResourceActivity(userId, "update", "contact", id, { name });
}
```

with:

```ts
export async function updateContact(id: string, formData: FormData): Promise<void> {
  const { supabase, userId } = await getUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Contact name is required.");

  const companyId = (formData.get("company_id") as string) || null;
  if (companyId) {
    const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", userId).single();
    if (!company) throw new Error("Company not found.");
  }

  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update contact.");
  await logResourceActivity(userId, "update", "contact", id, { name });
}
```

(The `updateContact` callers in `components/crm/crm-view.tsx` — `handleRoleChange` in both `ContactsView` and `ContactsPanel` — don't append a `company_id` field to their `FormData`. That's fine: `formData.get("company_id")` is `null` there, so this changes their behavior from "leave company unchanged" to "clear company" for those two specific call sites. Fix that in Task 7 by having those two call sites append `contact.company_id` to the `FormData` before calling `updateContact`, so their behavior is unchanged.)

- [ ] **Step 5: `createCompanyContact` and `createPersonContact` gain the 3 fields**

In `createCompanyContact`, replace:

```ts
      role: (formData.get("role") as string) || "other",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
```

with:

```ts
      role: (formData.get("role") as string) || "other",
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      position: (formData.get("position") as string) || null,
      linkedin_url: (formData.get("linkedin_url") as string) || null,
      github_url: (formData.get("github_url") as string) || null,
      notes: (formData.get("notes") as string) || null,
      company_id: companyId,
```

In `createPersonContact`, apply the identical replacement (same 5 lines, same insert shape).

- [ ] **Step 6: Add `getJobsForMention` to `lib/actions/jobs-list.ts`**

Append to the end of `lib/actions/jobs-list.ts`:

```ts
export interface JobMentionOption {
  id: string;
  title: string;
  company_name: string | null;
}

/** Lightweight job list for the CRM notes' @mention picker — not the paginated /jobs listing. */
export async function getJobsForMention(): Promise<JobMentionOption[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company:companies(name)")
    .eq("user_id", userId)
    .order("title", { ascending: true });

  if (error) {
    console.error("Error fetching jobs for mention:", error);
    return [];
  }

  return ((data ?? []) as unknown as { id: string; title: string; company: { name: string } | null }[]).map((row) => ({
    id: row.id,
    title: row.title,
    company_name: row.company?.name ?? null,
  }));
}
```

- [ ] **Step 7: Verify**

```bash
npm run lint
```

Expected: no errors in `lib/actions/contacts.ts` or `lib/actions/jobs-list.ts`.

```bash
node lib/db/selfcheck.ts
```

Expected: still passes (query-builder behavior is untouched, only column lists grew).

- [ ] **Step 8: Commit**

```bash
git add lib/actions/contacts.ts lib/actions/jobs-list.ts
git commit -m "feat(crm): wire position/linkedin_url/github_url through contact actions, add getJobsForMention"
```

---

### Task 4: `Dialog` UI primitive

**Files:**
- Create: `components/ui/dialog.tsx`

**Interfaces:**
- Consumes: `@base-ui/react/dialog`'s `Dialog` export (same package `components/ui/sheet.tsx` uses).
- Produces: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` — consumed by Task 5.

- [ ] **Step 1: Write the file**

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border bg-popover bg-clip-padding p-6 text-sm text-popover-foreground shadow-xl transition duration-200 ease-in-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4 bg-secondary"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5", className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors attributable to `components/ui/dialog.tsx` (pre-existing unrelated errors, if any, are not this task's concern).

- [ ] **Step 3: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat(ui): add Dialog primitive (centered variant of Sheet)"
```

---

### Task 5: `ContactFormDialog`

**Files:**
- Create: `components/crm/contact-form-dialog.tsx`

**Interfaces:**
- Consumes:
  - `Contact`, `createPersonContact`, `createCompanyContact`, `updateContact` from `lib/actions/contacts.ts` (Task 3)
  - `CrmCompany` from `lib/actions/companies.ts` (existing)
  - `getJobsForMention`, `JobMentionOption` from `lib/actions/jobs-list.ts` (Task 3)
  - `insertMentionToken` from `lib/mentions.ts` (Task 2)
  - `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle` from `components/ui/dialog.tsx` (Task 4)
  - `Command`, `CommandList`, `CommandGroup`, `CommandItem` from `components/ui/command.tsx` (existing)
- Produces: `ContactFormDialog` component, `export function contactRoleLabel`-adjacent `CONTACT_ROLES` reuse from `lib/types/contacts.ts` — consumed by Task 7.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  createCompanyContact,
  createPersonContact,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { getJobsForMention, type JobMentionOption } from "@/lib/actions/jobs-list";
import { insertMentionToken } from "@/lib/mentions";
import type { CrmCompany } from "@/lib/actions/companies";

const NO_COMPANY = "__none__";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present => edit that contact. Absent => create. */
  contact?: Contact;
  companies: CrmCompany[];
  /** Create-mode only: pins the new contact to this company and hides the picker. */
  lockedCompanyId?: string;
  tagSuggestions: string[];
  onSaved: (contact: Contact) => void;
}

function extractFields(formData: FormData) {
  return {
    name: (formData.get("name") as string)?.trim() ?? "",
    role: (formData.get("role") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    position: (formData.get("position") as string) || null,
    linkedin_url: (formData.get("linkedin_url") as string) || null,
    github_url: (formData.get("github_url") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  companies,
  lockedCompanyId,
  tagSuggestions,
  onSaved,
}: ContactFormDialogProps) {
  const mode = contact ? "edit" : "create";
  const tagListId = useId();
  const [pending, setPending] = useState(false);
  const [companyId, setCompanyId] = useState<string>(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [jobOptions, setJobOptions] = useState<JobMentionOption[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state whenever a different contact is opened, or the dialog re-opens for "create".
  useEffect(() => {
    if (!open) return;
    setCompanyId(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
    setNotes(contact?.notes ?? "");
    setMention(null);
  }, [open, contact, lockedCompanyId]);

  useEffect(() => {
    if (!open) return;
    getJobsForMention().then(setJobOptions);
  }, [open]);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? null;

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    const caret = e.target.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const at = uptoCaret.lastIndexOf("@");
    if (at === -1 || /\s/.test(uptoCaret.slice(at + 1))) {
      setMention(null);
    } else {
      setMention({ start: at, query: uptoCaret.slice(at + 1) });
    }
  };

  const pickMentionJob = (job: JobMentionOption) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? notes.length;
    const before = notes.slice(0, mention.start);
    const after = notes.slice(caret);
    const token = insertMentionToken(job.title, job.id);
    const next = `${before}${token} ${after}`;
    setNotes(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = (before + token + " ").length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const filteredJobs = mention
    ? jobOptions.filter((j) => j.title.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value.trim()) {
      toast.error("Name is required");
      return;
    }
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const fields = extractFields(formData);
      const resolvedCompanyId = lockedCompanyId ?? (companyId === NO_COMPANY ? null : companyId);

      if (mode === "edit" && contact) {
        formData.set("company_id", resolvedCompanyId ?? "");
        await updateContact(contact.id, formData);
        onSaved({
          ...contact,
          ...fields,
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      } else if (lockedCompanyId) {
        const { id } = await createCompanyContact(lockedCompanyId, formData);
        onSaved({
          id,
          ...fields,
          company_id: lockedCompanyId,
          company_name: companyName(lockedCompanyId),
        });
      } else {
        if (resolvedCompanyId) formData.set("company_id", resolvedCompanyId);
        const { id } = await createPersonContact(formData);
        onSaved({
          id,
          ...fields,
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      }
      onOpenChange(false);
    } catch {
      toast.error(mode === "edit" ? "Could not update contact" : "Could not create contact");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name *</Label>
              <Input id="contact-name" name="name" required defaultValue={contact?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {lockedCompanyId ? (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">{companyName(lockedCompanyId)}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? NO_COMPANY)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="No company">
                      {companyId === NO_COMPANY ? "No company" : companyName(companyId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="contact-position">Position</Label>
              <Input id="contact-position" name="position" placeholder="e.g. Software Engineer" defaultValue={contact?.position ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" name="phone" defaultValue={contact?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-tag">Tag</Label>
              <Input
                id="contact-tag"
                name="role"
                list={tagListId}
                placeholder="e.g. Alumni, HR, Technical Lead"
                defaultValue={contact?.role ?? ""}
              />
              <datalist id={tagListId}>
                {tagSuggestions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-linkedin">LinkedIn</Label>
              <Input id="contact-linkedin" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" defaultValue={contact?.linkedin_url ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-github">GitHub</Label>
              <Input id="contact-github" name="github_url" type="url" placeholder="https://github.com/…" defaultValue={contact?.github_url ?? ""} />
            </div>
          </div>

          <div className="relative space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              name="notes"
              ref={textareaRef}
              rows={3}
              placeholder="Type @ to link a saved job…"
              value={notes}
              onChange={handleNotesChange}
            />
            {mention && filteredJobs.length > 0 && (
              <Command className="absolute z-10 mt-1 w-full" value="">
                <CommandList>
                  <CommandGroup heading="Link a job">
                    {filteredJobs.map((job) => (
                      <CommandItem key={job.id} onItemSelect={() => pickMentionJob(job)}>
                        {job.title}
                        {job.company_name ? ` — ${job.company_name}` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {mode === "edit" ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors from `components/crm/contact-form-dialog.tsx` (it isn't imported anywhere yet, so a bad prop type would still surface as a type error inside the file itself).

- [ ] **Step 3: Commit**

```bash
git add components/crm/contact-form-dialog.tsx
git commit -m "feat(crm): add ContactFormDialog with tag datalist and @job mention picker"
```

---

### Task 6: `ContactCard`

**Files:**
- Create: `components/crm/contact-card.tsx`

**Interfaces:**
- Consumes: `Contact` from `lib/actions/contacts.ts`, `parseNoteMentions` from `lib/mentions.ts`, `contactRoleLabel` is **not** used (tag is free text now, rendered as-is).
- Produces: `ContactCard` component — consumed by Task 7.

- [ ] **Step 1: Write the file**

```tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { parseNoteMentions } from "@/lib/mentions";
import type { Contact } from "@/lib/actions/contacts";
import { Building2, Github, Linkedin, Mail, Phone, Trash2 } from "lucide-react";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NotePreview({ notes }: { notes: string }) {
  const segments = parseNoteMentions(notes);
  return (
    <p className="line-clamp-2 text-xs text-muted-foreground">
      {segments.map((segment, i) =>
        segment.jobId ? (
          <Link key={i} href={`/jobs/${segment.jobId}`} className="font-medium text-primary hover:underline">
            {segment.text}
          </Link>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onEdit(contact)} className="flex min-w-0 items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initials(contact.name) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{contact.name}</p>
            {contact.position && <p className="truncate text-xs text-muted-foreground">{contact.position}</p>}
          </div>
        </button>
        <button
          onClick={() => onDelete(contact)}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete contact"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {contact.role && <Badge variant="secondary">{contact.role}</Badge>}
        {contact.company_name && (
          <Badge variant="outline">
            <Building2 className="mr-1 size-3" />
            {contact.company_name}
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {contact.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="size-3 shrink-0" /> <span className="truncate">{contact.email}</span>
          </p>
        )}
        {contact.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3 shrink-0" /> {contact.phone}
          </p>
        )}
      </div>

      {(contact.linkedin_url || contact.github_url) && (
        <div className="flex gap-2">
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="LinkedIn">
              <Linkedin className="size-4" />
            </a>
          )}
          {contact.github_url && (
            <a href={contact.github_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
              <Github className="size-4" />
            </a>
          )}
        </div>
      )}

      {contact.notes && <NotePreview notes={contact.notes} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors from `components/crm/contact-card.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/crm/contact-card.tsx
git commit -m "feat(crm): add ContactCard with tag/company badges and mention-aware note preview"
```

---

### Task 7: Wire it into `crm-view.tsx`

**Files:**
- Modify: `components/crm/crm-view.tsx`

**Interfaces:**
- Consumes: `ContactFormDialog` (Task 5), `ContactCard` (Task 6), extended `Contact` (Task 3).
- Produces: nothing new for later tasks — this is the integration point.

- [ ] **Step 1: Update imports**

Replace the top of the file's imports:

```tsx
import {
  createCompanyContact,
  createPersonContact,
  deleteContact,
  getCompanyContacts,
  getOrphanContacts,
  setContactCompany,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { createCompany, getCompanyJobs, type CompanyJob, type CrmCompany } from "@/lib/actions/companies";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Link2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
```

with:

```tsx
import {
  createCompanyContact,
  deleteContact,
  getCompanyContacts,
  getOrphanContacts,
  setContactCompany,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { createCompany, getCompanyJobs, type CompanyJob, type CrmCompany } from "@/lib/actions/companies";
import { CONTACT_ROLES, contactRoleLabel } from "@/lib/types/contacts";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/types/job";
import { ContactFormDialog } from "@/components/crm/contact-form-dialog";
import { ContactCard } from "@/components/crm/contact-card";
import {
  Briefcase,
  Building2,
  ChevronDown,
  Link2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
```

`createPersonContact` is no longer called directly from this file — `ContactFormDialog` calls it internally now. `contactRoleLabel`/`CONTACT_ROLES` and `Mail`/`Phone` stay imported: `ContactsView`'s own copies of the fixed-role `Select` and the table are gone (Step 2), but `ContactsPanel` (its nested "linking" picker and its own compact per-item role `Select`, both untouched by this plan — see Step 3) still calls `contactRoleLabel` and still renders `Mail`/`Phone` icons.

- [ ] **Step 2: Rewrite `ContactsView`**

Replace the entire `ContactsView` function (from `function ContactsView({` through its closing `}` before `/** Company-grouped view`) with:

```tsx
/** Person-first roster — every contact regardless of company, with company as a filterable/reassignable tag. */
function ContactsView({
  initialContacts,
  companies,
  onCompanyCountChange,
}: {
  initialContacts: Contact[];
  companies: CrmCompany[];
  onCompanyCountChange: (companyId: string | null, delta: number) => void;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? null;

  const distinctTags = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.role).filter((r): r is string => !!r))).sort(),
    [contacts]
  );
  const tagSuggestions = useMemo(
    () => Array.from(new Set([...CONTACT_ROLES.map((r) => r.label), ...distinctTags])).sort(),
    [distinctTags]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (companyFilter === "unassigned" && c.company_id) return false;
      if (companyFilter !== "all" && companyFilter !== "unassigned" && c.company_id !== companyFilter) return false;
      if (tagFilter !== "all" && c.role !== tagFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (companyName(c.company_id) ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, companyFilter, tagFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleSaved = (saved: Contact) => {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      const next = exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    if (!editingContact) {
      onCompanyCountChange(saved.company_id, 1);
    } else if (editingContact.company_id !== saved.company_id) {
      onCompanyCountChange(editingContact.company_id, -1);
      onCompanyCountChange(saved.company_id, 1);
    }
  };

  const handleDelete = async (contact: Contact) => {
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      onCompanyCountChange(contact.company_id, -1);
    } catch {
      toast.error("Could not remove contact");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {companyFilter === "all" ? "All companies" : companyFilter === "unassigned" ? "No company" : companyName(companyFilter)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            <SelectItem value="unassigned">No company</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={(v) => setTagFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue>{tagFilter === "all" ? "All tags" : tagFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {distinctTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          Add contact
        </Button>
      </div>

      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact ?? undefined}
        companies={companies}
        tagSuggestions={tagSuggestions}
        onSaved={handleSaved}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {contacts.length === 0 ? "No contacts yet." : "No contacts match."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add people directly, or they get pulled in automatically when AI spots a recruiter on a job posting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `ContactsPanel`'s create form to use the shared dialog**

`ContactsPanel` (inside `CompanyRow`) keeps its compact list rendering but swaps its inline `creating &&` form for `ContactFormDialog`, and its `handleRoleChange` must preserve `company_id` now that `updateContact` writes it (Task 3, Step 4).

Replace:

```tsx
function ContactsPanel({
  companyId,
  contacts,
  onContactsChange,
}: {
  companyId: string;
  contacts: Contact[];
  onContactsChange: (next: Contact[], countDelta: number) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState("other");
  const [linking, setLinking] = useState(false);
  const [orphans, setOrphans] = useState<Contact[] | null>(null);
  const [pending, setPending] = useState(false);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.append("role", newRole);
      const { id } = await createCompanyContact(companyId, formData);
      const newContact: Contact = {
        id,
        name: (formData.get("name") as string) || "",
        role: newRole,
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
        notes: null,
        company_id: companyId,
        company_name: null,
      };
      onContactsChange([...contacts, newContact], 1);
      setCreating(false);
      setNewRole("other");
    } catch {
      toast.error("Could not add contact");
    } finally {
      setPending(false);
    }
  };

  const openLinkPicker = async () => {
```

with:

```tsx
function ContactsPanel({
  companyId,
  contacts,
  onContactsChange,
}: {
  companyId: string;
  contacts: Contact[];
  onContactsChange: (next: Contact[], countDelta: number) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [linking, setLinking] = useState(false);
  const [orphans, setOrphans] = useState<Contact[] | null>(null);

  const openCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleSaved = (saved: Contact) => {
    const exists = contacts.some((c) => c.id === saved.id);
    onContactsChange(
      exists ? contacts.map((c) => (c.id === saved.id ? saved : c)) : [...contacts, saved],
      exists ? 0 : 1
    );
  };

  const openLinkPicker = async () => {
```

Then, further down in the same function, replace the "add contact" trigger button:

```tsx
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add contact"
          >
            <Plus className="size-3.5" />
          </button>
```

with:

```tsx
          <button
            type="button"
            onClick={openCreate}
            className="flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add contact"
          >
            <Plus className="size-3.5" />
          </button>
```

Delete the entire `{creating && (...)}` block (the inline `<form onSubmit={handleCreate} ...>`) and replace it with:

```tsx
      <ContactFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact ?? undefined}
        companies={[]}
        lockedCompanyId={companyId}
        tagSuggestions={CONTACT_ROLES.map((r) => r.label)}
        onSaved={handleSaved}
      />
```

(`companies={[]}` is safe here: `lockedCompanyId` is set, so `ContactFormDialog` never renders the company `Select` and never reads `companies` for anything other than that lookup.)

Finally, replace `handleRoleChange` (which currently rebuilds a `FormData` missing `company_id`, and drop the now-dead `newRole` state usage in the delete/role-change handlers) — replace:

```tsx
  const handleRoleChange = async (contact: Contact, role: string) => {
    try {
      const formData = new FormData();
      formData.append("name", contact.name);
      formData.append("role", role);
      if (contact.email) formData.append("email", contact.email);
      if (contact.phone) formData.append("phone", contact.phone);
      if (contact.notes) formData.append("notes", contact.notes);
      await updateContact(contact.id, formData);
      onContactsChange(
        contacts.map((c) => (c.id === contact.id ? { ...c, role } : c)),
        0
      );
    } catch {
      toast.error("Could not update role");
    }
  };
```

with:

```tsx
  const handleRoleChange = async (contact: Contact, role: string) => {
    try {
      const formData = new FormData();
      formData.append("name", contact.name);
      formData.append("role", role);
      if (contact.email) formData.append("email", contact.email);
      if (contact.phone) formData.append("phone", contact.phone);
      if (contact.position) formData.append("position", contact.position);
      if (contact.linkedin_url) formData.append("linkedin_url", contact.linkedin_url);
      if (contact.github_url) formData.append("github_url", contact.github_url);
      if (contact.notes) formData.append("notes", contact.notes);
      if (contact.company_id) formData.append("company_id", contact.company_id);
      await updateContact(contact.id, formData);
      onContactsChange(
        contacts.map((c) => (c.id === contact.id ? { ...c, role } : c)),
        0
      );
    } catch {
      toast.error("Could not update role");
    }
  };
```

Apply the identical fix to `ContactsView`'s sibling `handleRoleChange` — wait, `ContactsView` no longer has one after Step 2's rewrite (its role edit now goes through the shared dialog). This fix applies only here, in `ContactsPanel`, since it still edits role inline via its own compact-list `Select`.

Also add `position`/`linkedin_url`/`github_url` to the per-item rendering in `ContactsPanel`'s list (inside the `contacts.map((contact) => ...)` block) so edited/created values are visible there too — insert after the existing email/phone `<div>`:

```tsx
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" /> {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" /> {contact.phone}
                    </span>
                  )}
                  {contact.position && <span>{contact.position}</span>}
                </div>
```

(replacing the existing `<div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">...</div>` block in that map — same className, one more conditional line). Also wrap the contact's name in a button calling `openEdit(contact)`, matching `ContactCard`'s click-to-edit affordance — replace:

```tsx
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contact.name}</p>
```

with:

```tsx
              <div className="min-w-0">
                <button type="button" onClick={() => openEdit(contact)} className="truncate text-sm font-medium hover:underline">
                  {contact.name}
                </button>
```

(and close the extra `</button>` instead of the implicit end of the removed `<p>` — the JSX already closes with `</div>` right after, unaffected.)

- [ ] **Step 4: Verify — lint, typecheck, build**

```bash
npm run lint
```

Expected: no errors (in particular, no unused-import or unused-variable warnings for `pending`/`newRole`/`Mail`/`Phone`/`createPersonContact`/`contactRoleLabel`).

```bash
npx tsc --noEmit
```

Expected: no type errors.

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Manual verification pass**

```bash
npm run dev
```

Then, in a browser at `/crm`:

1. Contacts tab shows a card grid, not a table.
2. Click "Add contact" — dialog opens with all 8 fields. Leave everything blank except Name, submit — a card with just the name/initials appears.
3. Click "Add contact" again, fill every field including a brand-new tag (e.g. "Design Partner") and both URLs, type `@` in Notes, pick a job from the popover, finish the sentence, submit.
4. New card shows the tag badge, company badge, position, email, phone, clickable LinkedIn/GitHub icons, and the note with the job title rendered as a link; clicking the link navigates to `/jobs/[id]`.
5. Select that tag in the new Tag filter — only that card remains; switch back to "All tags".
6. Click the card's name — dialog reopens pre-filled with every field, including the mention token intact in Notes; change the company, save; the card's company badge updates and the Companies tab's contact counts shift accordingly.
7. Delete the card — it disappears and the company's contact count in the Companies tab decrements.
8. Switch to the Companies tab, expand a company with contacts, confirm its nested list still renders (unchanged layout), "+ Add contact" there opens the same dialog locked to that company (no company picker shown), and inline tag/role editing there still works without silently clearing the contact's company.

- [ ] **Step 6: Commit**

```bash
git add components/crm/crm-view.tsx
git commit -m "feat(crm): replace contacts table with card grid, wire ContactFormDialog, add tag filter"
```

---

## Self-Review Notes

- **Spec coverage:** every field in the spec's table (name, email, company, position, phone, tag, LinkedIn, GitHub, notes) is in `ContactFormDialog` (Task 5); card view (Task 6/7); company+tag filtering (Task 7 Step 2); `@job` mention embed+render (Tasks 2, 5, 6); Companies-tab panel keeps its list layout and gains the 3 fields (Task 7 Step 3); server actions extended (Task 3); schema/migration (Task 1).
- **Placeholder scan:** none — every step has literal file contents or exact diffs.
- **Type consistency:** `Contact` (Task 3) → `ContactFormDialogProps.contact` (Task 5) → `ContactCard`'s `contact` prop (Task 6) → `ContactsView`/`ContactsPanel` state (Task 7) all reference the same `lib/actions/contacts.ts` `Contact` type, never redefined locally. `JobMentionOption` (Task 3) flows unchanged into `ContactFormDialog` (Task 5). `NoteSegment`/`insertMentionToken`/`parseNoteMentions` (Task 2) signatures match their call sites in Tasks 5 and 6 exactly.
- **Scope:** single plan, one PR-sized change; no sub-project split needed.

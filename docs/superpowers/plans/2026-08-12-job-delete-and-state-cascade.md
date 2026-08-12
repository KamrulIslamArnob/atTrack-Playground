# Smart Job Delete & Job State Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement smart cascading job deletion in the Company tab (and card menus) that safely removes unshared company, contact, and document records, alongside job state management (Active, On Hold, Archive) with collapsible board column drawers and grayscale visual styling.

**Architecture:** Extend SQLite `jobs` table with a `state` column. Add transaction-safe server action `deleteJobWithSmartCascade(jobId)` that checks entity usage counts before deletion. Update `BoardColumn` to filter cards into Active (top) and collapsible On Hold / Archived drawers (bottom) with CSS `grayscale hover:grayscale-0` visual states.

**Tech Stack:** Next.js Server Actions, SQLite (via `lib/db/client.ts`), React, Tailwind CSS, Lucide Icons, Sonner toasts.

## Global Constraints

- Preserve all existing API signatures and database schemas.
- Ensure all cascade checks are executed in a single atomic transaction or clean sequential checks.
- Do not delete companies, contacts, or documents if they are linked to 2+ jobs or marked as default/primary.
- Keep board drag-and-drop operations functional across all states.

---

### Task 1: Schema & Type Definitions Update

**Files:**
- Modify: `lib/db/schema.sql`
- Modify: `lib/db/sqlite.ts`
- Modify: `lib/types/job.ts`
- Modify: `lib/types/board.ts`

**Interfaces:**
- Produces: `JobState` type (`'active' | 'on_hold' | 'archived'`), `state` property on `BoardCard` and `JobDetailData['job']`.

- [ ] **Step 1: Update SQLite schema definitions**

Modify `lib/db/schema.sql` to add `state` column definition to `jobs` table:
```sql
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','on_hold','archived')),
```
And add migration check in `lib/db/sqlite.ts`:
```ts
const hasState = db.prepare("PRAGMA table_info(jobs)").all().some((col: any) => col.name === "state");
if (!hasState) {
  db.exec("ALTER TABLE jobs ADD COLUMN state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','on_hold','archived'));");
}
```

- [ ] **Step 2: Update TypeScript types**

In `lib/types/job.ts`:
```ts
export type JobState = 'active' | 'on_hold' | 'archived';
```
In `lib/types/board.ts`:
Add `state: JobState;` to `BoardCard` interface.

- [ ] **Step 3: Verify schema and type compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.sql lib/db/sqlite.ts lib/types/job.ts lib/types/board.ts
git commit -m "feat(schema): add job state column and type definitions"
```

---

### Task 2: Server Actions for Smart Delete Cascade & Job State Update

**Files:**
- Modify: `lib/actions/jobs.ts`
- Create: `lib/db/__tests__/cascade-delete.test.ts` (or validation script)

**Interfaces:**
- Produces: `deleteJobWithSmartCascade(jobId: string)`, `updateJobState(jobId: string, state: JobState)`.

- [ ] **Step 1: Implement `deleteJobWithSmartCascade`**

In `lib/actions/jobs.ts`:
```ts
export async function deleteJobWithSmartCascade(jobId: string): Promise<{ success: boolean; companyDeleted: boolean }> {
  const { supabase, userId } = await getUser();

  // 1. Get job details
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, company_id, resume_id, matched_resume_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (jobErr || !job) {
    throw new Error("Job not found.");
  }

  const companyId = job.company_id;

  // 2. Fetch contacts linked to this job
  const { data: jobContacts } = await supabase
    .from("job_contacts")
    .select("contact_id")
    .eq("job_id", jobId);
  const contactIds = (jobContacts ?? []).map((jc) => jc.contact_id);

  // 3. Fetch documents linked to this job
  const { data: jobDocs } = await supabase
    .from("job_documents")
    .select("document_id")
    .eq("job_id", jobId);
  const docIds = new Set<string>();
  (jobDocs ?? []).forEach((jd) => docIds.add(jd.document_id));
  if (job.resume_id) docIds.add(job.resume_id);
  if (job.matched_resume_id) docIds.add(job.matched_resume_id);

  // 4. Delete 1:1 job relations
  await supabase.from("job_contacts").delete().eq("job_id", jobId);
  await supabase.from("job_documents").delete().eq("job_id", jobId);
  await supabase.from("applications").delete().eq("job_id", jobId);
  await supabase.from("interviews").delete().eq("job_id", jobId);
  await supabase.from("job_deadlines").delete().eq("job_id", jobId);

  // 5. Delete job itself
  const { error: delJobErr } = await supabase.from("jobs").delete().eq("id", jobId).eq("user_id", userId);
  if (delJobErr) throw new Error("Failed to delete job.");

  // 6. Check company cascade
  let companyDeleted = false;
  if (companyId) {
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("user_id", userId);

    if (count === 0) {
      await supabase.from("companies").delete().eq("id", companyId).eq("user_id", userId);
      companyDeleted = true;
    }
  }

  // 7. Check contacts cascade
  for (const cid of contactIds) {
    const { count: jobLinkCount } = await supabase
      .from("job_contacts")
      .select("job_id", { count: "exact", head: true })
      .eq("contact_id", cid);

    const { data: contact } = await supabase
      .from("contacts")
      .select("company_id")
      .eq("id", cid)
      .maybeSingle();

    if (jobLinkCount === 0 && (!contact?.company_id || companyDeleted)) {
      await supabase.from("contacts").delete().eq("id", cid).eq("user_id", userId);
    }
  }

  // 8. Check documents cascade
  for (const did of Array.from(docIds)) {
    const { count: jobDocCount } = await supabase
      .from("job_documents")
      .select("job_id", { count: "exact", head: true })
      .eq("document_id", did);

    const { count: jobResumeCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .or(`resume_id.eq.${did},matched_resume_id.eq.${did}`);

    const { count: posCount } = await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .eq("resume_id", did);

    const { data: doc } = await supabase
      .from("documents")
      .select("is_default")
      .eq("id", did)
      .maybeSingle();

    if (jobDocCount === 0 && jobResumeCount === 0 && posCount === 0 && !doc?.is_default) {
      await supabase.from("documents").delete().eq("id", did).eq("user_id", userId);
    }
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/crm");

  return { success: true, companyDeleted };
}
```

- [ ] **Step 2: Implement `updateJobState`**

In `lib/actions/jobs.ts`:
```ts
export async function updateJobState(jobId: string, state: JobState) {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update job state.");

  revalidatePath("/board");
  revalidatePath("/jobs");
  return { success: true };
}
```

- [ ] **Step 3: Run TypeScript compiler to ensure clean build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/actions/jobs.ts
git commit -m "feat(actions): add deleteJobWithSmartCascade and updateJobState server actions"
```

---

### Task 3: Delete Job Option in Company Tab & Header

**Files:**
- Modify: `components/job-detail/tabs/company-tab.tsx`
- Modify: `components/job-detail/job-detail-content.tsx`

- [ ] **Step 1: Add Delete Job button in CompanyTab**

In `components/job-detail/tabs/company-tab.tsx`:
Add a "Delete job" destructive button using `useConfirm` to confirm job deletion:
```tsx
const { confirm, dialog } = useConfirm();

const handleDeleteJob = async () => {
  const confirmed = await confirm({
    title: "Delete Job",
    message: `Are you sure you want to delete "${data.job.title}"? If this is the only job for ${company.name}, the company record and unshared contacts will also be deleted.`,
    confirmText: "Delete",
    variant: "destructive",
  });
  if (!confirmed) return;
  
  try {
    const res = await deleteJobWithSmartCascade(data.job.id);
    toast.success(res.companyDeleted ? "Job and company deleted." : "Job deleted.");
    onRefresh();
  } catch {
    toast.error("Could not delete job.");
  }
};
```
Render button next to "Edit company":
```tsx
<div className="flex items-center gap-2 pt-2">
  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
    Edit company
  </Button>
  <Button variant="destructive" size="sm" onClick={handleDeleteJob}>
    <Trash2 className="mr-1.5 size-3.5" />
    Delete job
  </Button>
</div>
{dialog}
```

- [ ] **Step 2: Verify in browser / build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/job-detail/tabs/company-tab.tsx
git commit -m "feat(ui): add Delete job button with smart cascade prompt in CompanyTab"
```

---

### Task 4: Change State Control in Header and Card Context Menu

**Files:**
- Modify: `components/job-detail/job-detail-content.tsx`
- Modify: `components/board/board-card.tsx`

- [ ] **Step 1: Add "Change State" Menu in Job Detail Header**

In `components/job-detail/job-detail-content.tsx`:
Add a DropdownMenu for state change:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
      <span>State: {job.state ? job.state.replace("_", " ").toUpperCase() : "ACTIVE"}</span>
      <ChevronDown className="size-3 opacity-70" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleStateChange("active")}>
      🟢 Active
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleStateChange("on_hold")}>
      ⏸️ On Hold
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleStateChange("archived")}>
      📦 Archive
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

- [ ] **Step 2: Add "Change State" options to Board Card Menu**

In `components/board/board-card.tsx`:
Add state change actions under `MoveToMenu` extra items.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/job-detail/job-detail-content.tsx components/board/board-card.tsx
git commit -m "feat(ui): add Change State dropdown in job header and card menu"
```

---

### Task 5: Board Column Collapsible Drawers & Black-and-White Visual States

**Files:**
- Modify: `components/board/board-column.tsx`
- Modify: `components/board/board-card.tsx`

- [ ] **Step 1: Apply Grayscale styling to On Hold / Archived Cards**

In `components/board/board-card.tsx`:
Check `card.state`:
```tsx
const isArchived = card.state === "archived";
const isOnHold = card.state === "on_hold";
const isInactive = isArchived || isOnHold;
```
Apply grayscale filter classes:
```tsx
className={cn(
  "...",
  isInactive && "grayscale contrast-90 opacity-75 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
)}
```

- [ ] **Step 2: Filter Column Cards and Render Bottom Drawers**

In `components/board/board-column.tsx`:
Partition cards by `state`:
```ts
const activeCards = cards.filter((c) => !c.state || c.state === "active");
const onHoldCards = cards.filter((c) => c.state === "on_hold");
const archivedCards = cards.filter((c) => c.state === "archived");
```
Render active cards at the top.
Render a subtle divider gap `<div className="my-2 border-t border-border/40" />`.
Render collapsible accordion sections for On Hold (`On Hold Jobs (${onHoldCards.length})`) and Archived (`Archived Jobs (${archivedCards.length})`).

- [ ] **Step 3: Run build and verify styling**

Run: `npm run build`
Expected: Clean build without errors.

- [ ] **Step 4: Commit**

```bash
git add components/board/board-column.tsx components/board/board-card.tsx
git commit -m "feat(board): implement active top layout, collapsible drawers for on-hold/archived jobs, and B&W hover styling"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Test Job Deletion Cascade**
  - Create a test job for a new company. Delete from Company tab. Verify company is deleted.
  - Create two jobs for a single company. Delete one job. Verify company is NOT deleted.
- [ ] **Step 2: Test State Changing & Board Rendering**
  - Change job to "On Hold" and "Archived".
  - Verify cards appear in bottom column drawers in Black & White.
  - Hover cards and verify colors light up.

---

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-job-delete-and-state-cascade.md`.

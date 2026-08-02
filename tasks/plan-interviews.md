# Plan: Fix Status Update + Interviews Page with MCQ Prep

## Problem

1. **Status update bug**: `updateJob` only writes to `jobs.status`, never `applications.status`. The job detail page reads from `applications.status`, so edits appear to not persist.
2. **Interviews page**: When a job status is set to "interview", it should appear in `/interviews` with a form to add interview details and an MCQ test feature to prepare.

---

## Phase 1: Fix Status Update Bug

### 1.1 Sync both tables in `updateJob`

**File:** `lib/actions/jobs.ts`

After updating `jobs.status` (line ~145), also update the corresponding `applications` row:

```typescript
await supabase
  .from("applications")
  .update({ status })
  .eq("job_id", jobId)
  .eq("user_id", userId);
```

### 1.2 Fix job detail page to read from correct source

**File:** `app/(dashboard)/jobs/[id]/page.tsx` (line ~139)

Change `application.status` to `job?.status ?? "saved"` for the status badge, since `updateJob` writes to `jobs.status`.

---

## Phase 2: Interviews Data Model

### 2.1 Create `interviews` table

**File:** `migrations/011_interviews.sql`

```sql
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  type TEXT CHECK (type IN ('phone','video','onsite','technical','behavioral','panel')),
  location TEXT,
  meeting_url TEXT,
  interviewer_name TEXT,
  interviewer_email TEXT,
  notes TEXT,
  prep_notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','rescheduled')),
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: Users can only access their own interviews.

### 2.2 Auto-create interview when job status changes to "interview"

**File:** `lib/actions/jobs.ts`

In `updateJob`, when `status === "interview"` and no interview exists for this job, auto-create one:

```typescript
if (status === "interview") {
  const { data: existingInterview } = await supabase
    .from("interviews")
    .select("id")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .single();

  if (!existingInterview) {
    await supabase.from("interviews").insert({
      user_id: userId,
      job_id: jobId,
      status: "scheduled",
    });
  }
}
```

---

## Phase 3: Interviews Page

### 3.1 Server action to fetch interviews

**File:** `lib/actions/interviews.ts`

- `getInterviews()` — fetches all interviews with job + company data, sorted by `scheduled_at` (upcoming first)
- `updateInterview(id, data)` — update interview details
- `deleteInterview(id)` — delete an interview

### 3.2 Interviews page

**File:** `app/(dashboard)/interviews/page.tsx`

- Two sections: "Upcoming" and "Past"
- Each card shows: job title, company, date/time, type badge, status
- Empty state when no interviews

### 3.3 Interview detail/edit form

**File:** `components/interview-form.tsx`

Fields:
- Date & time picker
- Type (phone/video/onsite/technical/behavioral/panel)
- Location or meeting URL
- Interviewer name & email
- Notes / prep notes
- Duration
- Status (scheduled/completed/cancelled/rescheduled)

---

## Phase 4: MCQ Test Feature

### 4.1 Generate MCQ questions from job data

**File:** `lib/ai/mcq.ts`

Use OpenRouter to generate MCQ questions based on:
- Job title
- Job description
- Employment type
- Required skills (from notes)

Generate 10-15 questions with 4 options each, correct answer indicated.

### 4.2 MCQ schema

**File:** `lib/types/mcq.ts`

```typescript
interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface MCQTest {
  jobId: string;
  questions: MCQQuestion[];
}
```

### 4.3 Server action to generate test

**File:** `lib/actions/mcq.ts`

- `generateMCQTest(jobId)` — fetches job data, calls AI, returns questions
- Caches result in `mcq_cache` table or localStorage

### 4.4 MCQ test UI

**File:** `components/mcq-test.tsx`

- "Start Test" button on interview detail page
- Shows questions one at a time or as a list
- User selects answers
- Shows score with explanations for wrong answers
- Retake option

---

## Phase 5: Integration

### 5.1 Job detail page — "Prepare for Interview" button

When job status is "interview", show a button that opens the MCQ test.

### 5.2 Interviews page — link to MCQ test

Each interview card has a "Practice" button that opens the MCQ test for that job.

---

## Files to Create/Modify

| Action | File |
|---|---|
| Fix | `lib/actions/jobs.ts` — sync applications.status + auto-create interview |
| Fix | `app/(dashboard)/jobs/[id]/page.tsx` — read job.status for badge |
| Create | `migrations/011_interviews.sql` |
| Create | `lib/actions/interviews.ts` |
| Create | `lib/ai/mcq.ts` |
| Create | `lib/types/mcq.ts` |
| Create | `lib/actions/mcq.ts` |
| Create | `components/interview-form.tsx` |
| Create | `components/mcq-test.tsx` |
| Modify | `app/(dashboard)/interviews/page.tsx` |
| Modify | `app/(dashboard)/jobs/[id]/page.tsx` — add MCQ button |

---

## Verification

1. Edit a job → change status to "applied" → detail badge updates correctly
2. Change status to "interview" → interview appears in /interviews
3. Fill in interview details → saves correctly
4. Click "Practice" → MCQ test generates from job data
5. Complete test → shows score with explanations

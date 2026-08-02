# Spec: AI-Powered Job Extraction from Screenshot

## Objective

Extend the existing manual job entry flow with an AI-powered screenshot import option. Users can upload a screenshot of a job posting, Gemini's multimodal vision extracts structured job data, and the existing Add Job form is pre-populated for review/editing before saving.

**The AI layer is a pre-fill mechanism, not a parallel job creation system.**

---

## Architecture Overview

```
User clicks "Add Job"
        ↓
Choice Dialog: "Enter Manually" | "Import from Screenshot"
        ↓ (if Import)
Upload screenshot → Temporary Supabase Storage
        ↓
Server Action: Gemini Vision API call
        ↓
Structured JSON → Zod validation
        ↓
Extracted data returned to client
        ↓
Existing Add Job Dialog opens, pre-filled with extracted values
        ↓
User reviews/edits → Existing createJob action
        ↓
Job saved to PostgreSQL
        ↓
Temporary screenshot deleted
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, existing Shadcn components |
| AI | Gemini 2.0 Flash (multimodal) via `@google/generative-ai` |
| Storage | Supabase Storage (new `job-imports` bucket, private) |
| Validation | Zod (already installed, currently unused) |
| Database | Supabase PostgreSQL (existing schema) |
| Auth | Supabase Auth (existing `getUser()` helper) |

---

## Commands

```bash
# Install Gemini SDK
npm install @google/generative-ai

# Dev
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit
```

---

## Project Structure (new/modified files)

```
lib/
  ai/
    gemini.ts              # Gemini client setup + extraction logic
    prompts.ts             # Extraction prompt template
    schema.ts              # Zod schema for AI extraction output
  types/
    job.ts                 # Shared job types (JobNote, JobFormData, ExtractionResult)
  actions/
    jobs.ts                # Existing (no changes)
    job-imports.ts         # NEW: upload/extract/delete temporary screenshots

components/
  add-job-dialog.tsx       # Modified: accept initialData prop for pre-filling
  edit-job-dialog.tsx      # No changes
  job-import/
    import-choice.tsx      # NEW: choice dialog (Manual / Import)
    screenshot-upload.tsx  # NEW: upload + preview + extract UI

migrations/
  008_job_imports_storage.sql  # NEW: job-imports bucket + RLS

.env.example               # Modified: add GEMINI_API_KEY
```

---

## Code Style

- Server actions: `"use server"` prefix, async functions, throw/redirect on error
- Client components: `"use client"` prefix, useState for local state
- Forms: raw FormData + useState (no form library, matching existing pattern)
- Naming: kebab-case for files, PascalCase for components, camelCase for functions
- Styling: Tailwind classes, `rounded-4xl` for luma aesthetic, `border-border` for borders

---

## Detailed Implementation Plan

### Phase 1: Foundation

#### 1.1 Environment & Dependencies
- Add `GEMINI_API_KEY=` to `.env.example`
- Install `@google/generative-ai` package

#### 1.2 Database Migration (`008_job_imports_storage.sql`)
```sql
-- Create private 'job-imports' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-imports', 'job-imports', false);

-- RLS: Users can only upload/read/delete their own temp files
CREATE POLICY "Users can upload job import screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own job import screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own job import screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-imports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### 1.3 Shared Types (`lib/types/job.ts`)
Extract and centralize job-related types used by both add/edit dialogs and the AI extraction:
- `JobNote` interface
- `JobFormData` interface (all form fields)
- `ExtractionResult` interface (AI output)

### Phase 2: AI Extraction Layer

#### 2.1 Zod Schema (`lib/ai/schema.ts`)
Define the extraction schema matching the existing job form fields:

```typescript
import { z } from "zod";

export const extractionSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  salary_range: z.string().nullable(),
  employment_type: z.enum([
    "Full-time", "Part-time", "Contract", "Freelance",
    "Internship", "Temporary", "Apprenticeship", "Volunteer"
  ]).nullable(),
  work_location: z.enum(["remote", "onsite", "hybrid"]).nullable(),
  description: z.string().nullable(),
  application_url: z.string().url().nullable(),
  source: z.string().nullable(),
  deadline: z.string().nullable(),
  notes: z.array(z.object({
    title: z.string(),
    bullets: z.array(z.string())
  })).nullable(),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
```

#### 2.2 Gemini Client (`lib/ai/gemini.ts`)
- Initialize Gemini with API key from env
- Single exported function: `extractJobFromScreenshot(imageBase64: string): Promise<ExtractionResult>`
- Handles: API errors, rate limits, malformed responses
- Returns Zod-validated structured data

#### 2.3 Extraction Prompt (`lib/ai/prompts.ts`)
- System prompt instructing Gemini to extract job posting data
- Explicit instructions: return null for unknown fields, use only supported enum values
- Request JSON output matching the extraction schema

### Phase 3: Server Actions

#### 3.1 Job Import Actions (`lib/actions/job-imports.ts`)
Three server actions:

**`uploadScreenshot(formData: FormData)`**
- Authenticates user via `getUser()`
- Validates file (image only, max 5MB)
- Uploads to `{userId}/temp/{uuid}.{ext}` in `job-imports` bucket
- Returns `{ screenshotId, screenshotUrl }` for preview

**`extractFromScreenshot(screenshotId: string)`**
- Authenticates user via `getUser()`
- Downloads screenshot from `job-imports` bucket (user-scoped)
- Converts to base64
- Calls `extractJobFromScreenshot()` from `lib/ai/gemini.ts`
- Returns `ExtractionResult`
- Does NOT create any database records

**`deleteScreenshot(screenshotId: string)`**
- Authenticates user via `getUser()`
- Deletes from `job-imports` bucket (user-scoped)
- Used after successful job creation or on cancel

### Phase 4: UI Components

#### 4.1 Choice Dialog (`components/job-import/import-choice.tsx`)
- Small modal with two options:
  - "Enter Manually" → opens existing AddJobDialog
  - "Import from Screenshot" → opens ScreenshotUpload
- Replaces the current direct AddJobDialog trigger on /jobs page

#### 4.2 Screenshot Upload (`components/job-import/screenshot-upload.tsx`)
- Drag & drop zone + file picker
- Image preview after upload
- "Extract" button triggers server action
- Loading state: "Analyzing screenshot..."
- Error state with retry option
- On success: opens AddJobDialog pre-filled with extracted data

#### 4.3 Integration with AddJobDialog
- Modify AddJobDialog to accept optional `initialData` prop
- When `initialData` is provided, pre-fill all form fields
- The form remains fully editable after pre-filling

### Phase 5: Lifecycle Management

#### 5.1 Screenshot Cleanup
- After successful job creation: delete temporary screenshot
- If deletion fails: log error, let scheduled cleanup handle it
- Cleanup function for abandoned imports (files older than 24 hours)

#### 5.2 Error Handling
- Invalid file type → user-friendly message
- Gemini failure → keep screenshot, allow retry
- Invalid Gemini response → Zod rejects, show error, allow retry
- Storage failure → graceful error message
- Rate limit → show retry message

---

## Testing Strategy

| Test | Scenario |
|---|---|
| Complete screenshot | All fields extracted correctly |
| Missing info | Fields remain null, no hallucination |
| Salary absent | No fake salary values |
| Ambiguous data | Gemini doesn't guess unsupported values |
| Poor screenshot | Graceful failure or partial draft |
| Invalid response | Zod rejects it |
| User edits AI result | Modifications persist correctly |
| AI → Save | Same createJob action as manual |
| User cancels | Screenshot deleted |
| Successful save | Job created + screenshot deleted |
| Storage deletion failure | Job remains, cleanup logged |
| Abandoned import | Screenshot expires after 24h |
| Existing manual entry | Still works unchanged |
| Authorization | User can't access another user's screenshot |

---

## Boundaries

- **Always:** Validate with Zod before populating form, require auth for all operations, delete temp screenshots after job creation
- **Ask first:** Database schema changes, new dependencies, changing existing component APIs
- **Never:** Expose Gemini API key to client, bypass existing createJob action, store screenshots permanently, auto-save without user confirmation

---

## Success Criteria

1. User clicks "Add Job" → sees choice dialog
2. User selects "Import from Screenshot" → upload UI appears
3. User uploads screenshot → preview shown
4. User clicks "Extract" → loading state, then form opens pre-filled
5. User reviews/edits all fields → clicks Save
6. Job created via existing createJob action → same as manual
7. Temporary screenshot deleted after successful save
8. If user cancels → screenshot deleted
9. If extraction fails → retry possible without re-upload
10. Existing manual flow works exactly as before

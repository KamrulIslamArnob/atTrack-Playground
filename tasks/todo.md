# Tasks: AI-Powered Job Extraction from Screenshot

## Phase 1: Foundation

- [ ] 1.1 Install `@google/generative-ai` and add `GEMINI_API_KEY` to `.env.example`
  - Acceptance: `npm list @google/generative-ai` shows installed, `.env.example` has the key
  - Verify: `npm install` succeeds, env var is documented
  - Files: `package.json`, `.env.example`

- [ ] 1.2 Create migration `008_job_imports_storage.sql` with `job-imports` bucket + RLS
  - Acceptance: Bucket exists, users can only access their own files
  - Verify: SQL runs without errors in Supabase SQL Editor
  - Files: `migrations/008_job_imports_storage.sql`

- [ ] 1.3 Create shared types in `lib/types/job.ts`
  - Acceptance: `JobNote`, `JobFormData`, `ExtractionResult` types defined
  - Verify: TypeScript compiles without errors
  - Files: `lib/types/job.ts`

## Phase 2: AI Extraction Layer

- [ ] 2.1 Create Zod schema in `lib/ai/schema.ts`
  - Acceptance: Schema validates all job fields, enums match existing options
  - Verify: Schema compiles, valid/invalid test cases pass
  - Files: `lib/ai/schema.ts`

- [ ] 2.2 Create extraction prompt in `lib/ai/prompts.ts`
  - Acceptance: Prompt instructs Gemini to return JSON matching schema
  - Verify: Prompt is clear, includes enum constraints
  - Files: `lib/ai/prompts.ts`

- [ ] 2.3 Create Gemini client in `lib/ai/gemini.ts`
  - Acceptance: `extractJobFromScreenshot()` returns validated `ExtractionResult`
  - Verify: Handles API errors, rate limits, malformed responses
  - Files: `lib/ai/gemini.ts`

## Phase 3: Server Actions

- [ ] 3.1 Create `uploadScreenshot` action in `lib/actions/job-imports.ts`
  - Acceptance: Authenticates user, validates file, uploads to temp storage
  - Verify: Returns `screenshotId` and `screenshotUrl`
  - Files: `lib/actions/job-imports.ts`

- [ ] 3.2 Create `extractFromScreenshot` action in `lib/actions/job-imports.ts`
  - Acceptance: Downloads image, calls Gemini, returns validated extraction
  - Verify: Returns `ExtractionResult` or throws on failure
  - Files: `lib/actions/job-imports.ts`

- [ ] 3.3 Create `deleteScreenshot` action in `lib/actions/job-imports.ts`
  - Acceptance: Authenticates user, deletes from storage (user-scoped)
  - Verify: File removed from bucket
  - Files: `lib/actions/job-imports.ts`

## Phase 4: UI Components

- [ ] 4.1 Create `ImportChoice` dialog component
  - Acceptance: Shows "Enter Manually" and "Import from Screenshot" options
  - Verify: Clicking each option triggers correct callback
  - Files: `components/job-import/import-choice.tsx`

- [ ] 4.2 Create `ScreenshotUpload` component
  - Acceptance: Drag & drop + file picker, preview, extract button, loading/error states
  - Verify: Upload works, preview shows, extract triggers server action
  - Files: `components/job-import/screenshot-upload.tsx`

- [ ] 4.3 Modify `AddJobDialog` to accept `initialData` prop
  - Acceptance: Form pre-fills when `initialData` provided, remains editable
  - Verify: Pre-filled form saves correctly via existing createJob
  - Files: `components/add-job-dialog.tsx`

- [ ] 4.4 Update `/jobs` page to use `ImportChoice` instead of direct `AddJobDialog`
  - Acceptance: "Add Job" button opens choice dialog
  - Verify: Both manual and import flows work
  - Files: `app/(dashboard)/jobs/page.tsx`

## Phase 5: Lifecycle Management

- [ ] 5.1 Add screenshot deletion after successful job creation
  - Acceptance: Screenshot deleted after createJob succeeds
  - Verify: File removed from storage, job exists in DB
  - Files: `components/add-job-dialog.tsx`, `lib/actions/job-imports.ts`

- [ ] 5.2 Add cancellation cleanup
  - Acceptance: Screenshot deleted when user cancels import
  - Verify: File removed from storage
  - Files: `components/job-import/screenshot-upload.tsx`

## Verification

- [ ] Complete flow: Add Job → Import from Screenshot → Upload → Extract → Review → Save
- [ ] Manual flow still works: Add Job → Enter Manually → Fill form → Save
- [ ] Error handling: Invalid file, Gemini failure, storage failure
- [ ] Authorization: User can't access another user's screenshots
- [ ] Cleanup: Screenshots deleted after job creation or cancellation

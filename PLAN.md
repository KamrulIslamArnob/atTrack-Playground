# Plan: Documents Feature + AI Profile Matching

## Overview
Build a documents management system (multiple resumes, cover letters) with AI-powered job-resume matching. When a job is added, the AI analyzes it against the user's best-matching resume and stores a match score displayed on job cards.

## 1. Database Changes

### Migration 013: Documents + Match Score

**documents table additions:**
- `content TEXT` — extracted resume text from PDF
- `is_default BOOLEAN DEFAULT false` — marks the default resume
- `match_data JSONB` — structured AI extraction (skills, experience, education)

**jobs table additions:**
- `match_score NUMERIC` — 0-100 percentage
- `matched_resume_id UUID REFERENCES documents(id)` — which resume was used
- `match_reasoning TEXT` — brief AI explanation

**Index:**
```sql
CREATE UNIQUE INDEX idx_documents_one_default 
ON documents (user_id) WHERE is_default = true;
```

## 2. New Dependencies

- `pdf-parse` — extract text from uploaded PDFs

## 3. Server Actions

### `lib/actions/documents.ts`

| Action | Purpose |
|---|---|
| `getDocuments()` | List user's documents |
| `uploadDocument(formData)` | Upload PDF, extract text, AI structured extraction, store in DB |
| `deleteDocument(id)` | Delete from storage + DB |
| `setDefaultDocument(id)` | Set one resume as default, triggers re-scoring |
| `getSignedUrl(filePath)` | Get signed URL for private document download |

## 4. AI Functions

### `lib/ai/resume.ts`

**`extractResumeContent(pdfText: string)`**
- Sends resume text to OpenRouter
- Returns: `{ skills: string[], experience: string[], education: string[], summary: string }`
- Stored in `documents.match_data`

**`calculateMatchScore(jobDescription: string, resumeMatchData: object)`**
- Compares job description against structured resume data
- Returns: `{ score: number, reasoning: string }`
- Picks best-scoring resume from all user resumes

## 5. Trigger Points

**On job creation (`createJob`):**
1. After inserting job, fetch all user resumes with `match_data`
2. For each resume, call `calculateMatchScore`
3. Pick highest score
4. Update job with `match_score`, `matched_resume_id`, `match_reasoning`

**On resume upload/set default:**
1. Fetch all user jobs with descriptions
2. Recalculate match scores against all resumes
3. Batch update jobs table

**On resume delete:**
1. Clear `match_score` on jobs matched to deleted resume
2. Recalculate against remaining resumes

## 6. UI Components

### `components/documents-upload.tsx`
- File picker (PDF only), name input, type selector
- Shows extracted skills after upload
- Default resume toggle

### `components/documents-list.tsx`
- Table: name, type, uploaded date, default badge
- Actions: set default, download, delete

### `app/(dashboard)/documents/page.tsx`
- Same header layout as /jobs
- Documents table with upload button

### `components/applications-grid.tsx` update
- Match score badge next to status badge
- Colors: green (80+), yellow (50-79), red (<50), gray (no score)
- Tooltip with reasoning on hover

## 7. Match Score Badge Layout

```
┌─────────────────────────────────────────┐
│  Job Title              [85%] [Saved]  │
│  Company Name                          │
│  ...                                   │
└─────────────────────────────────────────┘
```

## 8. File Changes

| File | Action |
|---|---|
| `migrations/013_documents_and_match_score.sql` | Create |
| `package.json` | Add `pdf-parse` |
| `lib/actions/documents.ts` | Create |
| `lib/ai/resume.ts` | Create |
| `lib/actions/jobs.ts` | Modify |
| `components/documents-upload.tsx` | Create |
| `components/documents-list.tsx` | Create |
| `app/(dashboard)/documents/page.tsx` | Rewrite |
| `components/applications-grid.tsx` | Modify |

## 9. Execution Order

1. Install `pdf-parse`, create migration
2. Build `lib/ai/resume.ts`
3. Build `lib/actions/documents.ts`
4. Update `lib/actions/jobs.ts`
5. Build UI components
6. Update `/documents` page
7. Add match score badge to job cards
8. Test full flow

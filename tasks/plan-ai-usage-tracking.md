# Plan: Integrate AI Usage Logging

## Problem

The `ai_usage_logs` table, `logAiUsage()` server action, and admin AI Usage page exist, but **nothing writes to the table**. The admin AI Usage page always shows empty logs, 0 tokens, and $0 cost.

## Finding: OpenRouter already returns usage data

- Every OpenRouter response includes a `usage` object — **no extra params needed** (`usage: { include: true }` is deprecated; usage is always returned).
- Fields (confirmed in SDK types `ChatResult`/`ChatUsage` and OpenRouter docs):
  - `promptTokens`, `completionTokens`, `totalTokens`
  - `cost` (USD credits)
  - `promptTokensDetails.cachedTokens`, `completionTokensDetails.reasoningTokens`
- Non-streaming (`chat.send`, used by all `lib/ai/*` functions): usage is on the full response.
- Streaming (email route): usage arrives in the **final chunk**.

## Current call sites

| Site | Action | User context |
|---|---|---|
| `lib/ai/ai.ts` → `extractJobFromScreenshots` | screenshot extraction | `job-imports.ts` has `userId` |
| `lib/ai/resume.ts` → `extractResumeContent` | resume extraction | `documents.ts` has `userId` |
| `lib/ai/resume.ts` → `calculateMatchScore` | match score | `documents.ts` + `jobs.ts` (called in a per-resume loop) |
| `lib/ai/mcq.ts` → `generateMCQQuestions` | MCQ generation | `mcq.ts` has `userId` |
| `app/api/ai/generate-email/route.ts` | email generation (streaming) | **no auth** — gap |

---

## Phase 1: Log usage from `lib/ai/*` functions

### 1.1 Add optional `userId` param + usage capture to each function

**Files:** `lib/ai/ai.ts`, `lib/ai/resume.ts`, `lib/ai/mcq.ts`

Design: capture usage *inside* the AI functions (the only place the `usage` object exists), then call the existing error-swallowing `logAiUsage`. No return-type changes needed.

Pattern for each:

```typescript
export async function extractResumeContent(
  pdfText: string,
  userId?: string
): Promise<ResumeMatchData> {
  const startedAt = Date.now();
  // ...existing chat.send...

  if (userId) {
    try {
      const usage = "usage" in response && response.usage;
      await logAiUsage({
        userId,
        action: "extract_resume",
        model: response.model,
        inputTokens: usage?.promptTokens ?? 0,
        outputTokens: usage?.completionTokens ?? 0,
        costUsd: usage?.cost ?? undefined,
        durationMs: Date.now() - startedAt,
      });
    } catch {
      // AI usage logging should never break the main flow
    }
  }

  // ...existing validation + return...
}
```

Actions:
- `extractJobFromScreenshots` → `action: "extract_screenshots"`
- `extractResumeContent` → `action: "extract_resume"`
- `calculateMatchScore` → `action: "match_score"`
- `generateMCQQuestions` → `action: "generate_mcq"`

Log failures too (`metadata: { error: err.message }`).

### 1.2 Pass `userId` from callers

**Files:**
- `lib/actions/documents.ts` — pass `userId` to `extractResumeContent` (line ~67) and `calculateMatchScore` (line ~253)
- `lib/actions/jobs.ts` — pass `userId` to `calculateMatchScore` (line ~93, inside the per-resume loop)
- `lib/actions/mcq.ts` — pass `userId` to `generateMCQQuestions` (line ~43)
- `lib/actions/job-imports.ts` — pass `userId` to `extractJobFromScreenshots` (line ~84)

---

## Phase 2: Email route — auth + streaming usage capture

**File:** `app/api/ai/generate-email/route.ts`

1. **Add session auth** — the route is currently a public endpoint. Verify the user before calling OpenRouter (`getUser()` from `@/lib/auth`).
2. **Capture usage from the stream** — wrap `response.body` in a `TransformStream` that passes chunks through to the client while buffering the final SSE chunk containing `usage`.
3. **Log** — after the final chunk, call `logAiUsage({ userId, action: "generate_email", model, inputTokens, outputTokens, costUsd, durationMs })`.

---

## Phase 3: Verification

1. `npx tsc --noEmit`
2. `npm run lint` (expect same baseline: 7 errors, 29 warnings — all pre-existing)
3. `npx next build`
4. Manual: run each AI feature (screenshot import, resume upload, job create with match score, MCQ test, email generate) and confirm rows appear in `/admin/ai-usage`.

## Notes

- No DB migration needed — `ai_usage_logs` table and columns already exist.
- `getAdminAiUsage()` and the admin page will light up automatically since they read the same table.
- `calculateMatchScore` runs once per resume in `jobs.ts` — each call gets its own row.

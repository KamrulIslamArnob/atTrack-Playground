import { getUser } from "@/lib/auth";
import { extractResumeContent, calculateMatchScore, type ResumeMatchData, type TotalJobInfo } from "@/lib/ai/resume";

/** Rate-limit marker: tasks that throw this are re-queued (with backoff)
 *  instead of being dropped. */
export class RateLimitError extends Error {}

export function isRateLimited(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || /rate limit|limit reached/i.test(msg);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const RATE_RETRY_BACKOFF_MS = [8000, 20000, 45000];
const REQUEUE_DELAY_MS = 15000;
const MAX_REQUEUES = 3;

interface Task {
  key: string;
  run: () => Promise<void>;
  retries: number;
}

const pending = new Map<string, Task>();
const running = new Set<string>();
let draining = false;

/** Serialized in-process background queue. Tasks run one at a time in order;
 *  re-enqueueing an existing key replaces the pending run, so a burst of
 *  uploads collapses into a single rescore pass. A task re-enqueued while its
 *  own key is running re-runs once afterwards so the final write wins. */
export function enqueueBackground(key: string, run: () => Promise<void>, retries = 0): void {
  pending.set(key, { key, run, retries });
  pump();
}

async function pump(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.size > 0) {
      const key = pending.keys().next().value as string;
      const task = pending.get(key)!;
      pending.delete(key);
      running.add(key);
      try {
        await task.run();
      } catch (err) {
        if (err instanceof RateLimitError && task.retries < MAX_REQUEUES) {
          const retries = task.retries + 1;
          setTimeout(() => enqueueBackground(task.key, task.run, retries), REQUEUE_DELAY_MS * retries);
        } else {
          console.error(`[BgQueue] task "${task.key}" failed:`, err);
        }
      } finally {
        running.delete(key);
      }
    }
  } finally {
    draining = false;
  }
}

function isTransientError(err: unknown): boolean {
  if (isRateLimited(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network error|timeout/i.test(msg);
}

/** Retries an individual LLM/network call on 429 or network glitch with escalating backoff,
 *  then throws RateLimitError so the surrounding task can be re-queued wholesale. */
async function callWithRateRetry<T>(runner: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runner();
    } catch (err) {
      if (isTransientError(err)) {
        if (attempt < RATE_RETRY_BACKOFF_MS.length) {
          await sleep(RATE_RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        throw new RateLimitError(err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
  }
}

function extractTokens(text: string): Set<string> {
  if (!text) return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

function computeSimilarityScore(jobTitle: string, jobDesc: string | null, rawMatchData: unknown): number {
  const matchData = rawMatchData as Record<string, unknown> | null | undefined;
  const jobTokens = extractTokens(`${jobTitle} ${jobDesc ?? ""}`);
  if (jobTokens.size === 0) return 0;

  const resumeText = [
    matchData?.summary,
    matchData?.title,
    ...((matchData?.skills as string[]) ?? []),
    ...((matchData?.experience as Array<Record<string, unknown>>)?.map((e) => `${e.title ?? ""} ${e.company ?? ""} ${e.description ?? ""}`) ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const resumeTokens = extractTokens(resumeText);
  if (resumeTokens.size === 0) return 0;

  let matchCount = 0;
  for (const token of jobTokens) {
    if (resumeTokens.has(token)) matchCount++;
  }
  return matchCount / (jobTokens.size + resumeTokens.size - matchCount);
}

/** Re-scores every job that has no explicit resume pick against candidate resumes
 *  (priority queue ranked by default status + vector similarity); best score wins. */
export async function recalculateAllMatchScores(userId: string): Promise<void> {
  const { supabase } = await getUser();

  const { data: resumes } = await supabase
    .from("documents")
    .select("id, match_data, is_default")
    .eq("user_id", userId)
    .eq("type", "resume")
    .not("match_data", "is", null)
    .order("is_default", { ascending: false });

  const resumeList = (resumes ?? []) as CandidateResume[];
  if (resumeList.length === 0) {
    await supabase
      .from("jobs")
      .update({ match_score: null, matched_resume_id: null, match_reasoning: null })
      .eq("user_id", userId)
      .is("resume_id", null);
    return;
  }

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, description, location, employment_type, work_location, salary_range, notes, company:companies(name), position:positions(name)")
    .eq("user_id", userId)
    .is("resume_id", null);

  if (!jobs || jobs.length === 0) return;

  const TOP_CANDIDATE_LIMIT = 3;

  for (const job of jobs) {
    let bestScore = 0;
    let bestReasoning = "";
    let bestResumeId = "";

    const company = Array.isArray(job.company) ? job.company[0] : job.company;
    const position = Array.isArray(job.position) ? job.position[0] : job.position;
    const totalJobInfo: TotalJobInfo = {
      companyName: company?.name ?? null,
      positionName: position?.name ?? null,
      location: job.location ?? null,
      workLocation: job.work_location ?? null,
      employmentType: job.employment_type ?? null,
      salaryRange: job.salary_range ?? null,
      notes: Array.isArray(job.notes) ? job.notes : null,
    };

    // Priority Queue: Rank resumes by default flag priority & token similarity
    const rankedResumes: CandidateResume[] = resumeList
      .map((r) => ({
        ...r,
        simScore: computeSimilarityScore(job.title, job.description, r.match_data),
      }))
      .sort((a, b) => {
        if (Boolean(a.is_default) !== Boolean(b.is_default)) return a.is_default ? -1 : 1;
        return (b.simScore ?? 0) - (a.simScore ?? 0);
      })
      .slice(0, TOP_CANDIDATE_LIMIT);

    for (const resume of rankedResumes) {
      try {
        const result = await callWithRateRetry(() =>
          calculateMatchScore(job.title, job.description, resume.match_data as unknown as ResumeMatchData, userId, totalJobInfo)
        );
        if (result.score > bestScore) {
          bestScore = result.score;
          bestReasoning = result.reasoning;
          bestResumeId = resume.id;
        }
      } catch (err) {
        if (err instanceof RateLimitError) throw err;
        console.error(`Failed to score job ${job.id} against resume ${resume.id}:`, err);
      }
    }

    if (bestResumeId) {
      await supabase
        .from("jobs")
        .update({
          match_score: bestScore,
          matched_resume_id: bestResumeId,
          match_reasoning: bestReasoning,
        })
        .eq("id", job.id)
        .eq("user_id", userId);
    }
  }
}

interface CandidateResume {
  id: string;
  match_data: unknown;
  is_default?: boolean;
  simScore?: number;
}

/** Scores one job against a picked resume or top candidates via similarity priority ranking. */
export async function scoreJob(userId: string, jobId: string, pickedResumeId?: string | null): Promise<void> {
  const { supabase } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, location, employment_type, work_location, salary_range, notes, company:companies(name), position:positions(name)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) return;

  const company = Array.isArray(job.company) ? job.company[0] : job.company;
  const position = Array.isArray(job.position) ? job.position[0] : job.position;
  const totalJobInfo: TotalJobInfo = {
    companyName: company?.name ?? null,
    positionName: position?.name ?? null,
    location: job.location ?? null,
    workLocation: job.work_location ?? null,
    employmentType: job.employment_type ?? null,
    salaryRange: job.salary_range ?? null,
    notes: Array.isArray(job.notes) ? job.notes : null,
  };

  let query = supabase
    .from("documents")
    .select("id, match_data, is_default")
    .eq("user_id", userId)
    .eq("type", "resume");
  query = pickedResumeId ? query.eq("id", pickedResumeId) : query.not("match_data", "is", null);

  const { data: resumes } = await query;
  const list = (resumes ?? []) as CandidateResume[];

  if (list.length === 0) {
    await supabase
      .from("jobs")
      .update({ match_score: null, matched_resume_id: null, match_reasoning: null })
      .eq("id", jobId)
      .eq("user_id", userId);
    return;
  }

  const TOP_CANDIDATE_LIMIT = 3;
  const targetList: CandidateResume[] = pickedResumeId
    ? list
    : list
        .map((r) => ({
          ...r,
          simScore: computeSimilarityScore(job.title, job.description, r.match_data),
        }))
        .sort((a, b) => {
          if (Boolean(a.is_default) !== Boolean(b.is_default)) return a.is_default ? -1 : 1;
          return (b.simScore ?? 0) - (a.simScore ?? 0);
        })
        .slice(0, TOP_CANDIDATE_LIMIT);

  let bestScore = 0;
  let bestReasoning = "";
  let bestResumeId = "";

  for (const resume of targetList) {
    if (!resume.match_data) continue;
    try {
      const result = await callWithRateRetry(() =>
        calculateMatchScore(job.title, job.description, resume.match_data as unknown as ResumeMatchData, userId, totalJobInfo)
      );
      if (result.score > bestScore) {
        bestScore = result.score;
        bestReasoning = result.reasoning;
        bestResumeId = resume.id;
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      console.error(`Failed to score job ${jobId} against resume ${resume.id}:`, err);
    }
  }

  if (bestResumeId) {
    await supabase
      .from("jobs")
      .update({
        match_score: bestScore,
        matched_resume_id: bestResumeId,
        match_reasoning: bestReasoning,
      })
      .eq("id", jobId)
      .eq("user_id", userId);
  }
}

export function scheduleJobScore(userId: string, jobId: string, pickedResumeId?: string | null): void {
  enqueueBackground(`score-job-${jobId}`, () => scoreJob(userId, jobId, pickedResumeId));
}

export function scheduleRescoreAll(userId: string): void {
  enqueueBackground(`rescore-all-${userId}`, () => recalculateAllMatchScores(userId));
}

/** Resume upload pipeline: extract structured match_data, then queue a
 *  rescore-all. Queue serialization keeps extraction ahead of rescoring. */
export function scheduleResumeExtract(docId: string, pdfText: string, userId: string, type: string): void {
  enqueueBackground(`extract-${docId}`, async () => {
    const { supabase } = await getUser();
    const matchData = await callWithRateRetry(() => extractResumeContent(pdfText, userId));
    await supabase
      .from("documents")
      .update({ match_data: matchData })
      .eq("id", docId)
      .eq("user_id", userId);
    if (type === "resume") {
      scheduleRescoreAll(userId);
    }
  });
}
"use server";

import { createHash } from "node:crypto";
import { getUser } from "@/lib/auth";
import { generateMCQQuestions } from "@/lib/ai/mcq";
import type { MCQTest, MCQQuestion } from "@/lib/types/mcq";
import { logResourceActivity } from "@/lib/actions/activity-log";

export interface MCQResult {
  id: string;
  job_id: string;
  score: number;
  total: number;
  answers: Record<string, number>;
  questions: MCQQuestion[];
  created_at: string;
}

export async function generateMCQTest(jobId: string): Promise<MCQTest> {
  const { supabase, userId } = await getUser();

  const { data: job, error } = await supabase
    .from("jobs")
    .select(`
      id,
      title,
      description,
      employment_type,
      notes,
      company:companies(name)
    `)
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error || !job) {
    throw new Error("Job not found");
  }

  const notes = Array.isArray(job.notes)
    ? (job.notes as Array<{ title: string; bullets: string[] }>)
    : null;

  const company = (job.company as unknown as { name: string } | null)?.name ?? "Unknown";

  // Serve the last generated question set while the job content that fed it
  // is unchanged — retake becomes instant and costs no tokens.
  const contextHash = createHash("sha256")
    .update(
      JSON.stringify({
        title: job.title,
        description: job.description,
        employment_type: job.employment_type,
        notes,
      })
    )
    .digest("hex");

  const { data: cached } = await supabase
    .from("mcq_question_cache")
    .select("content_hash, questions, created_at")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    cached &&
    cached.content_hash === contextHash &&
    Array.isArray(cached.questions) &&
    cached.questions.length > 0
  ) {
    return {
      jobId: job.id,
      jobTitle: job.title,
      company,
      questions: cached.questions as MCQQuestion[],
      generatedAt: cached.created_at,
    };
  }

  const questions = await generateMCQQuestions({
    jobTitle: job.title,
    description: job.description,
    employmentType: job.employment_type,
    notes,
    userId,
  });

  // LRU Eviction: maintain max 50 MCQ cache entries per user
  const MAX_MCQ_CACHE_ENTRIES = 50;
  const { data: mcqEntries } = await supabase
    .from("mcq_question_cache")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (mcqEntries && mcqEntries.length >= MAX_MCQ_CACHE_ENTRIES) {
    const overflow = mcqEntries.length - MAX_MCQ_CACHE_ENTRIES + 1;
    const toEvict = mcqEntries.slice(0, overflow).map((e) => e.id);
    await supabase.from("mcq_question_cache").delete().in("id", toEvict);
  }

  // Persist on generation (not only on submit) so the cache survives a
  // closed modal. Delete-then-insert keeps it single-row per job.
  await supabase.from("mcq_question_cache").delete().eq("job_id", jobId).eq("user_id", userId);
  await supabase
    .from("mcq_question_cache")
    .insert({ user_id: userId, job_id: jobId, content_hash: contextHash, questions });

  return {
    jobId: job.id,
    jobTitle: job.title,
    company,
    questions,
    generatedAt: new Date().toISOString(),
  };
}

export async function saveMCQResult(
  jobId: string,
  score: number,
  total: number,
  answers: Record<string, number>,
  questions: MCQQuestion[]
): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("mcq_results").insert({
    user_id: userId,
    job_id: jobId,
    score,
    total,
    answers,
    questions,
  });

  if (error) {
    console.error("Failed to save MCQ result:", error);
  }

  await logResourceActivity(userId, "create", "mcq_result", undefined, { job_id: jobId, score, total });
}

export async function getMCQResults(jobId: string): Promise<MCQResult[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("mcq_results")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch MCQ results:", error);
    return [];
  }

  return (data as MCQResult[]) ?? [];
}

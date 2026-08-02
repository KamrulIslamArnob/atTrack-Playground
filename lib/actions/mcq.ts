"use server";

import { getUser } from "@/lib/auth";
import { generateMCQQuestions } from "@/lib/ai/mcq";
import type { MCQTest, MCQQuestion } from "@/lib/types/mcq";

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

  const questions = await generateMCQQuestions({
    jobTitle: job.title,
    description: job.description,
    employmentType: job.employment_type,
    notes,
  });

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: (job.company as unknown as { name: string } | null)?.name ?? "Unknown",
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

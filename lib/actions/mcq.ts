"use server";

import { getUser } from "@/lib/auth";
import { generateMCQQuestions } from "@/lib/ai/mcq";
import type { MCQTest } from "@/lib/types/mcq";

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

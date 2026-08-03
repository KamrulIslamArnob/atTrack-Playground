"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { calculateMatchScore, type ResumeMatchData } from "@/lib/ai/resume";

export async function createJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const applicationUrl = formData.get("application_url") as string | null;
  const location = formData.get("location") as string | null;
  const salaryRange = formData.get("salary_range") as string | null;
  const description = formData.get("description") as string | null;
  const employmentType = formData.get("employment_type") as string | null;
  const workLocation = formData.get("work_location") as string | null;
  const deadline = formData.get("deadline") as string | null;
  const source = formData.get("source") as string | null;
  const status = (formData.get("status") as string) || "saved";
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  // Find or create company
  let companyId: string;

  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .eq("name", companyName)
    .single();

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({ user_id: userId, name: companyName })
      .select("id")
      .single();

    if (companyError) {
      throw new Error("Failed to save company.");
    }
    companyId = newCompany.id;
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      company_id: companyId,
      title,
      application_url: applicationUrl || null,
      location: location || null,
      salary_range: salaryRange || null,
      description: description || null,
      employment_type: employmentType || null,
      work_location: workLocation || null,
      deadline: deadline || null,
      source: source || null,
      status,
      notes: notes.length > 0 ? notes : null,
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error("Failed to save job.");
  }

  const { error: applicationError } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_id: job.id,
      status,
    });

  if (applicationError) {
    console.error("Failed to create application record:", applicationError);
  }

  // Calculate match score against user's resumes
  try {
    const { data: resumes, error: resumeError } = await supabase
      .from("documents")
      .select("id, match_data")
      .eq("user_id", userId)
      .eq("type", "resume")
      .not("match_data", "is", null);

    console.log("[MatchScore] Resumes found:", resumes?.length ?? 0, "Error:", resumeError);

    if (resumes && resumes.length > 0) {
      let bestScore = 0;
      let bestReasoning = "";
      let bestResumeId = "";

      for (const resume of resumes) {
        console.log("[MatchScore] Calculating for resume:", resume.id);
        const result = await calculateMatchScore(
          title,
          description,
          resume.match_data as unknown as ResumeMatchData
        );
        console.log("[MatchScore] Score:", result.score, "Reasoning:", result.reasoning);

        if (result.score > bestScore) {
          bestScore = result.score;
          bestReasoning = result.reasoning;
          bestResumeId = resume.id;
        }
      }

      if (bestResumeId) {
        console.log("[MatchScore] Updating job", job.id, "with score:", bestScore);
        await supabase
          .from("jobs")
          .update({
            match_score: bestScore,
            matched_resume_id: bestResumeId,
            match_reasoning: bestReasoning,
          })
          .eq("id", job.id);
      }
    } else {
      console.log("[MatchScore] No resumes with match_data found");
    }
  } catch (e) {
    console.error("[MatchScore] Match scoring failed:", e);
  }

  revalidatePath("/jobs");
  return { jobId: job.id };
}

export async function updateJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const jobId = formData.get("job_id") as string;
  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const applicationUrl = formData.get("application_url") as string | null;
  const location = formData.get("location") as string | null;
  const salaryRange = formData.get("salary_range") as string | null;
  const description = formData.get("description") as string | null;
  const employmentType = formData.get("employment_type") as string | null;
  const workLocation = formData.get("work_location") as string | null;
  const deadline = formData.get("deadline") as string | null;
  const source = formData.get("source") as string | null;
  const status = (formData.get("status") as string) || "saved";
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  // Find or create company
  let companyId: string;

  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .eq("name", companyName)
    .single();

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({ user_id: userId, name: companyName })
      .select("id")
      .single();

    if (companyError) {
      throw new Error("Failed to save company.");
    }
    companyId = newCompany.id;
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      company_id: companyId,
      title,
      application_url: applicationUrl || null,
      location: location || null,
      salary_range: salaryRange || null,
      description: description || null,
      employment_type: employmentType || null,
      work_location: workLocation || null,
      deadline: deadline || null,
      source: source || null,
      status,
      notes: notes.length > 0 ? notes : null,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (jobError) {
    throw new Error("Failed to update job.");
  }

  // Sync applications table status
  await supabase
    .from("applications")
    .update({ status })
    .eq("job_id", jobId)
    .eq("user_id", userId);

  // Auto-create interview when status changes to "interview"
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

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  revalidatePath("/interviews");
}

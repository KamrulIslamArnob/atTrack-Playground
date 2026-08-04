"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { calculateMatchScore, type ResumeMatchData } from "@/lib/ai/resume";
import { logResourceActivity } from "@/lib/actions/activity-log";

export async function createJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const applicationUrl = formData.get("application_url") as string | null;
  const applicationEmail = formData.get("application_email") as string | null;
  const applicationProcess = formData.get("application_process") as string | null;
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
      application_email: applicationEmail || null,
      application_process: applicationProcess || null,
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

  // Calculate match score against user's resumes
  try {
    const { data: resumes, error: resumeError } = await supabase
      .from("documents")
      .select("id, match_data")
      .eq("user_id", userId)
      .eq("type", "resume")
      .not("match_data", "is", null);

    if (resumes && resumes.length > 0) {
      let bestScore = 0;
      let bestReasoning = "";
      let bestResumeId = "";

      for (const resume of resumes) {
        const result = await calculateMatchScore(
          title,
          description,
          resume.match_data as unknown as ResumeMatchData
        );

        if (result.score > bestScore) {
          bestScore = result.score;
          bestReasoning = result.reasoning;
          bestResumeId = resume.id;
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
          .eq("id", job.id);
      }
    }
  } catch (e) {
    console.error("[MatchScore] Match scoring failed:", e);
  }

  revalidatePath("/jobs");
  await logResourceActivity(userId, "create", "job", job.id, { title, company: companyName });
  return { jobId: job.id };
}

export async function updateJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const jobId = formData.get("job_id") as string;
  const title = formData.get("title") as string;
  const companyName = formData.get("company") as string;
  const applicationUrl = formData.get("application_url") as string | null;
  const applicationEmail = formData.get("application_email") as string | null;
  const applicationProcess = formData.get("application_process") as string | null;
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
      application_email: applicationEmail || null,
      application_process: applicationProcess || null,
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

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  revalidatePath("/interviews");
  await logResourceActivity(userId, "update", "job", jobId, { title, company: companyName });
}

export async function createApplication(formData: FormData) {
  const { supabase, userId } = await getUser();

  const jobId = formData.get("job_id") as string;
  const resumeId = formData.get("resume_id") as string | null;
  const resumeName = formData.get("resume_name") as string | null;
  const notes = formData.get("notes") as string | null;

  // Check if application already exists for this job
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .single();

  if (existing) {
    throw new Error("Application already exists for this job.");
  }

  const { data: application, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      job_id: jobId,
      status: "submitted",
      applied_at: new Date().toISOString(),
      resume_id: resumeId || null,
      resume_name: resumeName || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Failed to create application.");
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "create", "application", application.id, { job_id: jobId });
  return { applicationId: application.id };
}

export async function updateApplicationStatus(formData: FormData) {
  const { supabase, userId } = await getUser();

  const applicationId = formData.get("application_id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to update application status.");
  }

  revalidatePath("/jobs");
  await logResourceActivity(userId, "update", "application", applicationId, { status });
}

export async function deleteApplication(applicationId: string) {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to delete application.");
  }

  revalidatePath("/jobs");
  await logResourceActivity(userId, "delete", "application", applicationId);
}
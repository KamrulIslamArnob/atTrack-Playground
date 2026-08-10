"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { calculateMatchScore, type ResumeMatchData } from "@/lib/ai/resume";
import { logResourceActivity } from "@/lib/actions/activity-log";
import type { ProjectLink } from "@/lib/types/board";

export async function createJob(formData: FormData) {
  const { supabase, userId } = await getUser();

  const requestedListId = formData.get("list_id") as string | null;
  const positionId = formData.get("position_id") as string | null;

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
  const sectionDeadline = formData.get("section_deadline") as string | null;
  const sectionDeadlineListId = formData.get("section_deadline_list_id") as string | null;
  const source = formData.get("source") as string | null;
  const status = (formData.get("status") as string) || "saved";
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  if (!deadline?.trim() && !sectionDeadline?.trim()) {
    throw new Error("A deadline is required. Please provide an Application Deadline or a Section Deadline.");
  }

  // Board placement: the requested column, else Wishlist. Every job must land
  // in a column or it would be invisible on /board.
  const { data: targetList } = requestedListId
    ? await supabase
        .from("board_lists")
        .select("id")
        .eq("id", requestedListId)
        .eq("user_id", userId)
        .maybeSingle()
    : await supabase
        .from("board_lists")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "wishlist")
        .maybeSingle();

  let boardPosition: number | null = null;
  if (targetList) {
    const { data: last } = await supabase
      .from("jobs")
      .select("board_position")
      .eq("user_id", userId)
      .eq("list_id", targetList.id)
      .order("board_position", { ascending: false })
      .limit(1)
      .maybeSingle();
    boardPosition = (last?.board_position ?? -1) + 1;
  }

  // A tagged job inherits its position's default resume.
  let inheritedResumeId: string | null = null;
  if (positionId) {
    const { data: position } = await supabase
      .from("positions")
      .select("resume_id")
      .eq("id", positionId)
      .eq("user_id", userId)
      .maybeSingle();
    inheritedResumeId = position?.resume_id ?? null;
  }

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
      section_deadline: sectionDeadline || null,
      section_deadline_list_id: sectionDeadlineListId || null,
      source: source || null,
      // status is overwritten by the sync_job_status_from_list trigger whenever
      // list_id is set (migration 019). Kept for the no-board fallback path.
      status,
      notes: notes.length > 0 ? notes : null,
      list_id: targetList?.id ?? null,
      board_position: boardPosition,
      position_id: positionId || null,
      resume_id: inheritedResumeId,
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
          resume.match_data as unknown as ResumeMatchData,
          userId
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
          .eq("id", job.id)
          .eq("user_id", userId);
      }
    }
  } catch (e) {
    console.error("[MatchScore] Match scoring failed:", e);
  }

  // AI-detected recruiter/hiring-manager (Import with AI) — find-or-create under
  // this job's company and link it, so the CRM grows from job imports without
  // the user having to add the contact by hand. Never blocks job creation.
  const contactName = (formData.get("contact_name") as string | null)?.trim() || null;
  const contactEmail = (formData.get("contact_email") as string | null)?.trim() || null;
  if (contactName || contactEmail) {
    try {
      const contactRole = (formData.get("contact_role") as string | null)?.trim() || "recruiter";
      let contactId: string | null = null;

      if (contactEmail) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .eq("email", contactEmail)
          .maybeSingle();
        contactId = existing?.id ?? null;
      }
      if (!contactId && contactName) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .eq("name", contactName)
          .maybeSingle();
        contactId = existing?.id ?? null;
      }
      if (!contactId) {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            name: contactName ?? contactEmail,
            email: contactEmail,
            role: contactRole,
            company_id: companyId,
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }
      if (contactId) {
        await supabase.from("job_contacts").insert({ job_id: job.id, contact_id: contactId });
      }
    } catch (e) {
      console.error("[CreateJob] Contact linking failed:", e);
    }
  }

  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath("/crm");
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
  const sectionDeadline = formData.get("section_deadline") as string | null;
  const sectionDeadlineListId = formData.get("section_deadline_list_id") as string | null;
  const source = formData.get("source") as string | null;
  const status = (formData.get("status") as string) || "saved";
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  if (!deadline?.trim() && !sectionDeadline?.trim()) {
    throw new Error("A deadline is required. Please provide an Application Deadline or a Section Deadline.");
  }

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
      section_deadline: sectionDeadline || null,
      section_deadline_list_id: sectionDeadlineListId || null,
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

/**
 * Job-detail-sheet: user picks (or clears) which resume this specific job is
 * matched against. Re-scores just this job so the pill on the board updates
 * without waiting for the next full recalculateAllMatchScores pass.
 */
export async function setJobResume(jobId: string, resumeId: string | null) {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) throw new Error("Job not found.");

  if (!resumeId) {
    await supabase.from("jobs").update({ resume_id: null }).eq("id", jobId).eq("user_id", userId);
  } else {
    const { data: resume } = await supabase
      .from("documents")
      .select("id, match_data")
      .eq("id", resumeId)
      .eq("user_id", userId)
      .eq("type", "resume")
      .single();
    if (!resume) throw new Error("Resume not found.");

    const update: Record<string, unknown> = { resume_id: resumeId };
    if (resume.match_data) {
      try {
        const result = await calculateMatchScore(
          job.title,
          job.description,
          resume.match_data as unknown as ResumeMatchData,
          userId
        );
        update.match_score = result.score;
        update.match_reasoning = result.reasoning;
        update.matched_resume_id = resumeId;
      } catch (e) {
        console.error("[setJobResume] scoring failed:", e);
      }
    }
    await supabase.from("jobs").update(update).eq("id", jobId).eq("user_id", userId);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "update", "job", jobId, { resume_id: resumeId });
}

/** Notes tab: writes jobs.notes directly instead of routing through updateJob's full form. */
export async function setJobNotes(jobId: string, notes: Array<{ title: string; bullets: string[] }>) {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ notes: notes.length > 0 ? notes : null })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to save notes.");

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "update", "job", jobId, { notes_count: notes.length });
}

export async function setJobProjectLinks(jobId: string, links: ProjectLink[]) {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ project_links: links.length > 0 ? links : null })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to save project links.");

  revalidatePath("/board");
  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "update", "job", jobId, { project_links_count: links.length });
}

export async function setJobColor(jobId: string, color: string | null) {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ color })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to save job color.");

  revalidatePath("/board");
  revalidatePath("/jobs/" + jobId);
}

/** Activities tab "Log Other Activity" — a manual entry alongside the automatic ones. */
export async function logJobActivity(jobId: string, title: string, description?: string) {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) throw new Error("Job not found.");

  await logResourceActivity(userId, "log", "job", jobId, { title, description: description || undefined });
  revalidatePath("/jobs/" + jobId);
}
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { resolveProviderChain, generateText } from "@/lib/ai/providers";
import { scheduleJobScore } from "@/lib/ai/background";
import { calculateMatchScore, extractResumeContent, type ResumeMatchData, type TotalJobInfo } from "@/lib/ai/resume";
import { unlink } from "fs/promises";
import path from "path";
import { moduleLogger } from "@/lib/log";
import { requestId } from "@/lib/log/request";
import { logResourceActivity } from "./activity-log";
import type { ProjectLink } from "@/lib/types/board";
import type { JobState, JobTier } from "@/lib/types/job";
import type { ExtractionResult } from "@/lib/ai/schema";

const log = moduleLogger("actions.jobs");

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
  const mapUrl = formData.get("map_url") as string | null;
  const salaryRange = formData.get("salary_range") as string | null;
  const salaryMinRaw = formData.get("salary_min") as string | null;
  const salaryMaxRaw = formData.get("salary_max") as string | null;
  const salaryCurrency = formData.get("salary_currency") as string | null;
  const salaryPeriod = formData.get("salary_period") as string | null;
  const isUnpaidRaw = formData.get("is_unpaid");
  const isUnpaid = isUnpaidRaw === "true" || isUnpaidRaw === "on" || isUnpaidRaw === "1";
  const salaryMin = salaryMinRaw ? parseFloat(salaryMinRaw) : null;
  const salaryMax = salaryMaxRaw ? parseFloat(salaryMaxRaw) : null;

  const skillsRaw = formData.get("skills") as string | null;
  const skills = skillsRaw ? JSON.parse(skillsRaw) : null;
  const educationalRequirements = formData.get("educational_requirements") as string | null;
  const benefitsRaw = formData.get("benefits") as string | null;
  const benefits = benefitsRaw ? JSON.parse(benefitsRaw) : null;
  const workSchedule = formData.get("work_schedule") as string | null;
  const holidayPolicy = formData.get("holiday_policy") as string | null;

  const description = formData.get("description") as string | null;
  const employmentType = formData.get("employment_type") as string | null;
  const workLocation = formData.get("work_location") as string | null;
  const deadlineMode = formData.get("deadline_mode") as string | null;
  let deadline = formData.get("deadline") as string | null;
  const sectionDeadline = formData.get("section_deadline") as string | null;
  const sectionDeadlineListId = formData.get("section_deadline_list_id") as string | null;
  const milestoneName = formData.get("milestone_name") as string | null;
  const milestoneDate = formData.get("milestone_date") as string | null;
  const source = formData.get("source") as string | null;
  const tier = (formData.get("tier") as string | null) || null;
  const status = (formData.get("status") as string) || "saved";
  const notesRaw = formData.get("notes") as string | null;
  const notes = notesRaw ? JSON.parse(notesRaw) : [];

  if (deadlineMode === "asap") {
    deadline = "asap";
  } else if (deadlineMode === "unknown") {
    deadline = "unknown";
  }

  // Deadlines or milestone selection is mandatory on creation
  if (!deadline?.trim() && !sectionDeadline?.trim() && !milestoneDate?.trim()) {
    throw new Error("A deadline or milestone selection is required. Please choose ASAP, Unknown, or a specific date.");
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
      map_url: mapUrl || null,
      salary_range: salaryRange || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency || null,
      salary_period: salaryPeriod || null,
      is_unpaid: isUnpaid ? 1 : 0,
      skills: Array.isArray(skills) && skills.length > 0 ? skills : null,
      educational_requirements: educationalRequirements || null,
      benefits: Array.isArray(benefits) && benefits.length > 0 ? benefits : null,
      work_schedule: workSchedule || null,
      holiday_policy: holidayPolicy || null,
      description: description || null,
      employment_type: employmentType || null,
      work_location: workLocation || null,
      deadline: deadline || null,
      section_deadline: sectionDeadline || null,
      section_deadline_list_id: sectionDeadlineListId || null,
      source: source || null,
      tier: tier || null,
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

  // Match scoring is delay-tolerant: save returns instantly, the score lands
  // via the background queue and the board shows "—" until it does.
  scheduleJobScore(userId, job.id);

  if (description) {
    try {
      const { indexEntityChunks } = await import("@/lib/ai/embeddings");
      indexEntityChunks({
        userId,
        sourceId: job.id,
        sourceType: "job_description",
        text: description,
      }).catch((err) => log.warn({ err, reqId: requestId() }, "Job description vector indexing failed:"));
    } catch {}
  }

  if (milestoneDate?.trim() || deadlineMode === "milestone") {
    const mDate = milestoneDate?.trim() || new Date().toISOString().split("T")[0];
    const mName = milestoneName?.trim() || "Applied & Waiting";
    await supabase.from("job_deadlines").insert({
      id: crypto.randomUUID(),
      job_id: job.id,
      user_id: userId,
      name: mName,
      target_date: mDate,
      type: "milestone",
      is_completed: 0,
    });
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
      log.error({ err: e, reqId: requestId(), jobId: job.id }, "[CreateJob] Contact linking failed:");
    }
  }

  void logResourceActivity(userId, "job.create", "job", job.id, {
    companyId,
    listId: targetList?.id ?? null,
    hasDescription: Boolean(description),
    noteCount: notes.length,
  });

  revalidatePath("/jobs");
  revalidatePath("/board");
  revalidatePath("/crm");
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
  const notesRaw = formData.has("notes") ? (formData.get("notes") as string | null) : undefined;
  const notes = notesRaw ? JSON.parse(notesRaw) : undefined;

  const hasDeadlineField = formData.has("deadline") || formData.has("section_deadline");
  if (hasDeadlineField && !deadline?.trim() && !sectionDeadline?.trim()) {
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

  // Update company profile if company fields are present
  const companyUpdates: Record<string, unknown> = {};
  if (formData.has("company_website")) {
    const val = (formData.get("company_website") as string | null)?.trim();
    companyUpdates.website = val || null;
  }
  if (formData.has("company_location")) {
    const val = (formData.get("company_location") as string | null)?.trim();
    companyUpdates.location = val || null;
  }
  if (formData.has("company_founded_year")) {
    const val = (formData.get("company_founded_year") as string | null)?.trim();
    companyUpdates.founded_year = val ? parseInt(val, 10) || null : null;
  }
  if (formData.has("company_type")) {
    const val = (formData.get("company_type") as string | null)?.trim();
    companyUpdates.company_type = val || null;
  }
  if (formData.has("company_country")) {
    const val = (formData.get("company_country") as string | null)?.trim();
    companyUpdates.country = val || null;
  }

  if (Object.keys(companyUpdates).length > 0) {
    await supabase.from("companies").update(companyUpdates).eq("id", companyId);
  }

  const updateData: Record<string, unknown> = {
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
    source: source || null,
  };

  if (formData.has("status")) {
    updateData.status = status;
  }
  if (formData.has("deadline")) {
    updateData.deadline = deadline || null;
  }
  if (formData.has("section_deadline")) {
    updateData.section_deadline = sectionDeadline || null;
  }
  if (formData.has("section_deadline_list_id")) {
    updateData.section_deadline_list_id = sectionDeadlineListId || null;
  }
  if (formData.has("skills")) {
    const skillsRaw = formData.get("skills") as string | null;
    updateData.skills = skillsRaw ? JSON.parse(skillsRaw) : null;
  }
  if (formData.has("educational_requirements")) {
    updateData.educational_requirements = (formData.get("educational_requirements") as string | null) || null;
  }
  if (formData.has("benefits")) {
    const benefitsRaw = formData.get("benefits") as string | null;
    updateData.benefits = benefitsRaw ? JSON.parse(benefitsRaw) : null;
  }
  if (formData.has("work_schedule")) {
    updateData.work_schedule = (formData.get("work_schedule") as string | null) || null;
  }
  if (formData.has("holiday_policy")) {
    updateData.holiday_policy = (formData.get("holiday_policy") as string | null) || null;
  }
  if (formData.has("map_url")) {
    updateData.map_url = (formData.get("map_url") as string | null) || null;
  }
  if (formData.has("is_unpaid")) {
    const isUnpaidRaw = formData.get("is_unpaid");
    updateData.is_unpaid = isUnpaidRaw === "true" || isUnpaidRaw === "on" || isUnpaidRaw === "1" ? 1 : 0;
  }
  if (formData.has("salary_min")) {
    const v = formData.get("salary_min") as string | null;
    updateData.salary_min = v ? parseFloat(v) : null;
  }
  if (formData.has("salary_max")) {
    const v = formData.get("salary_max") as string | null;
    updateData.salary_max = v ? parseFloat(v) : null;
  }
  if (formData.has("salary_currency")) {
    updateData.salary_currency = (formData.get("salary_currency") as string | null) || null;
  }
  if (formData.has("salary_period")) {
    updateData.salary_period = (formData.get("salary_period") as string | null) || null;
  }
  if (formData.has("tier")) {
    const t = formData.get("tier") as string | null;
    updateData.tier = t || null;
  }

  if (notes !== undefined) {
    updateData.notes = notes.length > 0 ? notes : null;
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", jobId)
    .eq("user_id", userId);

  if (jobError) {
    throw new Error("Failed to update job.");
  }

  // Check if description changed → match scores are now stale
  try {
    const { data: oldJob } = await supabase
      .from("jobs")
      .select("description")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();
    if (oldJob && (oldJob.description ?? "") !== (description ?? "")) {
      await supabase
        .from("jobs")
        .update({ match_score: null, matched_resume_id: null, match_reasoning: null })
        .eq("id", jobId)
        .eq("user_id", userId);
      scheduleJobScore(userId, jobId);
    }
  } catch {
    // best-effort staleness detection
  }

  void logResourceActivity(userId, "job.update", "job", jobId, {
    fieldCount: Object.keys(updateData).length,
  });

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  revalidatePath("/interviews");
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

  void logResourceActivity(userId, "application.create", "application", application.id, { jobId });

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
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

  void logResourceActivity(userId, "application.update", "application", applicationId, { status });

  revalidatePath("/jobs");
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

  void logResourceActivity(userId, "application.delete", "application", applicationId);

  revalidatePath("/jobs");
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

    await supabase.from("jobs").update({ resume_id: resumeId }).eq("id", jobId).eq("user_id", userId);

    // Scoring is delay-tolerant: persist the pick now, let the background
    // queue re-score this job and refresh the pill on the board.
    scheduleJobScore(userId, jobId, resumeId);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
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

  revalidatePath("/jobs/" + jobId);
}

/** Extracts key technical skills, tools, and domain keywords using AI and saves them as a note. */
export async function extractJobKeywords(jobId: string): Promise<{ keywords: string[]; error?: string }> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, notes, resume_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) return { keywords: [], error: "Job not found." };
  if (!job.description) return { keywords: [], error: "No job description available to analyze." };

  let resumeText = "";
  if (job.resume_id) {
    const { data: doc } = await supabase
      .from("documents")
      .select("content")
      .eq("id", job.resume_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (doc?.content) {
      resumeText = doc.content.slice(0, 4000);
    }
  }

  const prompt = `You are an expert technical recruiter and ATS keyword analyst.
Analyze this job posting (and candidate resume if provided). Extract 8 to 15 key skills, technologies, frameworks, tools, qualifications, and core domain terms essential for this position.

Job Title: ${job.title}
Job Description:
${job.description.slice(0, 6000)}

${resumeText ? `Candidate Resume Context:\n${resumeText}\n` : ""}

Return ONLY a valid JSON object in this exact format:
{
  "keywords": ["React", "Next.js", "Node.js", "REST API", "SQL/NoSQL", "Git"]
}
IMPORTANT: Each keyword must be concise (1-3 words). No extra markdown commentary outside the JSON object.`;

  const chain = await resolveProviderChain(userId, "text");
  if (chain.length === 0) {
    return { keywords: [], error: "No AI provider configured. Please configure an AI provider in Settings." };
  }

  try {
    const result = await generateText(chain, { userPrompt: prompt }, { userId, action: "extract_keywords", metadata: { job_id: jobId } });
    const jsonMatch = result.text.match(/```json\n([\s\S]*?)\n```/) || result.text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response.");
    }
    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    const keywordsSchema = z.object({
      keywords: z.array(z.string()).min(1),
    });
    const validated = keywordsSchema.safeParse(parsed);
    const keywords: string[] = validated.success
      ? validated.data.keywords.map((k) => k.trim()).filter(Boolean)
      : Array.isArray(parsed.keywords)
        ? parsed.keywords.map((k: unknown) => String(k).trim()).filter(Boolean)
        : [];

    if (keywords.length === 0) {
      throw new Error("No keywords were generated.");
    }

    const existingNotes: Array<{ title: string; bullets: string[] }> = Array.isArray(job.notes) ? job.notes : [];
    const otherNotes = existingNotes.filter((n) => n.title.toLowerCase() !== "keywords" && n.title !== "__keywords__");
    const updatedNotes = [...otherNotes, { title: "Keywords", bullets: keywords }];

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ notes: updatedNotes })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error("Failed to save keywords.");
    }

    revalidatePath("/jobs/" + jobId);

    return { keywords };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { keywords: [], error: msg };
  }
}

/**
 * Triggers an immediate, on-demand AI match score check for a job against a specific resume
 * or the job's currently attached resume, using total job information.
 */
export async function checkJobResumeScore(
  jobId: string,
  targetResumeId?: string | null
): Promise<{ score: number; reasoning: string; error?: string }> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, description, location, employment_type, work_location, salary_range, notes, resume_id, company:companies(name), position:positions(name)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) return { score: 0, reasoning: "", error: "Job not found." };

  const resumeIdToUse = targetResumeId ?? job.resume_id;
  if (!resumeIdToUse) {
    return { score: 0, reasoning: "", error: "No resume selected for this job." };
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, content, match_data")
    .eq("id", resumeIdToUse)
    .eq("user_id", userId)
    .eq("type", "resume")
    .single();

  if (!doc) {
    return { score: 0, reasoning: "", error: "Resume document not found." };
  }

  let matchData = doc.match_data as ResumeMatchData | null;
  if (!matchData && doc.content) {
    try {
      matchData = await extractResumeContent(doc.content, userId);
      await supabase
        .from("documents")
        .update({ match_data: matchData })
        .eq("id", doc.id)
        .eq("user_id", userId);
    } catch {
      return { score: 0, reasoning: "", error: "Failed to parse resume content for scoring." };
    }
  }

  if (!matchData) {
    return { score: 0, reasoning: "", error: "Resume has no content to compare." };
  }

  const company = Array.isArray(job.company) ? job.company[0] : job.company;
  const position = Array.isArray(job.position) ? job.position[0] : job.position;
  const totalJobInfo: TotalJobInfo = {
    companyName: company?.name ?? null,
    positionName: position?.name ?? null,
    location: job.location ?? null,
    workLocation: job.work_location ?? null,
    employmentType: job.employment_type ?? null,
    salaryRange: job.salary_range ?? null,
    notes: Array.isArray(job.notes) ? (job.notes as Array<{ title: string; bullets: string[] }>) : null,
  };

  try {
    const result = await calculateMatchScore(job.title, job.description, matchData, userId, totalJobInfo);

    await supabase
      .from("jobs")
      .update({
        resume_id: resumeIdToUse,
        match_score: result.score,
        matched_resume_id: doc.id,
        match_reasoning: result.reasoning,
      })
      .eq("id", jobId)
      .eq("user_id", userId);

    revalidatePath("/board");
    revalidatePath("/jobs");
    revalidatePath("/jobs/" + jobId);

    return { score: result.score, reasoning: result.reasoning };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { score: 0, reasoning: "", error: msg };
  }
}

export async function deleteJobWithSmartCascade(
  jobId: string
): Promise<{ success: boolean; companyDeleted: boolean }> {
  const { supabase, userId } = await getUser();

  // 1. Fetch target job details from jobs table for current user
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, company_id, resume_id, matched_resume_id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (jobErr || !job) {
    throw new Error("Job not found.");
  }

  // 2. Store companyId
  const companyId = job.company_id;

  // 3. Fetch linked contacts from job_contacts WHERE job_id = jobId
  const { data: jobContacts } = await supabase
    .from("job_contacts")
    .select("contact_id")
    .eq("job_id", jobId);
  const contactIds = (jobContacts ?? []).map((jc) => jc.contact_id);

  // 4. Fetch linked documents from job_documents WHERE job_id = jobId plus job.resume_id and job.matched_resume_id
  const { data: jobDocs } = await supabase
    .from("job_documents")
    .select("document_id")
    .eq("job_id", jobId);
  const docIds = new Set<string>();
  (jobDocs ?? []).forEach((jd) => docIds.add(jd.document_id));
  if (job.resume_id) docIds.add(job.resume_id);
  if (job.matched_resume_id) docIds.add(job.matched_resume_id);

  // 5. Delete 1:1 job links/records
  await supabase.from("job_contacts").delete().eq("job_id", jobId);
  await supabase.from("job_documents").delete().eq("job_id", jobId);
  await supabase.from("applications").delete().eq("job_id", jobId);
  await supabase.from("interviews").delete().eq("job_id", jobId);
  await supabase.from("job_deadlines").delete().eq("job_id", jobId);

  // 6. Delete job record
  const { error: delJobErr } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", userId);
  if (delJobErr) throw new Error("Failed to delete job.");

  // Clean up vector chunks for deleted job
  try {
    const { deleteEntityChunks } = await import("@/lib/ai/embeddings");
    deleteEntityChunks(userId, jobId);
  } catch (err) {
    log.warn({ err, reqId: requestId(), jobId }, "Failed to delete job vector chunks:");
  }

  // 7. Company cascade check
  let companyDeleted = false;
  if (companyId) {
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("user_id", userId);

    if (count === 0) {
      await supabase.from("companies").delete().eq("id", companyId).eq("user_id", userId);
      companyDeleted = true;
      void logResourceActivity(userId, "company.delete", "company", companyId, { cascadeFrom: "job" });
    }
  }

  // 8. Contacts cascade check
  for (const cid of contactIds) {
    const { count: jobLinkCount } = await supabase
      .from("job_contacts")
      .select("job_id", { count: "exact", head: true })
      .eq("contact_id", cid);

    const { data: contact } = await supabase
      .from("contacts")
      .select("company_id")
      .eq("id", cid)
      .eq("user_id", userId)
      .maybeSingle();

    if ((jobLinkCount ?? 0) === 0 && (!contact?.company_id || companyDeleted)) {
      await supabase.from("contacts").delete().eq("id", cid).eq("user_id", userId);
      void logResourceActivity(userId, "contact.delete", "contact", cid, { cascadeFrom: "job" });
    }
  }

  // 9. Documents cascade check
  for (const did of Array.from(docIds)) {
    const { count: jobDocCount } = await supabase
      .from("job_documents")
      .select("job_id", { count: "exact", head: true })
      .eq("document_id", did);

    const { count: jobResumeCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .or(`resume_id.eq.${did},matched_resume_id.eq.${did}`);

    const { count: posCount } = await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .eq("resume_id", did);

    const { data: doc } = await supabase
      .from("documents")
      .select("file_path, is_default")
      .eq("id", did)
      .eq("user_id", userId)
      .maybeSingle();

    if ((jobDocCount ?? 0) === 0 && (jobResumeCount ?? 0) === 0 && (posCount ?? 0) === 0 && !doc?.is_default) {
      if (doc?.file_path && doc.file_path.startsWith("/resume/")) {
        const localDiskPath = path.join(process.cwd(), "public", doc.file_path);
        await unlink(localDiskPath).catch((err) => {
          // The path carries the user's own file name, so it stays out of the
          // line — the document id below identifies it well enough.
          log.warn({ err, reqId: requestId(), documentId: did }, "Could not delete local file:");
        });
      } else if (doc?.file_path) {
        await supabase.storage.from("documents").remove([doc.file_path]).catch(() => {});
      }
      await supabase.from("documents").delete().eq("id", did).eq("user_id", userId);
      void logResourceActivity(userId, "document.delete", "document", did, { cascadeFrom: "job" });
    }
  }

  // 10. Revalidate paths & log activity
  void logResourceActivity(userId, "job.delete", "job", jobId, {
    companyDeleted,
    contactsConsidered: contactIds.length,
    documentsConsidered: docIds.size,
  });

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/crm");

  return { success: true, companyDeleted };
}

export async function updateJobState(
  jobId: string,
  state: JobState
): Promise<{ success: boolean }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update job state.");

  void logResourceActivity(userId, "job.update", "job", jobId, { state });

  revalidatePath("/board");
  revalidatePath("/jobs");
  return { success: true };
}

export async function updateJobTier(
  jobId: string,
  tier: JobTier | null
): Promise<{ success: boolean }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("jobs")
    .update({ tier: tier || null, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to update job tier.");

  void logResourceActivity(userId, "job.update", "job", jobId, { tier });

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

export async function enrichJobFromAi(
  jobId: string,
  extraction: ExtractionResult
): Promise<{ success: boolean; updatedFields: string[] }> {
  const { supabase, userId } = await getUser();

  const { data: existingJob, error: fetchError } = await supabase
    .from("jobs")
    .select("*, companies(*)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existingJob) {
    throw new Error("Job not found");
  }

  const updatedFields: string[] = [];
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (extraction.title?.trim()) {
    updateData.title = extraction.title.trim();
    updatedFields.push("title");
  }
  if (extraction.application_url?.trim()) {
    updateData.application_url = extraction.application_url.trim();
    updatedFields.push("application_url");
  }
  if (extraction.application_email?.trim()) {
    updateData.application_email = extraction.application_email.trim();
    updatedFields.push("application_email");
  }
  if (extraction.application_process?.trim()) {
    updateData.application_process = extraction.application_process.trim();
    updatedFields.push("application_process");
  }
  if (extraction.location?.trim()) {
    updateData.location = extraction.location.trim();
    updatedFields.push("location");
  }
  if (extraction.salary_range?.trim()) {
    updateData.salary_range = extraction.salary_range.trim();
    updatedFields.push("salary");
  }
  if (extraction.salary_min != null) {
    updateData.salary_min = extraction.salary_min;
  }
  if (extraction.salary_max != null) {
    updateData.salary_max = extraction.salary_max;
  }
  if (extraction.salary_currency?.trim()) {
    updateData.salary_currency = extraction.salary_currency.trim();
  }
  if (extraction.salary_period?.trim()) {
    updateData.salary_period = extraction.salary_period.trim();
  }
  if (extraction.is_unpaid != null) {
    updateData.is_unpaid = extraction.is_unpaid ? 1 : 0;
  }
  if (extraction.employment_type?.trim()) {
    updateData.employment_type = extraction.employment_type.trim();
    updatedFields.push("employment_type");
  }
  if (extraction.work_location?.trim()) {
    updateData.work_location = extraction.work_location.trim();
    updatedFields.push("work_location");
  }
  if (extraction.educational_requirements?.trim()) {
    updateData.educational_requirements = extraction.educational_requirements.trim();
    updatedFields.push("educational_requirements");
  }
  if (extraction.work_schedule?.trim()) {
    updateData.work_schedule = extraction.work_schedule.trim();
    updatedFields.push("work_schedule");
  }
  if (extraction.holiday_policy?.trim()) {
    updateData.holiday_policy = extraction.holiday_policy.trim();
    updatedFields.push("holiday_policy");
  }
  if (extraction.map_url?.trim()) {
    updateData.map_url = extraction.map_url.trim();
    updatedFields.push("map_url");
  }
  if (extraction.deadline?.trim()) {
    updateData.deadline = extraction.deadline.trim();
    updatedFields.push("deadline");
  }
  if (extraction.source?.trim() && !existingJob.source) {
    updateData.source = extraction.source.trim();
    updatedFields.push("source");
  }

  // Description: update if extracted description is non-empty
  if (extraction.description?.trim()) {
    updateData.description = extraction.description.trim();
    updatedFields.push("description");
  }

  // Skills: merge/union
  if (Array.isArray(extraction.skills) && extraction.skills.length > 0) {
    const existingSkills: string[] = Array.isArray(existingJob.skills) ? existingJob.skills : [];
    const mergedSkills = Array.from(
      new Set([...existingSkills, ...extraction.skills].map((s) => s.trim()).filter(Boolean))
    );
    if (mergedSkills.length > 0) {
      updateData.skills = mergedSkills;
      updatedFields.push("skills");
    }
  }

  // Benefits: merge/union
  if (Array.isArray(extraction.benefits) && extraction.benefits.length > 0) {
    const existingBenefits: string[] = Array.isArray(existingJob.benefits) ? existingJob.benefits : [];
    const mergedBenefits = Array.from(
      new Set([...existingBenefits, ...extraction.benefits].map((b) => b.trim()).filter(Boolean))
    );
    if (mergedBenefits.length > 0) {
      updateData.benefits = mergedBenefits;
      updatedFields.push("benefits");
    }
  }

  // Notes: append any new extracted notes
  if (Array.isArray(extraction.notes) && extraction.notes.length > 0) {
    const existingNotes = Array.isArray(existingJob.notes) ? existingJob.notes : [];
    const existingTitles = new Set(existingNotes.map((n: { title?: string }) => n.title?.toLowerCase()));
    const newNotes = extraction.notes.filter((n) => !existingTitles.has(n.title?.toLowerCase()));
    if (newNotes.length > 0) {
      updateData.notes = [...existingNotes, ...newNotes];
      updatedFields.push("notes");
    }
  }

  // Update Company
  if (extraction.company?.trim()) {
    const companyId = existingJob.company_id;
    if (companyId) {
      await supabase
        .from("companies")
        .update({ name: extraction.company.trim() })
        .eq("id", companyId)
        .eq("user_id", userId);
    }
  }

  // Contact linking if found
  if (extraction.contact && (extraction.contact.name || extraction.contact.email) && existingJob.company_id) {
    try {
      const cName = extraction.contact.name?.trim() || null;
      const cEmail = extraction.contact.email?.trim() || null;
      const cRole = extraction.contact.role?.trim() || "recruiter";
      let contactId: string | null = null;

      if (cEmail) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", existingJob.company_id)
          .eq("email", cEmail)
          .maybeSingle();
        contactId = existing?.id ?? null;
      }
      if (!contactId && cName) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", existingJob.company_id)
          .eq("name", cName)
          .maybeSingle();
        contactId = existing?.id ?? null;
      }
      if (!contactId) {
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            name: cName ?? cEmail,
            email: cEmail,
            role: cRole,
            company_id: existingJob.company_id,
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }
      if (contactId) {
        // Link to job_contacts if not already linked
        const { data: linked } = await supabase
          .from("job_contacts")
          .select("id")
          .eq("job_id", jobId)
          .eq("contact_id", contactId)
          .maybeSingle();
        if (!linked) {
          await supabase.from("job_contacts").insert({ job_id: jobId, contact_id: contactId });
        }
      }
    } catch {
      // ignore
    }
  }

  // Update the job row
  const { error: updateError } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", jobId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error("Failed to update job with AI details.");
  }

  // Rescore match score
  scheduleJobScore(userId, jobId);

  // Vector index description
  if (updateData.description) {
    try {
      const { indexEntityChunks } = await import("@/lib/ai/embeddings");
      indexEntityChunks({
        userId,
        sourceId: jobId,
        sourceType: "job_description",
        text: updateData.description as string,
      }).catch(() => {});
    } catch {}
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return { success: true, updatedFields };
}
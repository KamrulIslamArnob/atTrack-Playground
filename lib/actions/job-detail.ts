"use server";

import { getUser } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/actions/smtp";
import { getJobDocuments } from "@/lib/actions/documents";
import { getJobContacts } from "@/lib/actions/contacts";
import type { JobDetailData } from "@/lib/types/job-detail";

/**
 * Single fetch backing job-detail-content.tsx — called directly from the
 * client (Sheet, opened from the board) and from the server (/jobs/[id]).
 * Everything the sheet's tabs need comes from here so there is one query
 * shape, not one per tab.
 */
export async function getJobDetail(jobId: string): Promise<JobDetailData | null> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase
    .from("jobs")
    .select(
      `*, company:companies(id, name, website, location, founded_year, company_type, country),
       position:positions(name), resume:documents!jobs_resume_id_fkey(name)`
    )
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!job) return null;

  const [
    { data: applications },
    { data: interviews },
    { data: activity },
    { data: resumes },
    contacts,
    documents,
    smtpReady,
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, applied_at, created_at, resume_name")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("interviews")
      .select(
        "id, scheduled_at, type, location, meeting_url, interviewer_name, interviewer_email, notes, status"
      )
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("activity_logs")
      .select("id, action, resource, resource_id, metadata, created_at")
      .eq("user_id", userId)
      .eq("resource_id", jobId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("documents")
      .select("id, name")
      .eq("user_id", userId)
      .eq("type", "resume")
      .order("created_at", { ascending: false }),
    getJobContacts(jobId),
    getJobDocuments(jobId),
    isSmtpConfigured(),
    supabase.from("profiles").select("full_name, headline").eq("id", userId).maybeSingle(),
  ]);

  const company = Array.isArray(job.company) ? job.company[0] : job.company;
  const position = Array.isArray(job.position) ? job.position[0] : job.position;
  const resume = Array.isArray(job.resume) ? job.resume[0] : job.resume;

  // AI Tools generation wants the attached resume's extracted text, not just its name.
  let resumeContent: string | null = null;
  if (job.resume_id) {
    const { data: resumeDoc } = await supabase
      .from("documents")
      .select("content")
      .eq("id", job.resume_id)
      .eq("user_id", userId)
      .maybeSingle();
    resumeContent = resumeDoc?.content ?? null;
  }

  return {
    job: {
      id: job.id,
      title: job.title,
      description: job.description ?? null,
      application_url: job.application_url ?? null,
      application_email: job.application_email ?? null,
      application_process: job.application_process ?? null,
      location: job.location ?? null,
      salary_range: job.salary_range ?? null,
      employment_type: job.employment_type ?? null,
      work_location: job.work_location ?? null,
      deadline: job.deadline ?? null,
      section_deadline: job.section_deadline ?? null,
      section_deadline_list_id: job.section_deadline_list_id ?? null,
      source: job.source ?? null,
      status: job.status ?? "saved",
      notes: Array.isArray(job.notes) ? job.notes : null,
      match_score: typeof job.match_score === "number" ? job.match_score : null,
      match_reasoning: job.match_reasoning ?? null,
      resume_id: job.resume_id ?? null,
      resume_name: resume?.name ?? null,
      project_links: Array.isArray(job.project_links) ? job.project_links : null,
      color: job.color ?? null,
      position_id: job.position_id ?? null,
      position_name: position?.name ?? null,
      list_id: job.list_id ?? null,
      created_at: job.created_at,
    },
    company: company
      ? {
          id: company.id,
          name: company.name,
          website: company.website ?? null,
          location: company.location ?? null,
          founded_year: company.founded_year ?? null,
          company_type: company.company_type ?? null,
          country: company.country ?? null,
        }
      : null,
    applications: (applications ?? []) as unknown as JobDetailData["applications"],
    interviews: (interviews ?? []) as unknown as JobDetailData["interviews"],
    contacts,
    documents,
    resumeOptions: (resumes ?? []) as unknown as JobDetailData["resumeOptions"],
    activity: (activity ?? []) as JobDetailData["activity"],
    smtpReady,
    applicantName: profile?.full_name ?? "",
    applicantHeadline: profile?.headline ?? null,
    resumeContent,
  };
}

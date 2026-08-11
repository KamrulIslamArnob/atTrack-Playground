// Shared shape for the job-detail-sheet: one fetch (getJobDetail) feeds both
// the board's Sheet and the /jobs/[id] page, so job-detail-content.tsx never
// has two different data shapes to reconcile.

import type { ProjectLink } from "@/lib/types/board";
import type { JobDocument } from "@/lib/actions/documents";
import type { Contact } from "@/lib/actions/contacts";

export interface JobDetailCompany {
  id: string;
  name: string;
  website: string | null;
  location: string | null;
  founded_year: number | null;
  company_type: string | null;
  country: string | null;
}

export interface JobDetailApplication {
  id: string;
  status: string;
  applied_at: string | null;
  created_at: string;
  resume_name: string | null;
}

export interface JobDetailInterview {
  id: string;
  scheduled_at: string | null;
  type: string | null;
  location: string | null;
  meeting_url: string | null;
  interviewer_name: string | null;
  interviewer_email: string | null;
  notes: string | null;
  status: string;
}

export interface JobDetailResumeOption {
  id: string;
  name: string;
}

export interface JobDetailJob {
  id: string;
  title: string;
  description: string | null;
  application_url: string | null;
  application_email: string | null;
  application_process: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  section_deadline: string | null;
  section_deadline_list_id: string | null;
  source: string | null;
  status: string;
  notes: Array<{ title: string; bullets: string[] }> | null;
  match_score: number | null;
  match_reasoning: string | null;
  resume_id: string | null;
  resume_name: string | null;
  project_links: ProjectLink[] | null;
  color: string | null;
  position_id: string | null;
  position_name: string | null;
  list_id: string | null;
  created_at: string;
}

export interface JobDetailData {
  job: JobDetailJob;
  company: JobDetailCompany | null;
  applications: JobDetailApplication[];
  interviews: JobDetailInterview[];
  contacts: Contact[];
  documents: JobDocument[];
  resumeOptions: JobDetailResumeOption[];
  smtpReady: boolean;
  applicantName: string;
  applicantHeadline: string | null;
  resumeContent: string | null; // the attached resume's extracted text, for AI Tools generation
}

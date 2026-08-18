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
  logo_url?: string | null;
  color?: string | null;
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

import type { JobState } from "@/lib/types/job";

export interface JobDetailJob {
  id: string;
  title: string;
  state?: JobState;
  description: string | null;
  application_url: string | null;
  application_email: string | null;
  application_process: string | null;
  location: string | null;
  salary_range: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  is_unpaid: boolean | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  section_deadline: string | null;
  section_deadline_list_id: string | null;
  source: string | null;
  status: string;
  notes: Array<{ title: string; bullets: string[] }> | null;
  skills: string[] | null;
  educational_requirements: string | null;
  benefits: string[] | null;
  work_schedule: string | null;
  holiday_policy: string | null;
  map_url: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  resume_id: string | null;
  resume_name: string | null;
  project_links: ProjectLink[] | null;
  color: string | null;
  tier: import("@/lib/types/job").JobTier | null;
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
  boardLists?: import("@/lib/types/board").BoardList[];
  deadlines?: import("@/lib/types/board").JobDeadline[];
  smtpReady: boolean;
  applicantName: string;
  applicantHeadline: string | null;
  resumeContent: string | null; // the attached resume's extracted text, for AI Tools generation
}

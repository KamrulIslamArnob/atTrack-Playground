// Job pipeline statuses (pre-application only)
export type JobStatus = "saved" | "interested" | "preparing";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
};

// Application lifecycle statuses
export type ApplicationStatus = "draft" | "submitted" | "acknowledged" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  draft: "#94A3B8",
  submitted: "#8B5CF6",
  acknowledged: "#3B82F6",
  interview: "#10B981",
  offer: "#059669",
  accepted: "#047857",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

export interface JobNote {
  id: string;
  title: string;
  bullets: string[];
}

export interface JobFormData {
  title: string;
  company: string;
  application_url: string | null;
  application_email: string | null;
  application_process: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  source: string | null;
  description: string | null;
  status: string;
  notes: JobNote[];
}

export interface ExtractionResult {
  title: string | null;
  company: string | null;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  description: string | null;
  application_url: string | null;
  application_email: string | null;
  application_process: string | null;
  source: string | null;
  deadline: string | null;
  notes: Array<{ title: string; bullets: string[] }> | null;
}

export interface ApplicationEmail {
  id: string;
  user_id: string;
  job_id: string;
  application_id: string | null;
  recipient_email: string;
  from_email: string;
  subject: string;
  body: string;
  resume_id: string | null;
  resume_name: string | null;
  status: "sent" | "failed" | "bounced";
  error_message: string | null;
  sent_at: string;
  created_at: string;
}

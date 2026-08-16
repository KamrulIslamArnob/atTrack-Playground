export type JobState = "active" | "on_hold" | "archived";

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
  interview: "#84cc16",
  offer: "#14b8a6",
  accepted: "#22c55e",
  rejected: "#f87171",
  withdrawn: "#6B7280",
};

// Priority Tiers
export type JobTier = "1" | "2" | "3";

export interface TierConfig {
  value: JobTier;
  label: string;
  shortLabel: string;
  badgeClass: string;
  borderClass: string;
  dotColor: string;
  description: string;
}

export const JOB_TIERS: Record<JobTier, TierConfig> = {
  "1": {
    value: "1",
    label: "Tier 1",
    shortLabel: "T1",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    borderClass: "border-amber-500/40",
    dotColor: "#f59e0b",
    description: "Top priority",
  },
  "2": {
    value: "2",
    label: "Tier 2",
    shortLabel: "T2",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    borderClass: "border-blue-500/40",
    dotColor: "#3b82f6",
    description: "Second priority",
  },
  "3": {
    value: "3",
    label: "Tier 3",
    shortLabel: "T3",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
    borderClass: "border-purple-500/40",
    dotColor: "#8b5cf6",
    description: "Third priority",
  },
};

export function getJobTierConfig(tier: string | null | undefined): TierConfig | null {
  if (!tier) return null;
  const key = tier.toString().trim() as JobTier;
  return JOB_TIERS[key] ?? null;
}

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

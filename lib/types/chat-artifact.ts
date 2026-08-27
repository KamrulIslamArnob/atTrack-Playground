/**
 * Chat artifact — structured snapshot of a DB entity created/updated via
 * write_database tool, rendered inline in chat as a card.
 * Stored as part of ToolExecutionStep artifact field, persisted inside
 * chat_messages.tool_calls JSON — no new DB column needed.
 * Snapshot is frozen at creation time so chat history stays immutable.
 */

export type ChatArtifactKind =
  | "job"
  | "contact"
  | "link"
  | "memory"
  | "interview";

export interface JobArtifactSnapshot {
  id: string;
  title: string;
  company_name: string | null;
  company_website: string | null;
  company_logo_url: string | null;
  company_color: string | null;
  location: string | null;
  employment_type: string | null;
  work_location: string | null;
  salary_range: string | null;
  salary_min: number | null;
  salary_max: number | null;
  state: string | null;
  list_id: string | null;
  list_name: string | null;
  list_kind: string | null;
  created_at: string;
}

export interface ContactArtifactSnapshot {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  linkedin_url: string | null;
}

export interface LinkArtifactSnapshot {
  id: string;
  title: string;
  url: string;
  notes: string | null;
  category_name: string | null;
}

export interface MemoryArtifactSnapshot {
  id: string;
  title: string | null;
  description: string;
}

export interface InterviewArtifactSnapshot {
  id: string;
  job_id?: string | null;
  job_title: string | null;
  company_name: string | null;
  scheduled_at: string | null;
  type: string | null;
  location: string | null;
  interviewer_name: string | null;
  status: string | null;
}

export type ChatArtifactSnapshot =
  | ({ kind: "job"; data: JobArtifactSnapshot } & { kind: "job" })
  | ({ kind: "contact"; data: ContactArtifactSnapshot } & { kind: "contact" })
  | ({ kind: "link"; data: LinkArtifactSnapshot } & { kind: "link" })
  | ({ kind: "memory"; data: MemoryArtifactSnapshot } & { kind: "memory" })
  | ({ kind: "interview"; data: InterviewArtifactSnapshot } & { kind: "interview" });

export interface ChatArtifact {
  id: string;
  kind: ChatArtifactKind;
  table: string;
  rowId: string;
  title: string;
  subtitle?: string;
  snapshot: JobArtifactSnapshot | ContactArtifactSnapshot | LinkArtifactSnapshot | MemoryArtifactSnapshot | InterviewArtifactSnapshot;
}

export function isChatArtifact(value: unknown): value is ChatArtifact {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.kind === "string" &&
    typeof v.table === "string" &&
    typeof v.rowId === "string" &&
    typeof v.title === "string" &&
    typeof v.snapshot === "object" &&
    v.snapshot !== null
  );
}

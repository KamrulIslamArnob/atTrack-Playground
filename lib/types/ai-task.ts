import type { ExtractionResult } from "@/lib/ai/schema";
import type { GeneratedEmail } from "@/lib/ai/ai-tools";
import type { AiToolKind } from "@/lib/types/ai-tools";

export type AITaskType = "job_update" | "job_import" | "generic_ai" | "ai_tool_generation";

export type AITaskStatus =
  | "queued"
  | "processing"
  | "awaiting_confirmation"
  | "completed"
  | "applied"
  | "dismissed"
  | "failed";

export interface AITaskPayload {
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  url?: string;
  text?: string;
  imageIds?: string[];
  kind?: AiToolKind;
  applicantName?: string;
  applicantHeadline?: string | null;
  resumeContent?: string | null;
  jobDescription?: string | null;
  context?: string | null;
  [key: string]: unknown;
}

export interface AITaskResult {
  extraction?: ExtractionResult;
  updatedFields?: string[];
  summary?: string;
  changesCount?: number;
  generatedEmail?: GeneratedEmail;
  toolKind?: AiToolKind;
  [key: string]: unknown;
}

export interface AITask {
  id: string;
  type: AITaskType;
  title: string;
  subtitle?: string;
  status: AITaskStatus;
  progress?: number; // 0 to 100
  statusMessage?: string;
  payload: AITaskPayload;
  result?: AITaskResult;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

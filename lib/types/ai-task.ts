import type { ExtractionResult } from "@/lib/ai/schema";

export type AITaskType = "job_update" | "job_import" | "generic_ai";

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
  [key: string]: unknown;
}

export interface AITaskResult {
  extraction: ExtractionResult;
  updatedFields?: string[];
  summary?: string;
  changesCount?: number;
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

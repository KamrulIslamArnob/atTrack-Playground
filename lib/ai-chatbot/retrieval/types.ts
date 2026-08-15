import type { Intent } from "../intent";

export type RetrievedSource =
  | "jobs"
  | "job_detail"
  | "resumes"
  | "crm"
  | "social"
  | "ai_prompts"
  | "memories"
  | "applications"
  | "interviews";

export interface RetrievedDoc {
  source: RetrievedSource;
  id: string; // stable, e.g. "job:123", "resume:uuid"
  title: string; // human label for the Sources UI chip
  text: string; // verbatim, token-truncated context
  citeRef: string; // e.g. "job:123" — referenced as [src:job:123] in prompt
}

export interface RetrievedMemory {
  id: string;
  title: string | null;
  description: string;
  relevanceScore: number;
}

export interface RetrievalResult {
  docs: RetrievedDoc[];
  // Source chips for the existing SourcesUsedChip UI (chat-messages.tsx).
  sources: string[];
  intent: Intent;
  dropped: string[]; // human-readable notes about truncated/dropped sources
  memories?: RetrievedMemory[];
}

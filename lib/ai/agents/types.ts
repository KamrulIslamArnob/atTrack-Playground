import type { RetrievedDoc } from "@/lib/ai-chatbot/retrieval/types";

export interface AgentContext {
  userId: string;
  personaId: string;
  personaPrompt?: string | null;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
  enabledSourceIds?: string[];
  sourceConfig?: Record<string, Record<string, unknown>>;
  retrievedDocs?: RetrievedDoc[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  badge?: string;
  systemPrompt: string | ((ctx: AgentContext) => string);
  /** Tool IDs that this agent is authorized to use. Empty array means text-only. */
  tools: string[];
  defaultModel?: string;
  canHandle?: (intent: string, prompt: string) => boolean;
}


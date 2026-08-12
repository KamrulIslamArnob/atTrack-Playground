export interface AIModel {
  id: string;
  name: string;
  provider: "gemini" | "anthropic" | "openai" | "deepseek" | "local" | string;
  description: string;
  supportsImages: boolean;
  isReasoning: boolean;
  badge?: string;
  capability?: string;
  isFast?: boolean;
  isPopular?: boolean;
}

export interface ChatPersona {
  id: string;
  name: string;
  iconName: string;
  description: string;
  systemPrompt: string;
  heading: string;
  subheading: string;
  preferredSources: string[];
  badge?: string;
}

export interface MiniScenario {
  id: string;
  title: string;
  description: string;
  iconName: string;
  agentId: string;
  starterPrompt: string;
  requiredSources: string[];
}

export interface ContextSource {
  id: string;
  type: "resume" | "jobs" | "contacts" | "github" | "gdrive" | "notion" | "linkedin" | "email" | "projects" | string;
  name: string;
  recordCount: number;
  lastSync: string;
  enabled: boolean;
}

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
}

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

export type SourceKind =
  | "native"
  | "oauth"
  | "pat"
  | "fs"
  | "api"
  | "custom";

export interface ContextSource {
  id: string; // stable: "jobs" | "github" | "obsidian" | "db_query" | "custom:<uuid>"
  type:
    | "resume"
    | "jobs"
    | "contacts"
    | "links"
    | "ai_prompts"
    | "obsidian"
    | "github"
    | "db_query"
    | "custom"
    | string;
  name: string;
  kind: SourceKind;
  enabled: boolean; // REAL permission — gates the linked tool
  recordCount: number; // 0 if not yet synced / not applicable
  lastSync: string | null; // real ISO timestamp or null
  toolName?: string; // links to a ToolDefinition.name (e.g. "search_jobs")
  // Auth/config for kinds that need credentials. Secrets NEVER live here —
  // only status + a reference; the secret itself is stored encrypted elsewhere
  // (localStorage for MVP, never logged, redacted in code).
  auth?: {
    status: "none" | "needed" | "connected";
    method?: "oauth" | "pat" | "fs-path" | "api-key";
  };
  config?: Record<string, unknown>; // e.g. { vaultPath } / { allowTables }
  isCustom?: boolean;
}

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  details?: string;
}

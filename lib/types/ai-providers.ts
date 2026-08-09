// Shared types for the AI provider settings feature (Settings > AI Providers).
// A "provider" is one configured credential (type + base URL + model + key);
// a "task route" is the ordered fallback chain of providers used for one of
// the three task categories below.

export const PROVIDER_TYPES = ["gemini", "anthropic", "openai_compatible"] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  gemini: "Gemini",
  anthropic: "Anthropic",
  openai_compatible: "OpenAI-compatible",
};

// task_type "image" has no wired call site yet — see plan Task 6 note. It's
// still fully configurable so it's ready the moment a consumer exists.
export const TASK_TYPES = ["text", "image", "scraping"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  text: "Text",
  image: "Image",
  scraping: "Scraping",
};

// Quick-fill buttons for openai_compatible's base_url field. Picking one just
// populates the field — the stored provider_type is still "openai_compatible".
export const OPENAI_COMPATIBLE_PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { label: "Together", baseUrl: "https://api.together.xyz/v1" },
  { label: "Ollama (local)", baseUrl: "http://localhost:11434/v1" },
] as const;

/** Client/UI-safe shape — never carries the decrypted (or encrypted) key. */
export interface AiProviderSummary {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
}

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

export type PresetCategory = "major" | "local" | "aggregator" | "protocol";

export interface AiPreset {
  id: string;
  name: string;
  category: PresetCategory;
  providerType: ProviderType;
  defaultModel: string;
  defaultBaseUrl?: string;
  badge?: string;
  placeholder: string;
  helpUrl?: string;
  isLocal?: boolean;
}

export const AI_PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: "major", label: "Major Providers" },
  { id: "local", label: "Local Engines" },
  { id: "aggregator", label: "Aggregators & Gateways" },
  { id: "protocol", label: "Standard Protocols" },
];

export const ALL_AI_PRESETS: AiPreset[] = [
  // Major Providers
  {
    id: "openai",
    name: "OpenAI",
    category: "major",
    providerType: "openai_compatible",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "major",
    providerType: "gemini",
    defaultModel: "gemini-2.5-flash",
    badge: "Free tier",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    category: "major",
    providerType: "anthropic",
    defaultModel: "claude-3-7-sonnet-20250219",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "groq",
    name: "Groq",
    category: "major",
    providerType: "openai_compatible",
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    badge: "Fast",
    placeholder: "gsk_...",
    helpUrl: "https://console.groq.com/keys",
  },
  {
    id: "xai",
    name: "xAI Grok",
    category: "major",
    providerType: "openai_compatible",
    defaultModel: "grok-2-latest",
    defaultBaseUrl: "https://api.x.ai/v1",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai",
  },
  {
    id: "nvidia",
    name: "Nvidia",
    category: "major",
    providerType: "openai_compatible",
    defaultModel: "meta/llama-3.3-70b-instruct",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    placeholder: "nvapi-...",
    helpUrl: "https://build.nvidia.com",
  },

  // Local Engines
  {
    id: "ollama",
    name: "Ollama",
    category: "local",
    providerType: "openai_compatible",
    defaultModel: "llama3.2:latest",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    badge: "Local",
    isLocal: true,
    placeholder: "ollama (optional)",
    helpUrl: "https://ollama.com",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    category: "local",
    providerType: "openai_compatible",
    defaultModel: "local-model",
    defaultBaseUrl: "http://127.0.0.1:1234/v1",
    badge: "Local",
    isLocal: true,
    placeholder: "lm-studio (optional)",
    helpUrl: "https://lmstudio.ai",
  },

  // Aggregators & Custom Gateways
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "aggregator",
    providerType: "openai_compatible",
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    badge: "Aggregator",
    placeholder: "sk-or-...",
    helpUrl: "https://openrouter.ai",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "aggregator",
    providerType: "openai_compatible",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com",
  },
  {
    id: "opencodezen",
    name: "OpenCodeZen",
    category: "aggregator",
    providerType: "openai_compatible",
    defaultModel: "default",
    defaultBaseUrl: "https://api.opencodezen.com/v1",
    placeholder: "sk-...",
    helpUrl: "https://opencodezen.com",
  },
  {
    id: "nowsporter",
    name: "Now Sporter",
    category: "aggregator",
    providerType: "openai_compatible",
    defaultModel: "default",
    defaultBaseUrl: "https://api.nowsporter.com/v1",
    placeholder: "sk-...",
  },

  // Standard Protocols
  {
    id: "custom_openai",
    name: "OpenAI-compatible",
    category: "protocol",
    providerType: "openai_compatible",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    placeholder: "sk-...",
  },
  {
    id: "custom_anthropic",
    name: "Anthropic-compatible",
    category: "protocol",
    providerType: "anthropic",
    defaultModel: "claude-3-7-sonnet-20250219",
    placeholder: "sk-ant-...",
  },
];

// Quick-fill buttons for openai_compatible's base_url field.
export const OPENAI_COMPATIBLE_PRESETS = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { label: "xAI Grok", baseUrl: "https://api.x.ai/v1" },
  { label: "Nvidia", baseUrl: "https://integrate.api.nvidia.com/v1" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { label: "OpenCodeZen", baseUrl: "https://api.opencodezen.com/v1" },
  { label: "Now Sporter", baseUrl: "https://api.nowsporter.com/v1" },
  { label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  { label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
] as const;

/** Client/UI-safe shape — never carries the decrypted (or encrypted) key. */
export interface AiProviderSummary {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  verified: boolean;
}


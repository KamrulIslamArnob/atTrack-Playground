import type { ProviderType } from "@/lib/types/ai-providers";

/**
 * Vision and reasoning are not recorded on `ai_providers` — the row stores a
 * free-text model id the user typed. These heuristics are the only signal
 * available, and both the model picker (which labels the options) and the
 * auto-router (which picks one) need the same answer, so they live here rather
 * than being re-guessed on each side.
 */

/** True when the model can accept image parts.
 *
 *  "flash" is deliberately NOT a signal on its own: it was meant to catch
 *  Gemini Flash, but it also matches text-only models like
 *  `deepseek-v4-flash-latest`, which then won every auto/images turn. A Gemini
 *  model reached through an openai_compatible row is caught by "gemini". */
export function modelSupportsImages(providerType: ProviderType, model: string): boolean {
  const m = model.toLowerCase();
  return providerType === "gemini" || m.includes("gemini") || m.includes("vision") || m.includes("4o");
}

/** True when the model emits a chain of thought worth showing in the UI. */
export function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes("r1") || m.includes("reasoner") || m.includes("o1") || m.includes("thinking");
}

/** Maximum context window token capacity for known model families. */
export function getModelContextLimit(model: string): number {
  const m = (model || "").toLowerCase();
  if (m.includes("gemini-1.5-pro") || m.includes("gemini-2.5-pro") || m.includes("gemini-pro")) return 2000000;
  if (m.includes("gemini")) return 1000000;
  if (m.includes("claude-3-5") || m.includes("claude-3-7") || m.includes("claude-sonnet") || m.includes("claude-opus") || m.includes("claude-haiku")) return 200000;
  if (m.includes("gpt-4o") || m.includes("gpt-4.1") || m.includes("o1") || m.includes("o3")) return 128000;
  if (m.includes("deepseek")) return 64000;
  if (m.includes("llama-3") || m.includes("mistral") || m.includes("qwen")) return 32768;
  return 128000;
}

/** Formats token numbers cleanly (e.g. 1M, 200k, 128k, 4.2k). */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`;
  return `${tokens}`;
}


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

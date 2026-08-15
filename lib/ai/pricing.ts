// Token pricing so an AI request can report what it actually cost.
//
// Before this existed, `ai_usage_logs.cost_usd` was written as a literal 0 on
// every row (lib/actions/ai-usage.ts), so the admin AI-usage page summed to
// $0.0000 no matter how much had been spent.
//
// Pure module: no I/O, no imports. Prices are vendor list prices in USD per
// one million tokens and WILL drift — an unknown model reports `null`, never
// 0, so a stale table shows up as "unknown" rather than as free.

export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M cached-input tokens, when the vendor discounts them. */
  cached?: number;
}

/** Keyed by the longest distinctive fragment of a model id. Lookup is a
 *  longest-match scan, so `models/gemini-2.0-flash` and
 *  `claude-3-5-sonnet-20241022` both resolve without an exact-id list. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Google
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },

  // Anthropic
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-opus": { input: 15, output: 75 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-opus-4": { input: 15, output: 75 },

  // OpenAI
  "gpt-4o-mini": { input: 0.15, output: 0.6, cached: 0.075 },
  "gpt-4o": { input: 2.5, output: 10, cached: 1.25 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cached: 0.1 },
  "gpt-4.1": { input: 2, output: 8, cached: 0.5 },
  "o3-mini": { input: 1.1, output: 4.4 },

  // DeepSeek
  "deepseek-chat": { input: 0.27, output: 1.1, cached: 0.07 },
  "deepseek-reasoner": { input: 0.55, output: 2.19, cached: 0.14 },
};

/** Usage logging records `${provider.name}/${modelId}`, and `provider.name`
 *  is user-typed. Strip that first segment, but only one: an OpenRouter id is
 *  itself `vendor/model` and must keep its slash. */
export function normalizeModelId(raw: string | undefined | null): string {
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const slash = lower.indexOf("/");
  if (slash === -1) return lower;
  const tail = lower.slice(slash + 1);
  // `models/gemini-…` is Google's own prefix, not a provider label, and the
  // tail of an OpenRouter id is the part that carries the model name either
  // way — so dropping one leading segment is right in both cases.
  return tail;
}

export function findPrice(model: string | undefined | null): ModelPrice | null {
  const id = normalizeModelId(model);
  if (!id) return null;
  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(MODEL_PRICES)) {
    if (!id.includes(key)) continue;
    if (!best || key.length > best.key.length) best = { key, price };
  }
  return best?.price ?? null;
}

export interface TokenCounts {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
}

export interface CostEstimate {
  /** null when no price is known — never 0, which would read as "free". */
  costUsd: number | null;
  pricing: "known" | "unknown";
}

export function estimateCost(model: string | undefined | null, tokens: TokenCounts): CostEstimate {
  const price = findPrice(model);
  if (!price) return { costUsd: null, pricing: "unknown" };

  const cached = tokens.cachedTokens ?? 0;
  // Vendors report cached tokens as a subset of the input count, so the
  // uncached remainder is what gets charged at the full input rate.
  const billedInput = Math.max(0, (tokens.inputTokens ?? 0) - cached);
  const cachedRate = price.cached ?? price.input;

  const usd =
    (billedInput * price.input + cached * cachedRate + (tokens.outputTokens ?? 0) * price.output) /
    1_000_000;

  // Sub-cent calls are the norm; six places keeps them from rounding to zero.
  return { costUsd: Math.round(usd * 1e6) / 1e6, pricing: "known" };
}

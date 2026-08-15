"use server";

import { createDbClient as createAdminClient } from "@/lib/db/client";

interface AiUsageLogParams {
  userId: string;
  action: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  /** null when the model has no entry in lib/ai/pricing.ts. */
  costUsd?: number | null;
  /** "unknown" means the cost column is a placeholder, not a real zero. */
  pricing?: "known" | "unknown";
  durationMs?: number;
  status?: "success" | "error";
  error?: string;
  metadata?: Record<string, unknown>;
}

export async function logAiUsage(params: AiUsageLogParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("ai_usage_logs").insert({
      user_id: params.userId,
      action: params.action,
      model: params.model ?? null,
      input_tokens: params.inputTokens ?? 0,
      output_tokens: params.outputTokens ?? 0,
      // Stays a number even when the price is unknown: the admin screens call
      // `.toFixed(4)` on this column unguarded, so a NULL would crash them.
      // `pricing` below is what separates "this really cost nothing" from
      // "this model is missing from lib/ai/pricing.ts".
      cost_usd: params.costUsd ?? 0,
      duration_ms: params.durationMs ?? null,
      metadata: {
        status: params.status ?? "success",
        pricing: params.pricing ?? "unknown",
        ...(params.error ? { error: params.error } : {}),
        ...(params.cachedTokens ? { cached_tokens: params.cachedTokens } : {}),
        ...(params.reasoningTokens ? { reasoning_tokens: params.reasoningTokens } : {}),
        ...(params.metadata ?? {}),
      },
    });
  } catch {
    // AI usage logging should never break the main flow
  }
}

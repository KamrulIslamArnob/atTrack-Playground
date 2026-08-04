"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface AiUsageLogParams {
  userId: string;
  action: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
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
      cost_usd: params.costUsd ?? 0,
      duration_ms: params.durationMs ?? null,
      metadata: {
        status: params.status ?? "success",
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

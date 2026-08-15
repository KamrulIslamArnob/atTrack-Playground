"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  PROVIDER_TYPES,
  TASK_TYPES,
  type AiProviderSummary,
  type ProviderType,
  type TaskType,
} from "@/lib/types/ai-providers";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.ai-providers");

interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  verified_at: string | null;
}

function toSummary(row: ProviderRow): AiProviderSummary {
  return {
    id: row.id,
    name: row.name,
    provider_type: row.provider_type,
    base_url: row.base_url,
    model: row.model,
    verified: !!row.verified_at,
  };
}

/** Stamps (or clears) verified_at after a real connection attempt against a
 *  saved provider — the one place that turns a test result into unlock state. */
async function persistVerification(
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"],
  id: string,
  userId: string,
  success: boolean
) {
  await supabase
    .from("ai_providers")
    .update({ verified_at: success ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function listProviders(): Promise<AiProviderSummary[]> {
  const { supabase, userId } = await getUser();

  const { data } = await supabase
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model, verified_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as ProviderRow[]).map(toSummary);
}

/** True when a chat request would actually have a model to call: either a
 *  provider whose connection has actually tested successfully (Settings →
 *  AI Providers — a saved-but-never-tested or since-broken key doesn't count)
 *  or the zero-config GEMINI_API_KEY env fallback (see lib/ai/providers.ts).
 *  Single source of truth for gating AI features so every lock screen and the
 *  actual provider resolution agree on "is anything usable". */
export async function hasAnyProviderConfigured(): Promise<boolean> {
  if (process.env.GEMINI_API_KEY) return true;
  const providers = await listProviders();
  return providers.some((p) => p.verified);
}

export async function createProvider(params: {
  name: string;
  provider_type: ProviderType;
  base_url?: string | null;
  model: string;
  api_key: string;
}): Promise<{ error?: string; id?: string; verified?: boolean; verifyError?: string }> {
  const { supabase, userId } = await getUser();

  if (!PROVIDER_TYPES.includes(params.provider_type)) {
    return { error: "Invalid provider type." };
  }
  if (params.provider_type === "openai_compatible" && !params.base_url?.trim()) {
    return { error: "Base URL is required for OpenAI-compatible providers." };
  }
  if (!params.name.trim()) {
    return { error: "Name is required." };
  }
  if (!params.model.trim()) {
    return { error: "Model is required." };
  }
  if (!params.api_key.trim()) {
    return { error: "API key is required." };
  }

  const { data, error } = await supabase
    .from("ai_providers")
    .insert({
      user_id: userId,
      name: params.name.trim(),
      provider_type: params.provider_type,
      base_url: params.provider_type === "openai_compatible" ? params.base_url!.trim() : null,
      model: params.model.trim(),
      encrypted_api_key: encrypt(params.api_key.trim()),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    log.error({ err: error }, "Error creating AI provider:");
    return { error: "Failed to save provider." };
  }

  const id = (data as unknown as { id: string }).id;

  // Auto-verify with the key just entered, same check the manual "Test
  // Connection" button runs — a provider must prove it actually works before
  // it can unlock AI features, not just exist as a saved row.
  const verifyResult = await attemptProviderConnection({
    id,
    provider_type: params.provider_type,
    base_url: params.base_url,
    model: params.model,
    api_key: params.api_key,
  });
  await persistVerification(supabase, id, userId, verifyResult.success);

  // Automatically assign newly created provider to unconfigured task routes
  for (const taskType of ["text", "image", "scraping"] as const) {
    try {
      const { data: existingRoute } = await supabase
        .from("ai_task_routes")
        .select("provider_ids")
        .eq("user_id", userId)
        .eq("task_type", taskType)
        .maybeSingle();

      const currentIds = (existingRoute as unknown as { provider_ids: string[] } | null)?.provider_ids ?? [];
      if (currentIds.length === 0) {
        await supabase.from("ai_task_routes").upsert({
          user_id: userId,
          task_type: taskType,
          provider_ids: [id],
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      // Non-critical auto-route failure
    }
  }

  revalidatePath("/settings");
  revalidatePath("/preferences");
  return { id, verified: verifyResult.success, verifyError: verifyResult.error };
}

export async function updateProvider(
  id: string,
  params: {
    name: string;
    provider_type: ProviderType;
    base_url?: string | null;
    model: string;
    api_key?: string;
  }
): Promise<{ error?: string; verified?: boolean; verifyError?: string }> {
  const { supabase, userId } = await getUser();

  if (!PROVIDER_TYPES.includes(params.provider_type)) {
    return { error: "Invalid provider type." };
  }
  if (params.provider_type === "openai_compatible" && !params.base_url?.trim()) {
    return { error: "Base URL is required for OpenAI-compatible providers." };
  }

  const update: Record<string, unknown> = {
    name: params.name.trim(),
    provider_type: params.provider_type,
    base_url: params.provider_type === "openai_compatible" ? params.base_url!.trim() : null,
    model: params.model.trim(),
    updated_at: new Date().toISOString(),
  };
  const keyChanged = Boolean(params.api_key?.trim());
  if (keyChanged) {
    update.encrypted_api_key = encrypt(params.api_key!.trim());
    // A changed key invalidates whatever was verified before; re-verify below.
    update.verified_at = null;
  }

  const { error } = await supabase.from("ai_providers").update(update).eq("id", id).eq("user_id", userId);

  if (error) {
    log.error({ err: error }, "Error updating AI provider:");
    return { error: "Failed to update provider." };
  }

  if (keyChanged) {
    const verifyResult = await attemptProviderConnection({
      id,
      provider_type: params.provider_type,
      base_url: params.base_url,
      model: params.model,
      api_key: params.api_key,
    });
    await persistVerification(supabase, id, userId, verifyResult.success);
    revalidatePath("/settings");
    return { verified: verifyResult.success, verifyError: verifyResult.error };
  }

  revalidatePath("/settings");
  return {};
}

export async function deleteProvider(id: string): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("ai_providers").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    log.error({ err: error }, "Error deleting AI provider:");
    return { error: "Failed to delete provider." };
  }

  // A deleted provider must not linger inside any task's fallback chain.
  const { data: routes } = await supabase
    .from("ai_task_routes")
    .select("id, provider_ids")
    .eq("user_id", userId);

  for (const route of (routes ?? []) as unknown as { id: string; provider_ids: string[] }[]) {
    if (route.provider_ids.includes(id)) {
      await supabase
        .from("ai_task_routes")
        .update({ provider_ids: route.provider_ids.filter((p) => p !== id) })
        .eq("id", route.id)
        .eq("user_id", userId);
    }
  }

  revalidatePath("/settings");
  return {};
}

export async function getTaskRoutes(): Promise<Record<TaskType, AiProviderSummary[]>> {
  const { supabase, userId } = await getUser();

  const [{ data: providers }, { data: routes }] = await Promise.all([
    supabase.from("ai_providers").select("id, name, provider_type, base_url, model, verified_at").eq("user_id", userId),
    supabase.from("ai_task_routes").select("task_type, provider_ids").eq("user_id", userId),
  ]);

  const byId = new Map(((providers ?? []) as unknown as ProviderRow[]).map((p) => [p.id, toSummary(p)]));
  const routeByType = new Map(
    ((routes ?? []) as unknown as { task_type: TaskType; provider_ids: string[] }[]).map((r) => [
      r.task_type,
      r.provider_ids,
    ])
  );

  const result = {} as Record<TaskType, AiProviderSummary[]>;
  for (const taskType of TASK_TYPES) {
    const ids = routeByType.get(taskType) ?? [];
    result[taskType] = ids.map((id) => byId.get(id)).filter((p): p is AiProviderSummary => !!p);
  }
  return result;
}

export async function saveTaskRoute(taskType: TaskType, providerIds: string[]): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  if (!TASK_TYPES.includes(taskType)) {
    return { error: "Invalid task type." };
  }

  const { error } = await supabase.from("ai_task_routes").upsert(
    {
      user_id: userId,
      task_type: taskType,
      provider_ids: providerIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,task_type" }
  );

  if (error) {
    log.error({ err: error }, "Error saving AI task route:");
    return { error: "Failed to save task routing." };
  }

  revalidatePath("/settings");
  return {};
}

export interface FetchedModel {
  id: string;
  name?: string;
  isFree?: boolean;
  description?: string;
  contextLength?: number;
}

export async function testProviderConnection(params: {
  id?: string;
  provider_type: ProviderType;
  base_url?: string | null;
  model: string;
  api_key?: string;
}): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
  const result = await attemptProviderConnection(params);
  // A saved provider's verified state is only ever set by an actual attempt
  // (this call, or the auto-verify that runs right after create/update below) —
  // never by row existence alone. See hasAnyProviderConfigured.
  if (params.id) {
    const { supabase, userId } = await getUser();
    await persistVerification(supabase, params.id, userId, result.success);
  }
  return result;
}

async function attemptProviderConnection(params: {
  id?: string;
  provider_type: ProviderType;
  base_url?: string | null;
  model: string;
  api_key?: string;
}): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
  const { supabase, userId } = await getUser();

  let apiKey = params.api_key?.trim();
  let baseUrl = params.base_url?.trim() || null;
  let model = params.model.trim();

  if (!apiKey && params.id) {
    const { data } = await supabase
      .from("ai_providers")
      .select("encrypted_api_key, base_url, model")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.encrypted_api_key) {
      try {
        apiKey = decrypt(data.encrypted_api_key);
        if (!baseUrl) baseUrl = data.base_url;
        if (!model) model = data.model;
      } catch {
        return { success: false, error: "Failed to decrypt saved API key." };
      }
    }
  }

  const isOllama = baseUrl?.includes("localhost") || baseUrl?.includes("127.0.0.1");
  if (!apiKey && !isOllama && params.provider_type !== "gemini") {
    return { success: false, error: "API key is required to test connection." };
  }

  const startTime = Date.now();

  try {
    if (params.provider_type === "gemini") {
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse) return { success: false, error: "No Gemini API key provided." };

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyToUse)}`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, error: `Gemini API returned ${res.status}: ${text.slice(0, 100)}` };
      }
      return { success: true, latencyMs };
    }

    if (params.provider_type === "anthropic") {
      if (!apiKey) return { success: false, error: "Anthropic API key is required." };

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: model || "claude-3-5-haiku-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, error: `Anthropic API returned ${res.status}: ${text.slice(0, 100)}` };
      }
      return { success: true, latencyMs };
    }

    if (params.provider_type === "openai_compatible") {
      if (!baseUrl) return { success: false, error: "Base URL is required." };

      const cleanBase = baseUrl.replace(/\/+$/, "");
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (apiKey) {
        headers["authorization"] = `Bearer ${apiKey}`;
      }

      let res = await fetch(`${cleanBase}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${cleanBase}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: model || "gpt-3.5-turbo",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(10000),
        });
      }

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { success: false, error: `Provider API returned ${res.status}: ${text.slice(0, 120)}` };
      }
      return { success: true, latencyMs };
    }

    return { success: false, error: "Unsupported provider type." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Connection failed: ${msg}` };
  }
}

export async function fetchProviderModels(params: {
  id?: string;
  provider_type: ProviderType;
  base_url?: string | null;
  api_key?: string;
}): Promise<{ success: boolean; error?: string; models: FetchedModel[] }> {
  const { supabase, userId } = await getUser();

  let apiKey = params.api_key?.trim();
  let baseUrl = params.base_url?.trim() || null;

  if (!apiKey && params.id) {
    const { data } = await supabase
      .from("ai_providers")
      .select("encrypted_api_key, base_url")
      .eq("id", params.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.encrypted_api_key) {
      try {
        apiKey = decrypt(data.encrypted_api_key);
        if (!baseUrl) baseUrl = data.base_url;
      } catch {
        // Ignored
      }
    }
  }

  try {
    if (params.provider_type === "gemini") {
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse) return { success: false, error: "No Gemini API key provided.", models: getFallbackModels("gemini") };

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyToUse)}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return { success: false, error: `Failed to fetch Gemini models (${res.status})`, models: getFallbackModels("gemini") };

      const json = await res.json();
      const rawList = Array.isArray(json.models) ? json.models : [];
      const models: FetchedModel[] = rawList
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent")
        )
        .map((m: { name: string; displayName?: string; description?: string; inputTokenLimit?: number }) => ({
          id: m.name,
          name: m.displayName || m.name,
          description: m.description,
          contextLength: m.inputTokenLimit,
          isFree: false,
        }));

      return { success: true, models: models.length > 0 ? models : getFallbackModels("gemini") };
    }

    if (params.provider_type === "anthropic") {
      if (apiKey) {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);

        if (res && res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            const models: FetchedModel[] = json.data.map((m: { id: string; display_name?: string }) => ({
              id: m.id,
              name: m.display_name || m.id,
              isFree: false,
            }));
            return { success: true, models };
          }
        }
      }
      return { success: true, models: getFallbackModels("anthropic") };
    }

    if (params.provider_type === "openai_compatible") {
      if (!baseUrl) return { success: false, error: "Base URL is required to fetch models.", models: [] };

      const cleanBase = baseUrl.replace(/\/+$/, "");
      const headers: Record<string, string> = {};
      if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(`${cleanBase}/models`, {
        headers,
        signal: AbortSignal.timeout(10000),
      }).catch((err) => {
        log.error({ err }, "Fetch models error:");
        return null;
      });

      if (!res || !res.ok) {
        const fallback = getFallbackModelsForBaseUrl(cleanBase);
        return {
          success: false,
          error: res ? `HTTP ${res.status}` : "Could not reach endpoint /models",
          models: fallback,
        };
      }

      const json = await res.json();
      const rawData = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];

      const models: FetchedModel[] = rawData.map((m: {
        id: string;
        name?: string;
        pricing?: { prompt?: string; completion?: string };
        context_length?: number;
      }) => {
        const id = m.id;
        const promptCost = m.pricing?.prompt;
        const completionCost = m.pricing?.completion;
        const isFree =
          id.toLowerCase().includes(":free") ||
          id.toLowerCase().includes("free") ||
          (promptCost === "0" && completionCost === "0");

        return {
          id,
          name: m.name || id,
          isFree,
          contextLength: m.context_length,
        };
      });

      models.sort((a, b) => {
        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;
        return a.id.localeCompare(b.id);
      });

      if (models.length === 0) {
        return { success: true, models: getFallbackModelsForBaseUrl(cleanBase) };
      }

      return { success: true, models };
    }

    return { success: false, error: "Unknown provider type.", models: [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, models: getFallbackModels(params.provider_type) };
  }
}

function getFallbackModels(providerType: ProviderType): FetchedModel[] {
  if (providerType === "gemini") {
    return [
      { id: "models/gemini-2.0-flash", name: "Gemini 2.0 Flash", isFree: false },
      { id: "models/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", isFree: false },
      { id: "models/gemini-1.5-pro", name: "Gemini 1.5 Pro", isFree: false },
      { id: "models/gemini-1.5-flash", name: "Gemini 1.5 Flash", isFree: false },
    ];
  }
  if (providerType === "anthropic") {
    return [
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", isFree: false },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", isFree: false },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", isFree: false },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", isFree: false },
    ];
  }
  return [];
}

function getFallbackModelsForBaseUrl(baseUrl: string): FetchedModel[] {
  const url = baseUrl.toLowerCase();
  if (url.includes("openrouter")) {
    return [
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Meta: Llama 3.3 70B (free)", isFree: true },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (free)", isFree: true },
      { id: "google/gemini-2.0-flash-exp:free", name: "Google: Gemini 2.0 Flash (free)", isFree: true },
      { id: "qwen/qwen-2.5-coder-32b-instruct:free", name: "Qwen 2.5 Coder 32B (free)", isFree: true },
      { id: "mistralai/mistral-small-24b-instruct-2501:free", name: "Mistral Small 24B (free)", isFree: true },
      { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o Mini", isFree: false },
      { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet", isFree: false },
    ];
  }
  if (url.includes("groq")) {
    return [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", isFree: false },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", isFree: false },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7b 32k", isFree: false },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", isFree: false },
    ];
  }
  if (url.includes("deepseek")) {
    return [
      { id: "deepseek-chat", name: "DeepSeek V3 (Chat)", isFree: false },
      { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoner)", isFree: false },
    ];
  }
  if (url.includes("openai.com")) {
    return [
      { id: "gpt-4o-mini", name: "GPT-4o Mini", isFree: false },
      { id: "gpt-4o", name: "GPT-4o", isFree: false },
      { id: "o1", name: "o1", isFree: false },
      { id: "o3-mini", name: "o3-mini", isFree: false },
    ];
  }
  return [];
}

export async function exportAiProviders(): Promise<{
  version: string;
  exportedAt: string;
  providers: Array<{
    name: string;
    provider_type: ProviderType;
    base_url: string | null;
    model: string;
    api_key: string;
  }>;
}> {
  const { supabase, userId } = await getUser();

  const { data: rawProviders } = await supabase
    .from("ai_providers")
    .select("name, provider_type, base_url, model, encrypted_api_key")
    .eq("user_id", userId);

  const providers = (rawProviders ?? []).map((p) => {
    let api_key = "";
    try {
      if (p.encrypted_api_key) api_key = decrypt(p.encrypted_api_key as string);
    } catch (err) {
      log.error({ err }, "[ExportProviders] Decryption failed:");
    }
    return {
      name: p.name as string,
      provider_type: p.provider_type as ProviderType,
      base_url: p.base_url as string | null,
      model: p.model as string,
      api_key,
    };
  });

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    providers,
  };
}

export async function importAiProviders(jsonString: string): Promise<{ error?: string; count?: number }> {
  const { supabase, userId } = await getUser();

  try {
    const parsed = JSON.parse(jsonString);
    const providersList = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.providers)
      ? parsed.providers
      : null;

    if (!providersList || providersList.length === 0) {
      return { error: "No valid providers found in JSON." };
    }

    let count = 0;
    for (const item of providersList) {
      if (!item.name || !item.provider_type || !item.model || !item.api_key) {
        continue;
      }
      if (!PROVIDER_TYPES.includes(item.provider_type)) {
        continue;
      }

      const { data: existing } = await supabase
        .from("ai_providers")
        .select("id")
        .eq("user_id", userId)
        .eq("name", String(item.name).trim())
        .maybeSingle();

      if (existing) {
        await supabase
          .from("ai_providers")
          .update({
            provider_type: item.provider_type,
            base_url: item.base_url ? String(item.base_url).trim() : null,
            model: String(item.model).trim(),
            encrypted_api_key: encrypt(String(item.api_key).trim()),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId);
      } else {
        await supabase.from("ai_providers").insert({
          user_id: userId,
          name: String(item.name).trim(),
          provider_type: item.provider_type,
          base_url: item.base_url ? String(item.base_url).trim() : null,
          model: String(item.model).trim(),
          encrypted_api_key: encrypt(String(item.api_key).trim()),
          updated_at: new Date().toISOString(),
        });
      }
      count++;
    }

    revalidatePath("/settings");
    return { count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Invalid JSON file: ${msg}` };
  }
}


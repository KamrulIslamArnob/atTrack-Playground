"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { logResourceActivity } from "@/lib/actions/activity-log";
import {
  PROVIDER_TYPES,
  TASK_TYPES,
  type AiProviderSummary,
  type ProviderType,
  type TaskType,
} from "@/lib/types/ai-providers";

interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
}

function toSummary(row: ProviderRow): AiProviderSummary {
  return {
    id: row.id,
    name: row.name,
    provider_type: row.provider_type,
    base_url: row.base_url,
    model: row.model,
  };
}

export async function listProviders(): Promise<AiProviderSummary[]> {
  const { supabase, userId } = await getUser();

  const { data } = await supabase
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as ProviderRow[]).map(toSummary);
}

export async function createProvider(params: {
  name: string;
  provider_type: ProviderType;
  base_url?: string | null;
  model: string;
  api_key: string;
}): Promise<{ error?: string; id?: string }> {
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
    console.error("Error creating AI provider:", error);
    return { error: "Failed to save provider." };
  }

  const id = (data as unknown as { id: string }).id;
  await logResourceActivity(userId, "create", "ai_provider", id, {
    name: params.name,
    provider_type: params.provider_type,
  });
  revalidatePath("/settings");
  return { id };
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
): Promise<{ error?: string }> {
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
  if (params.api_key?.trim()) {
    update.encrypted_api_key = encrypt(params.api_key.trim());
  }

  const { error } = await supabase.from("ai_providers").update(update).eq("id", id).eq("user_id", userId);

  if (error) {
    console.error("Error updating AI provider:", error);
    return { error: "Failed to update provider." };
  }

  await logResourceActivity(userId, "update", "ai_provider", id, { name: params.name });
  revalidatePath("/settings");
  return {};
}

export async function deleteProvider(id: string): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase.from("ai_providers").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    console.error("Error deleting AI provider:", error);
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

  await logResourceActivity(userId, "delete", "ai_provider", id);
  revalidatePath("/settings");
  return {};
}

export async function getTaskRoutes(): Promise<Record<TaskType, AiProviderSummary[]>> {
  const { supabase, userId } = await getUser();

  const [{ data: providers }, { data: routes }] = await Promise.all([
    supabase.from("ai_providers").select("id, name, provider_type, base_url, model").eq("user_id", userId),
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
    console.error("Error saving AI task route:", error);
    return { error: "Failed to save task routing." };
  }

  await logResourceActivity(userId, "update", "ai_task_route", undefined, {
    task_type: taskType,
    provider_ids: providerIds,
  });
  revalidatePath("/settings");
  return {};
}

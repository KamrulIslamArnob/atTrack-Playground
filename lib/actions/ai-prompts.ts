"use server";

import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getDefaultPrompt } from "@/lib/ai/prompts-defaults";
import type { AiToolKind } from "@/lib/types/ai-tools";

export async function getCustomPrompts(): Promise<Record<string, string>> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("ai_tool_prompts")
    .select("kind, system_prompt")
    .eq("user_id", userId);

  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const row of data as { kind: string; system_prompt: string }[]) {
    map[row.kind] = row.system_prompt;
  }
  return map;
}

export async function fetchDefaultPrompt(kind: AiToolKind): Promise<string> {
  return getDefaultPrompt(kind);
}

export async function saveCustomPrompt(kind: string, systemPrompt: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const trimmed = systemPrompt.trim();
  if (!trimmed) {
    await resetCustomPrompt(kind);
    return;
  }

  // Check if existing record
  const { data: existing } = await supabase
    .from("ai_tool_prompts")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("ai_tool_prompts")
      .update({ system_prompt: trimmed })
      .eq("id", existing.id);

    if (error) throw new Error(`Failed to save prompt: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("ai_tool_prompts")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        kind,
        system_prompt: trimmed,
      });

    if (error) throw new Error(`Failed to save prompt: ${error.message}`);
  }

  revalidatePath("/preferences/ai-prompts");
}

export async function resetCustomPrompt(kind: string): Promise<void> {
  const { supabase, userId } = await getUser();

  await supabase
    .from("ai_tool_prompts")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind);

  revalidatePath("/preferences/ai-prompts");
}

"use server";

import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AiMemory, CreateMemoryInput, UpdateMemoryInput } from "@/lib/types/memories";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.memories");

export async function getMemories(): Promise<AiMemory[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("ai_memories")
    .select("id, user_id, title, description, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return JSON.parse(JSON.stringify(data)) as AiMemory[];
}

export async function getMemory(id: string): Promise<AiMemory | null> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("ai_memories")
    .select("id, user_id, title, description, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return JSON.parse(JSON.stringify(data)) as AiMemory;
}

export async function createMemory(input: CreateMemoryInput): Promise<AiMemory> {
  const { supabase, userId } = await getUser();

  const description = input.description?.trim();
  if (!description) {
    throw new Error("Memory content cannot be empty.");
  }

  const title = input.title?.trim() || null;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newMemory: AiMemory = {
    id,
    user_id: userId,
    title,
    description,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("ai_memories").insert(newMemory as unknown as Record<string, unknown>);

  if (error) {
    throw new Error(`Failed to create memory: ${error.message}`);
  }

  // Index memory vector asynchronously
  try {
    const { indexMemoryVector } = await import("@/lib/ai/embeddings");
    await indexMemoryVector(newMemory.id, userId, newMemory.title, newMemory.description);
  } catch (err) {
    log.warn({ err }, "Failed to index memory vector:");
  }

  revalidatePath("/preferences/ai-prompts");
  return newMemory;
}

export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<AiMemory> {
  const { supabase, userId } = await getUser();

  const description = input.description?.trim();
  if (!description) {
    throw new Error("Memory content cannot be empty.");
  }

  const title = input.title?.trim() || null;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_memories")
    .update({
      title,
      description,
      updated_at: now,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update memory: ${error?.message || "Not found"}`);
  }

  // Re-index memory vector asynchronously
  try {
    const { indexMemoryVector } = await import("@/lib/ai/embeddings");
    await indexMemoryVector(id, userId, title, description);
  } catch (err) {
    log.warn({ err }, "Failed to update memory vector:");
  }

  revalidatePath("/preferences/ai-prompts");
  return (data as unknown) as AiMemory;
}

export async function deleteMemory(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("ai_memories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`);
  }

  // Clean up memory vector
  try {
    const { deleteMemoryVector } = await import("@/lib/ai/embeddings");
    deleteMemoryVector(id);
  } catch (err) {
    log.warn({ err }, "Failed to delete memory vector:");
  }

  revalidatePath("/preferences/ai-prompts");
}

"use server";

import { getUser } from "@/lib/auth";
import { createDbClient } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { BUILTIN_SKILLS, type Skill, type CreateSkillInput, type UpdateSkillInput } from "@/lib/types/skills";

/**
 * Retrieves all available skills (built-ins + user custom skills).
 */
export async function getSkills(): Promise<Skill[]> {
  const { userId } = await getUser();
  const db = createDbClient();

  const { data, error } = await db
    .from("skills")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return BUILTIN_SKILLS;
  }

  const customSkills = data as unknown as Skill[];
  // Merge user custom skills with built-ins (custom skills appear first)
  return [...customSkills, ...BUILTIN_SKILLS];
}

/**
 * Creates a new custom skill.
 */
export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const { userId } = await getUser();
  const db = createDbClient();

  const cleanCommand = input.command.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanCommand) {
    throw new Error("Command name must contain letters or numbers.");
  }
  if (!input.name || !input.name.trim()) {
    throw new Error("Skill name is required.");
  }
  if (!input.instructions || !input.instructions.trim()) {
    throw new Error("Skill instructions cannot be empty.");
  }

  const newSkill: Skill = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    command: cleanCommand,
    description: input.description?.trim() || null,
    instructions: input.instructions.trim(),
    icon: input.icon || "Sparkles",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db.from("skills").insert(newSkill as unknown as Record<string, unknown>);
  if (error) {
    throw new Error(error.message || "Failed to create skill");
  }

  revalidatePath("/prompts");
  revalidatePath("/chatbot");
  return newSkill;
}

/**
 * Updates an existing custom skill.
 */
export async function updateSkill(id: string, input: UpdateSkillInput): Promise<Skill> {
  const { userId } = await getUser();
  const db = createDbClient();

  const cleanCommand = input.command.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!cleanCommand) {
    throw new Error("Command name must contain letters or numbers.");
  }

  const updates = {
    name: input.name.trim(),
    command: cleanCommand,
    description: input.description?.trim() || null,
    instructions: input.instructions.trim(),
    icon: input.icon || "Sparkles",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("skills")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update skill");
  }

  revalidatePath("/prompts");
  revalidatePath("/chatbot");
  return data as unknown as Skill;
}

/**
 * Deletes a custom skill.
 */
export async function deleteSkill(id: string): Promise<void> {
  const { userId } = await getUser();
  const db = createDbClient();

  const { error } = await db
    .from("skills")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to delete skill");
  }

  revalidatePath("/prompts");
  revalidatePath("/chatbot");
}

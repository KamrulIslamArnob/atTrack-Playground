"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { logResourceActivity } from "@/lib/actions/activity-log";
import { resumeToPlainText } from "@/lib/resume/plain-text";
import { seedResumeDoc } from "@/lib/resume/seed";
import { renderResumeTex } from "@/lib/resume/render-tex";
import type { ResumeDoc } from "@/lib/types/resume-builder";

export interface ResumeBuilderDocument {
  id: string;
  name: string;
  is_default: boolean;
  builder_data: ResumeDoc;
  updated_at: string;
}

function isResumeDoc(value: unknown): value is ResumeDoc {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<ResumeDoc>;
  return Boolean(doc.header && typeof doc.header.name === "string" && doc.experience && doc.skills);
}

export async function createResumeBuilderDocument(): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();
  const builderData = seedResumeDoc();
  const name = `${builderData.header.name || "My"} resume`;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      type: "resume",
      file_path: "",
      content: resumeToPlainText(builderData),
      builder_data: builderData,
      is_default: false,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create resume template.");

  await logResourceActivity(userId, "create", "resume_builder", data.id, { name });
  revalidatePath("/documents");
  return { id: data.id };
}

export async function getResumeBuilderDocument(id: string): Promise<ResumeBuilderDocument | null> {
  const { supabase, userId } = await getUser();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, is_default, builder_data, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("type", "resume")
    .single();

  if (error || !data || !isResumeDoc(data.builder_data)) return null;
  return data as unknown as ResumeBuilderDocument;
}

export async function saveResumeBuilderDocument(
  id: string,
  name: string,
  builderData: ResumeDoc
): Promise<void> {
  if (!isResumeDoc(builderData)) throw new Error("The resume data is incomplete.");

  const { supabase, userId } = await getUser();
  const safeName = name.trim() || `${builderData.header.name || "My"} resume`;
  const { error } = await supabase
    .from("documents")
    .update({
      name: safeName,
      builder_data: builderData,
      content: resumeToPlainText(builderData),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("type", "resume");

  if (error) throw new Error(`Unable to save resume: ${error.message}`);

  await logResourceActivity(userId, "update", "resume_builder", id, { name: safeName });
  revalidatePath("/documents");
  revalidatePath(`/documents/builder/${id}`);
  revalidatePath(`/print/resume/${id}`);
}

export async function exportResumeBuilderTex(id: string): Promise<{ name: string; tex: string }> {
  const document = await getResumeBuilderDocument(id);
  if (!document) throw new Error("Resume template not found.");

  return {
    name: document.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "resume",
    tex: renderResumeTex(document.builder_data),
  };
}

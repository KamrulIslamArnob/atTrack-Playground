"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { aiToolLabel, type AiToolKind } from "@/lib/types/ai-tools";

/** AI Tools tab "Save as Document" — no physical file, content lives in documents.content. */
export async function saveAiToolAsDocument(
  jobId: string,
  kind: AiToolKind,
  subject: string,
  body: string
): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id, title").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      type: kind === "cover_letter" ? "cover_letter" : "other",
      name: `${aiToolLabel(kind)} — ${job.title}`,
      // No uploaded file backs a generated email — the text lives in `content`.
      file_path: `generated/${userId}/${crypto.randomUUID()}.txt`,
      content: `Subject: ${subject}\n\n${body}`,
      generated_kind: kind,
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to save document.");

  await supabase.from("job_documents").insert({ job_id: jobId, document_id: doc.id });

  revalidatePath("/jobs/" + jobId);
  revalidatePath("/documents");
  return { id: doc.id };
}


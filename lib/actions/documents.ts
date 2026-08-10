"use server";

import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { extractResumeContent, calculateMatchScore, type ResumeMatchData } from "@/lib/ai/resume";
import { logResourceActivity } from "@/lib/actions/activity-log";

export interface Document {
  id: string;
  name: string;
  type: string;
  // NOT NULL in schema.sql and unchanged there. A resume-builder document has
  // no file until its first PDF export, so its create action writes '' here
  // rather than relaxing the column.
  file_path: string;
  content: string | null;
  is_default: boolean;
  match_data: ResumeMatchData | null;
  created_at: string;
}

export async function getDocuments(): Promise<Document[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, type, file_path, content, is_default, match_data, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return (data as unknown as Document[]) ?? [];
}

export async function uploadDocument(formData: FormData): Promise<{ documentId: string }> {
  const { supabase, userId } = await getUser();

  const file = formData.get("file") as File;
  const name = (formData.get("name") as string) || file.name.replace(".pdf", "");
  const type = (formData.get("type") as string) || "resume";
  const setDefault = formData.get("is_default") === "true";
  const extractedText = formData.get("extracted_text") as string;

  if (!file || file.size === 0) {
    throw new Error("No file selected");
  }

  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are supported");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File size must be less than 10MB");
  }

  const pdfText = extractedText || "";

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error("Could not extract text from PDF. Please ensure the PDF contains selectable text.");
  }

  // AI extraction of structured resume data
  let matchData: ResumeMatchData | null = null;
  try {
    matchData = await extractResumeContent(pdfText, userId);
  } catch (e) {
    console.error("AI extraction failed, continuing without match data:", e);
  }

  // Upload to storage
  const filePath = `${userId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // If setting as default, unset other defaults first
  if (setDefault) {
    await supabase
      .from("documents")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  // Insert document record
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      name,
      type,
      file_path: filePath,
      content: pdfText,
      is_default: setDefault,
      match_data: matchData,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to save document: ${insertError.message}`);
  }

  // If this is a resume (default or not), recalculate match scores for all jobs
  if (type === "resume") {
    await recalculateAllMatchScores(supabase, userId);
  }

  revalidatePath("/documents");
  revalidatePath("/jobs");

  await logResourceActivity(userId, "create", "document", doc.id, { name, type });
  return { documentId: doc.id };
}

export async function deleteDocument(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  // Get document before deleting
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, type")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!doc) {
    throw new Error("Document not found");
  }

  // Delete from storage
  await supabase.storage.from("documents").remove([doc.file_path]);

  // Delete from DB
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  // If deleted resume was matched to jobs, recalculate
  if (doc.type === "resume") {
    await recalculateAllMatchScores(supabase, userId);
  }

  revalidatePath("/documents");
  revalidatePath("/jobs");
  await logResourceActivity(userId, "delete", "document", id);
}

export async function setDefaultDocument(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  // Unset all defaults
  await supabase
    .from("documents")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);

  // Set new default
  const { error } = await supabase
    .from("documents")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to set default: ${error.message}`);
  }

  // Recalculate all match scores with new default
  await recalculateAllMatchScores(supabase, userId);

  revalidatePath("/documents");
  revalidatePath("/jobs");
  await logResourceActivity(userId, "update", "document", id, { is_default: true });
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { supabase, userId } = await getUser();

  // Verify ownership
  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("file_path", filePath)
    .eq("user_id", userId)
    .single();

  if (!doc) {
    throw new Error("Document not found");
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

async function recalculateAllMatchScores(
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"],
  userId: string
): Promise<void> {
  // Get all resumes with match_data
  const { data: resumes } = await supabase
    .from("documents")
    .select("id, match_data")
    .eq("user_id", userId)
    .eq("type", "resume")
    .not("match_data", "is", null);

  // Jobs where the user picked a resume via setJobResume (job-detail-sheet)
  // keep that pick — this pass would otherwise overwrite it with the AI's own
  // best-match guess on every resume upload/delete/default change.
  if (!resumes || resumes.length === 0) {
    // No resumes with match data, clear all scores except user-picked ones.
    await supabase
      .from("jobs")
      .update({ match_score: null, matched_resume_id: null, match_reasoning: null })
      .eq("user_id", userId)
      .is("resume_id", null);
    return;
  }

  // Get all jobs with descriptions, excluding ones with a user-picked resume.
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, description")
    .eq("user_id", userId)
    .is("resume_id", null);

  if (!jobs || jobs.length === 0) return;

  // Score each job against each resume, pick best
  for (const job of jobs) {
    let bestScore = 0;
    let bestReasoning = "";
    let bestResumeId = "";

    for (const resume of resumes) {
      try {
        const result = await calculateMatchScore(
          job.title,
          job.description,
          resume.match_data as unknown as ResumeMatchData,
          userId
        );

        if (result.score > bestScore) {
          bestScore = result.score;
          bestReasoning = result.reasoning;
          bestResumeId = resume.id;
        }
      } catch (e) {
        console.error(`Failed to score job ${job.id} against resume ${resume.id}:`, e);
      }
    }

    if (bestResumeId) {
      await supabase
        .from("jobs")
        .update({
          match_score: bestScore,
          matched_resume_id: bestResumeId,
          match_reasoning: bestReasoning,
        })
        .eq("id", job.id)
        .eq("user_id", userId);
    }
  }
}

// --- job_documents (job-detail-sheet Documents tab) ---------------------

export interface JobDocument {
  id: string; // documents.id
  name: string;
  type: string;
  generated_kind: string | null;
  created_at: string;
}

export async function getJobDocuments(jobId: string): Promise<JobDocument[]> {
  const { supabase, userId } = await getUser();

  // job_documents carries no user_id of its own — scope through the job so a
  // stray row from a carried-over multi-user DB can't leak another user's docs.
  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (!job) return [];

  const { data, error } = await supabase
    .from("job_documents")
    .select("document:documents(id, name, type, generated_kind, created_at)")
    .eq("job_id", jobId);

  if (error) {
    console.error("Error fetching job documents:", error);
    return [];
  }

  return ((data ?? []) as unknown as { document: JobDocument | null }[])
    .map((row) => row.document)
    .filter((d): d is JobDocument => d !== null);
}

export async function linkDocument(jobId: string, documentId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  // Ownership check on both sides before writing the join row.
  const [{ data: job }, { data: doc }] = await Promise.all([
    supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single(),
    supabase.from("documents").select("id").eq("id", documentId).eq("user_id", userId).single(),
  ]);
  if (!job || !doc) throw new Error("Job or document not found.");

  await supabase.from("job_documents").insert({ job_id: jobId, document_id: documentId });

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "link", "job_document", documentId, { job_id: jobId });
}

export async function unlinkDocument(jobId: string, documentId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await supabase.from("job_documents").delete().eq("job_id", jobId).eq("document_id", documentId);

  revalidatePath("/jobs/" + jobId);
  await logResourceActivity(userId, "unlink", "job_document", documentId, { job_id: jobId });
}

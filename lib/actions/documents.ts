"use server";

import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { extractResumeContent, calculateMatchScore, type ResumeMatchData } from "@/lib/ai/resume";
import { logResourceActivity } from "@/lib/actions/activity-log";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";
import { exec, spawn } from "node:child_process";

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

  // Save PDF locally to public/resume/
  const resumeDir = path.join(process.cwd(), "public", "resume");
  await mkdir(resumeDir, { recursive: true });

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filename = `${Date.now()}-${safeFileName}`;
  const localDiskPath = path.join(resumeDir, filename);
  const filePath = `/resume/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(localDiskPath, Buffer.from(arrayBuffer));

  // If setting as default, unset other defaults first
  if (setDefault) {
    await supabase
      .from("documents")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  // Insert document record immediately without waiting for AI
  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      name,
      type,
      file_path: filePath,
      content: pdfText,
      is_default: setDefault,
      match_data: null,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to save document: ${insertError.message}`);
  }

  // Fire AI extraction & match score recalculation in the background asynchronously
  processResumeBackground(doc.id, pdfText, userId, type, supabase).catch((err) => {
    console.error("Background resume processing error:", err);
  });

  revalidatePath("/documents");
  revalidatePath("/jobs");

  await logResourceActivity(userId, "create", "document", doc.id, { name, type });
  return { documentId: doc.id };
}

async function processResumeBackground(
  docId: string,
  pdfText: string,
  userId: string,
  type: string,
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"]
): Promise<void> {
  try {
    const matchData = await extractResumeContent(pdfText, userId);
    await supabase
      .from("documents")
      .update({ match_data: matchData })
      .eq("id", docId)
      .eq("user_id", userId);

    if (type === "resume") {
      await recalculateAllMatchScores(supabase, userId);
    }
  } catch (e) {
    console.error(`Background processing for document ${docId} failed:`, e);
  }
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

  // Delete local file if stored in public/resume/ or fallback to storage
  if (doc.file_path && doc.file_path.startsWith("/resume/")) {
    const localDiskPath = path.join(process.cwd(), "public", doc.file_path);
    await unlink(localDiskPath).catch((err) => {
      console.warn(`Could not delete local file ${localDiskPath}:`, err);
    });
  } else if (doc.file_path) {
    await supabase.storage.from("documents").remove([doc.file_path]).catch(() => {});
  }

  // Delete from DB
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }

  // If deleted resume was matched to jobs, recalculate in background
  if (doc.type === "resume") {
    recalculateAllMatchScores(supabase, userId).catch((err) => {
      console.error("Background recalculateAllMatchScores failed:", err);
    });
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

  // Recalculate all match scores with new default in background
  recalculateAllMatchScores(supabase, userId).catch((err) => {
    console.error("Background recalculateAllMatchScores failed:", err);
  });

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

  if (filePath.startsWith("/resume/")) {
    return filePath;
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error || !data?.signedUrl) {
    return filePath;
  }

  return data.signedUrl;
}

async function recalculateAllMatchScores(
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"],
  userId: string
): Promise<void> {
  // Get all resumes with match_data (prioritize default resume)
  const { data: resumes } = await supabase
    .from("documents")
    .select("id, match_data, is_default")
    .eq("user_id", userId)
    .eq("type", "resume")
    .not("match_data", "is", null)
    .order("is_default", { ascending: false });

  if (!resumes || resumes.length === 0) {
    await supabase
      .from("jobs")
      .update({ match_score: null, matched_resume_id: null, match_reasoning: null })
      .eq("user_id", userId)
      .is("resume_id", null);
    return;
  }

  // Get all jobs without explicit resume pick
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, description")
    .eq("user_id", userId)
    .is("resume_id", null);

  if (!jobs || jobs.length === 0) return;

  // Score each job against resumes (prioritize default resume)
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
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("429") || msg.includes("Rate limit") || msg.includes("limit reached")) {
          console.warn(`Rate limit reached during match score calculation for job "${job.title}". Pausing score recalculation.`);
          return; // Stop hammering API when rate limited
        } else {
          console.error(`Failed to score job ${job.id} against resume ${resume.id}:`, msg);
        }
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

export async function openDocumentFolder(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("file_path, name")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !doc) {
    throw new Error("Document not found");
  }

  if (!doc.file_path) {
    throw new Error("No local file path recorded for this document.");
  }

  let absPath = doc.file_path;
  if (doc.file_path.startsWith("/")) {
    absPath = path.join(process.cwd(), "public", doc.file_path);
  } else if (!path.isAbsolute(absPath)) {
    const storageDir = process.env.STORAGE_DIR ?? path.join(process.cwd(), ".data", "storage");
    const candidateStoragePath = path.join(storageDir, doc.file_path);
    if (fs.existsSync(candidateStoragePath)) {
      absPath = candidateStoragePath;
    } else {
      absPath = path.resolve(process.cwd(), absPath);
    }
  }

  const folderPath = path.dirname(absPath);
  const fileExists = fs.existsSync(absPath);
  const folderExists = fs.existsSync(folderPath);

  if (!fileExists && !folderExists) {
    throw new Error(`Local directory does not exist: ${folderPath}`);
  }

  return new Promise((resolve, reject) => {
    let command = "";
    if (process.platform === "win32") {
      const winPath = (fileExists ? absPath : folderPath).replace(/\//g, "\\");
      command = fileExists
        ? `cmd.exe /c start explorer.exe /select,"${winPath}"`
        : `cmd.exe /c start explorer.exe "${winPath}"`;
    } else if (process.platform === "darwin") {
      command = fileExists ? `open -R "${absPath}"` : `open "${folderPath}"`;
    } else {
      command = `xdg-open "${folderPath}"`;
    }

    exec(command, (err) => {
      if (err) {
        console.error("Error opening document folder:", err);
        reject(new Error(`Failed to open folder: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
}


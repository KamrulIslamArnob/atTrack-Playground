"use server";

import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { scheduleResumeExtract, scheduleRescoreAll } from "@/lib/ai/background";
import { type ResumeMatchData } from "@/lib/ai/resume";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import type { ResumeDoc } from "@/lib/types/resume-builder";

export interface Document {
  id: string;
  name: string;
  type: string;
  // NOT NULL in schema.sql and unchanged there. A resume-builder document has
  // no file until its first PDF export, so its create action writes '' here
  // rather than relaxing the column.
  file_path: string;
  content: string | null;
  generated_kind?: string | null;
  is_default: boolean;
  match_data: ResumeMatchData | null;
  builder_data: ResumeDoc | null;
  created_at: string;
}

export async function getDocuments(): Promise<Document[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, type, file_path, content, generated_kind, is_default, match_data, builder_data, created_at")
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

  // AI extraction & match-score recalculation run on the background queue:
  // upload returns instantly, extraction lands first, rescore follows.
  scheduleResumeExtract(doc.id, pdfText, userId, type);

  revalidatePath("/documents");
  revalidatePath("/jobs");

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
    scheduleRescoreAll(userId);
  }

  revalidatePath("/documents");
  revalidatePath("/jobs");
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
  scheduleRescoreAll(userId);

  revalidatePath("/documents");
  revalidatePath("/jobs");
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
}

export async function unlinkDocument(jobId: string, documentId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await supabase.from("job_documents").delete().eq("job_id", jobId).eq("document_id", documentId);

  revalidatePath("/jobs/" + jobId);
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

export interface LinkedJobInfo {
  id: string;
  title: string;
  company_name: string | null;
}

export async function getDocumentDetails(
  id: string
): Promise<{ document: Document; job: LinkedJobInfo | null } | null> {
  const { supabase, userId } = await getUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, name, type, file_path, content, generated_kind, is_default, match_data, builder_data, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!doc) return null;

  // Find associated job if linked via job_documents
  let job: LinkedJobInfo | null = null;
  const { data: link } = await supabase
    .from("job_documents")
    .select("job_id")
    .eq("document_id", id)
    .maybeSingle();

  if (link?.job_id) {
    const { data: jobData } = await supabase
      .from("jobs")
      .select("id, title, company_id")
      .eq("id", link.job_id)
      .maybeSingle();

    if (jobData) {
      let companyName: string | null = null;
      if (jobData.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("name")
          .eq("id", jobData.company_id)
          .maybeSingle();
        companyName = comp?.name ?? null;
      }
      job = {
        id: jobData.id,
        title: jobData.title,
        company_name: companyName,
      };
    }
  }

  return { document: doc as unknown as Document, job };
}

export async function updateDocumentContent(
  id: string,
  name: string,
  content: string
): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("documents")
    .update({ name, content })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }

  revalidatePath("/documents");
  revalidatePath("/documents/" + id);
}

export async function createLinkDocument(data: {
  name: string;
  url: string;
  type?: string;
  isDefault?: boolean;
}): Promise<{ documentId: string }> {
  const { supabase, userId } = await getUser();

  const name = data.name.trim();
  let url = data.url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  const type = data.type || "resume";
  const setDefault = Boolean(data.isDefault);

  if (!name) throw new Error("Document name is required");
  if (!data.url.trim()) throw new Error("Link URL is required");

  if (setDefault) {
    await supabase
      .from("documents")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      name,
      type,
      file_path: url,
      content: `External Link: ${url}`,
      generated_kind: "external_link",
      is_default: setDefault,
      match_data: null,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to save link document: ${insertError.message}`);
  }

  revalidatePath("/documents");
  revalidatePath("/jobs");

  return { documentId: doc.id };
}

export async function createRawTexDocument(data: {
  name: string;
  texCode: string;
  type?: string;
  isDefault?: boolean;
}): Promise<{ documentId: string }> {
  const { supabase, userId } = await getUser();

  const name = data.name.trim();
  const texCode = data.texCode;
  const type = data.type || "resume";
  const setDefault = Boolean(data.isDefault);

  if (!name) throw new Error("Document name is required");
  if (!texCode || !texCode.trim()) throw new Error(".TEX code content is required");

  if (setDefault) {
    await supabase
      .from("documents")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      name,
      type,
      file_path: "",
      content: texCode,
      generated_kind: "latex_raw",
      is_default: setDefault,
      match_data: null,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Failed to save .TEX document: ${insertError.message}`);
  }

  // Schedule AI extraction on text content for skills/roles matching
  scheduleResumeExtract(doc.id, texCode, userId, type);

  revalidatePath("/documents");
  revalidatePath("/jobs");

  return { documentId: doc.id };
}


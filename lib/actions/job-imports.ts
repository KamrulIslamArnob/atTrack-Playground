"use server";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractJobFromScreenshot } from "@/lib/ai/gemini";
import type { ExtractionResult } from "@/lib/ai/schema";

const BUCKET = "job-imports";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function uploadScreenshot(
  formData: FormData
): Promise<{ screenshotId: string; screenshotUrl: string }> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  if (file.size > MAX_SIZE) throw new Error("File too large (max 5MB)");
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Invalid file type. Please upload an image.");
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const screenshotId = `${userId}/temp/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(screenshotId, file, { contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(screenshotId);

  return { screenshotId, screenshotUrl: publicUrl };
}

export async function extractFromScreenshot(
  screenshotId: string
): Promise<ExtractionResult> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");
  if (!screenshotId.startsWith(`${userId}/`)) {
    throw new Error("Unauthorized");
  }

  const supabase = createAdminClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(screenshotId);

  if (downloadError) {
    throw new Error(`Download failed: ${downloadError.message}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const result = await extractJobFromScreenshot(base64);
  return result;
}

export async function deleteScreenshot(screenshotId: string): Promise<void> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");
  if (!screenshotId.startsWith(`${userId}/`)) {
    throw new Error("Unauthorized");
  }

  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([screenshotId]);

  if (error) {
    console.error("Failed to delete screenshot:", error.message);
  }
}

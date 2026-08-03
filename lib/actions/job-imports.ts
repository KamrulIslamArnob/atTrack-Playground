"use server";

import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractJobFromScreenshots } from "@/lib/ai/ai";
import { createExtractionLogger } from "@/lib/ai/logger";
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

export async function extractFromScreenshots(
  screenshotIds: string[]
): Promise<ExtractionResult> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");
  if (screenshotIds.length === 0) throw new Error("No screenshots provided");

  // Verify all screenshots belong to user
  for (const id of screenshotIds) {
    if (!id.startsWith(`${userId}/`)) {
      throw new Error("Unauthorized");
    }
  }

  const extractionLog = createExtractionLogger(screenshotIds[0], userId);
  extractionLog.start();

  const supabase = createAdminClient();

  // Download all screenshots and convert to base64
  const imagesBase64: string[] = [];

  for (const screenshotId of screenshotIds) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(screenshotId);

    if (downloadError) {
      const { duration, error } = extractionLog.error(downloadError);
      await saveLog(supabase, userId, screenshotIds.join(","), "error", duration, undefined, error);
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    imagesBase64.push(base64);
  }

  try {
    const result = await extractJobFromScreenshots(imagesBase64);
    const extractedFields = Object.entries(result)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);

    const { duration } = extractionLog.success(extractedFields);
    await saveLog(supabase, userId, screenshotIds.join(","), "success", duration, extractedFields);

    return result;
  } catch (err) {
    const { duration, error } = extractionLog.error(err);
    await saveLog(supabase, userId, screenshotIds.join(","), "error", duration, undefined, error);
    throw err;
  }
}

export async function deleteScreenshots(screenshotIds: string[]): Promise<void> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  // Verify ownership and filter
  const ownedIds = screenshotIds.filter((id) => id.startsWith(`${userId}/`));

  if (ownedIds.length > 0) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(ownedIds);

    if (error) {
      console.error("Failed to delete screenshots:", error.message);
    }
  }
}

async function saveLog(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  screenshotId: string,
  status: "success" | "error",
  durationMs: number,
  extractedFields?: string[],
  errorMessage?: string
) {
  const { error } = await supabase.from("ai_extraction_logs").insert({
    user_id: userId,
    screenshot_id: screenshotId,
    status,
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    duration_ms: durationMs,
    extracted_fields: extractedFields ?? null,
    error_message: errorMessage ?? null,
  });

  if (error) {
    console.error("Failed to save extraction log:", error.message);
  }
}

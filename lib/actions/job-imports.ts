"use server";

import { getUser } from "@/lib/auth";
import { createDbClient as createAdminClient } from "@/lib/db/client";
import { extractJob } from "@/lib/ai/ai";
import { createExtractionLogger } from "@/lib/ai/logger";
import type { ExtractionResult } from "@/lib/ai/schema";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.job-imports");

const BUCKET = "job-imports";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
// Longer than the 1h signed URL so a slow-but-live import never loses its
// image mid-use; short enough that crash orphans don't linger indefinitely.
const STALE_TEMP_MS = 2 * 60 * 60 * 1000;

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

  // Backstop for crash/force-close orphans — deletion elsewhere is
  // fire-and-forget and gets skipped entirely when the session ends
  // abnormally, so sweep this user's own stale temp files on next use.
  await supabase.storage
    .from(BUCKET)
    .sweepStale(`${userId}/temp`, STALE_TEMP_MS)
    .catch((err: unknown) =>
      log.error({ err: err instanceof Error ? err.message : err }, "Failed to sweep stale screenshots:")
    );

  const ext = file.name.split(".").pop() || "png";
  const screenshotId = `${userId}/temp/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(screenshotId, file, { contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(screenshotId, 60 * 60); // 1 hour expiry

  if (signedUrlError) throw new Error(`Failed to get URL: ${signedUrlError.message}`);

  return { screenshotId, screenshotUrl: signedUrlData.signedUrl };
}

/**
 * One job posting, extracted from any mix of uploaded screenshots, pasted
 * text, and a source URL (career page, LinkedIn/Facebook post, ...) — at
 * least one of the three must be provided. All feed the same AI call so the
 * model merges them itself (see extractJob in lib/ai/ai.ts), including
 * fetching the URL via Gemini's built-in url_context tool.
 */
export async function extractJobImport(
  screenshotIds: string[],
  text: string,
  url: string
): Promise<ExtractionResult> {
  const { userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  if (screenshotIds.length === 0 && !trimmedText && !trimmedUrl) {
    throw new Error("Add a screenshot, paste text, a link, or a combination");
  }
  if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error("Link must start with http:// or https://");
  }

  // Verify all screenshots belong to user
  for (const id of screenshotIds) {
    if (!id.startsWith(`${userId}/`)) {
      throw new Error("Unauthorized");
    }
  }

  // ai_extraction_logs.screenshot_id is NOT NULL; use the first screenshot id
  // when there is one, otherwise a generated id for a text-only import.
  const sourceId = screenshotIds[0] ?? `text/${userId}/${crypto.randomUUID()}`;
  const extractionLog = createExtractionLogger(sourceId, userId);
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
      await saveLog(supabase, userId, sourceId, "error", duration, undefined, error);
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    imagesBase64.push(base64);
  }

  try {
    const result = await extractJob(imagesBase64, trimmedText, trimmedUrl, userId);
    const extractedFields = Object.entries(result)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);

    const { duration } = extractionLog.success(extractedFields);
    await saveLog(supabase, userId, sourceId, "success", duration, extractedFields);

    return result;
  } catch (err) {
    const { duration, error } = extractionLog.error(err);
    await saveLog(supabase, userId, sourceId, "error", duration, undefined, error);
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
      log.error({ err: error.message }, "Failed to delete screenshots:");
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
  errorMessage?: string,
  model?: string
) {
  const { error } = await supabase.from("ai_extraction_logs").insert({
    user_id: userId,
    screenshot_id: screenshotId,
    status,
    model: model ?? "unknown",
    duration_ms: durationMs,
    extracted_fields: extractedFields ?? null,
    error_message: errorMessage ?? null,
  });

  if (error) {
    log.error({ err: error.message }, "Failed to save extraction log:");
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createDbClient as createAdminClient } from "@/lib/db/client";
import { extractJob } from "@/lib/ai/ai";
import { createExtractionLogger } from "@/lib/ai/logger";
import type { ExtractionResult } from "@/lib/ai/schema";
import { moduleLogger } from "@/lib/log";
import { logResourceActivity } from "./activity-log";

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

export interface JsonImportedJobSummary {
  id: string;
  title: string;
  company: string;
  status: "created" | "updated";
}

export interface JsonImportResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  errors: string[];
  jobs: JsonImportedJobSummary[];
}

interface RawJobPayload {
  job?: Record<string, unknown>;
  company?: Record<string, unknown>;
  interviews?: Array<Record<string, unknown>>;
  contacts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Direct atTrack Job JSON importer.
 * Accepts single job export, array of jobs, or full backup wrapper.
 * Performs smart upsert: matches on existing ID (if owned) or (user_id, company, title)
 * to update existing records without creating duplicates.
 */
export async function importJobsFromJson(rawJson: string): Promise<JsonImportResult> {
  const { supabase, userId } = await getUser();
  if (!userId) throw new Error("Unauthorized");

  if (!rawJson || typeof rawJson !== "string" || !rawJson.trim()) {
    throw new Error("No JSON content provided.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    throw new Error("Invalid JSON format. Please check the pasted content.");
  }

  let items: RawJobPayload[] = [];
  if (Array.isArray(parsed)) {
    items = parsed as RawJobPayload[];
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.jobs)) {
      items = obj.jobs as RawJobPayload[];
    } else if (Array.isArray(obj.data)) {
      items = obj.data as RawJobPayload[];
    } else if (obj.job || obj.title) {
      items = [obj as RawJobPayload];
    }
  }

  if (items.length === 0) {
    throw new Error("No valid job objects found in JSON.");
  }

  // Fetch user's board lists to resolve column IDs safely across devices
  const { data: userLists } = await supabase
    .from("board_lists")
    .select("id, kind, name")
    .eq("user_id", userId);

  const availableLists = (userLists as unknown as Array<{ id: string; kind: string; name: string }>) || [];
  const fallbackList = availableLists.find((l) => l.kind === "wishlist") || availableLists[0] || null;
  const fallbackListId = fallbackList?.id ?? null;

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];
  const processedJobs: JsonImportedJobSummary[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const rawJob = (item.job && typeof item.job === "object" ? item.job : item) as Record<string, unknown>;
      const rawCompany = (item.company && typeof item.company === "object" ? item.company : null) as Record<string, unknown> | null;

      const title = (rawJob.title as string)?.trim() || "Untitled Position";
      const companyName =
        (rawCompany?.name as string)?.trim() ||
        (rawJob.company_name as string)?.trim() ||
        (typeof rawJob.company === "string" ? rawJob.company.trim() : "") ||
        "Unknown Company";

      // 1. Resolve Company (Find or Create)
      let companyId: string;
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", companyName)
        .maybeSingle();

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany, error: compErr } = await supabase
          .from("companies")
          .insert({
            user_id: userId,
            name: companyName,
            website: (rawCompany?.website as string) || null,
            location: (rawCompany?.location as string) || null,
            company_type: (rawCompany?.company_type as string) || null,
            country: (rawCompany?.country as string) || null,
          })
          .select("id")
          .single();

        if (compErr || !newCompany) {
          throw new Error(`Failed to create company "${companyName}": ${compErr?.message || "Unknown error"}`);
        }
        companyId = newCompany.id;
      }

      // 2. Check for Duplicate / Existing Job
      const candidateId = typeof rawJob.id === "string" && rawJob.id.length === 36 ? rawJob.id : null;
      let existingJob: { id: string; list_id: string | null } | null = null;

      if (candidateId) {
        const { data: byId } = await supabase
          .from("jobs")
          .select("id, list_id")
          .eq("id", candidateId)
          .eq("user_id", userId)
          .maybeSingle();
        if (byId) existingJob = byId as unknown as { id: string; list_id: string | null };
      }

      if (!existingJob) {
        const { data: byTitle } = await supabase
          .from("jobs")
          .select("id, list_id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .ilike("title", title)
          .maybeSingle();
        if (byTitle) existingJob = byTitle as unknown as { id: string; list_id: string | null };
      }

      // Extract any boardLists passed from the source application
      const sourceLists = (
        Array.isArray(item.boardLists)
          ? item.boardLists
          : Array.isArray(rawJob.boardLists)
            ? rawJob.boardLists
            : Array.isArray((parsed as Record<string, unknown>)?.boardLists)
              ? (parsed as Record<string, unknown>).boardLists
              : []
      ) as Array<{ id?: string; name?: string; kind?: string; color?: string | null; sort_order?: number }>;

      // Resolve valid board list_id on current device (auto-provisioning custom columns if missing)
      let targetListId: string | null = null;
      const rawListId = typeof rawJob.list_id === "string" ? rawJob.list_id : null;

      if (rawListId && availableLists.some((l) => l.id === rawListId)) {
        targetListId = rawListId;
      } else {
        const sourceList = rawListId ? sourceLists.find((l) => l.id === rawListId) : null;
        const sourceName = sourceList?.name?.trim() || null;
        const sourceKind = (sourceList?.kind as string)?.trim() || (rawJob.status as string)?.trim() || null;

        let matchedLocal = sourceName
          ? availableLists.find((l) => l.name.toLowerCase() === sourceName.toLowerCase())
          : null;

        if (!matchedLocal && sourceKind) {
          matchedLocal = availableLists.find((l) => l.kind.toLowerCase() === sourceKind.toLowerCase());
        }

        if (matchedLocal) {
          targetListId = matchedLocal.id;
        } else if (sourceName) {
          // Auto-create custom column on this device
          const nextSortOrder = availableLists.reduce((max, l) => Math.max(max, (l as { sort_order?: number }).sort_order || 0), 0) + 1;
          const { data: createdColumn, error: colErr } = await supabase
            .from("board_lists")
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              name: sourceName,
              kind: sourceKind || "custom",
              color: sourceList?.color || null,
              sort_order: nextSortOrder,
            })
            .select("id, kind, name")
            .single();

          if (!colErr && createdColumn) {
            const newColObj = createdColumn as unknown as { id: string; kind: string; name: string };
            availableLists.push(newColObj);
            targetListId = newColObj.id;
          } else {
            targetListId = fallbackListId;
          }
        } else {
          targetListId = fallbackListId;
        }
      }

      // Parse payload values
      const applicationUrl = (rawJob.application_url as string) || null;
      const applicationEmail = (rawJob.application_email as string) || null;
      const applicationProcess = (rawJob.application_process as string) || null;
      const location = (rawJob.location as string) || null;
      const mapUrl = (rawJob.map_url as string) || null;
      const salaryRange = (rawJob.salary_range as string) || null;
      const salaryMin = typeof rawJob.salary_min === "number" ? rawJob.salary_min : null;
      const salaryMax = typeof rawJob.salary_max === "number" ? rawJob.salary_max : null;
      const salaryCurrency = (rawJob.salary_currency as string) || null;
      const salaryPeriod = (rawJob.salary_period as string) || null;
      const isUnpaid = Boolean(rawJob.is_unpaid) ? 1 : 0;
      const skills = Array.isArray(rawJob.skills) ? rawJob.skills : null;
      const educationalRequirements = (rawJob.educational_requirements as string) || null;
      const benefits = Array.isArray(rawJob.benefits) ? rawJob.benefits : null;
      const workSchedule = (rawJob.work_schedule as string) || null;
      const holidayPolicy = (rawJob.holiday_policy as string) || null;
      const description = (rawJob.description as string) || null;
      const employmentType = (rawJob.employment_type as string) || null;
      const workLocation = (rawJob.work_location as string) || null;
      const deadline = (rawJob.deadline as string) || null;
      const source = (rawJob.source as string) || "JSON Import";
      const tier = typeof rawJob.tier === "string" ? rawJob.tier : null;
      const state = (rawJob.state as string) || "active";
      const color = (rawJob.color as string) || null;
      const matchScore = typeof rawJob.match_score === "number" ? rawJob.match_score : null;
      const matchReasoning = (rawJob.match_reasoning as string) || null;
      const createdAt = (rawJob.created_at as string) || new Date().toISOString();
      const status = (rawJob.status as string) || "saved";
      const notes = Array.isArray(rawJob.notes) ? rawJob.notes : [];
      const projectLinks = Array.isArray(rawJob.project_links) ? rawJob.project_links : null;

      let finalJobId: string;
      let actionStatus: "created" | "updated";

      if (existingJob) {
        // Update existing record
        finalJobId = existingJob.id;
        actionStatus = "updated";

        const { error: updateErr } = await supabase
          .from("jobs")
          .update({
            title,
            company_id: companyId,
            state,
            color,
            description,
            application_url: applicationUrl,
            application_email: applicationEmail,
            application_process: applicationProcess,
            location,
            map_url: mapUrl,
            salary_range: salaryRange,
            salary_min: salaryMin,
            salary_max: salaryMax,
            salary_currency: salaryCurrency,
            salary_period: salaryPeriod,
            is_unpaid: isUnpaid,
            skills,
            educational_requirements: educationalRequirements,
            benefits,
            work_schedule: workSchedule,
            holiday_policy: holidayPolicy,
            employment_type: employmentType,
            work_location: workLocation,
            deadline: deadline || "unknown",
            source,
            tier,
            status,
            notes,
            match_score: matchScore,
            match_reasoning: matchReasoning,
            project_links: projectLinks,
            updated_at: new Date().toISOString(),
          })
          .eq("id", finalJobId)
          .eq("user_id", userId);

        if (updateErr) {
          throw new Error(`Failed to update job "${title}": ${updateErr.message}`);
        }
        updatedCount++;
      } else {
        // Create fresh job
        actionStatus = "created";

        const { data: newJob, error: insertErr } = await supabase
          .from("jobs")
          .insert({
            user_id: userId,
            company_id: companyId,
            list_id: targetListId,
            title,
            state,
            color,
            description,
            application_url: applicationUrl,
            application_email: applicationEmail,
            application_process: applicationProcess,
            location,
            map_url: mapUrl,
            salary_range: salaryRange,
            salary_min: salaryMin,
            salary_max: salaryMax,
            salary_currency: salaryCurrency,
            salary_period: salaryPeriod,
            is_unpaid: isUnpaid,
            skills,
            educational_requirements: educationalRequirements,
            benefits,
            work_schedule: workSchedule,
            holiday_policy: holidayPolicy,
            employment_type: employmentType,
            work_location: workLocation,
            deadline: deadline || "unknown",
            source,
            tier,
            status,
            notes,
            match_score: matchScore,
            match_reasoning: matchReasoning,
            project_links: projectLinks,
            created_at: createdAt,
          })
          .select("id")
          .single();

        if (insertErr || !newJob) {
          throw new Error(`Failed to insert job "${title}": ${insertErr?.message || "Unknown error"}`);
        }
        finalJobId = newJob.id;
        createdCount++;
      }

      // 3. Sub-records: Interviews
      const interviews = Array.isArray(item.interviews)
        ? item.interviews
        : Array.isArray(rawJob.interviews)
          ? rawJob.interviews
          : [];

      for (const iv of interviews) {
        if (iv && typeof iv === "object") {
          const ivRecord = iv as Record<string, unknown>;
          const scheduledAt = (ivRecord.scheduled_at as string) || new Date().toISOString();
          const ivType = (ivRecord.type as string) || "screening";
          const ivStatus = (ivRecord.status as string) || "scheduled";

          const { error: ivErr } = await supabase.from("interviews").insert({
            user_id: userId,
            job_id: finalJobId,
            scheduled_at: scheduledAt,
            type: ivType,
            status: ivStatus,
            location: (ivRecord.location as string) || null,
            meeting_url: (ivRecord.meeting_url as string) || null,
            interviewer_name: (ivRecord.interviewer_name as string) || null,
            interviewer_email: (ivRecord.interviewer_email as string) || null,
            notes: (ivRecord.notes as string) || null,
          });

          if (ivErr) {
            log.error({ err: ivErr.message }, "Failed to import interview round:");
          }
        }
      }

      // 4. Sub-records: Contacts
      const contacts = Array.isArray(item.contacts)
        ? item.contacts
        : Array.isArray(rawJob.contacts)
          ? rawJob.contacts
          : [];

      for (const ct of contacts) {
        if (ct && typeof ct === "object") {
          const ctRecord = ct as Record<string, unknown>;
          const contactName = (ctRecord.name as string)?.trim();
          if (contactName) {
            await supabase.from("contacts").insert({
              user_id: userId,
              company_id: companyId,
              job_id: finalJobId,
              name: contactName,
              email: (ctRecord.email as string) || null,
              phone: (ctRecord.phone as string) || null,
              role: (ctRecord.role as string) || (ctRecord.title as string) || null,
              notes: (ctRecord.notes as string) || null,
            });
          }
        }
      }

      // 5. Sub-records: Deadlines & Milestones (Timeline)
      const rawDeadlines = Array.isArray(item.deadlines)
        ? item.deadlines
        : Array.isArray(rawJob.deadlines)
          ? rawJob.deadlines
          : [];

      for (const dl of rawDeadlines) {
        if (dl && typeof dl === "object") {
          const dlRecord = dl as Record<string, unknown>;
          const dlTitle = (dlRecord.title as string)?.trim();
          const dlDate = (dlRecord.due_date as string) || (dlRecord.date as string);
          if (dlTitle && dlDate) {
            const { data: existingDl } = await supabase
              .from("job_deadlines")
              .select("id")
              .eq("job_id", finalJobId)
              .eq("user_id", userId)
              .eq("title", dlTitle)
              .maybeSingle();

            if (!existingDl) {
              await supabase.from("job_deadlines").insert({
                id: crypto.randomUUID(),
                job_id: finalJobId,
                user_id: userId,
                title: dlTitle,
                type: (dlRecord.type as string) || "deadline",
                stage_kind: (dlRecord.stage_kind as string) || "custom",
                due_date: dlDate,
                is_pinned: Boolean(dlRecord.is_pinned) ? 1 : 0,
                is_completed: Boolean(dlRecord.is_completed) ? 1 : 0,
                notes: (dlRecord.notes as string) || null,
              });
            }
          }
        }
      }

      // 6. Sub-records: Applications
      const rawApplications = Array.isArray(item.applications)
        ? item.applications
        : Array.isArray(rawJob.applications)
          ? rawJob.applications
          : [];

      for (const app of rawApplications) {
        if (app && typeof app === "object") {
          const appRecord = app as Record<string, unknown>;
          const appStatus = (appRecord.status as string) || "applied";
          const { data: existingApp } = await supabase
            .from("applications")
            .select("id")
            .eq("job_id", finalJobId)
            .eq("user_id", userId)
            .eq("status", appStatus)
            .maybeSingle();

          if (!existingApp) {
            await supabase.from("applications").insert({
              id: crypto.randomUUID(),
              job_id: finalJobId,
              user_id: userId,
              status: appStatus,
              applied_at: (appRecord.applied_at as string) || new Date().toISOString(),
              resume_name: (appRecord.resume_name as string) || null,
            });
          }
        }
      }

      // 7. Sub-records: Documents (Text/links, skipping binary resumes)
      const rawDocuments = Array.isArray(item.documents)
        ? item.documents
        : Array.isArray(rawJob.documents)
          ? rawJob.documents
          : [];

      for (const doc of rawDocuments) {
        if (doc && typeof doc === "object") {
          const docRecord = doc as Record<string, unknown>;
          const docType = (docRecord.type as string) || "other";
          const docName = (docRecord.name as string)?.trim();
          if (docType !== "resume" && docName) {
            const { data: existingDoc } = await supabase
              .from("documents")
              .select("id")
              .eq("job_id", finalJobId)
              .eq("user_id", userId)
              .eq("name", docName)
              .maybeSingle();

            if (!existingDoc) {
              await supabase.from("documents").insert({
                id: crypto.randomUUID(),
                job_id: finalJobId,
                user_id: userId,
                name: docName,
                type: docType,
                content: (docRecord.content as string) || null,
              });
            }
          }
        }
      }

      processedJobs.push({
        id: finalJobId,
        title,
        company: companyName,
        status: actionStatus,
      });

      void logResourceActivity(userId, "job.import_json", "job", finalJobId, {
        title,
        company: companyName,
        action: actionStatus,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Item ${i + 1}: ${msg}`);
      log.error({ err: msg }, `Error importing item ${i + 1}:`);
    }
  }

  if (processedJobs.length > 0) {
    revalidatePath("/board");
    revalidatePath("/jobs");
    revalidatePath("/applications");
    revalidatePath("/interviews");
  }

  return {
    success: processedJobs.length > 0,
    total: items.length,
    created: createdCount,
    updated: updatedCount,
    errors,
    jobs: processedJobs,
  };
}


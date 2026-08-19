"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";

// atTrack is a native single-user app: no sign-in, sign-up, or sign-out.
// What remains here is profile and avatar editing, plus a destructive reset.

/** Toggles the raw database viewer (/preferences/database) on or off — see
 *  the column comment in lib/db/schema.sql for why it defaults off. */
export async function setShowRawDatabase(enabled: boolean): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, show_raw_database: enabled }, { onConflict: "id" });

  if (error) {
    throw new Error("Couldn't update the setting.");
  }

  revalidatePath("/settings");
  revalidatePath("/preferences/database");
}

export async function updateProfile(formData: FormData) {
  const { supabase, userId } = await getUser();

  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string | null;
  const headline = formData.get("headline") as string | null;
  const phone = formData.get("phone") as string | null;
  const location = formData.get("location") as string | null;
  const website = formData.get("website") as string | null;

  if (email && email.trim()) {
    const { getDb } = await import("@/lib/db/sqlite");
    getDb().prepare("UPDATE users SET email = ? WHERE id = ?").run(email.trim(), userId);
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      full_name: fullName,
      headline: headline || null,
      phone: phone || null,
      location: location || null,
      website: website || null,
    }, { onConflict: "id" });

  if (error) {
    redirect("/settings?error=" + encodeURIComponent("Failed to update profile."));
  }


  revalidatePath("/settings");
  revalidatePath("/overview");
  redirect("/settings?message=" + encodeURIComponent("Profile updated successfully."));
}

async function processUserAvatar(file: File): Promise<{ buffer: Buffer; format: string }> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let ext = (file.name ? file.name.split(".").pop() : "") || "png";
  ext = ext.toLowerCase().trim();
  if (ext === "jpg") ext = "jpeg";
  if (!["png", "jpeg", "webp", "gif", "svg"].includes(ext)) {
    ext = "png";
  }
  return { buffer: inputBuffer, format: ext };
}

export interface SaveAvatarResult {
  success: boolean;
  avatarUrl?: string;
  error?: string;
}

/** Validates, stores, and links an avatar file to the current user's profile
 *  without redirecting — shared by the Settings form (`uploadAvatar` below,
 *  which redirects) and the onboarding wizard (which stays in its own modal
 *  and animates the result instead of navigating away). */
export async function saveAvatar(formData: FormData): Promise<SaveAvatarResult> {
  try {
    const { supabase, userId } = await getUser();

    const file = formData.get("avatar") as File;

    if (!file || file.size === 0) {
      return { success: false, error: "No file selected." };
    }

    if (file.size > 500 * 1024) {
      return { success: false, error: "File size must be less than 500KB." };
    }

    const { buffer: processedBuffer, format } = await processUserAvatar(file);
    const filePath = `${userId}/avatar.${format}`;

    // Clean up all previous avatar files for this user so only the latest one remains
    try {
      const { data: existingFiles } = await supabase.storage.from("avatar").list(userId);
      if (existingFiles && existingFiles.length > 0) {
        const toDelete = existingFiles
          .map((f) => `${userId}/${f.name}`)
          .filter((p) => p !== filePath);
        if (toDelete.length > 0) {
          await supabase.storage.from("avatar").remove(toDelete);
        }
      }
    } catch {
      // Best-effort cleanup
    }

    const { error: uploadError } = await supabase.storage
      .from("avatar")
      .upload(filePath, processedBuffer, {
        contentType: `image/${format}`,
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: "Failed to upload avatar." };
    }

    const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(filePath);
    const versionedAvatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({ id: userId, avatar_url: versionedAvatarUrl }, { onConflict: "id" });

    if (updateError) {
      return { success: false, error: "Failed to update profile with avatar." };
    }

    try {
      revalidatePath("/", "layout");
      revalidatePath("/settings");
      revalidatePath("/overview");
    } catch {
      // revalidatePath requires Next.js request context; fails in test environments.
      // The core function still succeeds — cache invalidation is a nice-to-have.
    }

    return { success: true, avatarUrl: versionedAvatarUrl };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save avatar.",
    };
  }
}

export async function deleteAvatar(): Promise<{ success: boolean; error?: string }> {
  const { supabase, userId } = await getUser();

  try {
    const { data: existingFiles } = await supabase.storage.from("avatar").list(userId);
    if (existingFiles && existingFiles.length > 0) {
      const toDelete = existingFiles.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from("avatar").remove(toDelete);
    }
  } catch {}

  await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId);

  try {
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/overview");
  } catch {}

  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const result = await saveAvatar(formData);

  if (!result.success) {
    redirect("/settings?error=" + encodeURIComponent(result.error ?? "Failed to upload avatar."));
  }

  redirect("/settings?message=" + encodeURIComponent("Avatar uploaded successfully."));
}

/**
 * Wipes every row and uploaded file belonging to the owner.
 *
 * There is no account to delete in a single-user local app, so this is a reset
 * rather than a sign-out: the owner row itself is kept (deleting it would just be
 * recreated empty on the next request), and a fresh board is seeded on next read.
 * Guarded by typing the profile name, matching the previous confirm-by-email flow.
 */
export async function resetAllData(formData: FormData) {
  const { supabase, userId, user } = await getUser();

  const confirmation = ((formData.get("confirmation") as string) ?? "").trim();
  const expected = (user.user_metadata?.full_name ?? "").trim();

  if (!expected || confirmation !== expected) {
    redirect(
      "/settings?error=" +
        encodeURIComponent("Confirmation text does not match. Nothing was deleted.")
    );
  }

  // Log before deletion — this is the last chance to record it.

  const storage = supabase.storage;
  for (const bucket of ["avatar", "documents", "job-imports"] as const) {
    const { data: files } = await storage.from(bucket).list(userId);
    if (files && files.length > 0) {
      await storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
    }
  }

  // Every user-owned table (anything with a `user_id` column — see
  // lib/db/schema.sql) has to be listed explicitly: the owner's `profiles` row
  // is kept above, so `ON DELETE CASCADE FROM profiles` never fires here.
  // job_contacts/job_documents have no user_id column and aren't listed; they
  // cascade automatically off jobs/contacts/documents below.
  //
  // Order is children-before-parents for clarity, though every FK in the
  // schema is ON DELETE CASCADE or SET NULL (never RESTRICT), so no ordering
  // here can actually trip a foreign-key violation.
  const tables = [
    // Children of jobs (job_id -> jobs ON DELETE CASCADE) — before jobs.
    "mcq_results",
    "mcq_question_cache",
    "job_deadlines",
    "application_emails",
    "interviews",
    "applications",
    "jobs",

    // Children of link_categories (category_id -> link_categories CASCADE).
    "links",
    "link_categories",

    // Remaining directly user-owned tables.
    "contacts",
    "quick_shortcuts",
    "positions",
    "documents",
    "companies",
    "board_lists",
    "ai_extraction_logs",
    "smtp_config",
    "ai_usage_logs",
    "ai_providers",
    "ai_task_routes",
    "ai_tool_prompts",
    "ai_memories",
    "ai_output_cache",
    "extension_config",

    // Chat: messages before sessions (session_id -> chat_sessions CASCADE).
    "chat_messages",
    "chat_sessions",
    "ai_feedback",
  ];

  for (const table of tables) {
    await supabase.from(table).delete().eq("user_id", userId);
  }

  // Reset the profile back to a blank slate but keep the owner row itself.
  await supabase
    .from("profiles")
    .update({
      headline: null,
      phone: null,
      location: null,
      website: null,
      avatar_url: null,
      onboarded_at: null,
    })
    .eq("id", userId);

  revalidatePath("/", "layout");
  redirect("/overview?message=" + encodeURIComponent("All data deleted."));
}

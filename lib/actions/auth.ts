"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";

// AtTrack is a native single-user app: no sign-in, sign-up, or sign-out.
// What remains here is profile and avatar editing, plus a destructive reset.

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

export async function uploadAvatar(formData: FormData) {
  const { supabase, userId } = await getUser();

  const file = formData.get("avatar") as File;

  if (!file || file.size === 0) {
    redirect("/settings?error=" + encodeURIComponent("No file selected."));
  }

  if (file.size > 500 * 1024) {
    redirect("/settings?error=" + encodeURIComponent("File size must be less than 500KB."));
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    redirect("/settings?error=" + encodeURIComponent("Failed to upload avatar."));
  }

  const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_url: urlData.publicUrl }, { onConflict: "id" });

  if (updateError) {
    redirect("/settings?error=" + encodeURIComponent("Failed to update profile with avatar."));
  }


  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/overview");
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

  // Order matters: children before parents, since foreign keys are enforced.
  const tables = [
    "mcq_results",
    "application_emails",
    "interviews",
    "applications",
    "documents",
    "ai_extraction_logs",
    "smtp_config",
    "jobs",
    "companies",
    "board_lists",
    "ai_usage_logs",
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

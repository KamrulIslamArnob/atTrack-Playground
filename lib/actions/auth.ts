"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/overview");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const headline = formData.get("headline") as string | null;
  const phone = formData.get("phone") as string | null;
  const location = formData.get("location") as string | null;
  const website = formData.get("website") as string | null;

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        headline,
        phone,
        location,
        website,
      },
    },
  });

  if (error) {
    redirect("/signup?error=" + encodeURIComponent(error.message));
  }

  if (authData.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: fullName,
        headline: headline || null,
        phone: phone || null,
        location: location || null,
        website: website || null,
      });

    if (profileError) {
      redirect("/signup?error=" + encodeURIComponent("Failed to create profile. Please try again."));
    }
  }

  redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const fullName = formData.get("full_name") as string;
  const headline = formData.get("headline") as string | null;
  const phone = formData.get("phone") as string | null;
  const location = formData.get("location") as string | null;
  const website = formData.get("website") as string | null;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      headline: headline || null,
      phone: phone || null,
      location: location || null,
      website: website || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect("/settings?error=" + encodeURIComponent("Failed to update profile."));
  }

  revalidatePath("/settings");
  revalidatePath("/overview");
  redirect("/settings?message=" + encodeURIComponent("Profile updated successfully."));
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/login?message=" + encodeURIComponent("Check your email for the login link."));
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const file = formData.get("avatar") as File;

  if (!file || file.size === 0) {
    redirect("/settings?error=" + encodeURIComponent("No file selected."));
  }

  if (file.size > 500 * 1024) {
    redirect("/settings?error=" + encodeURIComponent("File size must be less than 500KB."));
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    redirect("/settings?error=" + encodeURIComponent("Failed to upload avatar."));
  }

  const { data: urlData } = supabase.storage
    .from("avatar")
    .getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", user.id);

  if (updateError) {
    redirect("/settings?error=" + encodeURIComponent("Failed to update profile with avatar."));
  }

  revalidatePath("/settings");
  revalidatePath("/overview");
  redirect("/settings?message=" + encodeURIComponent("Avatar uploaded successfully."));
}

export async function deleteAccount(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const email = formData.get("email") as string;

  if (email !== user.email) {
    redirect("/settings?error=" + encodeURIComponent("Email does not match. Account not deleted."));
  }

  const userId = user.id;

  // Delete storage files (all buckets)
  // Avatar
  await supabase.storage.from("avatar").remove([
    `${userId}/avatar.jpg`,
    `${userId}/avatar.png`,
    `${userId}/avatar.gif`,
    `${userId}/avatar.webp`,
    `${userId}/avatar.jpeg`,
  ]);

  // Documents (resumes, etc.)
  const { data: docFiles } = await supabase.storage.from("documents").list(userId);
  if (docFiles && docFiles.length > 0) {
    await supabase.storage.from("documents").remove(docFiles.map((f) => `${userId}/${f.name}`));
  }

  // Job imports (screenshots)
  const { data: importFiles } = await supabase.storage.from("job-imports").list(userId);
  if (importFiles && importFiles.length > 0) {
    await supabase.storage.from("job-imports").remove(importFiles.map((f) => `${userId}/${f.name}`));
  }

  // Delete database records (order matters due to foreign keys)
  // Child tables first (depend on jobs)
  await supabase.from("mcq_results").delete().eq("user_id", userId);
  await supabase.from("interviews").delete().eq("user_id", userId);
  await supabase.from("documents").delete().eq("user_id", userId);
  await supabase.from("applications").delete().eq("user_id", userId);

  // Independent tables
  await supabase.from("timeline_events").delete().eq("user_id", userId);
  await supabase.from("notes").delete().eq("user_id", userId);
  await supabase.from("ai_extraction_logs").delete().eq("user_id", userId);
  await supabase.from("smtp_config").delete().eq("user_id", userId);

  // Parent tables
  await supabase.from("jobs").delete().eq("user_id", userId);
  await supabase.from("companies").delete().eq("user_id", userId);

  // Profile (auth user record)
  await supabase.from("profiles").delete().eq("id", userId);

  // Delete auth user using secret key (bypasses RLS)
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    redirect("/settings?error=" + encodeURIComponent("Failed to delete account. Please try again."));
  }

  await supabase.auth.signOut();
  redirect("/login?message=" + encodeURIComponent("Account deleted successfully."));
}

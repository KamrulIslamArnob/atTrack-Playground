"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";

export interface SmtpConfig {
  id: string;
  host: string;
  port: number;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const { supabase, userId } = await getUser();

  const { data } = await supabase
    .from("smtp_config")
    .select("id, host, port, user_email, created_at, updated_at")
    .eq("user_id", userId)
    .single();

  return data;
}

export async function isSmtpConfigured(): Promise<boolean> {
  const { supabase, userId } = await getUser();

  const { count } = await supabase
    .from("smtp_config")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}

export async function getSmtpPassword(): Promise<string | null> {
  const { supabase, userId } = await getUser();

  const { data } = await supabase
    .from("smtp_config")
    .select("encrypted_password")
    .eq("user_id", userId)
    .single();

  if (!data?.encrypted_password) return null;

  try {
    return decrypt(data.encrypted_password);
  } catch {
    return null;
  }
}

export async function saveSmtpConfig(params: {
  host: string;
  port: number;
  user_email: string;
  password: string;
}): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  const encryptedPassword = encrypt(params.password);

  const { error } = await supabase
    .from("smtp_config")
    .upsert(
      {
        user_id: userId,
        host: params.host,
        port: params.port,
        user_email: params.user_email,
        encrypted_password: encryptedPassword,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Error saving SMTP config:", error);
    return { error: "Failed to save SMTP configuration." };
  }

  revalidatePath("/settings");
  return {};
}

export async function deleteSmtpConfig(): Promise<{ error?: string }> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("smtp_config")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return { error: "Failed to delete SMTP configuration." };
  }

  revalidatePath("/settings");
  return {};
}

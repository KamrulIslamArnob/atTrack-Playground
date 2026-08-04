import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface AuthResult {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  user: UserProfile;
  role: string;
  isBanned: boolean;
}

export async function getUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch role and ban status from profiles
  let { data: profile } = await supabase
    .from("profiles")
    .select("role, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  // Auto-create profile if missing (email/password or magic link signup)
  if (!profile) {
    const fullName = user.user_metadata?.full_name || null;
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
    });
    profile = { role: "user", is_banned: false };
  }

  const role = profile?.role ?? "user";
  const isBanned = profile?.is_banned ?? false;

  if (isBanned) {
    await supabase.auth.signOut();
    redirect("/login?error=" + encodeURIComponent("Your account has been suspended."));
  }

  return {
    supabase,
    userId: user.id,
    user,
    role,
    isBanned,
  };
}

export async function getAdminUser(): Promise<AuthResult> {
  const auth = await getUser();

  if (auth.role !== "admin") {
    redirect("/overview");
  }

  return auth;
}

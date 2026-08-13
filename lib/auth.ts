import { createDbClient as createClient } from "@/lib/db/client";

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

/**
 * Resolves the local owner.
 *
 * AtTrack is a native single-user app — there is no login, so this never
 * redirects and never fails. The owner row is created on first run
 * (lib/db/local-user.ts), with a matching profile.
 *
 * Kept named `getUser()` and returning `{ supabase, userId, ... }` because every
 * server component and server action is written against that shape.
 */
export async function getUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_banned")
    .eq("id", user.id)
    .maybeSingle();

  // The owner is always created with a profile; this covers a database carried
  // over from the earlier build where one might be missing.
  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || null,
    });
  }

  return {
    supabase,
    userId: user.id,
    user,
    role: profile?.role ?? "user",
    isBanned: false,
  };
}

/**
 * The local owner is the only user, so they own the admin views too — this no
 * longer gates anything.
 *
 * Note the owner's profile role stays 'user' so the sidebar keeps showing the
 * normal navigation (it swaps to an admin-only nav for 'admin'). The /admin
 * routes are reachable by URL.
 *
 * Kept as a separate function rather than inlined: admin server actions keep
 * their explicit call, and this stays the single place to reinstate a real check
 * if multi-user ever returns.
 */
export async function getAdminUser(): Promise<AuthResult> {
  return getUser();
}

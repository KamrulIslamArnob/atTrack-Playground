import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAuthActivity } from "@/lib/actions/activity-log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/overview";
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.search = "";

  // Handle OAuth callback (Google, etc.)
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if profile exists, create if not (new OAuth user)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          // Extract name and avatar from Google metadata
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
          const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

          await supabase.from("profiles").insert({
            id: user.id,
            full_name: fullName,
            avatar_url: avatarUrl,
            headline: null,
            phone: null,
            location: null,
            website: null,
          });
        } else {
          // Backfill avatar for existing profiles missing one
          const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
          if (avatarUrl) {
            const { data: existing } = await supabase
              .from("profiles")
              .select("avatar_url")
              .eq("id", user.id)
              .maybeSingle();

            if (existing && !existing.avatar_url) {
              await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
            }
          }

          // Admin users always land on the admin panel
          if (profile.role === "admin" && redirectTo.pathname === "/overview") {
            redirectTo.pathname = "/admin";
          }
        }

        await logAuthActivity(user.id, "sign_in", { method: "oauth" });
      }

      return NextResponse.redirect(redirectTo);
    }
  }

  // Handle OTP / magic link callback
  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Ensure profile exists for OTP/magic link users too
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          const fullName = user.user_metadata?.full_name || null;
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: fullName,
          });
        }

        await logAuthActivity(user.id, "sign_in", { method: "magic_link" });
      }
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "Could not authenticate. Please try again.");
  return NextResponse.redirect(redirectTo);
}

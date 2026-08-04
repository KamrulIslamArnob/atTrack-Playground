import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;

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
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          // Extract name from Google metadata
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;

          await supabase.from("profiles").insert({
            id: user.id,
            full_name: fullName,
            headline: null,
            phone: null,
            location: null,
            website: null,
          });
        }
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
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "Could not authenticate. Please try again.");
  return NextResponse.redirect(redirectTo);
}

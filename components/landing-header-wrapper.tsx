import { LandingHeader } from "@/components/landing-header";
import { createClient } from "@/lib/supabase/server";

export async function LandingHeaderWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingHeader isAuthenticated={!!user} />;
}

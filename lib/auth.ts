import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();

  if (!session?.session?.user) {
    redirect("/login");
  }

  return { supabase, userId: session.session.user.id };
}

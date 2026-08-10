import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUser } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sidebar } from "@/components/sidebar";
import { WindowTitlebar } from "@/components/window-titlebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, role, onboarded_at")
    .eq("id", user.id)
    .single();

  // Admins belong in /admin. This redirect used to live in proxy.ts, which can no
  // longer read the database (Edge runtime + SQLite). The role is already loaded
  // here, so moving it costs no extra query.
  const pathname = (await headers()).get("x-current-path") ?? "";
  if (profile?.role === "admin" && !pathname.startsWith("/admin")) {
    redirect("/admin");
  }

  return (
    // p-3/gap-3/rounded main only apply below md — that's the mobile floating-card
    // shell (header + drawer). At md+, sidebar and main share one flush boundary
    // (Sidebar's own border-r) instead of floating as two separate panels.
    <div className="flex h-screen flex-col bg-background p-3 md:p-0">
      <WindowTitlebar />

      <DashboardHeader user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} />

      <div className="flex flex-1 gap-3 overflow-hidden pt-3 md:gap-0 md:pt-0">
        <div className="hidden md:block">
          <Sidebar user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} resizable />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:rounded-none md:border-0">
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

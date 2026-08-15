import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUser } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sidebar } from "@/components/sidebar";
import { WindowTitlebar } from "@/components/window-titlebar";
import { DashboardMainContent } from "@/components/dashboard-main-content";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, role, onboarded_at, show_raw_database")
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background p-3 md:p-0">
      <WindowTitlebar />

      <DashboardHeader user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} showRawDatabase={Boolean(profile?.show_raw_database)} />

      <div className="flex flex-1 w-full overflow-hidden pt-3 md:pt-0 gap-3 md:gap-0 min-h-0 min-w-0">
        <div className="hidden md:block shrink-0 h-full">
          <Sidebar user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} showRawDatabase={Boolean(profile?.show_raw_database)} resizable />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden w-full h-full min-w-0 min-h-0 rounded-2xl border border-border bg-card md:rounded-none md:border-0">
          <DashboardMainContent>{children}</DashboardMainContent>
        </div>
      </div>
    </div>
  );
}


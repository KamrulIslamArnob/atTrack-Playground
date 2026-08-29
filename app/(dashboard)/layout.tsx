import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUser } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sidebar } from "@/components/sidebar";
import { WindowTitlebar } from "@/components/window-titlebar";
import { DashboardMainContent } from "@/components/dashboard-main-content";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { LicenseActivationScreen } from "@/components/license/license-activation-screen";
import { LicenseHeartbeatMonitor } from "@/components/license/license-heartbeat-monitor";
import { getLicenseState } from "@/lib/actions/license";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabase: Awaited<ReturnType<typeof getUser>>["supabase"] | null = null;
  let user: Awaited<ReturnType<typeof getUser>>["user"] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profile: any = null;
  try {
    const auth = await getUser();
    supabase = auth.supabase;
    user = auth.user;
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, full_name, role, onboarded_at, show_raw_database")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as unknown as any) ?? null;
  } catch {
    // If the DB is briefly locked (e.g. /api/database is mid-scan and the user
    // clicks the same sidebar link again), don't hard-crash the whole dashboard
    // layout with a 500. Fall back to a minimal shell and let the inner page
    // show its own error state.
    const fallback = await getUser().catch(() => null);
    if (!fallback) throw new Error("Failed to load user");
    supabase = fallback.supabase;
    user = fallback.user;
    profile = null;
  }
  if (!supabase || !user) throw new Error("Failed to load user");

  // Admins belong in /admin. This redirect used to live in proxy.ts, which can no
  // longer read the database (Edge runtime + SQLite). The role is already loaded
  // here, so moving it costs no extra query.
  let pathname = "";
  try {
    pathname = (await headers()).get("x-current-path") ?? "";
  } catch {
    pathname = "";
  }
  if (profile?.role === "admin" && !pathname.startsWith("/admin")) {
    redirect("/admin");
  }

  // Mandatory activation gate: nothing past the titlebar renders until this
  // device has redeemed a free license key (lib/actions/license.ts). There
  // is no skip and no free-usage grace period — see components/license/
  // license-activation-screen.tsx.
  const { activated } = await getLicenseState();
  if (!activated) {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background p-3 md:p-0">
        <WindowTitlebar />
        <LicenseActivationScreen />
      </div>
    );
  }

  const showOnboarding = !profile?.onboarded_at && profile?.role !== "admin";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background p-3 md:p-0">
      <WindowTitlebar />
      <LicenseHeartbeatMonitor />

      <DashboardHeader user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} showRawDatabase={Boolean(profile?.show_raw_database)} />


      <div className="flex flex-1 w-full overflow-hidden min-h-0 min-w-0">
        <div className="hidden md:block shrink-0 h-full relative z-30">
          <Sidebar user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} role={profile?.role} showRawDatabase={Boolean(profile?.show_raw_database)} resizable />
        </div>

        {/* Main Viewing Area - flush with sidebar, no rounded/border inset on desktop */}
        <div className="flex flex-1 flex-col overflow-hidden w-full h-full min-w-0 min-h-0 bg-card border border-border rounded-2xl md:rounded-none md:border-0 md:bg-background">
          <DashboardMainContent>{children}</DashboardMainContent>
        </div>
      </div>

      {showOnboarding && (
        <OnboardingWizard
          isOpen={true}
          profileName={profile?.full_name}
          userEmail={user.email}
          initialAvatarUrl={profile?.avatar_url}
        />
      )}
    </div>
  );
}


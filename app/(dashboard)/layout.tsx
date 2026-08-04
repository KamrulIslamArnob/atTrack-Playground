import { getUser } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = null as never;
  const user = { id: "mock", email: "test@aven.app", user_metadata: { full_name: "Test User" } };
  const profile = { avatar_url: null, full_name: "Test User" };

  return (
    <div className="flex h-screen flex-col bg-background p-3">
      <DashboardHeader user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} />

      <div className="flex flex-1 gap-3 overflow-hidden pt-3">
        <div className="hidden md:block">
          <Sidebar user={user} avatarUrl={profile?.avatar_url} fullName={profile?.full_name} />
        </div>

        <main className="flex-1 overflow-y-auto rounded-4xl border border-border bg-card">
          <div className="px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

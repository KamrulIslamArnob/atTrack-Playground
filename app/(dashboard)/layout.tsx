import { getUser } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard-header";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen flex-col bg-background p-3">
      <DashboardHeader />

      <div className="flex flex-1 gap-3 overflow-hidden pt-3">
        <div className="hidden md:block">
          <Sidebar user={user} avatarUrl={profile?.avatar_url} />
        </div>

        <main className="flex-1 overflow-y-auto rounded-4xl border border-border bg-card">
          <div className="px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

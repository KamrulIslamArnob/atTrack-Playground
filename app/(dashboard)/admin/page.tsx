import { getAdminDashboardStats } from "@/lib/actions/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Users,
  ShieldCheck,
  Ban,
  Briefcase,
  Send,
  Calendar,
  Cpu,
  Activity,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import {
  UsersTrendChart,
  JobsStatusChart,
  AiTrendChart,
  ActivityByActionChart,
} from "@/components/admin-charts";
import { ActivityLogItem } from "@/components/activity-log-item";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">{greeting}, Admin</h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
              Monitor users, activity, and AI usage across your platform.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <QuickStat icon={Users} label="Total Users" value={stats.totalUsers} color="text-blue-500" bgColor="bg-blue-500/10" />
            <QuickStat icon={ShieldCheck} label="Active Users" value={stats.activeUsers} color="text-emerald-500" bgColor="bg-emerald-500/10" />
            <QuickStat icon={Ban} label="Banned" value={stats.bannedUsers} color="text-rose-500" bgColor="bg-rose-500/10" />
            <QuickStat icon={Briefcase} label="Total Jobs" value={stats.totalJobs} color="text-violet-500" bgColor="bg-violet-500/10" />
            <QuickStat icon={Send} label="Applications" value={stats.totalApplications} color="text-amber-500" bgColor="bg-amber-500/10" />
            <QuickStat icon={Cpu} label="AI Today" value={stats.aiRequestsToday} color="text-indigo-500" bgColor="bg-indigo-500/10" />
          </div>
        </div>
      </div>

      <Breadcrumbs />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">New Users</h2>
            <p className="text-xs text-muted-foreground mt-1">Signups over the last 14 days</p>
          </div>
          {stats.usersTrend.length > 0 ? (
            <UsersTrendChart data={stats.usersTrend} />
          ) : (
            <EmptyState icon={UserPlus} text="No signups in the last 14 days" />
          )}
        </div>
        <div className="min-w-0 rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Activity by Action</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </div>
          {stats.activityByAction.length > 0 ? (
            <>
              <ActivityByActionChart data={stats.activityByAction} />
              <div className="mt-2 space-y-2">
                {stats.activityByAction.slice(0, 4).map((item) => (
                  <div key={item.action} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="size-2.5 rounded-full bg-primary/60" />
                      <span className="text-muted-foreground capitalize">{item.action}</span>
                    </div>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={Activity} text="No activity yet" />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">AI Usage</h2>
            <p className="text-xs text-muted-foreground mt-1">Requests over the last 14 days</p>
          </div>
          {stats.aiTrend.length > 0 ? (
            <AiTrendChart data={stats.aiTrend} />
          ) : (
            <EmptyState icon={Cpu} text="No AI requests yet" />
          )}
          <div className="mt-4 flex items-center gap-6">
            <div>
              <p className="text-2xl font-bold">{stats.totalAiRequests}</p>
              <p className="text-[11px] text-muted-foreground">All-time requests</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Jobs by Status</h2>
            <p className="text-xs text-muted-foreground mt-1">Across all users</p>
          </div>
          {stats.jobsByStatus.length > 0 ? (
            <JobsStatusChart data={stats.jobsByStatus} />
          ) : (
            <EmptyState icon={Briefcase} text="No jobs yet" />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-4xl border border-border bg-card p-6">
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-1">Latest actions across the platform</p>
        </div>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stats.recentActivity.map((log) => (
              <ActivityLogItem key={log.id} log={log} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Activity} text="No activity yet" />
        )}
      </div>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex size-10 items-center justify-center rounded-4xl ${bgColor}`}>
        <Icon className={`size-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3">
        <Icon className="size-6 text-muted-foreground/30" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

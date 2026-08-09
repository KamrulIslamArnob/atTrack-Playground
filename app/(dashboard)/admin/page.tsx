import { getAdminDashboardStats } from "@/lib/actions/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Users,
  ShieldCheck,
  Ban,
  Briefcase,
  Send,
  Cpu,
  Activity,
  Calendar,
  ArrowUpRight,
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
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const activeRate = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  const banRate = stats.totalUsers > 0 ? Math.round((stats.bannedUsers / stats.totalUsers) * 100) : 0;
  const appPerJob = stats.totalJobs > 0 ? (stats.totalApplications / stats.totalJobs).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{greeting}, Admin</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
                Monitor users, activity, and AI usage across your platform.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              {date}
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Active"
          value={stats.activeUsers}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          badge={`${activeRate}%`}
          badgeColor="text-emerald-600"
        />
        <MetricCard
          icon={Ban}
          label="Banned"
          value={stats.bannedUsers}
          color="text-rose-500"
          bgColor="bg-rose-500/10"
          badge={`${banRate}%`}
          badgeColor="text-rose-600"
        />
        <MetricCard
          icon={Briefcase}
          label="Jobs"
          value={stats.totalJobs}
          color="text-violet-500"
          bgColor="bg-violet-500/10"
        />
        <MetricCard
          icon={Send}
          label="Applications"
          value={stats.totalApplications}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
          badge={`${appPerJob}/job`}
          badgeColor="text-amber-600"
        />
        <MetricCard
          icon={Cpu}
          label="AI Today"
          value={stats.aiRequestsToday}
          color="text-cyan-500"
          bgColor="bg-cyan-500/10"
          badge={`${stats.totalAiRequests} total`}
          badgeColor="text-cyan-600"
        />
      </div>

      {/* Charts row 1: Users Trend + AI Usage Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold">New Users</h2>
                <p className="text-xs text-muted-foreground mt-1">Signups over the last 14 days</p>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                <ArrowUpRight className="size-4" />
                {stats.usersTrend.length > 0
                  ? stats.usersTrend.reduce((sum, d) => sum + d.count, 0)
                  : 0}
              </div>
            </div>
          </div>
          {stats.usersTrend.length > 0 ? (
            <UsersTrendChart data={stats.usersTrend} />
          ) : (
            <EmptyState icon={Users} text="No signups in the last 14 days" />
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold">AI Usage</h2>
                <p className="text-xs text-muted-foreground mt-1">Requests over the last 14 days</p>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-cyan-600">
                <ArrowUpRight className="size-4" />
                {stats.aiTrend.length > 0
                  ? stats.aiTrend.reduce((sum, d) => sum + d.requests, 0)
                  : 0}
              </div>
            </div>
          </div>
          {stats.aiTrend.length > 0 ? (
            <AiTrendChart data={stats.aiTrend} />
          ) : (
            <EmptyState icon={Cpu} text="No AI requests yet" />
          )}
        </div>
      </div>

      {/* Charts row 2: Jobs by Status + Activity by Action */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Jobs by Status</h2>
            <p className="text-xs text-muted-foreground mt-1">Distribution across all users</p>
          </div>
          {stats.jobsByStatus.length > 0 ? (
            <JobsStatusChart data={stats.jobsByStatus} />
          ) : (
            <EmptyState icon={Briefcase} text="No jobs yet" />
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Activity by Action</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </div>
          {stats.activityByAction.length > 0 ? (
            <ActivityByActionChart data={stats.activityByAction} />
          ) : (
            <EmptyState icon={Activity} text="No activity yet" />
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
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

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  badge,
  badgeColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
  bgColor: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-2xl ${bgColor}`}>
          <Icon className={`size-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold tracking-tight">
            {value.toLocaleString()}
            {badge && (
              <span className={`ml-2 text-xs font-medium ${badgeColor ?? "text-muted-foreground"}`}>
                ({badge})
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/50 mb-3">
        <Icon className="size-6 text-muted-foreground/30" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

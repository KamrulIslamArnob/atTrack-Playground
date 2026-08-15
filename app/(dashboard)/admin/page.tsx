import { getAdminDashboardStats } from "@/lib/actions/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Users,
  ShieldCheck,
  Ban,
  Briefcase,
  Send,
  Cpu,
  Calendar,
} from "lucide-react";
import {
  UsersTrendChart,
  JobsStageChart,
  AiTrendChart,
} from "@/components/admin-charts";

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
                Monitor users, jobs, and AI usage across your platform.
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Active Users"
          value={stats.activeUsers}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          badge={`${activeRate}%`}
          badgeColor="text-emerald-600"
        />
        <MetricCard
          icon={Ban}
          label="Banned Users"
          value={stats.bannedUsers}
          color="text-rose-500"
          bgColor="bg-rose-500/10"
        />
        <MetricCard
          icon={Briefcase}
          label="Total Jobs"
          value={stats.totalJobs}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
        <MetricCard
          icon={Send}
          label="Applications"
          value={stats.totalApplications}
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <MetricCard
          icon={Cpu}
          label="AI Requests"
          value={stats.totalAiRequests}
          color="text-indigo-500"
          bgColor="bg-indigo-500/10"
        />
      </div>

      {/* Charts row 1: User Growth + AI Requests */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">User Signups</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </div>
          {stats.usersTrend.length > 0 ? (
            <UsersTrendChart data={stats.usersTrend} />
          ) : (
            <EmptyState icon={Users} text="No signups yet" />
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">AI Requests</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 14 days</p>
          </div>
          {stats.aiTrend.length > 0 ? (
            <AiTrendChart data={stats.aiTrend} />
          ) : (
            <EmptyState icon={Cpu} text="No AI requests yet" />
          )}
        </div>
      </div>

      {/* Charts row 2: Jobs by Stage */}
      <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="font-heading text-lg font-semibold">Jobs by Stage</h2>
          <p className="text-xs text-muted-foreground mt-1">Distribution across all users</p>
        </div>
        {stats.jobsByStage.length > 0 ? (
          <JobsStageChart data={stats.jobsByStage} />
        ) : (
          <EmptyState icon={Briefcase} text="No jobs yet" />
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

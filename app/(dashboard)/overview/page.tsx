"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  Briefcase,
  Calendar,
  Clock,
  Target,
  ArrowRight,
  FileText,
  Plus,
  Camera,
  MapPin,
  DollarSign,
  Building2,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Users,
  BarChart3,
  Zap,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Activity,
  Timer,
  Award,
  Send,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import type { OverviewData } from "@/lib/actions/overview";

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusColors: Record<string, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
  applied: "#8B5CF6",
  interview: "#10B981",
  offer: "#059669",
  accepted: "#047857",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/overview");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch overview data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
              <p className="mt-2 text-muted-foreground max-w-lg">
                Here&apos;s your career dashboard. Track applications, interviews, and opportunities all in one place.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AddJobDialog
                trigger={
                  <button className={buttonVariants({ size: "sm", className: "gap-1.5" })}>
                    <Plus className="size-4" />
                    Add job
                  </button>
                }
              />
              <Link
                href="/jobs?import=screenshot"
                className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
              >
                <Camera className="size-4" />
                Import
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <QuickStat
              icon={Briefcase}
              label="Total Jobs"
              value={data.totalJobs}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <QuickStat
              icon={Send}
              label="Applications"
              value={data.totalApplications}
              color="text-violet-500"
              bgColor="bg-violet-500/10"
            />
            <QuickStat
              icon={Calendar}
              label="Interviews"
              value={data.totalInterviews}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
            <QuickStat
              icon={Target}
              label="Avg Match"
              value={data.averageMatchScore != null ? `${data.averageMatchScore}%` : "—"}
              color="text-amber-500"
              bgColor="bg-amber-500/10"
            />
            <QuickStat
              icon={TrendingUp}
              label="Offer Rate"
              value={data.offerRate != null ? `${data.offerRate}%` : "—"}
              color="text-emerald-600"
              bgColor="bg-emerald-500/10"
            />
            <QuickStat
              icon={Activity}
              label="Response"
              value={data.responseRate != null ? `${data.responseRate}%` : "—"}
              color="text-rose-500"
              bgColor="bg-rose-500/10"
            />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline Chart - 2 cols */}
        <div className="rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Application Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-1">Jobs by status</p>
            </div>
            <Link href="/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(data.pipeline).map(([key, value]) => ({ name: statusLabels[key] || key, value, fill: statusColors[key] || "#6B7280" }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {Object.entries(data.pipeline).map(([key], index) => (
                    <Cell key={`cell-${index}`} fill={statusColors[key] || "#6B7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Match Score Ring */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Match Score</h2>
              <p className="text-xs text-muted-foreground mt-1">Distribution</p>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.matchScoreDistribution.filter(d => d.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="range"
                >
                  {data.matchScoreDistribution
                    .filter(d => d.count > 0)
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {data.matchScoreDistribution.filter(d => d.count > 0).map((item) => (
              <div key={item.range} className="flex items-center gap-2 text-xs">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-muted-foreground">{item.range}</span>
                <span className="ml-auto font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Application Trend */}
        <div className="rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Application Trend</h2>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.applicationTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB" }}
                />
                <Area type="monotone" dataKey="applications" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorApplications)" strokeWidth={2} />
                <Area type="monotone" dataKey="interviews" stroke="#10B981" fillOpacity={1} fill="url(#colorInterviews)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">Applications</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Interviews</span>
            </div>
          </div>
        </div>

        {/* Time Analytics */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Time Analytics</h2>
              <p className="text-xs text-muted-foreground mt-1">Average response times</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-violet-500/10">
                <Timer className="size-6 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data.timeAnalytics.averageTimeToApply != null ? `${data.timeAnalytics.averageTimeToApply}d` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg. time to apply</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-emerald-500/10">
                <Zap className="size-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data.timeAnalytics.averageTimeToInterview != null ? `${data.timeAnalytics.averageTimeToInterview}d` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg. time to interview</p>
              </div>
            </div>
            {data.timeAnalytics.longestPending && (
              <div className="rounded-4xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">Longest pending</p>
                <p className="text-sm font-medium truncate">{data.timeAnalytics.longestPending.title}</p>
                <p className="text-xs text-muted-foreground">
                  {data.timeAnalytics.longestPending.company} • {data.timeAnalytics.longestPending.days} days
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Third Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Source Breakdown */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Job Sources</h2>
              <p className="text-xs text-muted-foreground mt-1">Where jobs come from</p>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.sourceBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="source"
                >
                  {data.sourceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {data.sourceBreakdown.slice(0, 4).map((item) => (
              <div key={item.source} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.source}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Work Location */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Work Location</h2>
              <p className="text-xs text-muted-foreground mt-1">Remote vs On-site</p>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.workLocationBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="location"
                >
                  {data.workLocationBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {data.workLocationBreakdown.map((item) => (
              <div key={item.location} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.location}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Employment Type */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Employment Type</h2>
              <p className="text-xs text-muted-foreground mt-1">Full-time vs Part-time</p>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.employmentTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="type"
                >
                  {data.employmentTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {data.employmentTypeBreakdown.slice(0, 4).map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.type}</span>
                </div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fourth Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Companies */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Top Companies</h2>
              <p className="text-xs text-muted-foreground mt-1">Most applied to</p>
            </div>
          </div>
          <div className="space-y-4">
            {data.topCompanies.length > 0 ? (
              data.topCompanies.map((company, index) => (
                <div key={company.name} className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-4xl bg-muted text-xs font-bold text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{company.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{company.applications} apps</span>
                      <span>{company.interviews} interviews</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Interview Stats */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Interview Stats</h2>
              <p className="text-xs text-muted-foreground mt-1">Performance overview</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-emerald-500/10">
                  <Calendar className="size-4 text-emerald-500" />
                </div>
                <span className="text-sm">Total interviews</span>
              </div>
              <span className="text-lg font-bold">{data.interviewStats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-blue-500/10">
                  <Clock className="size-4 text-blue-500" />
                </div>
                <span className="text-sm">Upcoming</span>
              </div>
              <span className="text-lg font-bold">{data.interviewStats.upcoming}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-violet-500/10">
                  <CheckCircle2 className="size-4 text-violet-500" />
                </div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="text-lg font-bold">{data.interviewStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-amber-500/10">
                  <Award className="size-4 text-amber-500" />
                </div>
                <span className="text-sm">Pass rate</span>
              </div>
              <span className="text-lg font-bold">
                {data.interviewStats.passRate != null ? `${data.interviewStats.passRate}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* MCQ Performance */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Practice Score</h2>
              <p className="text-xs text-muted-foreground mt-1">MCQ test results</p>
            </div>
            <Link href="/interviews" className="text-xs text-primary hover:underline flex items-center gap-1">
              Practice <ArrowRight className="size-3" />
            </Link>
          </div>
          {data.mcqStats.totalTests > 0 ? (
            <>
              <div className="flex items-center gap-6 mb-6">
                <div>
                  <p className="text-3xl font-bold">{data.mcqStats.averageScore ?? 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Average</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <p className="text-3xl font-bold">{data.mcqStats.bestScore ?? 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Best</p>
                </div>
              </div>
              {data.mcqStats.recentScores.length > 0 && (
                <div className="h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.mcqStats.recentScores} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", strokeWidth: 0, r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3">
                <Sparkles className="size-6 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground mb-3">No practice tests yet</p>
              <Link
                href="/interviews"
                className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1.5" })}
              >
                Start practicing
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Fifth Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Interviews */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Upcoming Interviews</h2>
              <p className="text-xs text-muted-foreground mt-1">Next scheduled</p>
            </div>
            <Link href="/interviews" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {data.upcomingInterviews.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-center gap-4 rounded-4xl border border-border p-4 transition-all hover:shadow-md hover:border-primary/20">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-4xl bg-emerald-500/10">
                    <Calendar className="size-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{interview.job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{interview.job.company}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-4xl bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {interview.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(interview.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3">
                <Calendar className="size-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">No upcoming interviews</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Recent Activity</h2>
              <p className="text-xs text-muted-foreground mt-1">Latest updates</p>
            </div>
          </div>
          {data.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="relative mt-1">
                    <div className="size-2 rounded-full bg-primary" />
                    <div className="absolute left-1/2 top-2 -translate-x-1/2 h-6 w-px bg-border" />
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="text-sm">{activity.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      {activity.status && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{activity.status}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3">
                <Activity className="size-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/jobs"
            className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30"
          >
            <div className="flex size-10 items-center justify-center rounded-4xl bg-blue-500/10">
              <Briefcase className="size-5 text-blue-500" />
            </div>
            All Jobs
          </Link>
          <Link
            href="/interviews"
            className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30"
          >
            <div className="flex size-10 items-center justify-center rounded-4xl bg-emerald-500/10">
              <Calendar className="size-5 text-emerald-500" />
            </div>
            Interviews
          </Link>
          <Link
            href="/documents"
            className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30"
          >
            <div className="flex size-10 items-center justify-center rounded-4xl bg-violet-500/10">
              <FileText className="size-5 text-violet-500" />
            </div>
            Documents
          </Link>
          <Link
            href="/insights"
            className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30"
          >
            <div className="flex size-10 items-center justify-center rounded-4xl bg-amber-500/10">
              <BarChart3 className="size-5 text-amber-500" />
            </div>
            Insights
          </Link>
        </div>
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

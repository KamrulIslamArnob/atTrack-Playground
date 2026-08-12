import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  PipelineChart,
  ApplicationTrendChart,
  McqScoreChart,
} from "@/components/overview-charts";
import {
  Briefcase,
  Calendar,
  Clock,
  Target,
  ArrowRight,
  Plus,
  Camera,
  TrendingUp,
  Activity,
  Timer,
  Zap,
  Send,
  CheckCircle2,
  Award,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
};

const pipelineColors: Record<string, string> = {
  saved: "#94A3B8",
  interested: "#3B82F6",
  preparing: "#F59E0B",
  applied: "#8B5CF6",
  interview: "#84cc16",
  offer: "#65a30d",
  accepted: "#4d7c0f",
  rejected: "#EF4444",
  withdrawn: "#6B7280",
};

const sourceColors: Record<string, string> = {
  linkedin: "#0A66C2",
  indeed: "#2164F3",
  glassdoor: "#0CAA41",
  referral: "#8B5CF6",
  company_site: "#F59E0B",
  other: "#6B7280",
  manual: "#6366F1",
  screenshot: "#EC4899",
};

const employmentTypeColors: Record<string, string> = {
  "Full-time": "#6366F1",
  "Part-time": "#8B5CF6",
  Contract: "#A855F7",
  Freelance: "#D946EF",
  Internship: "#EC4899",
  Temporary: "#F43F5E",
  Apprenticeship: "#F97316",
  Volunteer: "#EAB308",
};

const workLocationColors: Record<string, string> = {
  Remote: "#84cc16",
  Hybrid: "#F59E0B",
  "On-site": "#6366F1",
  Unspecified: "#6B7280",
};

export default async function OverviewPage() {
  const { supabase, userId } = await getUser();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, title, status, match_score, source, employment_type, work_location,
      created_at, updated_at,
      company:companies(name),
      applications(id, status, applied_at, created_at),
      interviews(id, scheduled_at, type, status)
    `)
    .eq("user_id", userId);

  const [
    { count: totalJobs },
    { count: totalApplications },
    { count: totalInterviews },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("interviews").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const { data: mcqResults } = await supabase
    .from("mcq_results")
    .select("score, total, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const allJobs = jobs ?? [];

  // Pipeline
  const pipelineCounts: Record<string, number> = {};
  for (const job of allJobs) {
    const s = job.status as string;
    pipelineCounts[s] = (pipelineCounts[s] || 0) + 1;
  }
  const pipeline = Object.fromEntries(
    Object.entries(pipelineCounts).filter(([, count]) => count > 0)
  );

  // Average match score
  let totalScore = 0;
  let scoredCount = 0;
  for (const job of allJobs) {
    if (job.match_score != null) {
      const score = Number(job.match_score);
      totalScore += score;
      scoredCount++;
    }
  }
  const averageMatchScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;

  // Source breakdown
  const sourceMap: Record<string, number> = {};
  for (const job of allJobs) {
    const src = (job.source as string) || "Other";
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  }
  const sourceBreakdown = Object.entries(sourceMap)
    .map(([source, count]) => ({
      source: source.charAt(0).toUpperCase() + source.slice(1).replace("_", " "),
      count,
      fill: sourceColors[source] || "#6B7280",
    }))
    .sort((a, b) => b.count - a.count);

  // Employment type breakdown
  const employmentTypeMap: Record<string, number> = {};
  for (const job of allJobs) {
    const t = (job.employment_type as string) || "Full-time";
    employmentTypeMap[t] = (employmentTypeMap[t] || 0) + 1;
  }
  const employmentTypeBreakdown = Object.entries(employmentTypeMap)
    .map(([type, count]) => ({ type, count, fill: employmentTypeColors[type] || "#6B7280" }))
    .sort((a, b) => b.count - a.count);

  // Work location breakdown
  const workLocationMap: Record<string, number> = {};
  for (const job of allJobs) {
    const l = (job.work_location as string) || "Unspecified";
    workLocationMap[l] = (workLocationMap[l] || 0) + 1;
  }
  const workLocationBreakdown = Object.entries(workLocationMap)
    .map(([location, count]) => ({ location, count, fill: workLocationColors[location] || "#6B7280" }))
    .sort((a, b) => b.count - a.count);

  // Application trend
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const trendMap: Record<string, { applications: number; interviews: number }> = {};
  for (const job of allJobs) {
    for (const app of Array.isArray(job.applications) ? job.applications : []) {
      const d = new Date((app as { created_at: string }).created_at);
      if (d >= thirtyDaysAgo) {
        const k = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!trendMap[k]) trendMap[k] = { applications: 0, interviews: 0 };
        trendMap[k].applications++;
      }
    }
    for (const int of Array.isArray(job.interviews) ? job.interviews : []) {
      const d = new Date((int as { scheduled_at: string }).scheduled_at);
      if (d >= thirtyDaysAgo) {
        const k = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!trendMap[k]) trendMap[k] = { applications: 0, interviews: 0 };
        trendMap[k].interviews++;
      }
    }
  }
  const applicationTrend = Object.entries(trendMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Upcoming interviews
  const upcomingInterviews = allJobs
    .flatMap((job) => {
      const co = (Array.isArray(job.company) ? job.company[0] : job.company) as { name: string } | null;
      return (Array.isArray(job.interviews) ? job.interviews : [])
        .filter((i: { scheduled_at: string | null }) => i.scheduled_at && new Date(i.scheduled_at) >= new Date())
        .map((i: { id: string; scheduled_at: string; type: string }) => ({
          id: i.id,
          scheduled_at: i.scheduled_at,
          type: i.type,
          job: { title: job.title as string, company: co?.name ?? "Unknown" },
        }));
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 3);

  // Interview stats
  const allInterviews = allJobs.flatMap((job) => (Array.isArray(job.interviews) ? job.interviews : []));
  const upcomingInterviewsCount = allInterviews.filter(
    (i: { scheduled_at: string | null }) => i.scheduled_at && new Date(i.scheduled_at) >= new Date()
  ).length;
  const completedInterviews = allInterviews.filter((i: { status: string }) => i.status === "completed").length;
  const passedInterviews = allInterviews.filter((i: { status: string }) => i.status === "passed").length;
  const interviewStats = {
    total: allInterviews.length,
    upcoming: upcomingInterviewsCount,
    completed: completedInterviews,
    passRate: completedInterviews > 0 ? Math.round((passedInterviews / completedInterviews) * 100) : null,
  };

  // MCQ stats
  const totalTests = mcqResults?.length ?? 0;
  const avgScore =
    totalTests > 0
      ? Math.round((mcqResults ?? []).reduce((sum, r) => sum + (r.score / r.total), 0) / totalTests * 100)
      : null;
  const recentScores = (mcqResults ?? [])
    .slice(0, 7)
    .reverse()
    .map((r) => ({
      date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: Math.round((r.score / r.total) * 100),
    }));

  // Time analytics
  let totalDaysToApply = 0;
  let applyCount = 0;
  let totalDaysToInterview = 0;
  let interviewCount = 0;

  for (const job of allJobs) {
    const created = new Date(job.created_at as string);
    const apps = Array.isArray(job.applications) ? job.applications : [];
    if (apps.length > 0) {
      const appDate = new Date(
        (apps[0] as { applied_at: string }).applied_at || (apps[0] as { created_at: string }).created_at
      );
      totalDaysToApply += Math.round((appDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      applyCount++;
    }
    const ints = Array.isArray(job.interviews) ? job.interviews : [];
    if (ints.length > 0 && apps.length > 0) {
      const intDate = new Date((ints[0] as { scheduled_at: string }).scheduled_at);
      const appDate = new Date(
        (apps[0] as { applied_at: string }).applied_at || (apps[0] as { created_at: string }).created_at
      );
      const d = Math.round((intDate.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
      if (d > 0) {
        totalDaysToInterview += d;
        interviewCount++;
      }
    }
  }
  const timeAnalytics = {
    averageTimeToApply: applyCount > 0 ? Math.round(totalDaysToApply / applyCount) : null,
    averageTimeToInterview: interviewCount > 0 ? Math.round(totalDaysToInterview / interviewCount) : null,
  };

  const offerRate =
    (totalJobs ?? 0) > 0 ? Math.round(((pipeline.offer ?? 0) + (pipeline.accepted ?? 0)) / (totalJobs ?? 1) * 100) : null;
  const totalApplied =
    (pipeline.applied ?? 0) + (pipeline.interview ?? 0) + (pipeline.offer ?? 0) + (pipeline.accepted ?? 0) + (pipeline.rejected ?? 0);
  const responded = (pipeline.interview ?? 0) + (pipeline.offer ?? 0) + (pipeline.accepted ?? 0) + (pipeline.rejected ?? 0);
  const responseRate = totalApplied > 0 ? Math.round((responded / totalApplied) * 100) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{greeting}</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
                Here&apos;s where you stand — every application, every interview, every number that matters.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <AddJobDialog
                trigger={
                  <button className={buttonVariants({ size: "sm", className: "w-full justify-center gap-1.5 sm:w-auto" })}>
                    <Plus className="size-4" />
                    Add job
                  </button>
                }
              />
              <Link
                href="/jobs?import=screenshot"
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-full justify-center gap-1.5 sm:w-auto" })}
              >
                <Camera className="size-4" />
                Import
              </Link>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <QuickStat icon={Briefcase} label="Jobs" value={totalJobs ?? 0} color="text-blue-500" bgColor="bg-blue-500/10" />
            <QuickStat icon={Send} label="Applied" value={totalApplications ?? 0} color="text-violet-500" bgColor="bg-violet-500/10" />
            <QuickStat icon={Calendar} label="Interviews" value={totalInterviews ?? 0} color="text-emerald-500" bgColor="bg-emerald-500/10" />
            <QuickStat icon={Target} label="Avg Match" value={averageMatchScore != null ? `${averageMatchScore}%` : "—"} color="text-amber-500" bgColor="bg-amber-500/10" />
            <QuickStat icon={TrendingUp} label="Offer Rate" value={offerRate != null ? `${offerRate}%` : "—"} color="text-emerald-600" bgColor="bg-emerald-500/10" />
            <QuickStat icon={Activity} label="Response" value={responseRate != null ? `${responseRate}%` : "—"} color="text-rose-500" bgColor="bg-rose-500/10" />
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Row 1: Pipeline */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">Pipeline</h2>
            <p className="text-xs text-muted-foreground">Where your jobs are now</p>
          </div>
          <Link href="/jobs" className="text-xs text-green-800 dark:text-lime-400 hover:underline flex items-center gap-1">View all <ArrowRight className="size-3" /></Link>
        </div>
        {Object.keys(pipeline).length > 0 ? (
          <>
            <PipelineChart pipeline={pipeline} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {Object.entries(pipeline).map(([key, count]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full" style={{ backgroundColor: pipelineColors[key] || "#6B7280" }} />
                  <span className="text-muted-foreground">{statusLabels[key] ?? key}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Briefcase className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No jobs yet</p>
          </div>
        )}
      </div>

      {/* Row 2: Trend + Timing */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Applications & Interviews</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <ApplicationTrendChart data={applicationTrend} />
          <div className="mt-3 flex items-center justify-center gap-5 text-xs">
            <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-violet-500" /><span className="text-muted-foreground">Applications</span></div>
            <div className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Interviews</span></div>
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Timing</h2>
            <p className="text-xs text-muted-foreground">How long things take</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10"><Timer className="size-5 text-violet-500" /></div>
              <div>
                <p className="text-xl font-bold">{timeAnalytics.averageTimeToApply != null ? `${timeAnalytics.averageTimeToApply}d` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Time to apply</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10"><Zap className="size-5 text-emerald-500" /></div>
              <div>
                <p className="text-xl font-bold">{timeAnalytics.averageTimeToInterview != null ? `${timeAnalytics.averageTimeToInterview}d` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Time to interview</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Work Location</h3>
          <div className="space-y-2">
            {workLocationBreakdown.map((item) => (
              <div key={item.location} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className="size-2 rounded-full" style={{ backgroundColor: item.fill }} /><span className="text-muted-foreground">{item.location}</span></div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Employment Type</h3>
          <div className="space-y-2">
            {employmentTypeBreakdown.slice(0, 5).map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className="size-2 rounded-full" style={{ backgroundColor: item.fill }} /><span className="text-muted-foreground">{item.type}</span></div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming Interviews + Interview Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading text-lg font-semibold">Upcoming Interviews</h2>
              <p className="text-xs text-muted-foreground">What&apos;s on the calendar</p>
            </div>
            <Link href="/interviews" className="text-xs text-green-800 dark:text-lime-400 hover:underline flex items-center gap-1">View all <ArrowRight className="size-3" /></Link>
          </div>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-3">
              {upcomingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-all hover:shadow-sm hover:border-primary/20">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10"><Calendar className="size-4 text-emerald-500" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{interview.job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{interview.job.company}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{interview.type}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(interview.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 mb-2"><Calendar className="size-6 text-muted-foreground/30" /></div>
              <p className="text-sm text-muted-foreground">No interviews scheduled</p>
            </div>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Interview Stats</h2>
            <p className="text-xs text-muted-foreground">How they went</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10"><Calendar className="size-4 text-emerald-500" /></div>
                <span className="text-sm">Total</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-blue-500/10"><Clock className="size-4 text-blue-500" /></div>
                <span className="text-sm">Upcoming</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.upcoming}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-violet-500/10"><CheckCircle2 className="size-4 text-violet-500" /></div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10"><Award className="size-4 text-amber-500" /></div>
                <span className="text-sm">Pass rate</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.passRate != null ? `${interviewStats.passRate}%` : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MCQ Practice (compact, only shown when there's data) */}
      {totalTests > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading text-sm font-semibold">Practice Tests</h3>
              <p className="text-[11px] text-muted-foreground">Your recent scores</p>
            </div>
            <Link href="/interviews" className="text-xs text-green-800 dark:text-lime-400 hover:underline flex items-center gap-1">Practice <ArrowRight className="size-3" /></Link>
          </div>
          <div className="flex items-center gap-6 mb-4">
            <div><p className="text-2xl font-bold">{avgScore ?? 0}%</p><p className="text-[10px] text-muted-foreground">Average</p></div>
            <div className="h-10 w-px bg-border" />
            <div><p className="text-2xl font-bold">
              {Math.round(Math.max(...(mcqResults ?? []).map((r) => r.score / r.total)) * 100)}%
            </p><p className="text-[10px] text-muted-foreground">Best</p></div>
          </div>
          <McqScoreChart data={recentScores} />
        </div>
      )}
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
      <div className={`flex size-10 items-center justify-center rounded-2xl ${bgColor}`}>
        <Icon className={`size-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  PipelineChart,
  MatchScoreChart,
  ApplicationTrendChart,
  SourceChart,
  LocationChart,
  EmploymentTypeChart,
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
  Building2,
  Sparkles,
  TrendingUp,
  Activity,
  Timer,
  Zap,
  Award,
  Send,
  CheckCircle2,
  BarChart3,
  FileText,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
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
  Remote: "#10B981",
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
    { count: totalDocuments },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("interviews").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const { data: mcqResults } = await supabase
    .from("mcq_results")
    .select("score, total, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const allJobs = jobs ?? [];

  // Pipeline
  const pipeline = { saved: 0, interested: 0, preparing: 0, applied: 0, interview: 0, offer: 0, accepted: 0, rejected: 0, withdrawn: 0 };
  for (const job of allJobs) {
    const s = job.status as keyof typeof pipeline;
    if (s in pipeline) pipeline[s]++;
  }

  // Match score distribution
  let totalScore = 0;
  let scoredCount = 0;
  const matchScoreDistribution = [
    { range: "90-100%", count: 0, fill: "#10B981" },
    { range: "70-89%", count: 0, fill: "#22C55E" },
    { range: "50-69%", count: 0, fill: "#F59E0B" },
    { range: "30-49%", count: 0, fill: "#F97316" },
    { range: "0-29%", count: 0, fill: "#EF4444" },
  ];
  for (const job of allJobs) {
    if (job.match_score != null) {
      const score = Number(job.match_score);
      totalScore += score;
      scoredCount++;
      if (score >= 90) matchScoreDistribution[0].count++;
      else if (score >= 70) matchScoreDistribution[1].count++;
      else if (score >= 50) matchScoreDistribution[2].count++;
      else if (score >= 30) matchScoreDistribution[3].count++;
      else matchScoreDistribution[4].count++;
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

  // Top companies
  const companyMap: Record<string, { applications: number; interviews: number }> = {};
  for (const job of allJobs) {
    const co = (Array.isArray(job.company) ? job.company[0] : job.company) as { name: string } | null;
    const name = co?.name ?? "Unknown";
    if (!companyMap[name]) companyMap[name] = { applications: 0, interviews: 0 };
    companyMap[name].applications += (Array.isArray(job.applications) ? job.applications : []).length;
    companyMap[name].interviews += (Array.isArray(job.interviews) ? job.interviews : []).length;
  }
  const topCompanies = Object.entries(companyMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 5);

  // Application trend (last 30 days)
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
        .map((i: { id: string; scheduled_at: string; type: string; status: string }) => ({
          id: i.id,
          scheduled_at: i.scheduled_at,
          type: i.type,
          status: i.status,
          job: { title: job.title as string, company: co?.name ?? "Unknown" },
        }));
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  // Recent activity
  const recentActivity: { id: string; type: string; title: string; timestamp: string; status?: string }[] = [];
  for (const job of allJobs.slice(0, 10)) {
    const co = (Array.isArray(job.company) ? job.company[0] : job.company) as { name: string } | null;
    recentActivity.push({
      id: job.id as string,
      type: "job_added",
      title: `Added ${(job.title as string) ?? "Untitled"} at ${co?.name ?? "Unknown"}`,
      timestamp: job.created_at as string,
      status: job.status as string,
    });
    for (const app of Array.isArray(job.applications) ? job.applications : []) {
      recentActivity.push({
        id: `${job.id}-app`,
        type: "application",
        title: `Applied to ${(job.title as string) ?? "Untitled"}`,
        timestamp: (app as { created_at: string }).created_at,
        status: "applied",
      });
    }
  }
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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
  const bestScore =
    totalTests > 0
      ? Math.round(Math.max(...(mcqResults ?? []).map((r) => r.score / r.total)) * 100)
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
  let longestPendingDays = 0;
  let longestPendingJob = null;

  for (const job of allJobs) {
    const created = new Date(job.created_at as string);
    const apps = Array.isArray(job.applications) ? job.applications : [];
    if (apps.length > 0) {
      const appDate = new Date(
        (apps[0] as { applied_at: string }).applied_at || (apps[0] as { created_at: string }).created_at
      );
      totalDaysToApply += Math.round((appDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      applyCount++;
    } else {
      const daysSinceCreated = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCreated > longestPendingDays) {
        longestPendingDays = daysSinceCreated;
        const co = (Array.isArray(job.company) ? job.company[0] : job.company) as { name: string } | null;
        longestPendingJob = { title: job.title as string, company: co?.name ?? "Unknown", days: daysSinceCreated };
      }
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
    longestPending: longestPendingJob,
  };

  const offerRate =
    (totalJobs ?? 0) > 0 ? Math.round(((pipeline.offer + pipeline.accepted) / (totalJobs ?? 1)) * 100) : null;
  const totalApplied =
    pipeline.applied + pipeline.interview + pipeline.offer + pipeline.accepted + pipeline.rejected;
  const responded = pipeline.interview + pipeline.offer + pipeline.accepted + pipeline.rejected;
  const responseRate = totalApplied > 0 ? Math.round((responded / totalApplied) * 100) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-4xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{greeting}</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
                Here&apos;s your career dashboard. Track applications, interviews, and opportunities all in one place.
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
            <QuickStat icon={Briefcase} label="Total Jobs" value={totalJobs ?? 0} color="text-blue-500" bgColor="bg-blue-500/10" />
            <QuickStat icon={Send} label="Applications Sent" value={totalApplications ?? 0} color="text-violet-500" bgColor="bg-violet-500/10" />
            <QuickStat icon={Calendar} label="Interviews" value={totalInterviews ?? 0} color="text-emerald-500" bgColor="bg-emerald-500/10" />
            <QuickStat icon={Target} label="Avg Match" value={averageMatchScore != null ? `${averageMatchScore}%` : "\u2014"} color="text-amber-500" bgColor="bg-amber-500/10" />
            <QuickStat icon={TrendingUp} label="Offer Rate" value={offerRate != null ? `${offerRate}%` : "\u2014"} color="text-emerald-600" bgColor="bg-emerald-500/10" />
            <QuickStat icon={Activity} label="Response" value={responseRate != null ? `${responseRate}%` : "\u2014"} color="text-rose-500" bgColor="bg-rose-500/10" />
          </div>
        </div>
      </div>

      <Breadcrumbs />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Job Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-1">Jobs by status</p>
            </div>
            <Link href="/jobs" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="size-3" /></Link>
          </div>
          <PipelineChart pipeline={pipeline} />
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Match Score</h2>
            <p className="text-xs text-muted-foreground mt-1">Distribution</p>
          </div>
          <MatchScoreChart data={matchScoreDistribution} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {matchScoreDistribution.filter((d) => d.count > 0).map((item) => (
              <div key={item.range} className="flex items-center gap-2 text-xs">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-muted-foreground">{item.range}</span>
                <span className="ml-auto font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-4xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Application Trend</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </div>
          <ApplicationTrendChart data={applicationTrend} />
          <div className="mt-4 flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-violet-500" /><span className="text-muted-foreground">Applications</span></div>
            <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Interviews</span></div>
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Time Analytics</h2>
            <p className="text-xs text-muted-foreground mt-1">Average response times</p>
          </div>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-violet-500/10"><Timer className="size-6 text-violet-500" /></div>
              <div>
                <p className="text-2xl font-bold">{timeAnalytics.averageTimeToApply != null ? `${timeAnalytics.averageTimeToApply}d` : "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Avg. time to apply</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-emerald-500/10"><Zap className="size-6 text-emerald-500" /></div>
              <div>
                <p className="text-2xl font-bold">{timeAnalytics.averageTimeToInterview != null ? `${timeAnalytics.averageTimeToInterview}d` : "\u2014"}</p>
                <p className="text-xs text-muted-foreground">Avg. time to interview</p>
              </div>
            </div>
            {timeAnalytics.longestPending && (
              <div className="rounded-4xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-2">Longest pending</p>
                <p className="text-sm font-medium truncate">{timeAnalytics.longestPending.title}</p>
                <p className="text-xs text-muted-foreground">{timeAnalytics.longestPending.company} &bull; {timeAnalytics.longestPending.days} days</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Job Sources</h2>
            <p className="text-xs text-muted-foreground mt-1">Where jobs come from</p>
          </div>
          <SourceChart data={sourceBreakdown} />
          <div className="mt-2 space-y-2">
            {sourceBreakdown.slice(0, 4).map((item) => (
              <div key={item.source} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} /><span className="text-muted-foreground">{item.source}</span></div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Work Location</h2>
            <p className="text-xs text-muted-foreground mt-1">Remote vs On-site</p>
          </div>
          <LocationChart data={workLocationBreakdown} />
          <div className="mt-2 space-y-2">
            {workLocationBreakdown.map((item) => (
              <div key={item.location} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} /><span className="text-muted-foreground">{item.location}</span></div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Employment Type</h2>
            <p className="text-xs text-muted-foreground mt-1">Full-time vs Part-time</p>
          </div>
          <EmploymentTypeChart data={employmentTypeBreakdown} />
          <div className="mt-2 space-y-2">
            {employmentTypeBreakdown.slice(0, 4).map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><div className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} /><span className="text-muted-foreground">{item.type}</span></div>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Top Companies</h2>
            <p className="text-xs text-muted-foreground mt-1">Most applied to</p>
          </div>
          <div className="space-y-4">
            {topCompanies.length > 0 ? topCompanies.map((company, index) => (
              <div key={company.name} className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-4xl bg-muted text-xs font-bold text-muted-foreground">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{company.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{company.applications} apps</span>
                    <span>{company.interviews} interviews</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Building2 className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Interview Stats</h2>
            <p className="text-xs text-muted-foreground mt-1">Performance overview</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-emerald-500/10"><Calendar className="size-4 text-emerald-500" /></div>
                <span className="text-sm">Total interviews</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-blue-500/10"><Clock className="size-4 text-blue-500" /></div>
                <span className="text-sm">Upcoming</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.upcoming}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-violet-500/10"><CheckCircle2 className="size-4 text-violet-500" /></div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-4xl bg-amber-500/10"><Award className="size-4 text-amber-500" /></div>
                <span className="text-sm">Pass rate</span>
              </div>
              <span className="text-lg font-bold">{interviewStats.passRate != null ? `${interviewStats.passRate}%` : "\u2014"}</span>
            </div>
          </div>
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Practice Score</h2>
              <p className="text-xs text-muted-foreground mt-1">MCQ test results</p>
            </div>
            <Link href="/interviews" className="text-xs text-primary hover:underline flex items-center gap-1">Practice <ArrowRight className="size-3" /></Link>
          </div>
          {totalTests > 0 ? (
            <>
              <div className="flex items-center gap-6 mb-6">
                <div><p className="text-3xl font-bold">{avgScore ?? 0}%</p><p className="text-[10px] text-muted-foreground">Average</p></div>
                <div className="h-12 w-px bg-border" />
                <div><p className="text-3xl font-bold">{bestScore ?? 0}%</p><p className="text-[10px] text-muted-foreground">Best</p></div>
              </div>
              {recentScores.length > 0 && <McqScoreChart data={recentScores} />}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3"><Sparkles className="size-6 text-muted-foreground/30" /></div>
              <p className="text-xs text-muted-foreground mb-3">No practice tests yet</p>
              <Link href="/interviews" className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1.5" })}>Start practicing <ArrowRight className="size-3" /></Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold">Upcoming Interviews</h2>
              <p className="text-xs text-muted-foreground mt-1">Next scheduled</p>
            </div>
            <Link href="/interviews" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="size-3" /></Link>
          </div>
          {upcomingInterviews.length > 0 ? (
            <div className="space-y-3">
              {upcomingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-center gap-4 rounded-4xl border border-border p-4 transition-all hover:shadow-md hover:border-primary/20">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-4xl bg-emerald-500/10"><Calendar className="size-5 text-emerald-500" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{interview.job.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{interview.job.company}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-4xl bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{interview.type}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(interview.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3"><Calendar className="size-6 text-muted-foreground/30" /></div>
              <p className="text-sm text-muted-foreground">No upcoming interviews</p>
            </div>
          )}
        </div>
        <div className="rounded-4xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="font-heading text-lg font-semibold">Recent Activity</h2>
            <p className="text-xs text-muted-foreground mt-1">Latest updates</p>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.slice(0, 6).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="relative mt-1"><div className="size-2 rounded-full bg-primary" /><div className="absolute left-1/2 top-2 -translate-x-1/2 h-6 w-px bg-border" /></div>
                  <div className="min-w-0 flex-1 pb-4">
                    <p className="text-sm">{activity.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(activity.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      {activity.status && <><span>&bull;</span><span className="capitalize">{statusLabels[activity.status] ?? activity.status}</span></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-muted/50 mb-3"><Activity className="size-6 text-muted-foreground/30" /></div>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-4xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/jobs" className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30">
            <div className="flex size-10 items-center justify-center rounded-4xl bg-blue-500/10"><Briefcase className="size-5 text-blue-500" /></div>
            All Jobs
          </Link>
          <Link href="/interviews" className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30">
            <div className="flex size-10 items-center justify-center rounded-4xl bg-emerald-500/10"><Calendar className="size-5 text-emerald-500" /></div>
            Interviews
          </Link>
          <Link href="/documents" className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30">
            <div className="flex size-10 items-center justify-center rounded-4xl bg-violet-500/10"><FileText className="size-5 text-violet-500" /></div>
            Documents
          </Link>
          <Link href="/insights" className="flex flex-col items-center gap-2 rounded-4xl border border-border p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/20 hover:bg-muted/30">
            <div className="flex size-10 items-center justify-center rounded-4xl bg-amber-500/10"><BarChart3 className="size-5 text-amber-500" /></div>
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

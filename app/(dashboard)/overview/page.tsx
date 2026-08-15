import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getBoard } from "@/lib/actions/board";
import { buttonVariants } from "@/components/ui/button";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  PipelineStages,
  BreakdownBar,
  ApplicationTrendChart,
  MatchScoreDistributionChart,
  McqScoreChart,
  type PipelineStage,
  type BreakdownItem,
  type MatchScoreBand,
} from "@/components/overview-charts";
import { DEFAULT_LIST_COLORS, matchScoreBand } from "@/lib/types/board";
import {
  Briefcase,
  Calendar,
  Target,
  ArrowRight,
  Plus,
  Camera,
  TrendingUp,
  Activity,
  Send,
} from "lucide-react";

/**
 * Importers write this field free-form, so the same mode arrives as "onsite",
 * "On-site" and "on_site" and used to be counted as three separate categories.
 */
function normalizeWorkLocation(raw: string | null): string {
  if (!raw) return "Unspecified";
  const key = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (key === "remote") return "Remote";
  if (key === "onsite") return "On-site";
  if (key === "hybrid") return "Hybrid";
  return raw;
}

export default async function OverviewPage() {
  const { supabase, userId } = await getUser();
  const { lists: boardLists } = await getBoard();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, title, list_id, match_score, source, employment_type, work_location,
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

  // Pipeline. Counted off board_lists, not jobs.status: the trigger behind that
  // column only ever stores 'saved' or 'preparing' (schema.sql), so it reported
  // every applied job as still preparing. The board is the real stage, and
  // reading it means a list the user adds shows up here in its own sort order.
  const jobsPerList: Record<string, number> = {};
  let unsortedJobs = 0;
  for (const job of allJobs) {
    const listId = job.list_id as string | null;
    if (listId) jobsPerList[listId] = (jobsPerList[listId] || 0) + 1;
    else unsortedJobs++;
  }

  const pipelineStages: PipelineStage[] = boardLists.map((list) => ({
    id: list.id,
    name: list.name,
    count: jobsPerList[list.id] ?? 0,
    color: list.color ?? DEFAULT_LIST_COLORS[list.kind],
  }));
  if (unsortedJobs > 0) {
    pipelineStages.push({
      id: "unsorted",
      name: "Unsorted",
      count: unsortedJobs,
      color: DEFAULT_LIST_COLORS.custom,
    });
  }

  // A job counts as applied once it sits at or past the Applied list. Using the
  // list's own sort_order keeps custom stages (a "Screening" list between
  // Applied and Interview) on the right side of the line automatically.
  const appliedOrder = boardLists.find((l) => l.kind === "applied")?.sort_order;
  const countLists = (match: (list: (typeof boardLists)[number]) => boolean) =>
    boardLists.filter(match).reduce((sum, l) => sum + (jobsPerList[l.id] ?? 0), 0);

  const reachedApplied =
    appliedOrder != null ? countLists((l) => l.sort_order >= appliedOrder) : 0;
  const movedPastApplied =
    appliedOrder != null ? countLists((l) => l.sort_order > appliedOrder) : 0;
  const offerCount = countLists((l) => l.kind === "offer" || l.kind === "accepted");

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

  // Match score distribution — same Strong/Fair/Weak bands as matchScoreBand()
  // (lib/types/board.ts), so this never disagrees with the board card or
  // /insights, which share the same 80/50 thresholds.
  const scoreBandCounts: Record<string, number> = { Strong: 0, Fair: 0, Weak: 0 };
  for (const job of allJobs) {
    if (job.match_score == null) continue;
    const band = matchScoreBand(Number(job.match_score));
    if (band) scoreBandCounts[band.label] = (scoreBandCounts[band.label] ?? 0) + 1;
  }
  const matchScoreDistribution: MatchScoreBand[] = ["Strong", "Fair", "Weak"].map((label) => ({
    label,
    count: scoreBandCounts[label] ?? 0,
  }));

  // Employment type breakdown
  const employmentTypeMap: Record<string, number> = {};
  for (const job of allJobs) {
    const t = (job.employment_type as string) || "Full-time";
    employmentTypeMap[t] = (employmentTypeMap[t] || 0) + 1;
  }
  const employmentTypeBreakdown: BreakdownItem[] = Object.entries(employmentTypeMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Work location breakdown
  const workLocationMap: Record<string, number> = {};
  for (const job of allJobs) {
    const l = normalizeWorkLocation(job.work_location as string | null);
    workLocationMap[l] = (workLocationMap[l] || 0) + 1;
  }
  const workLocationBreakdown: BreakdownItem[] = Object.entries(workLocationMap)
    .map(([label, count]) => ({ label, count }))
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

  const offerRate =
    (totalJobs ?? 0) > 0 ? Math.round((offerCount / (totalJobs ?? 1)) * 100) : null;
  const responseRate =
    reachedApplied > 0 ? Math.round((movedPastApplied / reachedApplied) * 100) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{greeting}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Search overview, pipeline progress, and upcoming milestones.
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
            lists={boardLists}
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

      {/* Quick Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickStat icon={Briefcase} label="Total Jobs" value={totalJobs ?? 0} tone="primary" />
        <QuickStat icon={Send} label="Applied" value={totalApplications ?? 0} tone="chart-2" />
        <QuickStat icon={Calendar} label="Interviews" value={totalInterviews ?? 0} tone="chart-3" />
        <QuickStat icon={Target} label="Avg Match" value={averageMatchScore != null ? `${averageMatchScore}%` : "—"} tone="chart-4" />
        <QuickStat icon={TrendingUp} label="Offer Rate" value={offerRate != null ? `${offerRate}%` : "—"} tone="success" />
        <QuickStat icon={Activity} label="Response Rate" value={responseRate != null ? `${responseRate}%` : "—"} tone="chart-5" />
      </div>

      {/* Primary Zone: Connected Pipeline Stepper */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-base font-semibold sm:text-lg">Pipeline</h2>
            <p className="text-xs text-muted-foreground">Current distribution across hiring stages</p>
          </div>
          <Link href="/jobs" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
            View board <ArrowRight className="size-3" />
          </Link>
        </div>
        {allJobs.length > 0 ? (
          <PipelineStages stages={pipelineStages} total={allJobs.length} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Briefcase className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No jobs in pipeline yet</p>
          </div>
        )}
      </div>

      {/* Operational Split Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Velocity & Schedule */}
        <div className="space-y-6 lg:col-span-7">
          {/* Trend Chart */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="font-heading text-base font-semibold sm:text-lg">Activity Trend</h2>
              <p className="text-xs text-muted-foreground">Applications and interviews in last 30 days</p>
            </div>
            <ApplicationTrendChart data={applicationTrend} />
            <div className="mt-3 flex items-center justify-center gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
                <span className="text-muted-foreground">Applications</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} />
                <span className="text-muted-foreground">Interviews</span>
              </div>
            </div>
          </div>

          {/* Upcoming Interviews */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading text-base font-semibold sm:text-lg">Upcoming Interviews</h2>
                <p className="text-xs text-muted-foreground">Next scheduled meetings and technical rounds</p>
              </div>
              <Link href="/interviews" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                Schedule <ArrowRight className="size-3" />
              </Link>
            </div>
            {upcomingInterviews.length > 0 ? (
              <div className="space-y-2.5">
                {upcomingInterviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60 hover:border-primary/30"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-surface">
                      <Calendar className="size-4 text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{interview.job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{interview.job.company}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-success-surface border border-success-border px-2 py-0.5 text-[10px] font-medium text-success">
                        {interview.type}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {new Date(interview.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted/50 mb-2">
                  <Calendar className="size-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">No upcoming interviews scheduled</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quality & Distributions */}
        <div className="space-y-6 lg:col-span-5">
          {/* Match Quality */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-2">
              <h2 className="font-heading text-base font-semibold sm:text-lg">Match Quality</h2>
              <p className="text-xs text-muted-foreground">Distribution across scoring tiers</p>
            </div>
            <MatchScoreDistributionChart data={matchScoreDistribution} />
          </div>

          {/* Consolidated Demographic Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="font-heading text-sm font-semibold mb-2">Work location</h3>
              <BreakdownBar items={workLocationBreakdown} total={allJobs.length} />
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="font-heading text-sm font-semibold mb-2">Employment type</h3>
              <BreakdownBar items={employmentTypeBreakdown} total={allJobs.length} />
            </div>
          </div>

          {/* Practice Tests (conditional) */}
          {totalTests > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-heading text-sm font-semibold">Practice Tests</h3>
                  <p className="text-[11px] text-muted-foreground">Recent technical assessment scores</p>
                </div>
                <Link href="/interviews" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  Practice <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="flex items-center gap-6 mb-3">
                <div>
                  <p className="text-xl font-bold tabular-nums">{avgScore ?? 0}%</p>
                  <p className="text-[10px] text-muted-foreground">Average</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-xl font-bold tabular-nums">
                    {Math.round(Math.max(...(mcqResults ?? []).map((r) => r.score / r.total)) * 100)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Best</p>
                </div>
              </div>
              <McqScoreChart data={recentScores} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const quickStatTone = {
  primary: "var(--primary)",
  success: "var(--success)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  "chart-5": "var(--chart-5)",
} as const;

function QuickStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  tone: keyof typeof quickStatTone;
}) {
  const c = quickStatTone[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/30">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in oklch, ${c}, transparent 90%)` }}
      >
        <Icon className="size-4" style={{ color: c }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums tracking-tight leading-tight">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

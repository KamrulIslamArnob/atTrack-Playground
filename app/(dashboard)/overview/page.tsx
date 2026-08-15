import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getBoard } from "@/lib/actions/board";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddJobDialog } from "@/components/add-job-dialog";
import {
  PipelineStages,
  BreakdownBar,
  ApplicationTrendChart,
  McqScoreChart,
  type PipelineStage,
  type BreakdownItem,
} from "@/components/overview-charts";
import { DEFAULT_LIST_COLORS } from "@/lib/types/board";
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
                lists={boardLists}
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
        {allJobs.length > 0 ? (
          <PipelineStages stages={pipelineStages} total={allJobs.length} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Briefcase className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No jobs yet</p>
          </div>
        )}
      </div>

      {/* Row 2: Breakdowns — two small splits sharing one card row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Work location</h3>
          <BreakdownBar items={workLocationBreakdown} total={allJobs.length} />
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-heading text-sm font-semibold mb-3">Employment type</h3>
          <BreakdownBar items={employmentTypeBreakdown} total={allJobs.length} />
        </div>
      </div>

      {/* Row 3: Trend + upcoming interviews */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-6">
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

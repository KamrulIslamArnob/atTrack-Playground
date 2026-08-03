import { getInsights } from "@/lib/actions/insights";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Briefcase,
  FileText,
  Calendar,
  Target,
  TrendingUp,
  Building2,
  Globe,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

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
  saved: "bg-muted",
  interested: "bg-blue-500",
  preparing: "bg-amber-500",
  applied: "bg-violet-500",
  interview: "bg-emerald-500",
  offer: "bg-emerald-600",
  accepted: "bg-emerald-600",
  rejected: "bg-red-500",
  withdrawn: "bg-muted",
};

const statusTextColors: Record<string, string> = {
  saved: "text-muted-foreground",
  interested: "text-blue-600 dark:text-blue-400",
  preparing: "text-amber-600 dark:text-amber-400",
  applied: "text-violet-600 dark:text-violet-400",
  interview: "text-emerald-600 dark:text-emerald-400",
  offer: "text-emerald-600 dark:text-emerald-400",
  accepted: "text-emerald-600 dark:text-emerald-400",
  rejected: "text-red-600 dark:text-red-400",
  withdrawn: "text-muted-foreground",
};

export default async function InsightsPage() {
  const insights = await getInsights();

  const maxStatusCount = Math.max(...Object.values(insights.statusBreakdown), 1);
  const maxSourceCount = Math.max(...Object.values(insights.sourceBreakdown), 1);

  const totalStatusJobs = Object.values(insights.statusBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="px-6">
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Analytics and patterns from your job search.
          </p>
        </div>
      </div>

      <Breadcrumbs />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Total Jobs"
          value={insights.totalJobs}
          color="bg-blue-500"
        />
        <StatCard
          icon={FileText}
          label="Applications"
          value={insights.totalApplications}
          color="bg-violet-500"
        />
        <StatCard
          icon={Calendar}
          label="Interviews"
          value={insights.totalInterviews}
          color="bg-emerald-500"
        />
        <StatCard
          icon={Target}
          label="Avg Match"
          value={insights.averageMatchScore != null ? `${insights.averageMatchScore}%` : "N/A"}
          color="bg-amber-500"
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Application funnel - takes 2 cols */}
        <div className="lg:col-span-2 rounded-4xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Application Pipeline</h2>
            <span className="text-xs text-muted-foreground">{totalStatusJobs} total</span>
          </div>
          <div className="mt-6 space-y-4">
            {Object.entries(insights.statusBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const percentage = totalStatusJobs > 0 ? Math.round((count / totalStatusJobs) * 100) : 0;
                return (
                  <div key={status} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`size-2 rounded-full ${statusColors[status] ?? "bg-muted"}`} />
                        <span className="text-sm font-medium">
                          {statusLabels[status] ?? status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{count}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${statusColors[status] ?? "bg-muted"} transition-all duration-500`}
                        style={{ width: `${(count / maxStatusCount) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(insights.statusBreakdown).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No applications yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Match score ring */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">Match Quality</h2>
          <div className="mt-6 flex flex-col items-center">
            <div className="relative size-32">
              <svg className="size-32 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/50"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(insights.averageMatchScore ?? 0) * 3.267} 326.7`}
                  className="text-primary transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">
                  {insights.averageMatchScore ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">avg score</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 w-full">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-lg font-semibold">{insights.matchScoreDistribution.high}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">High (80+)</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <div className="size-2 rounded-full bg-amber-500" />
                  <span className="text-lg font-semibold">{insights.matchScoreDistribution.medium}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Medium</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <div className="size-2 rounded-full bg-red-500" />
                  <span className="text-lg font-semibold">{insights.matchScoreDistribution.low}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Low (&lt;50)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sources */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            Sources
          </h2>
          <div className="mt-4 space-y-3">
            {Object.entries(insights.sourceBreakdown)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([source, count]) => (
                <div key={source} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">
                    {source}
                  </span>
                  <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(count / maxSourceCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right">{count}</span>
                </div>
              ))}
            {Object.keys(insights.sourceBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Work location */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            Work Location
          </h2>
          <div className="mt-4 space-y-3">
            {Object.entries(insights.workLocationBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([location, count]) => {
                const percentage = insights.totalJobs > 0 ? Math.round((count / insights.totalJobs) * 100) : 0;
                return (
                  <div key={location} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0 capitalize">
                      {location}
                    </span>
                    <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-10 text-right">{percentage}%</span>
                  </div>
                );
              })}
            {Object.keys(insights.workLocationBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Practice performance */}
        <div className="rounded-4xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            Practice
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-4xl bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tests Taken</span>
                <span className="text-xl font-bold">{insights.mcqStats.totalTests}</span>
              </div>
            </div>
            <div className="rounded-4xl bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Average</span>
                <span className={`text-xl font-bold ${
                  insights.mcqStats.averageScore != null && insights.mcqStats.averageScore >= 70
                    ? "text-emerald-600 dark:text-emerald-400"
                    : insights.mcqStats.averageScore != null
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                }`}>
                  {insights.mcqStats.averageScore != null ? `${insights.mcqStats.averageScore}%` : "—"}
                </span>
              </div>
            </div>
            <div className="rounded-4xl bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Best Score</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {insights.mcqStats.bestScore != null ? `${insights.mcqStats.bestScore}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employment types */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">Employment Types</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(insights.employmentTypeBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div
                key={type}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm"
              >
                <span>{type}</span>
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {count}
                </span>
              </div>
            ))}
          {Object.keys(insights.employmentTypeBreakdown).length === 0 && (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-4xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className={`flex size-11 items-center justify-center rounded-4xl ${color}`}>
          <Icon className="size-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

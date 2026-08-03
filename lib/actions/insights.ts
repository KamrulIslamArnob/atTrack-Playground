"use server";

import { getUser } from "@/lib/auth";

export interface InsightsData {
  totalJobs: number;
  totalApplications: number;
  totalInterviews: number;
  totalDocuments: number;
  statusBreakdown: Record<string, number>;
  matchScoreDistribution: {
    high: number; // 80+
    medium: number; // 50-79
    low: number; // <50
    none: number; // no score
  };
  averageMatchScore: number | null;
  sourceBreakdown: Record<string, number>;
  employmentTypeBreakdown: Record<string, number>;
  workLocationBreakdown: Record<string, number>;
  mcqStats: {
    totalTests: number;
    averageScore: number | null;
    bestScore: number | null;
  };
  recentActivity: {
    date: string;
    count: number;
  }[];
}

export async function getInsights(): Promise<InsightsData> {
  const { supabase, userId } = await getUser();

  // Fetch all jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, match_score, source, employment_type, work_location, created_at")
    .eq("user_id", userId);

  // Fetch applications count
  const { count: totalApplications } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Fetch interviews count
  const { count: totalInterviews } = await supabase
    .from("interviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Fetch documents count
  const { count: totalDocuments } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // Fetch MCQ results
  const { data: mcqResults } = await supabase
    .from("mcq_results")
    .select("score, total")
    .eq("user_id", userId);

  const allJobs = jobs ?? [];

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const job of allJobs) {
    statusBreakdown[job.status] = (statusBreakdown[job.status] || 0) + 1;
  }

  // Match score distribution
  let highMatches = 0;
  let mediumMatches = 0;
  let lowMatches = 0;
  let noScore = 0;
  let totalScore = 0;
  let scoredCount = 0;

  for (const job of allJobs) {
    if (job.match_score == null) {
      noScore++;
    } else {
      const score = Number(job.match_score);
      totalScore += score;
      scoredCount++;
      if (score >= 80) highMatches++;
      else if (score >= 50) mediumMatches++;
      else lowMatches++;
    }
  }

  // Source breakdown
  const sourceBreakdown: Record<string, number> = {};
  for (const job of allJobs) {
    const source = job.source || "Unknown";
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  }

  // Employment type breakdown
  const employmentTypeBreakdown: Record<string, number> = {};
  for (const job of allJobs) {
    const type = job.employment_type || "Unknown";
    employmentTypeBreakdown[type] = (employmentTypeBreakdown[type] || 0) + 1;
  }

  // Work location breakdown
  const workLocationBreakdown: Record<string, number> = {};
  for (const job of allJobs) {
    const loc = job.work_location || "Unknown";
    workLocationBreakdown[loc] = (workLocationBreakdown[loc] || 0) + 1;
  }

  // MCQ stats
  const totalTests = mcqResults?.length ?? 0;
  const avgScore = totalTests > 0
    ? Math.round(mcqResults!.reduce((sum, r) => sum + (r.score / r.total), 0) / totalTests * 100)
    : null;
  const bestScore = totalTests > 0
    ? Math.round(Math.max(...mcqResults!.map(r => r.score / r.total)) * 100)
    : null;

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentJobs = allJobs.filter(
    (j) => new Date(j.created_at) >= thirtyDaysAgo
  );

  const activityByDate: Record<string, number> = {};
  for (const job of recentJobs) {
    const date = new Date(job.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    activityByDate[date] = (activityByDate[date] || 0) + 1;
  }

  const recentActivity = Object.entries(activityByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    totalJobs: allJobs.length,
    totalApplications: totalApplications ?? 0,
    totalInterviews: totalInterviews ?? 0,
    totalDocuments: totalDocuments ?? 0,
    statusBreakdown,
    matchScoreDistribution: {
      high: highMatches,
      medium: mediumMatches,
      low: lowMatches,
      none: noScore,
    },
    averageMatchScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : null,
    sourceBreakdown,
    employmentTypeBreakdown,
    workLocationBreakdown,
    mcqStats: {
      totalTests,
      averageScore: avgScore,
      bestScore,
    },
    recentActivity,
  };
}

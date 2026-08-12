"use server";

import { getUser } from "@/lib/auth";

export interface InsightsData {
  totalJobs: number;
  totalApplications: number;
  totalInterviews: number;
  totalDocuments: number;
  jobPipelineBreakdown: Record<string, number>;
  applicationStatusBreakdown: Record<string, number>;
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

import { getDb } from "@/lib/db/sqlite";

export async function getInsights(): Promise<InsightsData> {
  const { userId } = await getUser();
  const db = getDb();

  // Execute parallelized SQL engine aggregations
  const [
    totalJobsRow,
    totalAppsRow,
    totalInterviewsRow,
    totalDocsRow,
    pipelineRows,
    appStatusRows,
    matchScoreStats,
    sourceRows,
    employmentRows,
    workLocationRows,
    mcqStatsRow,
    recentActivityRows,
  ] = await Promise.all([
    Promise.resolve(db.prepare(`SELECT count(*) as c FROM jobs WHERE user_id = ?`).get(userId) as { c: number }),
    Promise.resolve(db.prepare(`SELECT count(*) as c FROM applications WHERE user_id = ?`).get(userId) as { c: number }),
    Promise.resolve(db.prepare(`SELECT count(*) as c FROM interviews WHERE user_id = ?`).get(userId) as { c: number }),
    Promise.resolve(db.prepare(`SELECT count(*) as c FROM documents WHERE user_id = ?`).get(userId) as { c: number }),
    Promise.resolve(db.prepare(`SELECT status, count(*) as count FROM jobs WHERE user_id = ? GROUP BY status`).all(userId) as Array<{ status: string; count: number }>),
    Promise.resolve(db.prepare(`SELECT status, count(*) as count FROM applications WHERE user_id = ? GROUP BY status`).all(userId) as Array<{ status: string; count: number }>),
    Promise.resolve(db.prepare(`
      SELECT 
        SUM(CASE WHEN match_score >= 80 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN match_score >= 50 AND match_score < 80 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN match_score < 50 THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN match_score IS NULL THEN 1 ELSE 0 END) as none,
        AVG(match_score) as avg_score
      FROM jobs WHERE user_id = ?
    `).get(userId) as { high: number; medium: number; low: number; none: number; avg_score: number | null }),
    Promise.resolve(db.prepare(`SELECT COALESCE(source, 'Unknown') as source, count(*) as count FROM jobs WHERE user_id = ? GROUP BY source`).all(userId) as Array<{ source: string; count: number }>),
    Promise.resolve(db.prepare(`SELECT COALESCE(employment_type, 'Unknown') as type, count(*) as count FROM jobs WHERE user_id = ? GROUP BY employment_type`).all(userId) as Array<{ type: string; count: number }>),
    Promise.resolve(db.prepare(`SELECT COALESCE(work_location, 'Unknown') as loc, count(*) as count FROM jobs WHERE user_id = ? GROUP BY work_location`).all(userId) as Array<{ loc: string; count: number }>),
    Promise.resolve(db.prepare(`
      SELECT count(*) as totalTests, AVG(score * 1.0 / total) as avgScore, MAX(score * 1.0 / total) as bestScore 
      FROM mcq_results WHERE user_id = ?
    `).get(userId) as { totalTests: number; avgScore: number | null; bestScore: number | null }),
    Promise.resolve(db.prepare(`
      SELECT created_at FROM jobs 
      WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
    `).all(userId) as Array<{ created_at: string }>),
  ]);

  const jobPipelineBreakdown: Record<string, number> = {};
  for (const r of pipelineRows) jobPipelineBreakdown[r.status] = r.count;

  const applicationStatusBreakdown: Record<string, number> = {};
  for (const r of appStatusRows) applicationStatusBreakdown[r.status] = r.count;

  const sourceBreakdown: Record<string, number> = {};
  for (const r of sourceRows) sourceBreakdown[r.source] = r.count;

  const employmentTypeBreakdown: Record<string, number> = {};
  for (const r of employmentRows) employmentTypeBreakdown[r.type] = r.count;

  const workLocationBreakdown: Record<string, number> = {};
  for (const r of workLocationRows) workLocationBreakdown[r.loc] = r.count;

  const activityByDate: Record<string, number> = {};
  for (const job of recentActivityRows) {
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
    totalJobs: totalJobsRow?.c ?? 0,
    totalApplications: totalAppsRow?.c ?? 0,
    totalInterviews: totalInterviewsRow?.c ?? 0,
    totalDocuments: totalDocsRow?.c ?? 0,
    jobPipelineBreakdown,
    applicationStatusBreakdown,
    matchScoreDistribution: {
      high: matchScoreStats?.high ?? 0,
      medium: matchScoreStats?.medium ?? 0,
      low: matchScoreStats?.low ?? 0,
      none: matchScoreStats?.none ?? 0,
    },
    averageMatchScore: matchScoreStats?.avg_score != null ? Math.round(matchScoreStats.avg_score) : null,
    sourceBreakdown,
    employmentTypeBreakdown,
    workLocationBreakdown,
    mcqStats: {
      totalTests: mcqStatsRow?.totalTests ?? 0,
      averageScore: mcqStatsRow?.avgScore != null ? Math.round(mcqStatsRow.avgScore * 100) : null,
      bestScore: mcqStatsRow?.bestScore != null ? Math.round(mcqStatsRow.bestScore * 100) : null,
    },
    recentActivity,
  };
}

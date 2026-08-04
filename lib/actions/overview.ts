"use server";

import { getUser } from "@/lib/auth";

export interface OverviewData {
  // Summary stats
  totalJobs: number;
  totalApplications: number;
  totalInterviews: number;
  totalDocuments: number;
  averageMatchScore: number | null;
  offerRate: number | null;
  responseRate: number | null;

  // Pipeline data
  pipeline: {
    saved: number;
    interested: number;
    preparing: number;
    applied: number;
    interview: number;
    offer: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
  };

  // Application trend (last 30 days)
  applicationTrend: {
    date: string;
    applications: number;
    interviews: number;
  }[];

  // Match score distribution
  matchScoreDistribution: {
    range: string;
    count: number;
    fill: string;
  }[];

  // Source breakdown
  sourceBreakdown: {
    source: string;
    count: number;
    fill: string;
  }[];

  // Employment type breakdown
  employmentTypeBreakdown: {
    type: string;
    count: number;
    fill: string;
  }[];

  // Work location breakdown
  workLocationBreakdown: {
    location: string;
    count: number;
    fill: string;
  }[];

  // Top companies
  topCompanies: {
    name: string;
    applications: number;
    interviews: number;
  }[];

  // Upcoming interviews
  upcomingInterviews: {
    id: string;
    scheduled_at: string;
    type: string;
    status: string;
    job: {
      title: string;
      company: string;
    };
  }[];

  // Recent activity
  recentActivity: {
    id: string;
    type: string;
    title: string;
    timestamp: string;
    status?: string;
  }[];

  // Interview stats
  interviewStats: {
    total: number;
    upcoming: number;
    completed: number;
    passRate: number | null;
  };

  // MCQ stats
  mcqStats: {
    totalTests: number;
    averageScore: number | null;
    bestScore: number | null;
    recentScores: {
      date: string;
      score: number;
    }[];
  };

  // Time analytics
  timeAnalytics: {
    averageTimeToApply: number | null; // days
    averageTimeToInterview: number | null; // days
    longestPending: {
      title: string;
      company: string;
      days: number;
    } | null;
  };
}

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

export async function getOverviewData(): Promise<OverviewData> {
  const { supabase, userId } = await getUser();

  // Fetch all jobs with related data
  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, title, status, match_score, source, employment_type, work_location,
      created_at, updated_at, application_email,
      company:companies(name),
      applications(id, status, applied_at, created_at),
      interviews(id, scheduled_at, type, status)
    `)
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
    .select("score, total, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const allJobs = jobs ?? [];
  const totalJobs = allJobs.length;

  // Pipeline breakdown
  const pipeline = {
    saved: 0,
    interested: 0,
    preparing: 0,
    applied: 0,
    interview: 0,
    offer: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
  };

  for (const job of allJobs) {
    const status = job.status as keyof typeof pipeline;
    if (status in pipeline) {
      pipeline[status]++;
    }
  }

  // Match score calculation
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
    const source = (job.source as string) || "Other";
    sourceMap[source] = (sourceMap[source] || 0) + 1;
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
    const type = (job.employment_type as string) || "Full-time";
    employmentTypeMap[type] = (employmentTypeMap[type] || 0) + 1;
  }
  const employmentTypeBreakdown = Object.entries(employmentTypeMap)
    .map(([type, count]) => ({
      type,
      count,
      fill: employmentTypeColors[type] || "#6B7280",
    }))
    .sort((a, b) => b.count - a.count);

  // Work location breakdown
  const workLocationMap: Record<string, number> = {};
  for (const job of allJobs) {
    const loc = (job.work_location as string) || "Unspecified";
    workLocationMap[loc] = (workLocationMap[loc] || 0) + 1;
  }
  const workLocationBreakdown = Object.entries(workLocationMap)
    .map(([location, count]) => ({
      location,
      count,
      fill: workLocationColors[location] || "#6B7280",
    }))
    .sort((a, b) => b.count - a.count);

  // Top companies
  const companyMap: Record<string, { applications: number; interviews: number }> = {};
  for (const job of allJobs) {
    const companyRaw = job.company;
    const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null;
    const companyName = company?.name ?? "Unknown";
    if (!companyMap[companyName]) {
      companyMap[companyName] = { applications: 0, interviews: 0 };
    }
    const apps = Array.isArray(job.applications) ? job.applications : [];
    companyMap[companyName].applications += apps.length;
    const ints = Array.isArray(job.interviews) ? job.interviews : [];
    companyMap[companyName].interviews += ints.length;
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
    const apps = Array.isArray(job.applications) ? job.applications : [];
    for (const app of apps) {
      const appDate = new Date((app as { created_at: string }).created_at);
      if (appDate >= thirtyDaysAgo) {
        const dateKey = appDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!trendMap[dateKey]) trendMap[dateKey] = { applications: 0, interviews: 0 };
        trendMap[dateKey].applications++;
      }
    }
    const ints = Array.isArray(job.interviews) ? job.interviews : [];
    for (const interview of ints) {
      const intDate = new Date((interview as { scheduled_at: string }).scheduled_at);
      if (intDate >= thirtyDaysAgo) {
        const dateKey = intDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!trendMap[dateKey]) trendMap[dateKey] = { applications: 0, interviews: 0 };
        trendMap[dateKey].interviews++;
      }
    }
  }

  const applicationTrend = Object.entries(trendMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Upcoming interviews
  const upcomingInterviewsRaw = allJobs
    .flatMap((job) => {
      const ints = Array.isArray(job.interviews) ? job.interviews : [];
      const companyRaw = job.company;
      const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null;
      return ints
        .filter((i: { scheduled_at: string | null }) => i.scheduled_at && new Date(i.scheduled_at) >= new Date())
        .map((i: { id: string; scheduled_at: string; type: string; status: string }) => ({
          id: i.id,
          scheduled_at: i.scheduled_at,
          type: i.type,
          status: i.status,
          job: {
            title: job.title as string,
            company: company?.name ?? "Unknown",
          },
        }));
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  // Recent activity
  const recentActivity: OverviewData["recentActivity"] = [];
  for (const job of allJobs.slice(0, 10)) {
    const companyRaw = job.company;
    const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null;
    recentActivity.push({
      id: job.id as string,
      type: "job_added",
      title: `Added ${(job.title as string) ?? "Untitled"} at ${company?.name ?? "Unknown"}`,
      timestamp: job.created_at as string,
      status: job.status as string,
    });

    const apps = Array.isArray(job.applications) ? job.applications : [];
    for (const app of apps) {
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
  const allInterviews = allJobs.flatMap((job) => {
    const ints = Array.isArray(job.interviews) ? job.interviews : [];
    return ints;
  });
  const upcomingInterviewsCount = allInterviews.filter(
    (i: { scheduled_at: string | null }) => i.scheduled_at && new Date(i.scheduled_at) >= new Date()
  ).length;
  const completedInterviews = allInterviews.filter(
    (i: { status: string }) => i.status === "completed"
  ).length;
  const passedInterviews = allInterviews.filter(
    (i: { status: string }) => i.status === "passed"
  ).length;
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
      ? Math.round(
          (mcqResults ?? []).reduce((sum, r) => sum + (r.score / r.total), 0) / totalTests * 100
        )
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
      const appDate = new Date((apps[0] as { applied_at: string }).applied_at || (apps[0] as { created_at: string }).created_at);
      const daysToApply = Math.round((appDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      totalDaysToApply += daysToApply;
      applyCount++;
    } else {
      // Pending jobs without application
      const daysSinceCreated = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCreated > longestPendingDays) {
        longestPendingDays = daysSinceCreated;
        const companyRaw = job.company;
        const company = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null;
        longestPendingJob = {
          title: job.title as string,
          company: company?.name ?? "Unknown",
          days: daysSinceCreated,
        };
      }
    }

    const ints = Array.isArray(job.interviews) ? job.interviews : [];
    if (ints.length > 0 && apps.length > 0) {
      const intDate = new Date((ints[0] as { scheduled_at: string }).scheduled_at);
      const appDate = new Date((apps[0] as { applied_at: string }).applied_at || (apps[0] as { created_at: string }).created_at);
      const daysToInterview = Math.round((intDate.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToInterview > 0) {
        totalDaysToInterview += daysToInterview;
        interviewCount++;
      }
    }
  }

  const timeAnalytics = {
    averageTimeToApply: applyCount > 0 ? Math.round(totalDaysToApply / applyCount) : null,
    averageTimeToInterview: interviewCount > 0 ? Math.round(totalDaysToInterview / interviewCount) : null,
    longestPending: longestPendingJob,
  };

  // Offer rate
  const offerRate = totalJobs > 0 ? Math.round(((pipeline.offer + pipeline.accepted) / totalJobs) * 100) : null;

  // Response rate (applied + interview + offer + accepted + rejected) / total applied
  const totalApplied = pipeline.applied + pipeline.interview + pipeline.offer + pipeline.accepted + pipeline.rejected;
  const responded = pipeline.interview + pipeline.offer + pipeline.accepted + pipeline.rejected;
  const responseRate = totalApplied > 0 ? Math.round((responded / totalApplied) * 100) : null;

  return {
    totalJobs,
    totalApplications: totalApplications ?? 0,
    totalInterviews: totalInterviews ?? 0,
    totalDocuments: totalDocuments ?? 0,
    averageMatchScore,
    offerRate,
    responseRate,
    pipeline,
    applicationTrend,
    matchScoreDistribution,
    sourceBreakdown,
    employmentTypeBreakdown,
    workLocationBreakdown,
    topCompanies,
    upcomingInterviews: upcomingInterviewsRaw,
    recentActivity: recentActivity.slice(0, 8),
    interviewStats,
    mcqStats: {
      totalTests,
      averageScore: avgScore,
      bestScore,
      recentScores,
    },
    timeAnalytics,
  };
}

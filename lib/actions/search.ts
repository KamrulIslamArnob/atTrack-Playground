"use server";

import { getUser } from "@/lib/auth";

export interface SearchResult {
  type: "job" | "application" | "interview" | "document" | "page";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

const PAGE_RESULTS: { title: string; href: string; keywords: string }[] = [
  { title: "Overview", href: "/overview", keywords: "dashboard home summary stats" },
  { title: "Jobs", href: "/jobs", keywords: "job listings saved interested preparing" },
  { title: "Applications", href: "/applications", keywords: "application drafts submitted sent" },
  { title: "Interviews", href: "/interviews", keywords: "interview schedule upcoming completed" },
  { title: "Documents", href: "/documents", keywords: "resume cv cover letter file upload" },
  { title: "Settings", href: "/settings", keywords: "account profile smtp email preferences" },
];

const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  draft: "Draft",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const { supabase, userId } = await getUser();
  const q = query.trim();
  const like = `%${q}%`;
  const limit = 5;
  const results: SearchResult[] = [];

  // Search pages
  for (const page of PAGE_RESULTS) {
    if (
      page.title.toLowerCase().includes(q.toLowerCase()) ||
      page.keywords.toLowerCase().includes(q.toLowerCase())
    ) {
      results.push({
        type: "page",
        id: page.href,
        title: page.title,
        subtitle: "Navigation",
        href: page.href,
        icon: "page",
      });
    }
  }

  // Search jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, location, match_score, company:companies(name)")
    .eq("user_id", userId)
    .or(`title.ilike.${like},location.ilike.${like}`)
    .limit(limit);

  for (const job of jobs ?? []) {
    const company = Array.isArray(job.company) ? job.company[0] : job.company;
    results.push({
      type: "job",
      id: job.id,
      title: job.title,
      subtitle: [company?.name, job.location, STATUS_LABELS[job.status] ?? job.status]
        .filter(Boolean)
        .join(" · "),
      href: `/jobs`,
      icon: "job",
    });
  }

  // Search applications (via joined job + company)
  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, resume_name, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userId)
    .limit(limit);

  for (const app of applications ?? []) {
    const job = Array.isArray(app.job) ? app.job[0] : app.job;
    const company = job ? (Array.isArray(job.company) ? job.company[0] : job.company) : null;
    const searchable = [job?.title, company?.name, app.resume_name, STATUS_LABELS[app.status] ?? app.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (searchable.includes(q.toLowerCase())) {
      results.push({
        type: "application",
        id: app.id,
        title: job?.title ?? "Untitled Application",
        subtitle: [company?.name, STATUS_LABELS[app.status] ?? app.status, app.resume_name]
          .filter(Boolean)
          .join(" · "),
        href: `/applications`,
        icon: "application",
      });
    }
  }

  // Search interviews (via joined job + company)
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, type, status, interviewer_name, scheduled_at, location, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userId)
    .limit(limit * 2);

  for (const iv of interviews ?? []) {
    const job = Array.isArray(iv.job) ? iv.job[0] : iv.job;
    const company = job ? (Array.isArray(job.company) ? job.company[0] : job.company) : null;
    const searchable = [
      job?.title,
      company?.name,
      iv.interviewer_name,
      iv.type,
      iv.location,
      STATUS_LABELS[iv.status] ?? iv.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (searchable.includes(q.toLowerCase())) {
      const date = iv.scheduled_at
        ? new Date(iv.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : null;
      results.push({
        type: "interview",
        id: iv.id,
        title: job?.title ?? "Untitled Interview",
        subtitle: [company?.name, iv.interviewer_name, iv.type, date]
          .filter(Boolean)
          .join(" · "),
        href: `/interviews`,
        icon: "interview",
      });
    }
  }

  // Search documents
  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, type, created_at")
    .eq("user_id", userId)
    .or(`name.ilike.${like}`)
    .limit(limit);

  for (const doc of documents ?? []) {
    results.push({
      type: "document",
      id: doc.id,
      title: doc.name,
      subtitle: [doc.type === "resume" ? "Resume" : doc.type === "cover_letter" ? "Cover Letter" : "Document"]
        .filter(Boolean)
        .join(" · "),
      href: `/documents`,
      icon: "document",
    });
  }

  return results;
}

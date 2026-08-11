"use server";

import { getUser } from "@/lib/auth";

export interface SearchResult {
  type: "job" | "company" | "contact" | "document" | "application" | "interview" | "page";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

export interface AdminSearchResult {
  type: "user" | "activity" | "ai_usage" | "page";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

const PAGE_RESULTS: { title: string; href: string; keywords: string }[] = [
  { title: "Overview", href: "/overview", keywords: "dashboard home summary stats" },
  { title: "Board", href: "/board", keywords: "kanban pipeline stages drag wishlist columns" },
  { title: "Jobs", href: "/jobs", keywords: "job listings saved interested preparing" },
  { title: "Applications", href: "/applications", keywords: "application drafts submitted sent" },
  { title: "Interviews", href: "/interviews", keywords: "interview schedule upcoming completed" },
  { title: "CRM", href: "/crm", keywords: "contacts companies network hiring managers recruiters alumni" },
  { title: "Documents", href: "/documents", keywords: "resume cv cover letter file upload" },
  { title: "Settings", href: "/settings", keywords: "account profile smtp email preferences" },
  { title: "AI Prompts", href: "/preferences/ai-prompts", keywords: "custom ai system prompts cover letter templates preferences" },
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
  const limit = 6;
  const results: SearchResult[] = [];

  // 1. Pages & Navigation
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

  // 2. Jobs
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, location, tags, company:companies(name)")
    .eq("user_id", userId)
    .or(`title.ilike.${like},location.ilike.${like},tags.ilike.${like}`)
    .limit(limit);

  for (const job of jobs ?? []) {
    const company = Array.isArray(job.company) ? job.company[0] : job.company;
    results.push({
      type: "job",
      id: job.id,
      title: job.title,
      subtitle: [company?.name, job.location, STATUS_LABELS[job.status] ?? job.status, job.tags ? `Tags: ${job.tags}` : null]
        .filter(Boolean)
        .join(" · "),
      href: `/board?jobId=${job.id}`,
      icon: "job",
    });
  }

  // 3. Companies
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, website, location, company_type, country")
    .eq("user_id", userId)
    .or(`name.ilike.${like},website.ilike.${like},location.ilike.${like},company_type.ilike.${like}`)
    .limit(limit);

  for (const comp of companies ?? []) {
    results.push({
      type: "company",
      id: comp.id,
      title: comp.name,
      subtitle: [comp.location || comp.country, comp.company_type, comp.website]
        .filter(Boolean)
        .join(" · "),
      href: "/crm",
      icon: "company",
    });
  }

  // 4. Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, role, position, notes, company:companies(name)")
    .eq("user_id", userId)
    .or(`name.ilike.${like},email.ilike.${like},role.ilike.${like},position.ilike.${like},notes.ilike.${like}`)
    .limit(limit);

  for (const c of contacts ?? []) {
    const comp = Array.isArray(c.company) ? c.company[0] : c.company;
    results.push({
      type: "contact",
      id: c.id,
      title: c.name,
      subtitle: [c.position, comp?.name, c.email, c.role ? `Tags: ${c.role}` : null]
        .filter(Boolean)
        .join(" · "),
      href: "/crm",
      icon: "contact",
    });
  }

  // 5. Board Cards & Applications
  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, resume_name, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userId)
    .or(`resume_name.ilike.${like},notes.ilike.${like}`)
    .limit(limit);

  for (const app of applications ?? []) {
    const job = Array.isArray(app.job) ? app.job[0] : app.job;
    const company = job ? (Array.isArray(job.company) ? job.company[0] : job.company) : null;
    results.push({
      type: "application",
      id: app.id,
      title: job?.title ?? "Application",
      subtitle: [company?.name, STATUS_LABELS[app.status] ?? app.status, app.resume_name]
        .filter(Boolean)
        .join(" · "),
      href: `/board`,
      icon: "application",
    });
  }

  // 6. Documents & Resumes
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

  // 7. Interviews
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, type, status, interviewer_name, scheduled_at, location, job:jobs(id, title, company:companies(name))")
    .eq("user_id", userId)
    .or(`interviewer_name.ilike.${like},location.ilike.${like},notes.ilike.${like}`)
    .limit(limit);

  for (const iv of interviews ?? []) {
    const job = Array.isArray(iv.job) ? iv.job[0] : iv.job;
    const company = job ? (Array.isArray(job.company) ? job.company[0] : job.company) : null;
    const date = iv.scheduled_at
      ? new Date(iv.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
    results.push({
      type: "interview",
      id: iv.id,
      title: job?.title ?? "Interview",
      subtitle: [company?.name, iv.interviewer_name ? `Interviewer: ${iv.interviewer_name}` : null, iv.type, date]
        .filter(Boolean)
        .join(" · "),
      href: `/interviews`,
      icon: "interview",
    });
  }

  return results;
}

const ADMIN_PAGE_RESULTS: { title: string; href: string; keywords: string }[] = [
  { title: "Dashboard", href: "/admin", keywords: "admin dashboard overview stats" },
  { title: "Users", href: "/admin/users", keywords: "users accounts manage ban promote" },
  { title: "Activity Log", href: "/admin/activity", keywords: "activity audit log actions" },
  { title: "AI Usage", href: "/admin/ai-usage", keywords: "ai usage tokens cost requests" },
];

export async function adminGlobalSearch(query: string): Promise<AdminSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();
  const like = `%${q}%`;
  const limit = 5;
  const results: AdminSearchResult[] = [];

  // Search admin pages
  for (const page of ADMIN_PAGE_RESULTS) {
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

  // Search profiles and users via local DB client
  const { supabase } = await getUser();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_banned");

  const { data: users } = await supabase
    .from("users")
    .select("id, email");

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  for (const profile of profiles ?? []) {
    const user = userMap.get(profile.id);
    const email = user?.email ?? "";
    const searchable = [email, profile.full_name, profile.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (searchable.includes(q.toLowerCase())) {
      results.push({
        type: "user",
        id: profile.id,
        title: profile.full_name ?? email ?? "Unknown",
        subtitle: [email, profile.role, profile.is_banned ? "Banned" : null]
          .filter(Boolean)
          .join(" · "),
        href: `/admin/users/${profile.id}`,
        icon: "user",
      });
    }
  }



  // Search AI usage logs
  const { data: aiLogs } = await supabase
    .from("ai_usage_logs")
    .select("id, action, model, user_id, created_at")
    .or(`action.ilike.${like},model.ilike.${like}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const log of aiLogs ?? []) {
    const userEmail = userMap.get(log.user_id)?.email ?? "unknown";
    results.push({
      type: "ai_usage",
      id: log.id,
      title: `${log.action} (${log.model})`,
      subtitle: userEmail,
      href: "/admin/ai-usage",
      icon: "ai_usage",
    });
  }

  return results;
}

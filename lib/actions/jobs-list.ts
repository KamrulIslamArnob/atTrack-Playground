"use server";

import { getUser } from "@/lib/auth";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.jobs-list");

export interface JobsListParams {
  search?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface JobsListResult {
  jobs: JobListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface JobListItem {
  id: string;
  title: string;
  status: string;
  location: string | null;
  salary_range: string | null;
  employment_type: string | null;
  work_location: string | null;
  deadline: string | null;
  application_url: string | null;
  application_email: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  tier?: import("@/lib/types/job").JobTier | null;
  created_at: string;
  updated_at: string;
  company: {
    id?: string;
    name: string;
    location: string | null;
    website?: string | null;
    logo_url?: string | null;
    color?: string | null;
  } | null;
  applications: {
    id: string;
    status: string;
    applied_at: string | null;
  }[];
}

export async function getJobsList(params: JobsListParams = {}): Promise<JobsListResult> {
  const { supabase, userId } = await getUser();

  const {
    search = "",
    status = "all",
    sort = "newest",
    page = 1,
    perPage = 30,
  } = params;

  // Build query
  let query = supabase
    .from("jobs")
    .select(`
      id,
      title,
      status,
      location,
      salary_range,
      employment_type,
      work_location,
      deadline,
      application_url,
      application_email,
      match_score,
      match_reasoning,
      tier,
      created_at,
      updated_at,
      company:companies(id, name, location, website, logo_url, color),
      applications(id, status, applied_at)
    `, { count: "exact" })
    .eq("user_id", userId);

  // Apply status filter
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  // Apply search filter
  if (search) {
    const term = `%${search}%`;
    query = query.or(`title.ilike.${term},location.ilike.${term}`);
  }

  // Get total count
  let countQuery = supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (status && status !== "all") {
    countQuery = countQuery.eq("status", status);
  }

  if (search) {
    const term = `%${search}%`;
    countQuery = countQuery.or(`title.ilike.${term},location.ilike.${term}`);
  }

  const { count } = await countQuery;

  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Apply sorting
  switch (sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "deadline_earliest":
      query = query.order("deadline", { ascending: true, nullsFirst: true });
      break;
    case "deadline_latest":
      query = query.order("deadline", { ascending: false, nullsFirst: true });
      break;
    case "company_az":
      query = query.order("title", { ascending: true });
      break;
    case "company_za":
      query = query.order("title", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  // Apply pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    log.error({ err: error }, "Error fetching jobs:");
    return { jobs: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  return {
    jobs: (data as unknown as JobListItem[]) ?? [],
    total,
    page,
    perPage,
    totalPages,
  };
}

export interface JobMentionOption {
  id: string;
  title: string;
  company_name: string | null;
}

/** Lightweight job list for the CRM notes' @mention picker — not the paginated /jobs listing. */
export async function getJobsForMention(): Promise<JobMentionOption[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company:companies(name)")
    .eq("user_id", userId)
    .order("title", { ascending: true });

  if (error) {
    log.error({ err: error }, "Error fetching jobs for mention:");
    return [];
  }

  return ((data ?? []) as unknown as { id: string; title: string; company: { name: string } | null }[]).map((row) => ({
    id: row.id,
    title: row.title,
    company_name: row.company?.name ?? null,
  }));
}

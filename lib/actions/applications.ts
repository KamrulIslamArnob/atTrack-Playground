"use server";

import { getUser } from "@/lib/auth";

export interface ApplicationsParams {
  search?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface ApplicationsResult {
  applications: Application[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface Application {
  id: string;
  applied_at: string | null;
  created_at: string;
  job: {
    id: string;
    title: string;
    status: string;
    location: string | null;
    salary_range: string | null;
    company: {
      name: string;
      location: string | null;
    } | null;
  } | null;
}

export async function getApplications(params: ApplicationsParams = {}): Promise<ApplicationsResult> {
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
    .from("applications")
    .select(`
      id,
      applied_at,
      created_at,
      job:jobs(
        id,
        title,
        status,
        location,
        salary_range,
        company:companies(name, location)
      )
    `, { count: "exact" })
    .eq("user_id", userId);

  // Apply status filter (on job status)
  if (status && status !== "all") {
    query = query.eq("job.status", status);
  }

  // Apply search filter
  if (search) {
    query = query.or(`job.title.ilike.%${search}%,job.company.name.ilike.%${search}%,job.company.location.ilike.%${search}%`);
  }

  // Apply sorting
  switch (sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "company":
      query = query.order("created_at", { ascending: false }); // We'll sort by company in memory since it's a nested relation
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  // Get total count for pagination
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Apply pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error } = await query.range(from, to);

  if (error) {
    console.error("Error fetching applications:", error);
    return { applications: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  let applications = (data as unknown as Application[]) ?? [];

  // Sort by company in memory if needed (nested relation sorting)
  if (sort === "company") {
    applications = [...applications].sort((a, b) =>
      (a.job?.company?.name ?? "").localeCompare(b.job?.company?.name ?? "")
    );
  }

  return {
    applications,
    total,
    page,
    perPage,
    totalPages,
  };
}

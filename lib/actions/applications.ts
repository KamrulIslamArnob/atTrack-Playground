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
    employment_type: string | null;
    work_location: string | null;
    deadline: string | null;
    application_url: string | null;
    match_score: number | null;
    match_reasoning: string | null;
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
        employment_type,
        work_location,
        deadline,
        application_url,
        match_score,
        match_reasoning,
        company:companies(name, location)
      )
    `, { count: "exact" })
    .eq("user_id", userId);

  // Apply status filter - find matching job IDs
  let matchingJobIds: string[] | null = null;
  if (status && status !== "all") {
    const { data: statusJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("status", status);
    
    if (!statusJobs || statusJobs.length === 0) {
      return { applications: [], total: 0, page, perPage, totalPages: 0 };
    }
    
    matchingJobIds = statusJobs.map((j) => j.id);
    query = query.in("job_id", matchingJobIds);
  }

  // Apply search filter - find matching job IDs and intersect
  if (search) {
    const term = `%${search}%`;
    const { data: matchingJobs } = await supabase
      .from("jobs")
      .select("id")
      .or(`title.ilike.${term},location.ilike.${term}`);
    
    const { data: matchingCompanies } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", term);
    
    const jobIds = new Set<string>();
    matchingJobs?.forEach((j) => jobIds.add(j.id));
    
    if (matchingCompanies && matchingCompanies.length > 0) {
      const { data: companyJobs } = await supabase
        .from("jobs")
        .select("id")
        .in("company_id", matchingCompanies.map((c) => c.id));
      companyJobs?.forEach((j) => jobIds.add(j.id));
    }
    
    const searchIds = [...jobIds];
    
    if (searchIds.length === 0) {
      return { applications: [], total: 0, page, perPage, totalPages: 0 };
    }
    
    // Intersect with status filter if both exist
    if (matchingJobIds !== null) {
      matchingJobIds = matchingJobIds.filter((id) => searchIds.includes(id));
      if (matchingJobIds.length === 0) {
        return { applications: [], total: 0, page, perPage, totalPages: 0 };
      }
    } else {
      matchingJobIds = searchIds;
    }
    
    query = query.in("job_id", matchingJobIds);
  }

  // Get total count for pagination (with same filters)
  let countQuery = supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (matchingJobIds !== null) {
    countQuery = countQuery.in("job_id", matchingJobIds);
  }

  const { count } = await countQuery;

  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Fetch all matching rows (no ordering - we sort in memory since some fields are nested)
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching applications:", error);
    return { applications: [], total: 0, page: 1, perPage, totalPages: 0 };
  }

  let applications = (data as unknown as Application[]) ?? [];

  // Sort in memory (nested relations and mixed fields can't be sorted by Supabase)
  switch (sort) {
    case "applied_oldest":
      applications = [...applications].sort((a, b) => {
        const aTime = new Date(a.applied_at ?? a.created_at).getTime();
        const bTime = new Date(b.applied_at ?? b.created_at).getTime();
        return aTime - bTime;
      });
      break;
    case "deadline_earliest":
      applications = [...applications].sort((a, b) => {
        const aTime = a.job?.deadline ? new Date(a.job.deadline).getTime() : Infinity;
        const bTime = b.job?.deadline ? new Date(b.job.deadline).getTime() : Infinity;
        return aTime - bTime;
      });
      break;
    case "deadline_latest":
      applications = [...applications].sort((a, b) => {
        const aTime = a.job?.deadline ? new Date(a.job.deadline).getTime() : -Infinity;
        const bTime = b.job?.deadline ? new Date(b.job.deadline).getTime() : -Infinity;
        return bTime - aTime;
      });
      break;
    case "company_az":
      applications = [...applications].sort((a, b) =>
        (a.job?.company?.name ?? "").localeCompare(b.job?.company?.name ?? "")
      );
      break;
    case "company_za":
      applications = [...applications].sort((a, b) =>
        (b.job?.company?.name ?? "").localeCompare(a.job?.company?.name ?? "")
      );
      break;
    case "applied_newest":
    default:
      applications = [...applications].sort((a, b) => {
        const aTime = new Date(a.applied_at ?? a.created_at).getTime();
        const bTime = new Date(b.applied_at ?? b.created_at).getTime();
        return bTime - aTime;
      });
      break;
  }

  // Paginate in memory
  const from = (page - 1) * perPage;
  applications = applications.slice(from, from + perPage);

  return {
    applications,
    total,
    page,
    perPage,
    totalPages,
  };
}

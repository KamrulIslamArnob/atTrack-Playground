"use server";

import { getUser } from "@/lib/auth";

export interface Interview {
  id: string;
  job_id: string;
  scheduled_at: string | null;
  type: string | null;
  location: string | null;
  meeting_url: string | null;
  interviewer_name: string | null;
  interviewer_email: string | null;
  notes: string | null;
  prep_notes: string | null;
  status: string;
  duration_minutes: number | null;
  created_at: string;
  job: {
    id: string;
    title: string;
    status: string;
    location: string | null;
    employment_type: string | null;
    company: {
      name: string;
      location: string | null;
    } | null;
  } | null;
}

export async function getInterviews(params?: {
  search?: string;
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}): Promise<{
  interviews: Interview[];
  total: number;
  page: number;
  totalPages: number;
  perPage: number;
}> {
  const { supabase, userId } = await getUser();
  const search = params?.search ?? "";
  const status = params?.status ?? "all";
  const sort = params?.sort ?? "newest";
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 30;

  let query = supabase
    .from("interviews")
    .select(
      `
      id,
      scheduled_at,
      type,
      location,
      meeting_url,
      interviewer_name,
      interviewer_email,
      notes,
      prep_notes,
      status,
      duration_minutes,
      created_at,
      job_id,
      job:jobs(
        id,
        title,
        status,
        location,
        employment_type,
        company:companies(name, location)
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId);

  // Apply status filter
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  // Apply search filter - fetch matching job IDs first
  if (search) {
    const term = `%${search}%`;

    const { data: matchingJobs } = await supabase
      .from("jobs")
      .select("id")
      .ilike("title", term);

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
      return { interviews: [], total: 0, page: 1, totalPages: 0, perPage };
    }

    query = query.in("job_id", searchIds);
  }

  // Apply sorting
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    newest: { column: "created_at", ascending: false },
    oldest: { column: "created_at", ascending: true },
    "date-asc": { column: "scheduled_at", ascending: true },
    "date-desc": { column: "scheduled_at", ascending: false },
  };
  const s = sortMap[sort] ?? sortMap.newest;
  query = query.order(s.column, { ascending: s.ascending, nullsFirst: true });

  // Get total count for pagination
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching interviews:", error);
    return { interviews: [], total: 0, page: 1, totalPages: 0, perPage };
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  return {
    interviews: (data as unknown as Interview[]) ?? [],
    total,
    page,
    totalPages,
    perPage,
  };
}

export async function updateInterview(
  id: string,
  data: {
    scheduled_at?: string | null;
    type?: string | null;
    location?: string | null;
    meeting_url?: string | null;
    interviewer_name?: string | null;
    interviewer_email?: string | null;
    notes?: string | null;
    prep_notes?: string | null;
    status?: string;
    duration_minutes?: number | null;
  }
): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("interviews")
    .update(data)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update interview: ${error.message}`);
  }
}

export async function deleteInterview(id: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete interview: ${error.message}`);
  }
}

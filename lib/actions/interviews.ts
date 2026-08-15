"use server";

import { getUser } from "@/lib/auth";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.interviews");

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

    // .eq("user_id", userId) is load-bearing here: RLS used to scope these
    // implicitly, and without it the search would span every user's rows.
    const { data: matchingJobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .ilike("title", term);

    const { data: matchingCompanies } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", term);

    const jobIds = new Set<string>();
    matchingJobs?.forEach((j) => jobIds.add(j.id));

    if (matchingCompanies && matchingCompanies.length > 0) {
      const { data: companyJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", userId)
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
    log.error({ err: error }, "Error fetching interviews:");
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

export async function createInterview(
  data: {
    job_id: string;
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
): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const { data: inserted, error } = await supabase
    .from("interviews")
    .insert({
      user_id: userId,
      job_id: data.job_id,
      scheduled_at: data.scheduled_at ?? null,
      type: data.type ?? null,
      location: data.location ?? null,
      meeting_url: data.meeting_url ?? null,
      interviewer_name: data.interviewer_name ?? null,
      interviewer_email: data.interviewer_email ?? null,
      notes: data.notes ?? null,
      prep_notes: data.prep_notes ?? null,
      status: data.status ?? "scheduled",
      duration_minutes: data.duration_minutes ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create interview: ${error.message}`);
  }

  return { id: inserted.id };
}

export async function getPreparingJobs(): Promise<
  { id: string; title: string; company_name: string }[]
> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company:companies(name)")
    .eq("user_id", userId)
    .eq("status", "preparing")
    .order("created_at", { ascending: false });

  if (error) {
    log.error({ err: error }, "Error fetching preparing jobs:");
    return [];
  }

  return (data ?? []).map((job) => {
    const company = Array.isArray(job.company) ? job.company[0] : job.company;
    return {
      id: job.id as string,
      title: (job.title as string) || "Untitled",
      company_name: (company as { name: string } | null)?.name ?? "Unknown",
    };
  });
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

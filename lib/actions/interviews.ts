"use server";

import { getUser } from "@/lib/auth";

export interface Interview {
  id: string;
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

export async function getInterviews(): Promise<{
  upcoming: Interview[];
  past: Interview[];
}> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("interviews")
    .select(`
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
      job:jobs(
        id,
        title,
        status,
        location,
        employment_type,
        company:companies(name, location)
      )
    `)
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("Error fetching interviews:", error);
    return { upcoming: [], past: [] };
  }

  const interviews = (data as unknown as Interview[]) ?? [];
  const now = new Date();

  const upcoming = interviews.filter(
    (i) => i.status === "scheduled" && (!i.scheduled_at || new Date(i.scheduled_at) >= now)
  );

  const past = interviews.filter(
    (i) => i.status !== "scheduled" || (i.scheduled_at && new Date(i.scheduled_at) < now)
  );

  return { upcoming, past };
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

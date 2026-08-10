"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import type { JobDeadline, ListKind } from "@/lib/types/board";

export async function getJobDeadlines(jobId: string): Promise<JobDeadline[]> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("job_deadlines")
    .select("id, job_id, title, stage_kind, due_date, is_pinned, is_completed, notes, created_at")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("[Deadlines] Error fetching deadlines:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    job_id: row.job_id,
    title: row.title,
    stage_kind: (row.stage_kind as ListKind | "custom" | null) ?? "custom",
    due_date: row.due_date,
    is_pinned: Boolean(row.is_pinned),
    is_completed: Boolean(row.is_completed),
    notes: row.notes,
    created_at: row.created_at,
  }));
}

export async function createJobDeadline(
  jobId: string,
  payload: { title: string; due_date: string; stage_kind?: string; notes?: string }
): Promise<JobDeadline> {
  const { supabase, userId } = await getUser();

  const title = payload.title.trim();
  if (!title) throw new Error("Deadline title is required.");
  if (!payload.due_date) throw new Error("Due date is required.");

  const { data, error } = await supabase
    .from("job_deadlines")
    .insert({
      id: crypto.randomUUID(),
      job_id: jobId,
      user_id: userId,
      title,
      stage_kind: payload.stage_kind || "custom",
      due_date: payload.due_date,
      is_pinned: 0,
      is_completed: 0,
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create deadline: ${error?.message}`);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);

  return {
    id: data.id,
    job_id: data.job_id,
    title: data.title,
    stage_kind: (data.stage_kind as ListKind | "custom" | null) ?? "custom",
    due_date: data.due_date,
    is_pinned: Boolean(data.is_pinned),
    is_completed: Boolean(data.is_completed),
    notes: data.notes,
  };
}

export async function updateJobDeadline(
  deadlineId: string,
  payload: { title?: string; due_date?: string; stage_kind?: string; notes?: string }
): Promise<void> {
  const { supabase, userId } = await getUser();

  const updateFields: Record<string, unknown> = {};
  if (payload.title !== undefined) updateFields.title = payload.title.trim();
  if (payload.due_date !== undefined) updateFields.due_date = payload.due_date;
  if (payload.stage_kind !== undefined) updateFields.stage_kind = payload.stage_kind;
  if (payload.notes !== undefined) updateFields.notes = payload.notes;

  const { data, error } = await supabase
    .from("job_deadlines")
    .update(updateFields)
    .eq("id", deadlineId)
    .eq("user_id", userId)
    .select("job_id")
    .single();

  if (error) {
    throw new Error(`Failed to update deadline: ${error.message}`);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  if (data?.job_id) revalidatePath(`/jobs/${data.job_id}`);
}

export async function toggleDeadlineCompleted(
  deadlineId: string,
  isCompleted: boolean
): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("job_deadlines")
    .update({ is_completed: isCompleted ? 1 : 0 })
    .eq("id", deadlineId)
    .eq("user_id", userId)
    .select("job_id")
    .single();

  if (error) {
    throw new Error(`Failed to toggle deadline: ${error.message}`);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  if (data?.job_id) revalidatePath(`/jobs/${data.job_id}`);
}

export async function toggleDeadlinePinned(
  jobId: string,
  deadlineId: string
): Promise<void> {
  const { supabase, userId } = await getUser();

  // First unpin all deadlines for this job
  await supabase
    .from("job_deadlines")
    .update({ is_pinned: 0 })
    .eq("job_id", jobId)
    .eq("user_id", userId);

  // Pin the target deadline if provided
  if (deadlineId) {
    await supabase
      .from("job_deadlines")
      .update({ is_pinned: 1 })
      .eq("id", deadlineId)
      .eq("user_id", userId);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteJobDeadline(deadlineId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data, error } = await supabase
    .from("job_deadlines")
    .delete()
    .eq("id", deadlineId)
    .eq("user_id", userId)
    .select("job_id")
    .single();

  if (error) {
    throw new Error(`Failed to delete deadline: ${error.message}`);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  if (data?.job_id) revalidatePath(`/jobs/${data.job_id}`);
}

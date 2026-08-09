"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { logResourceActivity } from "@/lib/actions/activity-log";
import type { BoardCard, BoardList, ProjectLink } from "@/lib/types/board";

export interface BoardData {
  lists: BoardList[];
  cards: BoardCard[];
}

/**
 * Spread-logging an error object across the RSC boundary prints "{}" — name
 * the message explicitly so the terminal shows the real cause.
 */
function boardError(context: string, error: { message?: string }): Error {
  const message = error?.message ?? "unknown error";
  console.error(`[Board] ${context} failed: ${message}`);
  return new Error(`${context} failed: ${message}`);
}

interface RawJobRow {
  id: string;
  title: string;
  list_id: string | null;
  board_position: number | null;
  position_id: string | null;
  resume_id: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  project_links: ProjectLink[] | null;
  deadline: string | null;
  created_at: string;
  company: { name: string } | null;
  position: { name: string } | null;
  resume: { name: string } | null;
  applications: { id: string; status: string }[] | null;
}

/**
 * Reads the whole board in two queries (lists, then jobs) and joins in memory.
 * Consistent with getApplications(), which also pulls the full set per request.
 */
export async function getBoard(params: { positionId?: string } = {}): Promise<BoardData> {
  const { supabase, userId } = await getUser();

  const { data: initialLists, error: listsError } = await supabase
    .from("board_lists")
    .select("id, name, kind, color, sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (listsError) {
    throw boardError("Loading board lists", listsError);
  }

  let lists = initialLists ?? [];

  // Users created before onboarding existed have no lists yet. Seed once.
  if (lists.length === 0) {
    const { error: seedError } = await supabase.rpc("seed_board_lists", {
      p_user_id: userId,
    });
    if (seedError) {
      throw boardError("Seeding board lists", seedError);
    }
    const reread = await supabase
      .from("board_lists")
      .select("id, name, kind, color, sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    lists = reread.data ?? [];
  }

  let query = supabase
    .from("jobs")
    .select(
      `
      id,
      title,
      list_id,
      board_position,
      position_id,
      resume_id,
      match_score,
      match_reasoning,
      project_links,
      deadline,
      created_at,
      company:companies(name),
      position:positions(name),
      resume:documents!jobs_resume_id_fkey(name),
      applications(id, status)
    `
    )
    .eq("user_id", userId);

  if (params.positionId) {
    query = query.eq("position_id", params.positionId);
  }

  const { data: jobs, error } = await query;

  if (error) {
    throw boardError("Loading board cards", error);
  }

  const cards: BoardCard[] = ((jobs ?? []) as unknown as RawJobRow[])
    .map((j) => {
      const application = j.applications?.[0] ?? null;
      return {
        id: j.id,
        title: j.title,
        company_name: j.company?.name ?? null,
        list_id: j.list_id,
        board_position: j.board_position,
        position_id: j.position_id,
        position_name: j.position?.name ?? null,
        resume_id: j.resume_id,
        resume_name: j.resume?.name ?? null,
        match_score: j.match_score,
        match_reasoning: j.match_reasoning,
        project_links: j.project_links,
        deadline: j.deadline,
        created_at: j.created_at,
        application_id: application?.id ?? null,
        application_status: application?.status ?? null,
      };
    })
    .sort((a, b) => (a.board_position ?? 0) - (b.board_position ?? 0));

  return { lists: lists as BoardList[], cards };
}

/**
 * Moves a card into `listId` at `targetIndex`, then renumbers that column.
 *
 * Renumbering the whole destination column (rather than computing a fractional
 * board_position) keeps the ordering exactly correct with no float-precision
 * collapse after repeated drags, at the cost of one write per card in that column.
 *
 * ponytail: rewrites one column's ordering per move. Switch to fractional
 * board_position only if a single column ever exceeds ~200 cards.
 */
export async function moveCard(jobId: string, listId: string, targetIndex: number) {
  const { supabase, userId } = await getUser();

  // Verify the destination list belongs to the caller and learn its semantics.
  const { data: list } = await supabase
    .from("board_lists")
    .select("id, kind, name")
    .eq("id", listId)
    .eq("user_id", userId)
    .single();

  if (!list) {
    throw new Error("List not found.");
  }

  // Ownership check on the card itself. Title is carried into the activity log.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) {
    throw new Error("Job not found.");
  }

  // Current occupants of the destination column, minus the card being moved.
  const { data: siblings } = await supabase
    .from("jobs")
    .select("id, board_position")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .neq("id", jobId)
    .order("board_position", { ascending: true });

  const ordered = (siblings ?? []).map((s) => s.id);
  const index = Math.max(0, Math.min(targetIndex, ordered.length));
  ordered.splice(index, 0, jobId);

  // The moved card also changes list_id, which fires the status-sync trigger.
  await Promise.all(
    ordered.map((id, i) =>
      supabase
        .from("jobs")
        .update(id === jobId ? { list_id: listId, board_position: i } : { board_position: i })
        .eq("id", id)
        .eq("user_id", userId)
    )
  );

  // Reaching an "applied" column creates the submission record if absent.
  // Dragging back OUT of it never deletes that record.
  if (list.kind === "applied") {
    await ensureApplication(supabase, userId, jobId);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/applications");
  await logResourceActivity(userId, "move_card", "job", jobId, {
    title: job.title,
    list_id: listId,
    list_name: list.name,
    list_kind: list.kind,
  });
}

/**
 * Find-or-create the applications row for a job.
 *
 * Deliberately NOT reusing createApplication() from lib/actions/jobs.ts: that
 * one throws when a row already exists, which would break re-dragging a card
 * back into Applied. Exported for the job-detail-sheet's Shortcuts panel
 * (logApplication/logOffer below), which needs the same find-or-create logic
 * outside of a board drag.
 */
export async function ensureApplication(
  supabase: Awaited<ReturnType<typeof getUser>>["supabase"],
  userId: string,
  jobId: string
) {
  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  // Snapshot the resume the user picked for this job, matching the
  // denormalization that migration 016 designed for applications.
  const { data: job } = await supabase
    .from("jobs")
    .select("resume_id, resume:documents!jobs_resume_id_fkey(name)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  // The Supabase clients are untyped, so a to-one embed widens to an array in
  // TS even though it comes back as a single object. Normalize both shapes.
  const embedded = job?.resume as unknown as
    | { name: string }
    | { name: string }[]
    | null;
  const resumeName = Array.isArray(embedded)
    ? embedded[0]?.name ?? null
    : embedded?.name ?? null;

  await supabase.from("applications").insert({
    user_id: userId,
    job_id: jobId,
    status: "submitted",
    applied_at: new Date().toISOString(),
    resume_id: job?.resume_id ?? null,
    resume_name: resumeName,
  });
}

/** Shortcuts panel "Log Application" — creates the applications row if one doesn't exist yet. */
export async function logApplication(jobId: string): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id, title").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await ensureApplication(supabase, userId, jobId);

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  revalidatePath("/applications");
  await logResourceActivity(userId, "log", "application", jobId, { title: job.title });
}

/** Shortcuts panel "Log Offer" / "Log Accepted" — ensures an application exists, then sets its status. */
export async function logOffer(jobId: string, status: "offer" | "accepted"): Promise<void> {
  const { supabase, userId } = await getUser();

  const { data: job } = await supabase.from("jobs").select("id, title").eq("id", jobId).eq("user_id", userId).single();
  if (!job) throw new Error("Job not found.");

  await ensureApplication(supabase, userId, jobId);

  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .single();
  if (application) {
    await supabase.from("applications").update({ status }).eq("id", application.id).eq("user_id", userId);
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs/" + jobId);
  revalidatePath("/applications");
  await logResourceActivity(userId, "update", "application", jobId, { status, title: job.title });
}

export async function createList(name: string): Promise<{ id: string }> {
  const { supabase, userId } = await getUser();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("List name is required.");
  }

  const { data: last } = await supabase
    .from("board_lists")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("board_lists")
    .insert({
      user_id: userId,
      name: trimmed,
      kind: "custom",
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Failed to create list.");
  }

  revalidatePath("/board");
  await logResourceActivity(userId, "create", "board_list", data.id, { name: trimmed });
  return { id: data.id };
}

export async function renameList(id: string, name: string) {
  const { supabase, userId } = await getUser();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("List name is required.");
  }

  const { error } = await supabase
    .from("board_lists")
    .update({ name: trimmed })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to rename list.");
  }

  revalidatePath("/board");
  await logResourceActivity(userId, "update", "board_list", id, { name: trimmed });
}

/**
 * Only custom lists are deletable — the six seeded kinds anchor the board's
 * automation, and the unique index on (user_id, kind) means a deleted one
 * cannot simply be recreated by hand. Cards fall back to Wishlist rather than
 * being orphaned with a null list_id.
 */
export async function deleteList(id: string) {
  const { supabase, userId } = await getUser();

  const { data: list } = await supabase
    .from("board_lists")
    .select("id, kind, name")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!list) {
    throw new Error("List not found.");
  }
  if (list.kind !== "custom") {
    throw new Error("Default lists cannot be deleted.");
  }

  const { data: fallback } = await supabase
    .from("board_lists")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "wishlist")
    .single();

  if (fallback) {
    await supabase
      .from("jobs")
      .update({ list_id: fallback.id })
      .eq("list_id", id)
      .eq("user_id", userId);
  }

  const { error } = await supabase
    .from("board_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to delete list.");
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  await logResourceActivity(userId, "delete", "board_list", id, { name: list.name });
}

export async function reorderLists(orderedIds: string[]) {
  const { supabase, userId } = await getUser();

  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("board_lists")
        .update({ sort_order: i + 1 })
        .eq("id", id)
        .eq("user_id", userId)
    )
  );

  revalidatePath("/board");
}

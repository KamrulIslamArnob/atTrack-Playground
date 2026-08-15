"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import type { BoardCard, BoardList, ListKind, ProjectLink } from "@/lib/types/board";
import type { JobState } from "@/lib/types/job";

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
  state?: JobState;
  list_id: string | null;
  board_position: number | null;
  position_id: string | null;
  resume_id: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  project_links: ProjectLink[] | null;
  deadline: string | null;
  section_deadline: string | null;
  section_deadline_list_id: string | null;
  created_at: string;
  company: { name: string } | null;
  position: { name: string } | null;
  resume: { name: string } | null;
  applications: { id: string; status: string }[] | null;
  job_deadlines: {
    id: string;
    job_id: string;
    title: string;
    type?: string | null;
    stage_kind: string | null;
    due_date: string;
    is_pinned: boolean;
    is_completed: boolean;
    notes: string | null;
  }[] | null;
}

/**
 * Reads the whole board in two queries (lists, then jobs+embeds) and joins in
 * memory. The jobs query embeds company, position, resume, applications, and
 * job_deadlines — the query builder resolves each embed with a single batched
 * IN() query, so the total is ~7 queries regardless of card count.
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
      state,
      list_id,
      board_position,
      position_id,
      resume_id,
      match_score,
      match_reasoning,
      project_links,
      deadline,
      section_deadline,
      section_deadline_list_id,
      created_at,
      company:companies(name),
      position:positions(name),
      resume:documents!jobs_resume_id_fkey(name),
      applications(id, status),
      job_deadlines(id, job_id, title, type, stage_kind, due_date, is_pinned, is_completed, notes)
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
      const deadlines = (j.job_deadlines ?? []).map((d) => ({
        id: d.id,
        job_id: d.job_id,
        title: d.title,
        type: (d.type as "deadline" | "milestone") ?? "deadline",
        stage_kind: (d.stage_kind as ListKind | "custom" | null) ?? "custom",
        due_date: d.due_date,
        is_pinned: Boolean(d.is_pinned),
        is_completed: Boolean(d.is_completed),
        notes: d.notes,
      }));
      return {
        id: j.id,
        title: j.title,
        state: (j.state as JobState) ?? "active",
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
        section_deadline: j.section_deadline,
        section_deadline_list_id: j.section_deadline_list_id,
        deadlines,
        created_at: j.created_at,
        application_id: application?.id ?? null,
        application_status: application?.status ?? null,
      };
    })
    .sort((a, b) => (a.board_position ?? 0) - (b.board_position ?? 0));

  return { lists: lists as BoardList[], cards };
}

/**
 * Moves a card into `listId` at `targetIndex` using Fractional Indexing.
 *
 * Computes `board_position` as the midpoint between adjacent cards:
 *   newPos = (prevPos + nextPos) / 2
 *
 * This reduces database writes from O(N) sibling column updates down to O(1)
 * for a single card update. If precision collapses below 1e-6, it performs an
 * automatic single-pass rebalance.
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

  // Ownership check on the card itself.
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
  const { data: siblingRows } = await supabase
    .from("jobs")
    .select("id, board_position")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .neq("id", jobId)
    .order("board_position", { ascending: true });

  const siblings = siblingRows ?? [];
  let newPosition: number;
  const GAP = 1000;

  if (siblings.length === 0) {
    newPosition = GAP;
  } else {
    const clampedIndex = Math.max(0, Math.min(targetIndex, siblings.length));
    if (clampedIndex === 0) {
      // Placed before the first card
      const firstPos = siblings[0].board_position ?? GAP;
      newPosition = firstPos / 2;
    } else if (clampedIndex === siblings.length) {
      // Placed after the last card
      const lastPos = siblings[siblings.length - 1].board_position ?? 0;
      newPosition = lastPos + GAP;
    } else {
      // Placed between two cards
      const prevPos = siblings[clampedIndex - 1].board_position ?? 0;
      const nextPos = siblings[clampedIndex].board_position ?? (prevPos + GAP * 2);

      if (Math.abs(nextPos - prevPos) < 1e-6) {
        // Precision threshold reached: rebalance column to restore wide gaps
        const { getDb } = await import("@/lib/db/sqlite");
        const db = getDb();
        const rebalanced = siblings.map((s) => s.id);
        rebalanced.splice(clampedIndex, 0, jobId);
        
        const cases = rebalanced.map(() => `WHEN ? THEN ?`).join(" ");
        const params: unknown[] = [];
        rebalanced.forEach((id, idx) => {
          params.push(id, (idx + 1) * GAP);
        });
        const ph = rebalanced.map(() => "?").join(",");
        db.prepare(
          `UPDATE "jobs" SET board_position = CASE "id" ${cases} END WHERE "id" IN (${ph}) AND "user_id" = ?`
        ).run(...([...params, ...rebalanced, userId] as never[]));

        newPosition = (clampedIndex + 1) * GAP;
      } else {
        newPosition = (prevPos + nextPos) / 2;
      }
    }
  }

  // Move the card itself — fires the status-sync trigger via UPDATE OF list_id.
  await supabase
    .from("jobs")
    .update({ list_id: listId, board_position: newPosition })
    .eq("id", jobId)
    .eq("user_id", userId);

  // Reaching an "applied" column creates the submission record if absent.
  if (list.kind === "applied") {
    await ensureApplication(supabase, userId, jobId);
  }

  revalidatePath("/board");
  revalidatePath("/jobs");
  revalidatePath("/applications");
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
}

export async function reorderLists(orderedIds: string[]) {
  const { userId } = await getUser();

  if (orderedIds.length === 0) {
    revalidatePath("/board");
    return;
  }

  // Batched reorder: single UPDATE with CASE-WHEN instead of N individual writes.
  const { getDb } = await import("@/lib/db/sqlite");
  const db = getDb();
  const cases = orderedIds.map(() => `WHEN ? THEN ?`).join(" ");
  const params: unknown[] = [];
  orderedIds.forEach((id, i) => {
    params.push(id, i + 1);
  });
  const ph = orderedIds.map(() => "?").join(",");
  db.prepare(
    `UPDATE "board_lists" SET sort_order = CASE "id" ${cases} END WHERE "id" IN (${ph}) AND "user_id" = ?`
  ).run(...([...params, ...orderedIds, userId] as never[]));

  revalidatePath("/board");
}

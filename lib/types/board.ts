// Board = a single unified pipeline over `jobs`. One card per job opportunity,
// spanning Wishlist -> Offer. Columns live in the `board_lists` table (migration
// 019) so users can add their own; `kind` is the semantic anchor that tells the
// board what a drag MEANS, independent of the column's display name.

export type ListKind =
  | "wishlist"
  | "preparing"
  | "applied"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "custom";

export interface BoardList {
  id: string;
  name: string;
  kind: ListKind;
  color: string | null;
  sort_order: number;
}

export interface ProjectLink {
  id: string;
  label: string;
  url: string;
}

export interface JobDeadline {
  id: string;
  job_id: string;
  title: string;
  stage_kind: ListKind | "custom" | null;
  due_date: string;
  is_pinned: boolean;
  is_completed: boolean;
  notes: string | null;
  created_at?: string;
}

export interface BoardCard {
  id: string; // jobs.id
  title: string;
  company_name: string | null;
  list_id: string | null;
  board_position: number | null;
  position_id: string | null;
  position_name: string | null;
  resume_id: string | null;
  resume_name: string | null;
  match_score: number | null;
  match_reasoning: string | null;
  project_links: ProjectLink[] | null;
  deadline: string | null;
  section_deadline: string | null;
  section_deadline_list_id: string | null;
  deadlines?: JobDeadline[];
  created_at: string;
  application_id: string | null; // null => surfaces in the Application Inbox
  application_status: string | null;
}

export interface EffectiveDeadlineInfo {
  type: "section" | "job" | "milestone";
  title: string;
  date: Date;
  dateString: string;
  daysRemaining: number;
  label: string;
  targetListName?: string;
  isPinned?: boolean;
  urgency: "overdue" | "red" | "yellow" | "blue" | "gray";
  bannerClassName: string;
  badgeClassName: string;
}

export function getEffectiveDeadlineInfo(
  card: BoardCard,
  lists: BoardList[] = []
): EffectiveDeadlineInfo | null {
  let activeDeadlineStr: string | null = null;
  let deadlineTitle = "Job Deadline";
  let deadlineType: "section" | "job" | "milestone" = "job";
  let targetListName: string | undefined = undefined;
  let isPinned = false;

  // 1. Check if there is a pinned uncompleted deadline
  const uncompletedDeadlines = (card.deadlines ?? []).filter((d) => !d.is_completed);
  const pinned = uncompletedDeadlines.find((d) => d.is_pinned);

  if (pinned) {
    activeDeadlineStr = pinned.due_date;
    deadlineTitle = pinned.title;
    deadlineType = "milestone";
    isPinned = true;
  } else if (uncompletedDeadlines.length > 0) {
    // 2. Check if a milestone matches the current board list stage
    const currentList = lists.find((l) => l.id === card.list_id);
    const stageMatch = currentList
      ? uncompletedDeadlines.find((d) => d.stage_kind === currentList.kind)
      : null;

    if (stageMatch) {
      activeDeadlineStr = stageMatch.due_date;
      deadlineTitle = stageMatch.title;
      deadlineType = "milestone";
      targetListName = currentList?.name;
    } else {
      // 3. Otherwise pick the earliest upcoming deadline
      const sorted = [...uncompletedDeadlines].sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );
      activeDeadlineStr = sorted[0].due_date;
      deadlineTitle = sorted[0].title;
      deadlineType = "milestone";
    }
  }

  // Fallbacks for legacy single deadlines
  if (!activeDeadlineStr && card.section_deadline) {
    let isSatisfied = false;
    if (card.section_deadline_list_id && card.list_id && lists.length > 0) {
      const currentList = lists.find((l) => l.id === card.list_id);
      const targetList = lists.find((l) => l.id === card.section_deadline_list_id);
      if (targetList) {
        targetListName = targetList.name;
        if (currentList && currentList.sort_order >= targetList.sort_order) {
          isSatisfied = true;
        }
      }
    }

    if (!isSatisfied) {
      activeDeadlineStr = card.section_deadline;
      deadlineTitle = targetListName ? `${targetListName} Deadline` : "Section Deadline";
      deadlineType = "section";
    }
  }

  if (!activeDeadlineStr && card.deadline) {
    activeDeadlineStr = card.deadline;
    deadlineTitle = "Job Deadline";
    deadlineType = "job";
  }

  if (!activeDeadlineStr) return null;

  const targetDate = new Date(activeDeadlineStr);
  if (isNaN(targetDate.getTime())) return null;

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgency: "overdue" | "red" | "yellow" | "blue" | "gray" = "gray";
  if (daysRemaining <= 0) {
    urgency = "overdue";
  } else if (daysRemaining <= 3) {
    urgency = "red";
  } else if (daysRemaining <= 7) {
    urgency = "yellow";
  } else if (daysRemaining <= 10) {
    urgency = "blue";
  } else {
    urgency = "gray";
  }

  const dateFormatted = targetDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  let label = "";
  if (daysRemaining < 0) {
    label = `Overdue by ${Math.abs(daysRemaining)}d`;
  } else if (daysRemaining === 0) {
    label = "Due Today";
  } else if (daysRemaining === 1) {
    label = "1 day left";
  } else {
    label = `${daysRemaining} days left`;
  }

  let bannerClassName = "";
  let badgeClassName = "";

  switch (urgency) {
    case "overdue":
      bannerClassName = "bg-red-950/20 text-red-700 dark:text-red-300 border-red-500/50";
      badgeClassName = "bg-red-500/20 text-red-700 dark:text-red-300";
      break;
    case "red":
      bannerClassName = "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40";
      badgeClassName = "bg-rose-500/20 text-rose-700 dark:text-rose-300";
      break;
    case "yellow":
      bannerClassName = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
      badgeClassName = "bg-amber-500/20 text-amber-700 dark:text-amber-300";
      break;
    case "blue":
      bannerClassName = "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40";
      badgeClassName = "bg-blue-500/20 text-blue-700 dark:text-blue-300";
      break;
    case "gray":
    default:
      bannerClassName = "bg-muted/60 text-muted-foreground border-border";
      badgeClassName = "bg-muted text-muted-foreground";
      break;
  }

  return {
    type: deadlineType,
    title: deadlineTitle,
    date: targetDate,
    dateString: dateFormatted,
    daysRemaining,
    label,
    targetListName,
    isPinned,
    urgency,
    bannerClassName,
    badgeClassName,
  };
}

export type ExperienceLevel = "entry" | "mid" | "senior";

export interface Position {
  id: string;
  name: string;
  experience_level: ExperienceLevel | null;
  resume_id: string | null;
  resume_name: string | null;
  is_primary: boolean;
  job_count: number;
}

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  entry: "Entry · 0-2 years of exp.",
  mid: "Mid Level · 2-5 years of exp.",
  senior: "Senior · 5+ years of exp.",
};

export const LIST_KIND_LABELS: Record<ListKind, string> = {
  wishlist: "Wishlist",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  custom: "Custom",
};

// Mirrors the hex values seeded by public.seed_board_lists() in migration 019.
// Used as the fallback when board_lists.color is null (custom lists).
export const DEFAULT_LIST_COLORS: Record<ListKind, string> = {
  wishlist: "#38bdf8",
  preparing: "#fbbf24",
  applied: "#c084fc",
  interview: "#84cc16",
  offer: "#14b8a6",
  accepted: "#22c55e",
  rejected: "#f87171",
  custom: "#38bdf8",
};

// Match-score bands. Thresholds match getInsights() in lib/actions/insights.ts
// (high 80+, medium 50-79, low <50) so the board and /insights never disagree.
export function matchScoreBand(score: number | null): {
  label: string;
  className: string;
} | null {
  if (score === null) return null;
  if (score >= 80)
    return {
      label: "Strong",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
  if (score >= 50)
    return {
      label: "Fair",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  return {
    label: "Weak",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
}

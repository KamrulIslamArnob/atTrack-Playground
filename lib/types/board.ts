import type { JobState } from "./job";
import { parseLocalDate } from "@/lib/utils";

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

export type DeadlineKind = "deadline" | "milestone";

export interface JobDeadline {
  id: string;
  job_id: string;
  title: string;
  type?: DeadlineKind;
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
  state: JobState;
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
  tier?: import("./job").JobTier | null;
  deadlines?: JobDeadline[];
  created_at: string;
  application_id: string | null; // null => surfaces in the Application Inbox
  application_status: string | null;
}

export interface EffectiveDeadlineInfo {
  type: "section" | "job" | "milestone";
  kind?: DeadlineKind;
  title: string;
  date: Date;
  dateString: string;
  daysRemaining: number;
  label: string;
  targetListName?: string;
  isPinned?: boolean;
  urgency: "overdue" | "red" | "yellow" | "blue" | "purple" | "gray";
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
  let deadlineKind: DeadlineKind = "deadline";
  let targetListName: string | undefined = undefined;
  let isPinned = false;

  // 1. Check if there is a pinned uncompleted deadline
  const uncompletedDeadlines = (card.deadlines ?? []).filter((d) => !d.is_completed);
  const pinned = uncompletedDeadlines.find((d) => d.is_pinned);

  if (pinned) {
    activeDeadlineStr = pinned.due_date;
    deadlineTitle = pinned.title;
    deadlineType = "milestone";
    deadlineKind = pinned.type ?? "deadline";
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
      deadlineKind = stageMatch.type ?? "deadline";
      targetListName = currentList?.name;
    } else {
      // 3. Otherwise pick the earliest upcoming deadline / milestone
      const sorted = [...uncompletedDeadlines].sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );
      activeDeadlineStr = sorted[0].due_date;
      deadlineTitle = sorted[0].title;
      deadlineType = "milestone";
      deadlineKind = sorted[0].type ?? "deadline";
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
      deadlineKind = "deadline";
    }
  }

  if (!activeDeadlineStr && card.deadline) {
    activeDeadlineStr = card.deadline;
    deadlineTitle = "Job Deadline";
    deadlineType = "job";
    deadlineKind = "deadline";
  }

  if (!activeDeadlineStr) return null;

  const normalized = activeDeadlineStr.trim().toLowerCase();
  if (normalized === "asap") {
    return {
      type: deadlineType,
      kind: "deadline",
      title: deadlineTitle || "Job Deadline",
      date: new Date(),
      dateString: "ASAP",
      daysRemaining: 0,
      label: "Apply ASAP",
      urgency: "red",
      bannerClassName: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-b border-rose-500/40",
      badgeClassName: "bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold",
    };
  }

  if (normalized === "unknown") {
    return {
      type: deadlineType,
      kind: "deadline",
      title: deadlineTitle || "Job Deadline",
      date: new Date(),
      dateString: "Unknown",
      daysRemaining: 999,
      label: "Unknown",
      urgency: "gray",
      bannerClassName: "bg-muted/60 text-muted-foreground border-b border-border",
      badgeClassName: "bg-muted text-muted-foreground",
    };
  }

  const targetDate = parseLocalDate(activeDeadlineStr);
  if (isNaN(targetDate.getTime())) return null;

  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let urgency: "overdue" | "red" | "yellow" | "blue" | "purple" | "gray" = "gray";
  let label = "";

  if (deadlineKind === "milestone") {
    // Milestone count-up elapsed time
    const elapsedDays = Math.max(0, Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)));
    urgency = "purple";
    if (elapsedDays === 0) {
      label = "Started Today";
    } else if (elapsedDays === 1) {
      label = "1 day waiting";
    } else {
      label = `${elapsedDays} days waiting`;
    }
  } else {
    // Deadline countdown
    if (daysRemaining < 0) {
      urgency = "overdue";
      label = `Overdue by ${Math.abs(daysRemaining)}d`;
    } else if (daysRemaining === 0) {
      urgency = "overdue";
      label = "Due Today";
    } else if (daysRemaining <= 3) {
      urgency = "red";
      label = daysRemaining === 1 ? "1 day left" : `${daysRemaining} days left`;
    } else if (daysRemaining <= 7) {
      urgency = "yellow";
      label = `${daysRemaining} days left`;
    } else if (daysRemaining <= 10) {
      urgency = "blue";
      label = `${daysRemaining} days left`;
    } else {
      urgency = "gray";
      label = `${daysRemaining} days left`;
    }
  }

  const dateFormatted = targetDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  let bannerClassName = "";
  let badgeClassName = "";

  switch (urgency) {
    case "overdue":
      bannerClassName = "bg-destructive-surface text-destructive border-b border-destructive-border";
      badgeClassName = "bg-destructive text-destructive-foreground font-semibold";
      break;
    case "red":
      bannerClassName = "bg-destructive-surface text-destructive border-b border-destructive-border";
      badgeClassName = "bg-destructive/15 text-destructive font-semibold";
      break;
    case "yellow":
      bannerClassName = "bg-warning-surface text-warning border-b border-warning-border";
      badgeClassName = "bg-warning/15 text-warning font-semibold";
      break;
    case "blue":
      bannerClassName = "bg-info-surface text-info border-b border-info-border";
      badgeClassName = "bg-info/15 text-info font-semibold";
      break;
    case "purple":
      bannerClassName = "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800/50";
      badgeClassName = "bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-semibold";
      break;
    case "gray":
    default:
      bannerClassName = "bg-muted/70 text-muted-foreground border-b border-border";
      badgeClassName = "bg-muted text-muted-foreground";
      break;
  }

  return {
    type: deadlineType,
    kind: deadlineKind,
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
  accepted: "#a3e635",
  rejected: "#f87171",
  custom: "#38bdf8",
};

// Match-score bands. Thresholds match getInsights() in lib/actions/insights.ts
// (high 80+, medium 50-79, low <50) so the board and /insights never disagree.
export function matchScoreBand(score: number | null): {
  label: string;
  className: string;
  borderClass: string;
  labelBgClass: string;
  labelColorClass: string;
} | null {
  if (score === null) return null;
  if (score >= 80)
    return {
      label: "Strong",
      className:
        "bg-success-surface border border-success-border text-success",
      borderClass: "border-success-border",
      labelBgClass: "bg-success-surface",
      labelColorClass: "text-success",
    };
  if (score >= 50)
    return {
      label: "Fair",
      className:
        "bg-warning-surface border border-warning-border text-warning",
      borderClass: "border-warning-border",
      labelBgClass: "bg-warning-surface",
      labelColorClass: "text-warning",
    };
  return {
    label: "Weak",
    className:
      "bg-destructive-surface border border-destructive-border text-destructive",
    borderClass: "border-destructive-border",
    labelBgClass: "bg-destructive-surface",
    labelColorClass: "text-destructive",
  };
}

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
  created_at: string;
  application_id: string | null; // null => surfaces in the Application Inbox
  application_status: string | null;
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

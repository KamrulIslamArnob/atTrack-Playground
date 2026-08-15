export interface LinkCategory {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialLink {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  url: string;
  notes?: string | null;
  icon_url?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkInput {
  title: string;
  url: string;
  category_id: string;
  notes?: string | null;
  tags?: string[] | null;
}

export interface UpdateLinkInput {
  title?: string;
  url?: string;
  category_id?: string;
  notes?: string | null;
  tags?: string[] | null;
}

export interface CreateCategoryInput {
  name: string;
  sort_order?: number;
}

export const DEFAULT_LINK_CATEGORIES = [
  "Recruitment Portals",
  "Career Pages",
  "Career Groups",
  "Useful Links",
] as const;

export interface QuickShortcut {
  id: string;
  user_id: string;
  title: string;
  value: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuickShortcutInput {
  title: string;
  value: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateQuickShortcutInput {
  title?: string;
  value?: string;
  icon?: string;
  sort_order?: number;
}

/** A normalized link row parsed from a CSV / pasted block (pre-import). */
export interface CsvLinkRow {
  /** Stable client id for list keys. */
  id: string;
  title: string;
  url: string;
  /** Category name (display) — resolved to category_id at import time. */
  categoryName?: string;
  notes?: string;
  tags?: string[];
  /** True when title/url were heuristically recovered (missing/garbage). */
  needsReview?: boolean;
}

/** Result of the (optional) AI normalization step. */
export interface FormatLinksResult {
  rows: CsvLinkRow[];
  /** Free-text notes from the model, e.g. what it guessed. */
  notes?: string;
}

export const DEFAULT_QUICK_SHORTCUTS = [
  { title: "LinkedIn", icon: "linkedin", value: "" },
  { title: "GitHub", icon: "github", value: "" },
  { title: "Facebook", icon: "facebook", value: "" },
  { title: "Email", icon: "mail", value: "" },
  { title: "Phone", icon: "phone", value: "" },
  { title: "Address", icon: "map-pin", value: "" },
] as const;

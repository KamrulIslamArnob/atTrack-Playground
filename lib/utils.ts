import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TAG_COLORS = [
  "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
  "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40",
  "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40",
  "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
  "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40",
  "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40",
  "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40",
  "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40",
  "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40",
  "bg-pink-500/15 text-pink-700 border-pink-500/30 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/40",
];

export function getTagColorClass(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  if (normalized === "alumni") {
    return "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40";
  }
  if (normalized === "recruiter" || normalized === "hiring manager" || normalized === "hiring_manager") {
    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40";
  }
  if (normalized === "employee" || normalized === "executive") {
    return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40";
  }
  if (normalized === "referral") {
    return "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40";
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

const AVATAR_COLORS = [
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30",
  "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30",
  "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30",
];

export function getAvatarColorClass(name: string): string {
  let hash = 0;
  const str = name.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Returns specific avatar color class based on role/tags:
 * - Alumni -> Orangish
 * - Recruiter / Hiring Manager -> Greenish
 * - Employee / Executive -> Yellowish
 * - Referral -> Red
 * - Fallback -> Hash of name or default avatar color
 */
export function getContactAvatarColorClass(
  roleOrTags?: string | string[] | null,
  name?: string
): string {
  const tagsList: string[] = [];

  if (Array.isArray(roleOrTags)) {
    tagsList.push(...roleOrTags.map((t) => t.trim().toLowerCase()));
  } else if (typeof roleOrTags === "string" && roleOrTags.trim()) {
    tagsList.push(
      ...roleOrTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  // Check tags in order
  for (const t of tagsList) {
    if (t === "alumni") {
      return "bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/30";
    }
  }
  for (const t of tagsList) {
    if (t === "recruiter" || t === "hiring manager" || t === "hiring_manager") {
      return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30";
    }
  }
  for (const t of tagsList) {
    if (t === "employee" || t === "executive") {
      return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30";
    }
  }
  for (const t of tagsList) {
    if (t === "referral") {
      return "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30";
    }
  }

  if (name) {
    return getAvatarColorClass(name);
  }

  return "bg-primary/10 text-primary border border-primary/20";
}



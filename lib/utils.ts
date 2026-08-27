import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parses a date-only "YYYY-MM-DD" string as local midnight, not UTC midnight
 *  (new Date(str) parses as UTC, which shifts a day in negative-UTC timezones). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
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

/**
 * Universal UUID generator with fallback for non-secure / HTTP / older browser contexts
 * where crypto.randomUUID is not available.
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 v4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Null-safe and type-safe JSON parser with fallback default.
 * Prevents runtime crashes when parsing database columns or localStorage after schema updates.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Formats relative distance to now (e.g. "5 minutes ago", "in 2 days", "just now").
 * Zero-dependency native replacement for date-fns formatDistanceToNow.
 */
export function formatDistanceToNow(
  date: Date | string | number,
  options: { addSuffix?: boolean } = {}
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30.4375);
  const diffYear = Math.round(diffDay / 365.25);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffSec) < 45) {
    return options.addSuffix
      ? diffSec <= 0
        ? "just now"
        : "in a few seconds"
      : "less than a minute";
  }
  if (Math.abs(diffMin) < 45) {
    return rtf.format(diffMin, "minute");
  }
  if (Math.abs(diffHour) < 22) {
    return rtf.format(diffHour, "hour");
  }
  if (Math.abs(diffDay) < 26) {
    return rtf.format(diffDay, "day");
  }
  if (Math.abs(diffMonth) < 11) {
    return rtf.format(diffMonth, "month");
  }
  return rtf.format(diffYear, "year");
}

/**
 * Formats a Date using standard tokens (yyyy, MM, MMM, dd, d, EEE, hh, mm, a, etc.).
 * Zero-dependency native replacement for date-fns format.
 */
export function format(date: Date | string | number, formatStr: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const dayOfWeek = d.getDay();

  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const tokens: Record<string, string> = {
    yyyy: String(year),
    yy: String(year).slice(-2),
    MMMM: MONTHS_LONG[month],
    MMM: MONTHS_SHORT[month],
    MM: pad(month + 1),
    M: String(month + 1),
    dd: pad(day),
    d: String(day),
    EEEE: DAYS_LONG[dayOfWeek],
    EEE: DAYS_SHORT[dayOfWeek],
    hh: pad(hours12),
    h: String(hours12),
    HH: pad(hours24),
    H: String(hours24),
    mm: pad(minutes),
    m: String(minutes),
    ss: pad(seconds),
    s: String(seconds),
    a: ampm,
  };

  return formatStr.replace(
    /(yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|hh|h|HH|H|mm|m|ss|s|a)/g,
    (match) => tokens[match] ?? match
  );
}

export function addDays(date: Date | string | number, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function subDays(date: Date | string | number, amount: number): Date {
  return addDays(date, -amount);
}

export function differenceInDays(
  dateLeft: Date | string | number,
  dateRight: Date | string | number
): number {
  const dLeft = new Date(dateLeft);
  const dRight = new Date(dateRight);
  const utcLeft = Date.UTC(dLeft.getFullYear(), dLeft.getMonth(), dLeft.getDate());
  const utcRight = Date.UTC(dRight.getFullYear(), dRight.getMonth(), dRight.getDate());
  return Math.floor((utcLeft - utcRight) / (1000 * 60 * 60 * 24));
}

export function isPast(date: Date | string | number): boolean {
  return new Date(date).getTime() < Date.now();
}

export function isToday(date: Date | string | number): boolean {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function isTomorrow(date: Date | string | number): boolean {
  const d = new Date(date);
  const tomorrow = addDays(new Date(), 1);
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  );
}

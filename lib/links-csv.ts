import type { CsvLinkRow } from "@/lib/types/links";

function uid(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function detectDelimiter(line: string): string {
  const candidates = ["\t", ",", ";", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

// Maps a known header label -> the CsvLinkRow field it fills.
const HEADER_KEYS: Record<string, keyof CsvLinkRow> = {
  title: "title",
  name: "title",
  "link title": "title",
  url: "url",
  link: "url",
  web: "url",
  website: "url",
  category: "categoryName",
  cat: "categoryName",
  type: "categoryName",
  notes: "notes",
  note: "notes",
  description: "notes",
  tags: "tags",
  label: "tags",
};

function normalizeHeader(h: string): keyof CsvLinkRow | null {
  const key = h.trim().toLowerCase();
  return HEADER_KEYS[key] ?? null;
}

function domainFromUrl(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Brand tokens = the company / app / domain name, which is already conveyed
// by the title + URL. Tags that merely repeat these are redundant.
function brandTokens(title: string, url: string): Set<string> {
  const domain = domainFromUrl(url);
  const tokens = new Set<string>();
  // Every label in the domain (e.g. "beat" and "app" from "beat.app") is
  // treated as a brand token — app names like "Beat App" must not become tags.
  for (const label of domain.toLowerCase().split(".")) {
    if (label.length >= 2) tokens.add(label);
  }
  for (const w of title.toLowerCase().split(/[^a-z0-9]+/i)) {
    if (w.length >= 2) tokens.add(w);
  }
  return tokens;
}

/**
 * Strip tags that merely repeat the company / brand / app / domain name.
 * Those are redundant (already the title/URL) and must never be tags.
 * Meaningful differentiator tags (type/topic/stage) are preserved.
 */
export function sanitizeLinkTags(
  title: string,
  url: string,
  tags?: string[]
): string[] | undefined {
  if (!tags || tags.length === 0) return tags;
  const brand = brandTokens(title, url);
  const cleaned = tags
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean)
    .filter((t) => {
      const low = t.toLowerCase();
      if (brand.has(low)) return false;
      const words = low.split(/[^a-z0-9]+/i).filter(Boolean);
      if (words.length > 0 && words.every((w) => brand.has(w))) return false;
      return true;
    });
  return cleaned.length > 0 ? cleaned : undefined;
}

function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[|,;]/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
}

/**
 * Heuristic, fully-offline CSV / TSV / pasted-links parser.
 * Accepts:
 *  - header rows with any of the recognized column labels (case-insensitive)
 *  - headerless rows assumed as: title, url, category, notes, tags
 *  - plain pasted "Title — url" lines
 */
export function parseCsvRaw(text: string): CsvLinkRow[] {
  const lines = splitLines(text);
  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines[0]);
  const firstCells = lines[0].split(delim).map((c) => c.trim());

  const headerMap: (keyof CsvLinkRow | null)[] = firstCells.map(normalizeHeader);
  const hasHeader = headerMap.some((h) => h !== null);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CsvLinkRow[] = [];
  for (const line of dataLines) {
    const cells = line.split(delim).map((c) => c.trim());
    if (cells.length === 0 || cells.every((c) => c === "")) continue;

    const rec: Partial<CsvLinkRow> = {};
    if (hasHeader) {
      headerMap.forEach((key, idx) => {
        if (!key) return;
        const val = cells[idx] ?? "";
        if (key === "tags") rec.tags = parseTags(val);
        else (rec as Record<string, unknown>)[key] = val;
      });
    } else {
      rec.title = cells[0] ?? "";
      rec.url = cells[1] ?? "";
      rec.categoryName = cells[2] || undefined;
      rec.notes = cells[3] || undefined;
      rec.tags = cells[4] ? parseTags(cells[4]) : undefined;
    }

    const title = (rec.title ?? "").toString();
    const url = (rec.url ?? "").toString();
    if (!title && !url) continue;

    const finalTitle = title || domainFromUrl(url) || "Untitled Link";
    const needsReview = !title || !url;

    rows.push({
      id: uid(),
      title: finalTitle,
      url,
      categoryName: rec.categoryName || undefined,
      notes: rec.notes || undefined,
      tags: sanitizeLinkTags(finalTitle, url, rec.tags),
      needsReview,
    });
  }

  // Fallback: single-column "Title — url" style pastes.
  if (rows.length === 0 && lines.length > 0 && delim === ",") {
    for (const line of lines) {
      const m = line.match(/^(.*?)\s*[—\-–|:]\s*(https?:\/\/\S+|\S+\.\S+)\s*$/);
      if (m) {
        rows.push({
          id: uid(),
          title: m[1].trim() || domainFromUrl(m[2]),
          url: m[2].trim(),
          needsReview: false,
        });
      }
    }
  }

  return rows;
}

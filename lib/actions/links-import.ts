"use server";

import type { CsvLinkRow, FormatLinksResult } from "@/lib/types/links";
import { createLink, createCategory } from "@/lib/actions/links";
import { getOrCreateLocalUser } from "@/lib/db/local-user";
import { resolveProviderChain, generateText } from "@/lib/ai/providers";
import { sanitizeLinkTags } from "@/lib/links-csv";

const FORMAT_PROMPT = `You are a data-normalization assistant. The user pasted a block of links (CSV, TSV, or free text). Convert it into a clean JSON array.

Each item must be an object with these fields only:
- "title": string (human-readable name; derive from the URL domain if missing)
- "url": string (a valid http/https URL; prepend https:// if missing a scheme)
- "categoryName": string (optional — the category this link belongs to, e.g. "Recruitment Portals", "Career Pages", "Career Groups", "Useful Links", or any other sensible name)
- "notes": string (optional)
- "tags": string[] (optional)

Rules:
- Output ONLY a JSON array. No prose, no markdown fences.
- Infer a sensible categoryName when one is implied by the context (e.g. a job board -> "Recruitment Portals").
- If the link is clearly malformed, still do your best to extract a title + url.
- Preserve every row from the input; do not drop data.

TAG RULES (important — follow exactly):
- The title and URL already contain the company / brand / app / product name. NEVER use that name as a tag. Tags that repeat the brand (e.g. the app name, "beat", "mascot", or the company name) are forbidden and useless.
- Tags must instead capture what makes each link DIFFERENT or USABLE, for example:
  * the link TYPE: job-board, career-page, referral, blog, docs, login, dashboard, application
  * the TOPIC or focus: engineering, design, internships, remote, graduate, finance
  * the STAGE or action: apply, track, research, prepare
  * where applicable, the source PLATFORM only if it is NOT the brand itself (e.g. linkedin, indeed, glassdoor)
- Keep tags short, lowercase, single-concept. Prefer 1-3 meaningful tags per link over repeating the name.`;

function parseModelJson(text: string): CsvLinkRow[] | null {
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\\[[\\s\\S]*\\])/);
  const raw = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text;
  try {
    const arr = JSON.parse(raw.trim());
    if (!Array.isArray(arr)) return null;
    return arr
      .map((item: Record<string, unknown>, i: number): CsvLinkRow | null => {
        if (typeof item !== "object" || item === null) return null;
        const title = String(item.title ?? "").trim();
        const url = String(item.url ?? "").trim();
        if (!title && !url) return null;
        const tagsRaw = item.tags;
        const tags = Array.isArray(tagsRaw)
          ? tagsRaw.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean)
          : typeof tagsRaw === "string"
            ? String(tagsRaw)
                .split(/[|,;]/)
                .map((t) => t.trim().replace(/^#/, ""))
                .filter(Boolean)
            : undefined;
        return {
          id: `ai-${i}-${Math.random().toString(36).slice(2, 7)}`,
          title: title || url,
          url,
          categoryName: item.categoryName ? String(item.categoryName).trim() : undefined,
          notes: item.notes ? String(item.notes).trim() : undefined,
          tags: sanitizeLinkTags(title || url, url, tags),
          needsReview: !title || !url,
        };
      })
      .filter((r): r is CsvLinkRow => r !== null);
  } catch {
    return null;
  }
}

/**
 * Optional AI normalization of messy link input. Returns null when no
 * provider is configured or the model output can't be parsed — the caller
 * then falls back to the deterministic parseCsvRaw().
 */
export async function formatLinksWithAi(
  rawText: string
): Promise<FormatLinksResult | null> {
  let userId: string;
  try {
    userId = getOrCreateLocalUser().id;
  } catch {
    return null;
  }
  const chain = await resolveProviderChain(userId, "text");
  if (chain.length === 0) return null;

  try {
    const result = await generateText(
      chain,
      { systemPrompt: FORMAT_PROMPT, userPrompt: rawText, maxOutputTokens: 8192 },
      { userId, action: "format_links_csv" }
    );
    const rows = parseModelJson(result.text);
    if (!rows || rows.length === 0) return null;
    return { rows, notes: "Formatted with AI." };
  } catch {
    return null;
  }
}

export interface ImportLinksResult {
  created: number;
  failed: number;
  skipped: { title: string; reason: string }[];
  errors: string[];
}

/**
 * Bulk-create links. Resolves each row's category by name against
 * `categoryMap` (name -> id); unknown categories are created on the fly.
 * Rows missing both title and url are skipped with a reason.
 */
export async function importLinks(
  rows: CsvLinkRow[],
  categoryMap: Record<string, string>,
  fallbackCategoryId: string
): Promise<ImportLinksResult> {
  const nameToId: Record<string, string> = { ...categoryMap };
  const result: ImportLinksResult = { created: 0, failed: 0, skipped: [], errors: [] };

  for (const row of rows) {
    const title = (row.title ?? "").toString().trim();
    const url = (row.url ?? "").toString().trim();
    if (!title && !url) {
      result.skipped.push({ title: title || "(blank)", reason: "No title or URL" });
      continue;
    }
    if (!title || !url) {
      result.skipped.push({
        title: title || url,
        reason: !title ? "Missing title" : "Missing URL",
      });
      continue;
    }

    let categoryId = fallbackCategoryId;
    const catName = (row.categoryName ?? "").toString().trim();
    if (catName) {
      const existing = nameToId[catName] ?? nameToId[catName.toLowerCase()];
      if (existing) {
        categoryId = existing;
      } else {
        const created = await createCategory({ name: catName });
        if (created.success && created.data) {
          nameToId[catName] = created.data.id;
          nameToId[catName.toLowerCase()] = created.data.id;
          categoryId = created.data.id;
        }
      }
    }

    const res = await createLink({
      title,
      url,
      category_id: categoryId,
      notes: row.notes || null,
      tags: row.tags ?? [],
    });
    if (res.success) result.created += 1;
    else {
      result.failed += 1;
      result.errors.push(`${title}: ${res.error ?? "Failed to create"}`);
    }
  }

  return result;
}


"use server";

import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db/sqlite";
import { moduleLogger } from "@/lib/log";

const log = moduleLogger("actions.search");

export interface SearchResult {
  type: "job" | "company" | "contact" | "document" | "application" | "interview" | "deadline" | "position" | "page";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  contentSnippet?: string;
}

export interface AdminSearchResult {
  type: "user" | "activity" | "ai_usage" | "page";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

const PAGE_RESULTS: { title: string; href: string; keywords: string }[] = [
  { title: "Overview", href: "/overview", keywords: "dashboard home summary stats" },
  { title: "Board", href: "/board", keywords: "kanban pipeline stages drag wishlist columns" },
  { title: "Jobs", href: "/jobs", keywords: "job listings saved interested preparing" },
  { title: "Applications", href: "/applications", keywords: "application drafts submitted sent" },
  { title: "Interviews", href: "/interviews", keywords: "interview schedule upcoming completed" },
  { title: "CRM", href: "/crm", keywords: "contacts companies network hiring managers recruiters alumni" },
  { title: "Documents", href: "/documents", keywords: "resume cv cover letter file upload" },
  { title: "Settings", href: "/settings", keywords: "account profile smtp email preferences" },
  { title: "AI Prompts", href: "/preferences/ai-prompts", keywords: "custom ai system prompts cover letter templates preferences" },
  { title: "Database", href: "/preferences/database", keywords: "database sqlite tables schema viewer data preferences" },
  { title: "Performance", href: "/preferences", keywords: "performance ram memory cpu system ports root path connection process status details preferences" },
];

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const { userId } = await getUser();
  const q = query.trim();
  const results: SearchResult[] = [];

  // 1. Pages & Navigation
  for (const page of PAGE_RESULTS) {
    if (
      page.title.toLowerCase().includes(q.toLowerCase()) ||
      page.keywords.toLowerCase().includes(q.toLowerCase())
    ) {
      results.push({
        type: "page",
        id: page.href,
        title: page.title,
        subtitle: "Navigation",
        href: page.href,
        icon: "page",
      });
    }
  }

  // 2. Omni-Search FTS5 Single Query (O(1) inverted index term lookup time complexity)
  try {
    const db = getDb();
    const sanitized = q.replace(/[^a-zA-Z0-9\s]/g, "").trim();
    let ftsRows: Array<{
      entity_type: string;
      entity_id: string;
      title: string;
      subtitle: string;
      content: string;
      href: string;
      icon: string;
    }> = [];

    if (sanitized.length > 0) {
      const ftsQuery = sanitized.split(/\s+/).filter(Boolean).map((term) => `"${term}"*`).join(" ");
      try {
        ftsRows = db.prepare(`
          SELECT entity_type, entity_id, title, subtitle, content, href, icon
          FROM omni_search_index
          WHERE user_id = ? AND omni_search_index MATCH ?
          ORDER BY bm25(omni_search_index, 10.0, 5.0, 2.0)
          LIMIT 150
        `).all(userId, ftsQuery) as typeof ftsRows;
      } catch {
        const like = `%${q}%`;
        ftsRows = db.prepare(`
          SELECT entity_type, entity_id, title, subtitle, content, href, icon
          FROM omni_search_index
          WHERE user_id = ? AND (title LIKE ? OR subtitle LIKE ? OR content LIKE ?)
          LIMIT 150
        `).all(userId, like, like, like) as typeof ftsRows;
      }
    } else {
      const like = `%${q}%`;
      ftsRows = db.prepare(`
        SELECT entity_type, entity_id, title, subtitle, content, href, icon
        FROM omni_search_index
        WHERE user_id = ? AND (title LIKE ? OR subtitle LIKE ? OR content LIKE ?)
        LIMIT 150
      `).all(userId, like, like, like) as typeof ftsRows;
    }

    for (const r of ftsRows) {
      let snippet: string | undefined = undefined;
      if (r.content && r.content.trim().length > 0) {
        const cleanContent = r.content.trim();
        const matchIdx = cleanContent.toLowerCase().indexOf(q.toLowerCase());
        if (matchIdx >= 0) {
          const start = Math.max(0, matchIdx - 30);
          const end = Math.min(cleanContent.length, matchIdx + q.length + 50);
          snippet = (start > 0 ? "..." : "") + cleanContent.slice(start, end) + (end < cleanContent.length ? "..." : "");
        } else if (cleanContent.length > 100) {
          snippet = cleanContent.slice(0, 100) + "...";
        } else {
          snippet = cleanContent;
        }
      }

      results.push({
        type: r.entity_type as SearchResult["type"],
        id: r.entity_id,
        title: r.title || "Untitled",
        subtitle: r.subtitle || "",
        href: r.href || "#",
        icon: r.icon || r.entity_type,
        contentSnippet: snippet,
      });
    }
  } catch (err) {
    log.error({ err }, "Omni search query failed:");
  }

  return results;
}

const ADMIN_PAGE_RESULTS: { title: string; href: string; keywords: string }[] = [
  { title: "Dashboard", href: "/admin", keywords: "admin dashboard overview stats" },
  { title: "Users", href: "/admin/users", keywords: "users accounts manage ban promote" },
  { title: "Activity Log", href: "/admin/activity", keywords: "activity audit log actions" },
  { title: "AI Usage", href: "/admin/ai-usage", keywords: "ai usage tokens cost requests" },
];

export async function adminGlobalSearch(query: string): Promise<AdminSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();
  const like = `%${q}%`;
  const limit = 5;
  const results: AdminSearchResult[] = [];

  // Search admin pages
  for (const page of ADMIN_PAGE_RESULTS) {
    if (
      page.title.toLowerCase().includes(q.toLowerCase()) ||
      page.keywords.toLowerCase().includes(q.toLowerCase())
    ) {
      results.push({
        type: "page",
        id: page.href,
        title: page.title,
        subtitle: "Navigation",
        href: page.href,
        icon: "page",
      });
    }
  }

  // Optimized indexed SQL join search directly against SQLite engine
  const db = getDb();
  const matchedProfiles = db.prepare(`
    SELECT p.id, p.full_name, p.role, p.is_banned, u.email
    FROM profiles p
    LEFT JOIN users u ON p.id = u.id
    WHERE p.full_name LIKE ? OR p.role LIKE ? OR u.email LIKE ?
    LIMIT ?
  `).all(like, like, like, limit) as Array<{
    id: string;
    full_name: string | null;
    role: string | null;
    is_banned: boolean | null;
    email: string | null;
  }>;

  for (const p of matchedProfiles) {
    results.push({
      type: "user",
      id: p.id,
      title: p.full_name ?? p.email ?? "Unknown",
      subtitle: [p.email, p.role, p.is_banned ? "Banned" : null]
        .filter(Boolean)
        .join(" · "),
      href: `/admin/users/${p.id}`,
      icon: "user",
    });
  }

  const matchedAiLogs = db.prepare(`
    SELECT l.id, l.action, l.model, l.user_id, u.email
    FROM ai_usage_logs l
    LEFT JOIN users u ON l.user_id = u.id
    WHERE l.action LIKE ? OR l.model LIKE ?
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(like, like, limit) as Array<{
    id: string;
    action: string;
    model: string;
    user_id: string;
    email: string | null;
  }>;

  for (const log of matchedAiLogs) {
    results.push({
      type: "ai_usage",
      id: log.id,
      title: `${log.action} (${log.model})`,
      subtitle: log.email ?? "unknown",
      href: "/admin/ai-usage",
      icon: "ai_usage",
    });
  }

  return results;
}

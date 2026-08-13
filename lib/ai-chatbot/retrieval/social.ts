import { createDbClient } from "@/lib/db/client";
import type { RetrievedDoc } from "./types";

const LINK_CAP = 30;

/**
 * Saved links / bookmarks (links table) + per-contact social URLs.
 * Reads via the project's DB client (user-scoped by callers passing userId).
 */
export async function getSocialLinks(userId: string): Promise<RetrievedDoc[]> {
  const db = createDbClient();
  const { data: links } = await db
    .from("links")
    .select("id, title, url, notes, tags")
    .eq("user_id", userId)
    .order("title", { ascending: true })
    .limit(LINK_CAP);

  const out: RetrievedDoc[] = [];
  (links ?? []).slice(0, LINK_CAP).forEach((l: Record<string, unknown>) => {
    const text = [
      `Title: ${l.title}`,
      `URL: ${l.url}`,
      l.notes ? `Notes: ${l.notes}` : null,
      l.tags ? `Tags: ${l.tags}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    out.push({
      source: "social",
      id: `link:${l.id}`,
      title: String(l.title ?? "link"),
      text,
      citeRef: `link:${l.id}`,
    });
  });
  return out;
}

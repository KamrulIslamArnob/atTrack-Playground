import { createDbClient } from "@/lib/db/client";
import { getSemanticMemories } from "./hybrid";
import type { RetrievedDoc } from "./types";

/**
 * AI Memories DB (ai_memories table) — user's persistent markdown notes and knowledge.
 * Supports hybrid semantic vector search and relational retrieval.
 */
export async function getMemoriesRetrieved(
  userId: string,
  filterQuery?: string
): Promise<RetrievedDoc[]> {
  if (filterQuery && filterQuery.trim()) {
    try {
      const semanticMemories = await getSemanticMemories(userId, filterQuery.trim(), 10);
      if (semanticMemories.length > 0) {
        return semanticMemories.map((m) => {
          const memoryTitle = m.title ? String(m.title) : "Custom Memory";
          return {
            source: "memories",
            id: `memory:${m.id}`,
            title: `Memory: ${memoryTitle}`,
            text: `# Memory: ${memoryTitle}\n${m.description}`,
            citeRef: `memory:${m.id}`,
          };
        });
      }
    } catch (err) {
      console.warn("Semantic memory retrieval failed, falling back to lexical search:", err);
    }
  }

  const db = createDbClient();
  let q = db
    .from("ai_memories")
    .select("id, title, description, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (filterQuery && filterQuery.trim()) {
    q = q.ilike("description", `%${filterQuery.trim()}%`);
  }

  const { data } = await q.limit(10);

  const out: RetrievedDoc[] = [];
  (data ?? []).forEach((m: Record<string, unknown>) => {
    const memoryTitle = m.title ? String(m.title) : "Custom Memory";
    const desc = String(m.description ?? "");
    out.push({
      source: "memories",
      id: `memory:${m.id}`,
      title: `Memory: ${memoryTitle}`,
      text: `# Memory: ${memoryTitle}\n${desc}`,
      citeRef: `memory:${m.id}`,
    });
  });
  return out;
}

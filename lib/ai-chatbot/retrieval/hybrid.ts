import { getDb } from "@/lib/db/sqlite";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { RetrievedMemory } from "./types";

/**
 * Retrieves semantically relevant user memory facts using vec_memories.
 */
export async function getSemanticMemories(
  userId: string,
  query: string,
  limit: number = 3
): Promise<RetrievedMemory[]> {
  const db = getDb();
  const queryEmbedding = await generateEmbedding(query, userId);

  try {
    // 1. Pure KNN search on vec_memories virtual table
    const vecRows = db.prepare(`
      SELECT
        id,
        distance,
        memory_id
      FROM vec_memories
      WHERE embedding MATCH ?
        AND k = ?
    `).all(queryEmbedding, limit * 3) as Array<{
      id: number;
      distance: number;
      memory_id: string;
    }>;

    if (vecRows.length === 0) return [];

    const memoryIds = vecRows.map((r) => r.memory_id).filter(Boolean);
    const placeholders = memoryIds.map(() => "?").join(",");

    // 2. Hydrate from relational ai_memories with user_id scoping
    const rows = db.prepare(`
      SELECT id, title, description
      FROM ai_memories
      WHERE id IN (${placeholders})
        AND user_id = ?
    `).all(...memoryIds, userId) as Array<{
      id: string;
      title: string | null;
      description: string;
    }>;

    const distMap = new Map(vecRows.map((v) => [v.memory_id, v.distance]));
    return rows
      .map((r) => {
        const dist = distMap.get(r.id) ?? 0.5;
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          relevanceScore: Math.max(0, 1 - dist),
          distance: dist,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  } catch (err) {
    console.warn("Vector memory search failed, falling back to relational query:", err);
    const rows = db
      .prepare(
        "SELECT id, title, description FROM ai_memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?"
      )
      .all(userId, limit) as Array<{ id: string; title: string | null; description: string }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      relevanceScore: 0.5,
    }));
  }
}

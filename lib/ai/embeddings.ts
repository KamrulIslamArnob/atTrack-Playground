import { getDb } from "@/lib/db/sqlite";
import { resolveProviderChain } from "@/lib/ai/providers";

export const VECTOR_DIMENSION = 768;

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

/**
 * Approximate token estimator: ~4 chars per token, or word count * 1.3
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  const words = text.trim().split(/\s+/).length;
  const charEstimate = Math.ceil(text.length / 4);
  return Math.max(words, charEstimate);
}

/**
 * Chunks text with a sliding window (300-500 tokens) respecting paragraph and sentence boundaries.
 */
export function chunkText(
  text: string,
  options: { maxTokens?: number; overlapTokens?: number } = {}
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const maxTokens = options.maxTokens ?? 400;
  const overlapTokens = options.overlapTokens ?? 50;

  const trimmed = text.trim();
  const totalTokens = estimateTokens(trimmed);

  if (totalTokens <= maxTokens) {
    return [{ index: 0, content: trimmed, tokenCount: totalTokens }];
  }

  let units = trimmed.split(/\n\s*\n/).map((u) => u.trim()).filter((u) => u.length > 0);
  if (units.length === 1 && totalTokens > maxTokens) {
    units = trimmed.split(/\n+/).map((u) => u.trim()).filter((u) => u.length > 0);
  }

  const chunks: TextChunk[] = [];
  let currentUnits: string[] = [];
  let currentTokenCount = 0;
  let chunkIndex = 0;

  for (const unit of units) {
    const unitTokens = estimateTokens(unit);

    if (currentTokenCount + unitTokens > maxTokens && currentUnits.length > 0) {
      const chunkContent = currentUnits.join("\n\n");
      chunks.push({
        index: chunkIndex++,
        content: chunkContent,
        tokenCount: estimateTokens(chunkContent),
      });

      const overlapAccum: string[] = [];
      let overlapTokensCount = 0;
      for (let i = currentUnits.length - 1; i >= 0; i--) {
        const uTokens = estimateTokens(currentUnits[i]);
        if (overlapTokensCount + uTokens <= overlapTokens) {
          overlapAccum.unshift(currentUnits[i]);
          overlapTokensCount += uTokens;
        } else {
          break;
        }
      }
      currentUnits = [...overlapAccum, unit];
      currentTokenCount = overlapTokensCount + unitTokens;
    } else {
      currentUnits.push(unit);
      currentTokenCount += unitTokens;
    }
  }

  if (currentUnits.length > 0) {
    const chunkContent = currentUnits.join("\n\n");
    chunks.push({
      index: chunkIndex++,
      content: chunkContent,
      tokenCount: estimateTokens(chunkContent),
    });
  }

  return chunks;
}

/**
 * Deterministic fallback vector hash for offline mode / unit tests
 */
export function generateDeterministicEmbedding(text: string, dimension: number = VECTOR_DIMENSION): Float32Array {
  const vector = new Float32Array(dimension);
  if (!text || text.length === 0) return vector;

  const words = text.toLowerCase().match(/[a-z0-9_#+.-]+/g) || [text];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let h1 = 5381;
    let h2 = 2166136261;
    for (let j = 0; j < word.length; j++) {
      const code = word.charCodeAt(j);
      h1 = ((h1 << 5) + h1) ^ code;
      h2 = Math.imul(h2 ^ code, 16777619);
    }
    for (let s = 0; s < 16; s++) {
      const dim = Math.abs(h1 + s * h2) % dimension;
      const sign = ((h2 + s * h1) & 1) === 0 ? 1.0 : -1.0;
      vector[dim] += sign / Math.sqrt(words.length);
    }
  }

  let norm = 0;
  for (let d = 0; d < dimension; d++) {
    norm += vector[d] * vector[d];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let d = 0; d < dimension; d++) {
      vector[d] /= norm;
    }
  }

  return vector;
}

const MAX_CACHE_ENTRIES = 1000;
const embeddingCache = new Map<string, Float32Array>();

function getCachedEmbedding(key: string): Float32Array | undefined {
  const item = embeddingCache.get(key);
  if (item) {
    embeddingCache.delete(key);
    embeddingCache.set(key, item);
  }
  return item;
}

function setCachedEmbedding(key: string, vector: Float32Array): void {
  if (embeddingCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) {
      embeddingCache.delete(firstKey);
    }
  }
  embeddingCache.set(key, vector);
}

/**
 * Generates a 768-dimensional normalized float32 embedding vector using BYOK provider or local fallback.
 * Employs an in-memory LRU cache for sub-millisecond repeated lookups.
 */
export async function generateEmbedding(text: string, userId?: string): Promise<Float32Array> {
  if (!text || text.trim().length === 0) {
    return new Float32Array(VECTOR_DIMENSION);
  }

  const cleanText = text.trim();
  const cacheKey = `${userId || "anon"}:${cleanText}`;
  const cached = getCachedEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  let resultVector: Float32Array | null = null;

  if (userId) {
    try {
      const providers = await resolveProviderChain(userId, "text");
      const active = providers[0];

      if (active && active.provider_type === "gemini" && active.api_key) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: active.api_key });
        const res = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: cleanText,
        });

        const values = (res as { embeddings?: Array<{ values?: number[] }> }).embeddings?.[0]?.values;
        if (values && values.length > 0) {
          const arr = new Float32Array(VECTOR_DIMENSION);
          const len = Math.min(values.length, VECTOR_DIMENSION);
          for (let i = 0; i < len; i++) arr[i] = values[i];

          // Normalize L2
          let norm = 0;
          for (let i = 0; i < VECTOR_DIMENSION; i++) norm += arr[i] * arr[i];
          norm = Math.sqrt(norm);
          if (norm > 0) {
            for (let i = 0; i < VECTOR_DIMENSION; i++) arr[i] /= norm;
          }
          resultVector = arr;
        }
      }
    } catch (err) {
      console.warn("API embedding failed, falling back to deterministic embedding:", err);
    }
  }

  if (!resultVector) {
    resultVector = generateDeterministicEmbedding(cleanText, VECTOR_DIMENSION);
  }

  setCachedEmbedding(cacheKey, resultVector);
  return resultVector;
}

/**
 * Cosine distance between two vectors: 1 - cosine_similarity (0 = identical, 2 = opposite).
 */
export function cosineDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Vector dimension mismatch");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  const similarity = dot / denom;
  return Math.max(0, Math.min(2, 1 - similarity));
}

/**
 * Indexes long-form text (job description, resume, notes) into relational chunks and sqlite-vec.
 */
export async function indexEntityChunks(params: {
  userId: string;
  sourceId: string;
  sourceType: "job_description" | "job_notes" | "resume" | "document";
  text: string;
}): Promise<{ chunkCount: number }> {
  const { userId, sourceId, sourceType, text } = params;
  const db = getDb();

  // Delete existing chunks for this source
  const oldChunks = db
    .prepare("SELECT id FROM document_chunks WHERE user_id = ? AND source_type = ? AND source_id = ?")
    .all(userId, sourceType, sourceId) as Array<{ id: number }>;

  for (const chunk of oldChunks) {
    try {
      db.prepare("DELETE FROM vec_document_chunks WHERE id = ?").run(chunk.id);
    } catch {}
  }
  db.prepare("DELETE FROM document_chunks WHERE user_id = ? AND source_type = ? AND source_id = ?").run(
    userId,
    sourceType,
    sourceId
  );

  const chunks = chunkText(text);
  const insertChunk = db.prepare(`
    INSERT INTO document_chunks (user_id, source_id, source_type, chunk_index, chunk_text, token_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `);

  const insertVec = db.prepare(`
    INSERT INTO vec_document_chunks (id, embedding, user_id, source_id)
    VALUES (?, ?, ?, ?)
  `);

  for (const chunk of chunks) {
    const res = insertChunk.run(userId, sourceId, sourceType, chunk.index, chunk.content, chunk.tokenCount);
    const chunkId = BigInt(res.lastInsertRowid);
    const embedding = await generateEmbedding(chunk.content, userId);
    try {
      insertVec.run(chunkId, embedding, userId, sourceId);
    } catch (err) {
      console.warn("Could not insert into vec_document_chunks (extension may be unavailable):", err);
    }
  }

  return { chunkCount: chunks.length };
}

/**
 * Deletes all document chunks and associated vector embeddings for a given source entity.
 */
export function deleteEntityChunks(userId: string, sourceId: string): void {
  const db = getDb();
  const oldChunks = db
    .prepare("SELECT id FROM document_chunks WHERE user_id = ? AND source_id = ?")
    .all(userId, sourceId) as Array<{ id: number }>;

  for (const chunk of oldChunks) {
    try {
      db.prepare("DELETE FROM vec_document_chunks WHERE id = ?").run(chunk.id);
    } catch {}
  }
  db.prepare("DELETE FROM document_chunks WHERE user_id = ? AND source_id = ?").run(userId, sourceId);
}

/**
 * Indexes an AI memory into vec_memories table.
 */
export async function indexMemoryVector(
  memoryId: string,
  userId: string,
  title: string | null,
  description: string
): Promise<void> {
  const db = getDb();
  try {
    db.prepare("DELETE FROM vec_memories WHERE memory_id = ?").run(memoryId);
  } catch {}

  const textToEmbed = title ? `${title}: ${description}` : description;
  const embedding = await generateEmbedding(textToEmbed, userId);

  try {
    db.prepare(`
      INSERT INTO vec_memories (embedding, memory_id, user_id)
      VALUES (?, ?, ?)
    `).run(embedding, memoryId, userId);
  } catch (err) {
    console.warn("Could not insert into vec_memories:", err);
  }
}

/**
 * Deletes an AI memory vector.
 */
export function deleteMemoryVector(memoryId: string): void {
  const db = getDb();
  try {
    db.prepare("DELETE FROM vec_memories WHERE memory_id = ?").run(memoryId);
  } catch {}
}

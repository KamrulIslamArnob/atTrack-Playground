"use server";

import { createHash } from "node:crypto";
import { getUser } from "@/lib/auth";

export interface EmailOutput {
  subject: string;
  body: string;
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((obj as Record<string, unknown>)[k])}`
  );
  return "{" + pairs.join(",") + "}";
}

function hashParams(params: Record<string, unknown>): string {
  return createHash("sha256")
    .update(canonicalStringify(params))
    .digest("hex");
}

/**
 * Returns a cached email / AI-tool output for the given params, if one exists
 * and the underlying inputs haven't changed. The key is a SHA-256 of all the
 * params that went into generation (job description, resume content, etc.).
 */
export async function getCachedOutput(
  kind: string,
  params: Record<string, unknown>
): Promise<EmailOutput | null> {
  const { supabase, userId } = await getUser();
  const contentHash = hashParams(params);

  const { data } = await supabase
    .from("ai_output_cache")
    .select("id, output, created_at")
    .eq("user_id", userId)
    .eq("content_hash", contentHash)
    .eq("kind", kind)
    .maybeSingle();

  if (!data?.output) return null;

  const output = data.output as EmailOutput;
  if (
    !output.subject ||
    !output.body ||
    output.subject.trim().toLowerCase().includes("your subject line here") ||
    output.body.trim().toLowerCase().includes("your email body here") ||
    output.subject.trim().startsWith("<") ||
    output.body.trim().startsWith("<")
  ) {
    // Purge bad cache entry
    if (data.id) {
      await supabase.from("ai_output_cache").delete().eq("id", data.id);
    }
    return null;
  }

  return output;
}

const MAX_CACHE_ENTRIES_PER_USER = 50;

/** Stores (or overwrites) a generated output in the cache with LRU eviction. */
export async function setCachedOutput(
  kind: string,
  params: Record<string, unknown>,
  output: EmailOutput
): Promise<void> {
  if (
    !output.subject ||
    !output.body ||
    output.subject.trim().toLowerCase().includes("your subject line here") ||
    output.body.trim().toLowerCase().includes("your email body here") ||
    output.subject.trim().startsWith("<") ||
    output.body.trim().startsWith("<")
  ) {
    return;
  }

  const { supabase, userId } = await getUser();
  const contentHash = hashParams(params);

  // Evict oldest cache entries if count exceeds max threshold
  const { data: entries } = await supabase
    .from("ai_output_cache")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (entries && entries.length >= MAX_CACHE_ENTRIES_PER_USER) {
    const overflow = entries.length - MAX_CACHE_ENTRIES_PER_USER + 1;
    const toEvict = entries.slice(0, overflow).map((e) => e.id);
    await supabase.from("ai_output_cache").delete().in("id", toEvict);
  }

  // Upsert: delete old + insert new (shim doesn't expose upsert cleanly).
  await supabase
    .from("ai_output_cache")
    .delete()
    .eq("user_id", userId)
    .eq("content_hash", contentHash);

  await supabase.from("ai_output_cache").insert({
    user_id: userId,
    content_hash: contentHash,
    kind,
    output,
  });
}

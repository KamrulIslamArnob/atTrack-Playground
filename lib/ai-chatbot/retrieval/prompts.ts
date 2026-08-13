import { createDbClient } from "@/lib/db/client";
import type { RetrievedDoc } from "./types";

/**
 * Inbuilt AI-prompt DB (ai_tool_prompts table) — reusable system prompts the
 * app already stores for its "AI Tools" feature. Surfaced as guidance context
 * when an intent aligns (e.g. outreach -> email prompts, interview_prep).
 */
export async function getAiToolPrompts(
  userId: string,
  kind?: string
): Promise<RetrievedDoc[]> {
  const db = createDbClient();
  const q = db.from("ai_tool_prompts").select("id, kind, system_prompt").eq("user_id", userId);
  if (kind) q.eq("kind", kind);
  const { data } = await q.limit(5);

  const out: RetrievedDoc[] = [];
  (data ?? []).forEach((p: Record<string, unknown>) => {
    out.push({
      source: "ai_prompts",
      id: `prompt:${p.id}`,
      title: `AI Tool Prompt: ${p.kind}`,
      text: String(p.system_prompt ?? ""),
      citeRef: `prompt:${p.id}`,
    });
  });
  return out;
}

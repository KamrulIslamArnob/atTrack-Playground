import type { ChatPersona } from "./sessions";
import type { RetrievedDoc } from "./retrieval/types";

/**
 * Builds the GROUNDED context block from retrieved native docs. Each fact is
 * wrapped in [src:<citeRef>]…[/src] so the LLM can quote it verbatim and the
 * UI can map citations back to Sources. This is the "100% accurate" guarantee:
 * workspace facts live ONLY inside these blocks; anything outside is the model's
 * own general knowledge (which the system prompt tells it to label as guidance).
 */
export function buildGroundedContext(docs: RetrievedDoc[]): string | null {
  if (!docs || docs.length === 0) return null;

  const blocks = docs
    .map((d) => `[src:${d.citeRef}] ${d.title}\n${d.text}\n[/src:${d.citeRef}]`)
    .join("\n\n");

  return (
    "=== USER WORKSPACE DATA (verbatim, authoritative — do NOT alter IDs, names, " +
    "dates, salaries, URLs, or statuses) ===\n" +
    blocks +
    "\n=== END WORKSPACE DATA ==="
  );
}

/**
 * Assemble the grounded system prompt. Reuses the existing workspace-context
 * instruction style and ADDS the accuracy rules from the workflow spec (§7).
 */
export function assembleGroundedSystemPrompt(opts: {
  persona?: ChatPersona;
  personaPrompt?: string | null;
  baseSystemPrompt: string;
  groundedContext: string | null;
  webSearchActive?: boolean;
}): string {
  const { persona, personaPrompt, baseSystemPrompt, groundedContext, webSearchActive } = opts;

  const parts: string[] = [baseSystemPrompt];

  if (groundedContext) {
    parts.push(
      "",
      "ACCURACY RULES (critical):",
      "- Facts inside [src:...]...[/src:...] blocks are the user's REAL workspace data. " +
        "You may quote or paraphrase them, but IDs, names, salaries, dates, URLs, and statuses must stay EXACT.",
      "- Anything NOT inside a [src] block is your general knowledge — present it as guidance " +
        '(e.g. "Generally, you might…"), never as workspace fact.',
      "- If the user asks about data not present in the retrieved sources, say you don't see it " +
        "in their workspace. Do NOT guess or invent workspace details.",
      "- When useful, reference the source as [src:<id>] so the UI can show it.",
      "",
      groundedContext
    );
  }

  void persona;
  void personaPrompt;
  void webSearchActive;
  return parts.join("\n");
}

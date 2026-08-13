// Intent classification for the chatbot retrieval workflow.
//
// Goal: given the user's text + current persona, decide WHICH native data
// sources to pull BEFORE calling the LLM. This keeps the retrieval token
// budget bounded and the grounded context accurate.
//
// Design (per chatbot-intent-retrieval-workflow.md §4):
//   - Tier 1: cheap deterministic heuristic (no tokens) — handles the
//     common cases via keyword/regex match against signals.
//   - Tier 2: LLM fallback ONLY when the heuristic is inconclusive, using a
//     tiny classification call (small maxOutputTokens) that returns one of
//     the Intent enum values. Reuses resolveProviderChain for the model.
//
// This module is PURE for the heuristic path (unit-testable without network).
// The LLM fallback is optional and injected by the caller so this file stays
// free of provider imports.

export type Intent =
  | "job_list"
  | "job_detail"
  | "resume_review"
  | "outreach"
  | "interview_prep"
  | "crm_lookup"
  | "social_links"
  | "performance" // NOTE: excluded from retrieval — see retrieval/index.ts
  | "general_qa";

export interface IntentResult {
  primary: Intent;
  secondary: Intent[];
  method: "heuristic" | "llm" | "default";
}

// Signal dictionaries. Keep them conservative — over-matching wastes retrieval.
const SIGNALS: Record<Exclude<Intent, "general_qa">, RegExp> = {
  job_list:
    /\b(jobs?|applications?|positions?|tracking|board|what (am i|have i) (track|apply)|open (roles?|applications?))\b/i,
  job_detail:
    /\b(deadline|salary|responsibilit|requirement|match score|fit|details?|about (the )?(role|position)|for (this|that|the) (job|role|position)|description)\b/i,
  resume_review:
    /\b(resume|cv|ats|bullet ?points?|tailor|rewrite (my )?(cv|resume)|impact statement)\b/i,
  outreach:
    /\b(outreach|cold (email|message)|linkedin|recruiter|hiring manager|message (them|a recruiter)|follow[- ]?up email)\b/i,
  interview_prep:
    /\b(interview|mock|prepare|star method|behavioral|technical (question|round)|practice (question|interview))\b/i,
  crm_lookup:
    /\b(contacts?|crm|recruiter(s)?|who (do i know|at)|network|relationship)\b/i,
  social_links:
    /\b(links?|bookmarks?|resources?|saved (urls?|links?)|reference (sites?|pages?))\b/i,
  performance: /\b(performance|stats|metrics|progress|how am i doing|dashboard numbers?)\b/i,
};

// Persona is only a HINT. Map persona -> a small boost set.
const PERSONA_HINT: Record<string, Intent[]> = {
  ats_coach: ["resume_review"],
  interviewer: ["interview_prep"],
  outreach: ["outreach", "crm_lookup"],
  code_architect: ["general_qa"], // code questions rarely need workspace data
  general: [],
};

// Negative patterns: questions that MENTION a topic but only ask to EXPLAIN the
// concept (not to use the user's data) must NOT trigger retrieval. e.g. "explain
// the STAR method" vs "help me answer this interview question for my Acme role".
const GENERIC_CONCEPT =
  /\b(explain|what is|what's|define|how does|how do(es)? (star|the star)|framework|template|example of|tips (for|on)|guide to|best practice)\b/i;

// Words that signal the user is actually referencing THEIR data (pull it).
// Bare pronouns ("me"/"my") are intentionally NOT enough — they appear in
// generic requests ("give me a framework"). Require a concrete data noun.
const OWN_DATA_SIGNAL =
  /\b(my (job|role|position|resume|cv|application|applications|interview|contact|contacts|linkedin|github)|our (team|company)|this (job|role|position|resume|application|interview|contact)|for (the|my) (acme|company|role|position)|at (acme|google|the company))\b/i;

function heuristicClassify(query: string, personaId?: string): IntentResult | null {
  const matches: Intent[] = [];
  for (const intent of Object.keys(SIGNALS) as Exclude<Intent, "general_qa">[]) {
    if (SIGNALS[intent].test(query)) matches.push(intent);
  }

  // If a data-bearing intent matched but the query is really a generic
  // concept question (no reference to the user's own data), don't pull
  // workspace data — fall back to general_qa. This prevents "explain STAR
  // method" from retrieving jobs/resumes it doesn't need.
  if (matches.length > 0 && GENERIC_CONCEPT.test(query) && !OWN_DATA_SIGNAL.test(query)) {
    return null;
  }

  const hints = PERSONA_HINT[personaId ?? "general"] ?? [];
  for (const h of hints) if (!matches.includes(h)) matches.push(h);

  if (matches.length === 0) return null;

  // De-dupe, keep first as primary (strongest signal order).
  const seen = new Set<Intent>();
  const ordered = matches.filter((m) => (seen.has(m) ? false : (seen.add(m), true)));
  return {
    primary: ordered[0],
    secondary: ordered.slice(1),
    method: "heuristic",
  };
}

/**
 * Classify intent. Synchronous heuristic first; if inconclusive and a
 * `llmClassify` callback is supplied, defer to it (caller owns the token cost).
 */
export function classifyIntent(
  query: string,
  personaId?: string,
  llmClassify?: (query: string, personaId?: string) => Promise<Intent>
): IntentResult {
  const heuristic = heuristicClassify(query, personaId);
  if (heuristic) return heuristic;

  // No heuristic match. If no LLM fallback provided, default safely to
  // general_qa (no retrieval, no token waste).
  if (!llmClassify) {
    return { primary: "general_qa", secondary: [], method: "default" };
  }

  // Synchronous wrapper returns the default; the caller is expected to AWAIT
  // llmClassify separately when it wants the LLM result. To keep this function
  // synchronous and pure for tests, we return default now and let the async
  // path (retrieveContext) override via the injected classifier.
  return { primary: "general_qa", secondary: [], method: "default" };
}

/** Async variant used by the route: runs heuristic, falls back to LLM. */
export async function classifyIntentAsync(
  query: string,
  personaId?: string,
  llmClassify?: (query: string, personaId?: string) => Promise<Intent>
): Promise<IntentResult> {
  const heuristic = heuristicClassify(query, personaId);
  if (heuristic) return heuristic;
  if (llmClassify) {
    try {
      const primary = await llmClassify(query, personaId);
      return { primary, secondary: [], method: "llm" };
    } catch {
      /* fall through to default */
    }
  }
  return { primary: "general_qa", secondary: [], method: "default" };
}

export const INTENT_LABELS: Record<Intent, string> = {
  job_list: "Tracked Jobs",
  job_detail: "Job Details",
  resume_review: "Resume",
  outreach: "Outreach / CRM",
  interview_prep: "Interview Prep",
  crm_lookup: "CRM Contacts",
  social_links: "Saved Links",
  performance: "Performance",
  general_qa: "General",
};

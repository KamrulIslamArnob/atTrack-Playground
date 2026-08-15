import type { Intent } from "../intent";
import type { RetrievedDoc, RetrievalResult } from "./types";
import { getJobsSummary, getJobDetails } from "./jobs";
import { getResumes } from "./resumes";
import { getContactsRetrieved } from "./crm";
import { getSocialLinks } from "./social";
import { getAiToolPrompts } from "./prompts";
import { getMemoriesRetrieved } from "./memories";

// Source chip labels for the existing SourcesUsedChip UI (chat-messages.tsx).
const SOURCE_LABEL: Record<RetrievedDoc["source"], string> = {
  jobs: "Job Applications",
  job_detail: "Job Details",
  resumes: "Resume",
  crm: "CRM Contacts",
  social: "Saved Links",
  ai_prompts: "AI Tool Prompts",
  memories: "AI Memories",
  applications: "Applications",
  interviews: "Interviews",
};

// Map intent -> which retrievers to run. `performance` is intentionally EXCLUDED
// from retrieval: in this app /api/performance returns OS/system metrics, not
// career metrics, so there is no native career-performance data source. If such
// a source is added later, add a performance.ts retriever and include it here.
const INTENT_SOURCES: Record<Intent, (() => Promise<RetrievedDoc[]>)[]> = {
  job_list: [() => Promise.resolve([])], // filled with userId below
  job_detail: [],
  resume_review: [],
  outreach: [],
  interview_prep: [],
  crm_lookup: [],
  social_links: [],
  performance: [], // excluded — see note above
  general_qa: [],
};

/**
 * Intent-scoped retrieval of native workspace data. Read-only, user-scoped.
 * Returns retrieved docs + source chips for the UI + dropped-source notes.
 *
 * Every retriever is user-scoped (via getUser() inside the lib/actions/* calls,
 * or by passing userId to the DB-client queries). We never cross user bounds.
 */
export async function retrieveContext(
  intent: Intent,
  userId: string,
  query: string,
  enabledSourceIds?: string[]
): Promise<RetrievalResult> {
  const dropped: string[] = [];
  let docs: RetrievedDoc[] = [];

  // Permission gate: if the user has disabled a source, do not pull it even if
  // the intent would. `enabledSourceIds === undefined` means the permission
  // model isn't in play (legacy client) -> no gating. `[]` means all off.
  // A non-empty array restricts to exactly those source ids.
  const allowed = (id: string) => {
    if (enabledSourceIds === undefined) return true;
    if (enabledSourceIds.includes(id)) return true;
    // Social links and CRM merge: granting CRM ("contacts") also gives social links ("links") access and vice-versa
    if (id === "links" && enabledSourceIds.includes("contacts")) return true;
    if (id === "contacts" && enabledSourceIds.includes("links")) return true;
    return false;
  };

  switch (intent) {
    case "job_list":
      if (allowed("jobs")) docs = await getJobsSummary(userId);
      else dropped.push("Job Applications source is disabled.");
      break;
    case "job_detail":
      if (allowed("jobs")) {
        const r = await getJobDetails(userId, query);
        dropped.push(...r.dropped);
        docs = r.docs;
      } else {
        dropped.push("Job Applications source is disabled.");
      }
      break;
    case "resume_review":
      if (allowed("resume")) docs = await getResumes(userId);
      else dropped.push("Resume source is disabled.");
      break;
    case "outreach": {
      const [crmDocs, aiDocs] = await Promise.all([
        allowed("contacts") ? getContactsRetrieved(userId) : Promise.resolve([]),
        allowed("ai_prompts") ? getAiToolPrompts(userId, "email") : Promise.resolve([]),
      ]);
      docs = [...crmDocs, ...aiDocs];
      if (!allowed("contacts") && !allowed("ai_prompts")) dropped.push("Outreach sources disabled.");
      break;
    }
    case "crm_lookup":
      if (allowed("contacts") || allowed("links")) docs = await getContactsRetrieved(userId);
      else dropped.push("Contacts CRM & Social Links source is disabled.");
      break;
    case "interview_prep": {
      const [jobsSummary, aiDocs] = await Promise.all([
        allowed("jobs") ? getJobsSummary(userId).then((d) => d.slice(0, 4)) : Promise.resolve([]),
        allowed("ai_prompts") ? getAiToolPrompts(userId, "interview") : Promise.resolve([]),
      ]);
      docs = [...jobsSummary, ...aiDocs];
      break;
    }
    case "social_links":
      if (allowed("contacts") || allowed("links")) docs = await getSocialLinks(userId);
      else dropped.push("Contacts CRM & Social Links source is disabled.");
      break;
    case "performance":
      dropped.push("Performance intent: no native career-performance data source (app/performance is OS metrics).");
      break;
    case "general_qa":
    default:
      docs = [];
      break;
  }

  // Fast memory check: if query specifically mentions memories/notes or contains @ mention, pull memories
  if (allowed("memories") && (/\b(memor(y|ies)|notes?|guidelines?|rules?|preferences?|saved context|custom context)\b/i.test(query) || query.includes("@"))) {
    const memDocs = await getMemoriesRetrieved(userId, query.includes("@") ? undefined : query);
    if (memDocs.length > 0) {
      docs = [...docs, ...memDocs];
    }
  }

  // Token safety net: hard cap total docs to avoid runaway context.
  const HARD_CAP = 40;
  if (docs.length > HARD_CAP) {
    dropped.push(`Retrieval capped at ${HARD_CAP} docs (${docs.length} found).`);
    docs = docs.slice(0, HARD_CAP);
  }

  void INTENT_SOURCES; // reserved for future declarative routing

  const sources = Array.from(new Set(docs.map((d) => SOURCE_LABEL[d.source])));
  return { docs, sources, intent, dropped };
}

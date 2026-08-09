// Embed relationships, declared rather than introspected.
//
// PostgREST resolves `company:companies(name)` from Postgres FK metadata. SQLite
// exposes FKs too, but declaring the handful this app actually uses is clearer
// and fails loudly on a typo instead of guessing. Every entry here corresponds to
// an embed that appears in a .select() somewhere in lib/actions.

export interface Relation {
  /** Table being embedded. */
  target: string;
  /** "one": parent holds the FK. "many": child rows point back at the parent. */
  kind: "one" | "many";
  /**
   * For "one": the column on the parent holding the target id.
   * For "many": the column on the target pointing back at the parent's id.
   */
  column: string;
  /** Postgres FK constraint name, used to disambiguate two FKs to the same table. */
  fkHint?: string;
}

/** from-table -> embed alias -> relation */
const RELATIONS: Record<string, Record<string, Relation>> = {
  jobs: {
    company: { target: "companies", kind: "one", column: "company_id" },
    position: { target: "positions", kind: "one", column: "position_id" },
    resume: {
      target: "documents",
      kind: "one",
      column: "resume_id",
      fkHint: "jobs_resume_id_fkey",
    },
    matched_resume: {
      target: "documents",
      kind: "one",
      column: "matched_resume_id",
      fkHint: "jobs_matched_resume_id_fkey",
    },
    applications: { target: "applications", kind: "many", column: "job_id" },
    interviews: { target: "interviews", kind: "many", column: "job_id" },
    mcq_results: { target: "mcq_results", kind: "many", column: "job_id" },
    job_contacts: { target: "job_contacts", kind: "many", column: "job_id" },
    job_documents: { target: "job_documents", kind: "many", column: "job_id" },
  },
  applications: {
    job: { target: "jobs", kind: "one", column: "job_id" },
    company: { target: "companies", kind: "one", column: "company_id" },
    resume: { target: "documents", kind: "one", column: "resume_id" },
  },
  interviews: {
    job: { target: "jobs", kind: "one", column: "job_id" },
    company: { target: "companies", kind: "one", column: "company_id" },
  },
  positions: {
    resume: { target: "documents", kind: "one", column: "resume_id" },
  },
  board_lists: {},
  companies: {
    jobs: { target: "jobs", kind: "many", column: "company_id" },
  },
  documents: {},
  profiles: {},
  contacts: {
    company: { target: "companies", kind: "one", column: "company_id" },
  },
  job_contacts: {
    job: { target: "jobs", kind: "one", column: "job_id" },
    contact: { target: "contacts", kind: "one", column: "contact_id" },
  },
  job_documents: {
    job: { target: "jobs", kind: "one", column: "job_id" },
    document: { target: "documents", kind: "one", column: "document_id" },
  },
};

/**
 * Resolves an embed. `alias` is what the caller wrote before the colon (or the
 * bare table name); `table` is the target table name it parsed to.
 */
export function findRelation(
  from: string,
  alias: string,
  table: string,
  fkHint?: string
): Relation | null {
  const forTable = RELATIONS[from];
  if (!forTable) return null;

  // Exact alias match wins (covers `company:companies(...)` and `applications(...)`).
  const byAlias = forTable[alias];
  if (byAlias && byAlias.target === table) {
    if (!fkHint || byAlias.fkHint === fkHint) return byAlias;
  }

  // Otherwise disambiguate by target table, honouring the FK hint when given.
  const candidates = Object.values(forTable).filter((r) => r.target === table);
  if (candidates.length === 0) return null;
  if (fkHint) {
    return candidates.find((r) => r.fkHint === fkHint) ?? null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

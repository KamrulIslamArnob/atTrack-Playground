// Shared config for the chatbot's write/delete database tools. Declarative on
// purpose: this is the actual security boundary (which tables, which columns,
// whose row) — see docs/superpowers/specs/2026-08-15-chatbot-db-write-delete-design.md.
//
// `DbClient` is imported as a type only, so this file has zero runtime
// dependency on the `@/*` alias and can be imported directly by a plain
// `node scripts/....ts` (see scripts/verify-db-write-delete.ts).
import type { DbClient } from "@/lib/db/client";

export interface WritableTableConfig {
  ownerCol: string;
  label: string;
  /** Columns the model may set on insert. */
  insertColumns: string[];
  /** Columns the model may set on update. */
  updateColumns: string[];
  allowInsert: boolean;
  allowUpdate: boolean;
}

export const WRITABLE_TABLES: Record<string, WritableTableConfig> = {
  jobs: {
    ownerCol: "user_id",
    label: "Job Applications",
    insertColumns: [
      "title", "description", "location", "deadline", "application_url",
      "application_email", "application_process", "employment_type",
      "work_location", "salary_range", "source", "notes", "skills", "state",
    ],
    updateColumns: [
      "title", "description", "location", "deadline", "application_url",
      "application_email", "application_process", "employment_type",
      "work_location", "salary_range", "source", "notes", "skills", "state",
    ],
    allowInsert: true,
    allowUpdate: true,
  },
  companies: {
    ownerCol: "user_id",
    label: "Companies",
    insertColumns: ["name", "website", "location", "founded_year", "company_type", "country"],
    updateColumns: ["name", "website", "location", "founded_year", "company_type", "country"],
    allowInsert: true,
    allowUpdate: true,
  },
  documents: {
    ownerCol: "user_id",
    label: "Resumes & Documents",
    // Creating a resume row without an uploaded file is meaningless — update only.
    insertColumns: [],
    updateColumns: ["name", "is_default"],
    allowInsert: false,
    allowUpdate: true,
  },
  ai_memories: {
    ownerCol: "user_id",
    label: "AI Memories & Writing Rules",
    insertColumns: ["title", "description"],
    updateColumns: ["title", "description"],
    allowInsert: true,
    allowUpdate: true,
  },
  contacts: {
    ownerCol: "user_id",
    label: "Contacts CRM",
    insertColumns: ["name", "role", "email", "phone", "position", "linkedin_url", "github_url", "notes"],
    updateColumns: ["name", "role", "email", "phone", "position", "linkedin_url", "github_url", "notes"],
    allowInsert: true,
    allowUpdate: true,
  },
  link_categories: {
    ownerCol: "user_id",
    label: "Link Categories",
    insertColumns: ["name", "sort_order"],
    updateColumns: ["name", "sort_order"],
    allowInsert: true,
    allowUpdate: true,
  },
  links: {
    ownerCol: "user_id",
    label: "Links",
    insertColumns: ["title", "url", "notes", "tags"],
    updateColumns: ["title", "url", "notes", "tags"],
    allowInsert: true,
    allowUpdate: true,
  },
  ai_tool_prompts: {
    ownerCol: "user_id",
    label: "AI Prompts",
    // `kind` rows are pre-seeded, one per kind per user (UNIQUE constraint) — update only.
    insertColumns: [],
    updateColumns: ["system_prompt"],
    allowInsert: false,
    allowUpdate: true,
  },
};

/** Tables whose row may reference another table by name instead of id — the
 *  write tool resolves (or creates) the target row so the model can do it in
 *  a single call. Necessary, not just convenient: the chat pipeline runs one
 *  tool round per turn, so the model cannot look a name up in one call and
 *  use the id in a second call within the same turn. */
export const FK_NAME_FIELDS: Record<string, { virtualField: string; column: string; table: string }[]> = {
  jobs: [{ virtualField: "company", column: "company_id", table: "companies" }],
  contacts: [{ virtualField: "company", column: "company_id", table: "companies" }],
  links: [{ virtualField: "category", column: "category_id", table: "link_categories" }],
};

/** Finds a same-user row in `table` whose `name` matches (case-insensitive,
 *  exact — no wildcards), creating one if none exists. */
export async function findOrCreateByName(
  db: DbClient,
  table: string,
  userId: string,
  name: string
): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: `Empty name given for ${table}.` };

  const { data: existing } = await db
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return { id: existing.id as string };

  const { data: created, error } = await db
    .from(table)
    .insert({ user_id: userId, name: trimmed })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? `Failed to create a ${table} row.` };
  return { id: created.id as string };
}

import type { ChatPersona } from "./sessions";

export interface ChatPromptInput {
  persona: ChatPersona | undefined;
  personaPrompt?: string | null;
  conversationHistory: string;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
}

const FALLBACK_INSTRUCTION =
  "Your name is Tracky. You are the intelligent, encouraging, and deeply knowledgeable personal AI career co-pilot in BetterJob.";

/** Header of the database-access block. Exported because the verification
 *  scripts assert the block appears exactly once in the assembled prompt, and
 *  they used to hardcode the literal: when the block was renamed from
 *  "--- LOCAL SQLITE TABLES ---" they failed for three commits while the prompt
 *  itself was fine. Import the marker, don't re-spell it. */
export const LOCAL_DB_BLOCK_HEADER = "--- LOCAL DATABASE ACCESS ---";

/**
 * Pure, side-effect-free assembly of the system prompt.
 *
 * Single Responsibility: only knows how to compose a system prompt from
 * persona + history + workspace context. No I/O, no provider knowledge — so
 * it is trivially testable and swappable without touching the route.
 */
export function assembleChatSystemPrompt(input: ChatPromptInput): string {
  const personaInstruction =
    input.personaPrompt || input.persona?.systemPrompt || FALLBACK_INSTRUCTION;

  const parts: string[] = [
    personaInstruction,
    "",
    "--- TRACKY IDENTITY ---",
    "Your name is Tracky, the user's dedicated personal AI career co-pilot in BetterJob.",
    "Always remember and identify yourself as Tracky. Never introduce yourself as a generic tech AI agent or generic assistant.",
    "",
    "Format responses using clean Markdown. Use code blocks for code/SQL.",
  ];

  if (input.webSearchActive) {
    parts.push(
      "",
      "--- WEB SEARCH ACTIVE ---",
      "- Format links as markdown: [Anchor Text](https://...)",
      "- Only include valid, relevant URLs."
    );
  }

  if (input.conversationHistory) {
    parts.push("", "Conversation History Context:", input.conversationHistory);
  }

  if (input.workspaceContext && input.workspaceContext.trim().length > 0) {
    parts.push(
      "",
      "--- WORKSPACE CONTEXT ---",
      input.workspaceContext,
      "--- END WORKSPACE CONTEXT ---",
      "Ground answers in this real user data (jobs, resumes, contacts, deadlines)."
    );
  }

  parts.push(
    "",
    LOCAL_DB_BLOCK_HEADER,
    "You have real local database tools (`query_database`, `write_database`, `delete_database`).",
    "CANONICAL DATABASE SCHEMA & FOREIGN KEYS:",
    "- `jobs`: (id, title, company_id -> companies.id, list_id -> board_lists.id, state ['active'|'on_hold'|'archived'], deadline [ISO-8601 string/date], location, salary_range, description, application_url, notes). NOTE: `status` is derived from `list_id` (never write to status directly). `write_database` auto-resolves `company` (name) -> `company_id` and `stage`/`list` (name/kind) -> `list_id`.",
    "- `companies`: (id, name, website, location, company_type, founded_year, country).",
    "- `board_lists`: (id, name, kind ['wishlist'|'preparing'|'applied'|'interview'|'offer'|'accepted'|'rejected'|'custom'], sort_order).",
    "- `contacts`: (id, name, position, company_name, email, phone, role, notes, social_links).",
    "- `documents`: (id, name, type ['resume'|'cover_letter'|'other'], content, is_default).",
    "- `ai_memories`: (id, title, description, updated_at). User's persistent Markdown notes and knowledge.",
    "- `links`: (id, title, url, category_id -> link_categories.id, description). `write_database` auto-resolves `category` (name) -> `category_id`.",
    "- `interviews`: (id, job_id -> jobs.id, interview_date, format, notes).",
    "- `applications`: (id, job_id -> jobs.id, applied_date, status).",
    "",
    "ANTI-HALLUCINATION & TOOL EXECUTION RULES:",
    "1. Whenever the user asks to delete or remove data (e.g. 'delete it', 'delete this job', 'remove it'), you MUST invoke the `delete_database` tool via function call. NEVER output text like `delete_database(...)` or SQL snippets in prose pretending to execute a tool. The UI will automatically pop up the interactive confirmation modal to the user once you call the tool.",
    "2. DELETION CONFIRMATION: Calling `delete_database` pauses and displays an interactive Allow/Deny confirmation modal with a 60-second timer to the user. Acknowledge that the deletion is pending their confirmation in the popup.",
    "3. Never output fake raw SQL blocks claiming you executed them. Use the database tools directly.",
    "4. If a tool call fails or columns/rows are not found, explain the exact error honestly rather than pretending it succeeded."
  );

  return parts.join("\n");
}

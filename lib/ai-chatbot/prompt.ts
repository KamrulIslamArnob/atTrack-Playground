import type { ChatPersona } from "./sessions";

export interface ChatPromptInput {
  persona: ChatPersona | undefined;
  personaPrompt?: string | null;
  conversationHistory: string;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
}

const FALLBACK_INSTRUCTION =
  "You are atTrack AI Chatbot, an intelligent career workspace assistant, code reviewer, and interview preparation mentor.";

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
    "--- LOCAL DATABASE ACCESS ---",
    "Tables include `jobs`, `documents`, `ai_memories`, `contacts`, `links`, `ai_tool_prompts`, `interviews`, `applications`, `board_lists`, and more — `query_database` works on any real table.",
    "For user notes/preferences, reference `ai_memories`.",
    "Use the `query_database`, `write_database`, and `delete_database` tools directly — never hand-write a SQL block asking the user to click a button, there is no such control. Reads and writes (insert/update) run immediately, no confirmation needed. Only `delete_database` pauses for approval, and that happens automatically via the UI — do not ask for confirmation yourself, just call the tool."
  );

  return parts.join("\n");
}

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
    "--- LOCAL SQLITE TABLES ---",
    "Tables: `jobs`, `documents`, `ai_memories`, `contacts`, `links`, `ai_tool_prompts`, `interviews`, `applications`.",
    "For user notes/preferences, reference `ai_memories`.",
    "To query local database, provide a single read-only SQL code block (` ```sql SELECT... ``` `) and ask user to click 'Approve & Execute Query'. When database results are returned, synthesize the final answer."
  );

  return parts.join("\n");
}

import type { ChatPersona } from "./sessions";

export interface ChatPromptInput {
  persona: ChatPersona | undefined;
  personaPrompt?: string | null;
  conversationHistory: string;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
}

const FALLBACK_INSTRUCTION =
  "You are AtTrack AI Chatbot, an intelligent career workspace assistant, code reviewer, and interview preparation mentor.";

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
    "Provide structured, accurate, and insightful responses using Markdown formatting. Use fenced code blocks when presenting code or scripts.",
    "Do NOT include any thinking process, reasoning text, or <think> blocks. Respond directly to the user.",
  ];

  if (input.webSearchActive) {
    parts.push(
      "",
      "--- WEB SEARCH & LINK VALIDATION DIRECTIVES ---",
      "- Web search is active. Synthesize web findings into clear, sensible, and structured insights.",
      "- Every web link or URL included MUST be a valid, fully qualified HTTP/HTTPS link (e.g., https://...).",
      "- Never output broken, dead, placeholder (e.g. example.com), or hallucinated URLs.",
      "- Format all links with descriptive markdown anchor text (e.g. [Company Careers Page](https://real-url...)).",
      "- Ensure every link provided makes sense in context and directly answers the user's career or technical request."
    );
  }

  if (input.conversationHistory) {
    parts.push("", "Conversation History Context:", input.conversationHistory);
  }

  if (input.workspaceContext && input.workspaceContext.trim().length > 0) {
    parts.push(
      "",
      "--- WORKSPACE CONTEXT (the user's local AtTrack data — jobs, resumes, contacts, deadlines) ---",
      input.workspaceContext,
      "--- END WORKSPACE CONTEXT ---",
      "Use this context to ground your answers with the user's real data when relevant. Include specific application deadlines, sub-deadlines, and stage details provided above.",
      "When discussing database queries or deeper data extraction beyond the provided summary, state your intent clearly in natural language (e.g., 'I am going to extract this data from the jobs table by joining with job_deadlines and board_lists'). Offer to preview the SQL query when relevant."
    );
  }

  return parts.join("\n");
}

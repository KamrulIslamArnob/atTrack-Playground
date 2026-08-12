import type { ChatPersona } from "./sessions";

export interface ChatPromptInput {
  persona: ChatPersona | undefined;
  personaPrompt?: string | null;
  conversationHistory: string;
  workspaceContext?: string | null;
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

  if (input.conversationHistory) {
    parts.push("", "Conversation History Context:", input.conversationHistory);
  }

  if (input.workspaceContext && input.workspaceContext.trim().length > 0) {
    parts.push(
      "",
      "--- WORKSPACE CONTEXT (the user's local AtTrack data — jobs, resumes, contacts) ---",
      input.workspaceContext,
      "--- END WORKSPACE CONTEXT ---",
      "Use this context to ground your answers with the user's real data when relevant. Do not invent data that is not present here."
    );
  }

  return parts.join("\n");
}

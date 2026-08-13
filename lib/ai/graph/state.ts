import { Annotation } from "@langchain/langgraph";

export interface MessageRoleContent {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatGraphState {
  userId: string;
  model: string;
  personaId: string;
  personaPrompt: string;
  rawMessages: MessageRoleContent[];
  workspaceContext: string | null;
  systemPrompt: string | null;
  outputStream?: ReadableStream<Uint8Array> | null;
  // Extension slots for future RAG / Tools
  retrievedDocs: unknown[];
  toolResults: unknown[];
  error: string | null;
}

export const ChatStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  model: Annotation<string>(),
  personaId: Annotation<string>(),
  personaPrompt: Annotation<string>(),
  rawMessages: Annotation<MessageRoleContent[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  workspaceContext: Annotation<string | null>({
    value: (left, right) => (right !== undefined ? right : left ?? null),
    default: () => null,
  }),
  systemPrompt: Annotation<string | null>({
    value: (left, right) => (right !== undefined ? right : left ?? null),
    default: () => null,
  }),
  webSearchActive: Annotation<boolean>({
    value: (left, right) => (right !== undefined ? right : left ?? false),
    default: () => false,
  }),
  // Intent-aware retrieval (chatbot-intent-retrieval-workflow.md).
  intent: Annotation<string>({
    value: (left, right) => (right !== undefined ? right : left ?? "general_qa"),
    default: () => "general_qa",
  }),
  sources: Annotation<string[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  // Real tool-calling (chatbot-tool-calling-architecture.md). Gated by CHAT_TOOLS=on.
  toolCalls: Annotation<unknown[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  // User's enabled source permission ids (from the Workspace Sources drawer).
  // Gates which tools the model may call. Empty/absent = no gating (legacy).
  enabledSourceIds: Annotation<string[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  // Per-source config (Obsidian vaultPath, GitHub token, etc.) sent from the
  // client, used by tools at execution time. NEVER logged.
  sourceConfig: Annotation<Record<string, Record<string, unknown>>>({
    value: (left, right) => (right ? right : left ?? {}),
    default: () => ({}),
  }),
  finalAnswer: Annotation<string | null>({
    value: (left, right) => (right !== undefined ? right : left ?? null),
    default: () => null,
  }),
  outputStream: Annotation<ReadableStream<Uint8Array> | null>({
    value: (left, right) => (right !== undefined ? right : left ?? null),
    default: () => null,
  }),
  retrievedDocs: Annotation<unknown[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  toolResults: Annotation<unknown[]>({
    value: (left, right) => (right ? right : left ?? []),
    default: () => [],
  }),
  error: Annotation<string | null>({
    value: (left, right) => (right !== undefined ? right : left ?? null),
    default: () => null,
  }),
});

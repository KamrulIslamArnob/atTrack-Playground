import { chatGraph } from "@/lib/ai/graph/graph";
import type { MessageRoleContent } from "@/lib/ai/graph/state";

export interface ChatServiceInput {
  userId: string;
  messages: MessageRoleContent[];
  model?: string;
  personaId: string;
  personaPrompt?: string;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
  /** User's enabled source permission ids (gates tools). */
  enabledSourceIds?: string[];
  /** Per-source config (Obsidian path, GitHub token). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
}

export class ChatService {
  async handleChatRequest(input: ChatServiceInput): Promise<Response> {
    const resultState = await chatGraph.invoke({
      userId: input.userId,
      model: input.model || "",
      personaId: input.personaId,
      personaPrompt: input.personaPrompt || "",
      rawMessages: input.messages,
      workspaceContext: input.workspaceContext || null,
      webSearchActive: Boolean(input.webSearchActive),
      enabledSourceIds: input.enabledSourceIds, // may be undefined (legacy) or [] (all off)
      sourceConfig: input.sourceConfig && typeof input.sourceConfig === "object" ? input.sourceConfig : {},
      systemPrompt: null,
      outputStream: null,
      retrievedDocs: [],
      toolResults: [],
      toolCalls: [],
      intent: "general_qa",
      sources: [],
      finalAnswer: null,
      error: null,
    });

    if (resultState.error) {
      return new Response(JSON.stringify({ error: resultState.error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!resultState.outputStream) {
      return new Response(JSON.stringify({ error: "Failed to initialize response stream." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Append a sources frame after [DONE] so the client can render real
    // "Sources used" chips (chat-messages.tsx SourcesUsedChip). Additive: the
    // existing SSE token contract is unchanged; clients that ignore it are fine.
    const base = resultState.outputStream;
    const sources = Array.isArray(resultState.sources) ? resultState.sources : [];
    const toolCalls = Array.isArray(resultState.toolCalls) ? resultState.toolCalls : [];
    const encoder = new TextEncoder();
    const sourcesFrame =
      sources.length > 0
        ? encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
        : new Uint8Array(0);
    // Real tool-call records -> drive the ToolExecutionStatus UI with actual
    // tool names/statuses (no hardcoded fallbacks).
    const toolCallsFrame =
      toolCalls.length > 0
        ? encoder.encode(`data: ${JSON.stringify({ tool_calls: toolCalls })}\n\n`)
        : new Uint8Array(0);

    const merged = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = base.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          if (sourcesFrame.byteLength > 0) controller.enqueue(sourcesFrame);
          if (toolCallsFrame.byteLength > 0) controller.enqueue(toolCallsFrame);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(merged, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}

export const chatService = new ChatService();

import { NextRequest } from "next/server";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";
import { CHAT_PERSONAS } from "@/lib/ai-chatbot/sessions";
import { assembleChatSystemPrompt } from "@/lib/ai-chatbot/prompt";
import { getUser } from "@/lib/auth";
import { chatService } from "@/services/chat/chat-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages, model, persona, personaId, personaPrompt, workspaceContext, webSearchActive, enabledSources, sourceConfig } = body;

    // Presence of the `enabledSources` key signals the new permission model.
    // Absent => legacy (no gating). Present (even []) => enforce: [] means all off.
    const hasEnabledKey = body && typeof body === "object" && "enabledSources" in body;
    const resolvedEnabled = hasEnabledKey
      ? Array.isArray(enabledSources)
        ? enabledSources.filter((x: unknown) => typeof x === "string")
        : []
      : undefined;

    const { userId } = await getUser();

    // Handle both 'persona' and 'personaId' with type validation
    const validatedModel = typeof model === "string" ? model.trim() : undefined;
    const personaToUse = typeof persona === "string" ? persona : typeof personaId === "string" ? personaId : "general";
    const selectedPersona = CHAT_PERSONAS.find((p) => p.id === personaToUse);
    const validatedPersonaPrompt = typeof personaPrompt === "string" ? personaPrompt : undefined;
    const validatedWorkspaceContext = typeof workspaceContext === "string" ? workspaceContext : null;
    const isWebSearchActive = Boolean(webSearchActive);

    const rawMessages = Array.isArray(messages) ? messages : [];

    // Check feature flag: default to LangGraph pipeline unless explicitly turned off
    const useLangGraph = process.env.CHAT_LANGGRAPH !== "off";

    if (useLangGraph) {
      return await chatService.handleChatRequest({
        userId,
        messages: rawMessages,
        model: validatedModel,
        personaId: personaToUse,
        personaPrompt: validatedPersonaPrompt,
        workspaceContext: validatedWorkspaceContext,
        webSearchActive: isWebSearchActive,
        enabledSourceIds: resolvedEnabled,
        sourceConfig: sourceConfig && typeof sourceConfig === "object" ? sourceConfig : {},
      });
    }

    // --- Legacy Direct Pipeline (Fallback when CHAT_LANGGRAPH=off) ---
    const lastMessage = rawMessages[rawMessages.length - 1];
    const historyMessages = rawMessages.slice(0, -1);

    const conversationHistory = historyMessages
      .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = assembleChatSystemPrompt({
      persona: selectedPersona,
      personaPrompt: validatedPersonaPrompt || null,
      conversationHistory,
      workspaceContext: validatedWorkspaceContext,
    });

    const userPrompt = rawMessages.length
      ? (lastMessage?.content ?? "")
      : "Hello.";

    const chain = await resolveProviderChain(userId, "text");
    if (chain.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI provider configured and no GEMINI_API_KEY fallback available." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (validatedModel && chain.length > 0) {
      const modelMap: Record<string, string> = {
        "gemini-2.0-flash": "models/gemini-2.0-flash",
        "gemini-1.5-pro": "models/gemini-1.5-pro",
        "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
        "gpt-4o": "gpt-4o",
        "deepseek-r1": "deepseek-reasoner",
      };
      chain[0] = { ...chain[0], model: modelMap[validatedModel] || validatedModel };
    }

    const stream = await generateTextStream(
      chain,
      { systemPrompt, userPrompt },
      { userId, action: "ai_chatbot", metadata: { model, persona: personaToUse, messageCount: rawMessages.length } }
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg || "Failed to process chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

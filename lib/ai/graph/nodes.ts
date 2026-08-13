import { CHAT_PERSONAS } from "@/lib/ai-chatbot/sessions";
import { assembleChatSystemPrompt } from "@/lib/ai-chatbot/prompt";
import { resolveProviderChain, generateTextStream, generateTextWithTools, type ToolExecutionContext } from "@/lib/ai/providers";
import { classifyIntentAsync } from "@/lib/ai-chatbot/intent";
import { retrieveContext } from "@/lib/ai-chatbot/retrieval";
import { buildGroundedContext, assembleGroundedSystemPrompt } from "@/lib/ai-chatbot/grounded-context";
import type { RetrievedDoc } from "@/lib/ai-chatbot/retrieval/types";
import { getTool, listToolDeclarations } from "@/lib/ai/tools/registry";
import { ChatStateAnnotation } from "./state";

export async function loadContextNode(state: typeof ChatStateAnnotation.State) {
  try {
    const { personaId, personaPrompt, rawMessages, workspaceContext, webSearchActive } = state;

    const selectedPersona = CHAT_PERSONAS.find((p) => p.id === personaId);
    const messagesArray = Array.isArray(rawMessages) ? rawMessages : [];

    const historyMessages = messagesArray.slice(0, -1);
    const conversationHistory = historyMessages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = assembleChatSystemPrompt({
      persona: selectedPersona,
      personaPrompt: personaPrompt || null,
      conversationHistory,
      workspaceContext: typeof workspaceContext === "string" ? workspaceContext : null,
      webSearchActive: Boolean(webSearchActive),
    });

    return { systemPrompt };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { error: errorMsg };
  }
}

/**
 * Intent-aware native-data retrieval (chatbot-intent-retrieval-workflow.md).
 * Gated by CHAT_RETRIEVAL=on. When off, returns empty (legacy behavior).
 * Runs read-only, user-scoped queries against jobs/resumes/contacts/links/
 * ai_tool_prompts. `performance` intent is intentionally excluded (the app's
 * /api/performance returns OS metrics, not career metrics).
 */
export async function retrieveContextNode(state: typeof ChatStateAnnotation.State) {
  try {
    if (process.env.CHAT_RETRIEVAL !== "on") {
      return { retrievedDocs: [], sources: [], intent: "general_qa" };
    }

    const messagesArray = Array.isArray(state.rawMessages) ? state.rawMessages : [];
    const lastMessage = messagesArray[messagesArray.length - 1];
    const userPrompt = messagesArray.length ? (lastMessage?.content ?? "") : "";

    const intent = await classifyIntentAsync(userPrompt, state.personaId);
    const retrieval = await retrieveContext(intent.primary, state.userId, userPrompt, state.enabledSourceIds);

    return { retrievedDocs: retrieval.docs, sources: retrieval.sources, intent: intent.primary };
  } catch (err) {
    // Retrieval is best-effort: on failure, fall back to non-grounded generation
    // rather than failing the whole request.
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[retrieveContextNode] failed, continuing ungrounded:", errorMsg);
    return { retrievedDocs: [], sources: [], intent: "general_qa" };
  }
}

/**
 * Real LLM-driven tool-calling. Gated by CHAT_TOOLS=on. When on, runs the model
 * with the registered tools; the model decides which to call, we execute them
 * (read-only, user-scoped), feed results back, and capture the final answer +
 * the recorded tool calls. When off, no-ops (legacy single-pass path).
 */
export async function toolExecutorNode(state: typeof ChatStateAnnotation.State) {
  try {
    if (process.env.CHAT_TOOLS !== "on") {
      return { toolCalls: [], finalAnswer: null };
    }

    const { userId, personaId, rawMessages, systemPrompt, enabledSourceIds, sourceConfig } = state;
    const messagesArray = Array.isArray(rawMessages) ? rawMessages : [];
    const lastMessage = messagesArray[messagesArray.length - 1];
    const userPrompt = messagesArray.length ? (lastMessage?.content ?? "") : "Hello.";

    const declarations = listToolDeclarations(personaId, enabledSourceIds);
    if (declarations.length === 0) {
      return { toolCalls: [], finalAnswer: null };
    }

    const chain = await resolveProviderChain(userId, "text");
    if (chain.length === 0) {
      return { toolCalls: [], finalAnswer: null };
    }

    const ctx: ToolExecutionContext = { userId, personaId, sourceConfig };
    const executor = async (name: string, args: Record<string, unknown>, ectx: ToolExecutionContext) => {
      const tool = getTool(name);
      if (!tool) return { content: `Unknown tool: ${name}`, citations: [] };
      return tool.execute(args, ectx);
    };

    const { text, toolCalls } = await generateTextWithTools(
      chain,
      { systemPrompt: systemPrompt || "", userPrompt },
      declarations,
      executor,
      ctx,
      undefined,
      { userId, action: "ai_chatbot", metadata: { persona: personaId } }
    );

    return { toolCalls, finalAnswer: text || null };
  } catch (err) {
    // Tool path failure: fall back to normal generation (generateNode will run).
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[toolExecutorNode] failed, falling back to plain generation:", errorMsg);
    return { toolCalls: [], finalAnswer: null };
  }
}

function parseAttachmentsToImages(rawAttachments: unknown) {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) return undefined;
  const images: { mimeType: string; data: string }[] = [];
  for (const att of rawAttachments) {
    if (!att || typeof att !== "object") continue;
    const url = (att as { url?: string }).url;
    if (typeof url === "string" && url.startsWith("data:")) {
      const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        images.push({ mimeType: match[1], data: match[2] });
      }
    }
  }
  return images.length > 0 ? images : undefined;
}

export async function generateNode(state: typeof ChatStateAnnotation.State) {
  try {
    const { userId, model, personaId, rawMessages, systemPrompt, retrievedDocs, webSearchActive, finalAnswer } = state;

    // If the tool-execution node already produced a grounded final answer
    // (CHAT_TOOLS=on), stream it directly so the UI keeps its streaming UX.
    if (finalAnswer) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const chunks = finalAnswer.match(/[\s\S]{1,40}/g) ?? [finalAnswer];
          for (const c of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return { outputStream: stream };
    }

    const messagesArray = Array.isArray(rawMessages) ? rawMessages : [];
    const lastMessage = messagesArray[messagesArray.length - 1];
    const userPrompt = messagesArray.length ? (lastMessage?.content ?? "") : "Hello.";
    const lastMsgAttachments = (lastMessage as { experimental_attachments?: unknown })?.experimental_attachments;
    const images = parseAttachmentsToImages(lastMsgAttachments);
    const hasImages = Boolean(images && images.length > 0);

    let targetModel = model;
    if (targetModel === "auto" || targetModel === "Auto Hybrid Agent" || !targetModel) {
      if (hasImages) {
        targetModel = "gemini-2.0-flash";
      } else if (
        userPrompt.includes("```") ||
        userPrompt.toLowerCase().includes("code") ||
        userPrompt.toLowerCase().includes("function") ||
        userPrompt.toLowerCase().includes("typescript") ||
        userPrompt.toLowerCase().includes("react")
      ) {
        targetModel = "claude-3-5-sonnet";
      } else if (
        userPrompt.toLowerCase().includes("think") ||
        userPrompt.toLowerCase().includes("deep") ||
        userPrompt.toLowerCase().includes("math") ||
        userPrompt.toLowerCase().includes("algorithm")
      ) {
        targetModel = "deepseek-r1";
      } else {
        targetModel = "gemini-2.0-flash";
      }
    }

    const selectedPersona = CHAT_PERSONAS.find((p) => p.id === personaId);

    // Fold retrieved native data into the system prompt (accuracy-guaranteed).
    const groundedContext = buildGroundedContext((retrievedDocs as RetrievedDoc[]) ?? []);
    const finalSystemPrompt =
      groundedContext && selectedPersona
        ? assembleGroundedSystemPrompt({
            persona: selectedPersona,
            personaPrompt: state.personaPrompt || null,
            baseSystemPrompt: systemPrompt || "",
            groundedContext,
            webSearchActive: Boolean(webSearchActive),
          })
        : (systemPrompt ?? "");

    const chain = await resolveProviderChain(userId, "text");
    if (chain.length === 0) {
      return { error: "No AI provider configured and no GEMINI_API_KEY fallback available." };
    }

    if (targetModel && chain.length > 0) {
      const modelMap: Record<string, string> = {
        "gemini-2.0-flash": "models/gemini-2.0-flash",
        "gemini-1.5-pro": "models/gemini-1.5-pro",
        "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
        "gpt-4o": "gpt-4o",
        "deepseek-r1": "deepseek-reasoner",
      };
      chain[0] = { ...chain[0], model: modelMap[targetModel] || targetModel };
    }

    const stream = await generateTextStream(
      chain,
      { systemPrompt: finalSystemPrompt, userPrompt, images },
      { userId, action: "ai_chatbot", metadata: { model: targetModel, persona: personaId, messageCount: messagesArray.length } }
    );

    return { outputStream: stream };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { error: errorMsg };
  }
}

export async function finalizeNode(_state: typeof ChatStateAnnotation.State) {
  return {};
}

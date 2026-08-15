import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { executeChatPipeline } from "@/lib/ai-chatbot/pipeline";
import { moduleLogger } from "@/lib/log";
import { withRoute } from "@/lib/log/route";

const log = moduleLogger("api");

export const runtime = "nodejs";
/** A grounded answer over a full workspace plus tool results routinely runs
 *  past a minute on slower providers, and the cap truncates the stream
 *  mid-sentence with no error frame. atTrack is local-first — there is no
 *  serverless ceiling to respect here. */
export const maxDuration = 300;

export const POST = withRoute("/api/chat", async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      messages,
      model,
      persona,
      personaId,
      personaPrompt,
      workspaceContext,
      webSearchActive,
      enabledSources,
      sourceConfig,
    } = body;

    const { userId } = await getUser();

    // Source permissions gating: array of authorized workspace source IDs
    const hasEnabledKey = body && typeof body === "object" && "enabledSources" in body;
    const resolvedEnabled = hasEnabledKey
      ? Array.isArray(enabledSources)
        ? enabledSources.filter((x: unknown): x is string => typeof x === "string")
        : []
      : undefined;

    const validatedModel = typeof model === "string" ? model.trim() : undefined;
    const personaToUse = typeof persona === "string" ? persona : typeof personaId === "string" ? personaId : "general";
    const validatedPersonaPrompt = typeof personaPrompt === "string" ? personaPrompt : undefined;
    const validatedWorkspaceContext = typeof workspaceContext === "string" ? workspaceContext : null;
    const isWebSearchActive = Boolean(webSearchActive);
    const rawMessages = Array.isArray(messages) ? messages : [];

    return await executeChatPipeline({
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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err }, "[/api/chat] error:");
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
});

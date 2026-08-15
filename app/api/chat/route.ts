import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { executeChatPipeline } from "@/lib/ai-chatbot/pipeline";
import { handleDbApprovalRequest } from "@/lib/ai-chatbot/db-approval-route";
import { moduleLogger } from "@/lib/log";
import { withRoute } from "@/lib/log/route";

const log = moduleLogger("api");

export const runtime = "nodejs";
/** A grounded answer over a full workspace plus tool results routinely runs
 *  past a minute on slower providers, and the cap truncates the stream
 *  mid-sentence with no error frame. atTrack is local-first — there is no
 *  serverless ceiling to respect here. */
export const maxDuration = 300;

function normalizeMessageContent(content: unknown, parts?: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

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

    // A pending DELETE approval decision (Allow/Deny) arrives as its own
    // request — handle it and return before the normal chat pipeline runs.
    const dbApproval = body && typeof body === "object" ? (body as Record<string, unknown>).dbApproval : undefined;
    if (
      dbApproval &&
      typeof dbApproval === "object" &&
      typeof (dbApproval as { approvalId?: unknown }).approvalId === "string" &&
      ((dbApproval as { decision?: unknown }).decision === "allow" ||
        (dbApproval as { decision?: unknown }).decision === "deny")
    ) {
      return handleDbApprovalRequest(
        (dbApproval as { approvalId: string }).approvalId,
        (dbApproval as { decision: "allow" | "deny" }).decision,
        userId
      );
    }

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
    const rawMessages = Array.isArray(messages)
      ? messages.map((m: unknown) => {
          const item = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
          return {
            role: typeof item.role === "string" ? item.role : "user",
            content: normalizeMessageContent(item.content, item.parts),
            experimental_attachments: item.experimental_attachments ?? item.attachments,
          };
        })
      : [];

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

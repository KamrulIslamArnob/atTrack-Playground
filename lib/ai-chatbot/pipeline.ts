import { CHAT_PERSONAS } from "@/lib/ai-chatbot/sessions";
import type { ChatPersona } from "@/lib/ai-chatbot/types";
import { assembleChatSystemPrompt } from "@/lib/ai-chatbot/prompt";
import {
  resolveProviderChain,
  resolveAllProviders,
  generateTextStream,
  generateTextWithToolsStream,
  type ResolvedProvider,
  type ToolExecutionContext,
  type ToolCallRecord,
} from "@/lib/ai/providers";
import { modelSupportsImages, isReasoningModel } from "@/lib/ai/model-capabilities";
import { classifyIntentAsync, type IntentResult } from "@/lib/ai-chatbot/intent";
import { retrieveContext } from "@/lib/ai-chatbot/retrieval";
import { buildGroundedContext, assembleGroundedSystemPrompt } from "@/lib/ai-chatbot/grounded-context";
import type { RetrievedDoc } from "@/lib/ai-chatbot/retrieval/types";
import { getTool } from "@/lib/ai/tools/registry";
import type { ToolApproval } from "@/lib/ai/tools/types";
import { getAgent } from "@/lib/ai/agents/registry";
import type { AgentDefinition, AgentContext } from "@/lib/ai/agents/types";
import type { ProviderType } from "@/lib/types/ai-providers";
import { moduleLogger } from "@/lib/log";
import { AI_EVENTS, aiEvent, aiSpan, aiWarn, argKeys, newTraceId, sizeOf } from "@/lib/log/ai-events";

const log = moduleLogger("chat");

// Every stage below takes the turn's `traceId` as a trailing optional argument
// rather than carrying it on LoadedChatContext: the context type is built by
// hand in scripts/verify-challenger-final.ts, so a required field there would
// break a caller this module does not own. A default keeps each stage usable
// (and traceable) standalone.

export interface ChatPipelineInput {
  userId: string;
  messages: Array<{ role: string; content: string; experimental_attachments?: unknown }>;
  model?: string;
  personaId: string;
  personaPrompt?: string;
  workspaceContext?: string | null;
  webSearchActive?: boolean;
  enabledSourceIds?: string[];
  sourceConfig?: Record<string, Record<string, unknown>>;
}

export interface LoadedChatContext {
  input: ChatPipelineInput;
  messagesArray: Array<{ role: string; content: string; experimental_attachments?: unknown }>;
  lastMessage?: { role: string; content: string; experimental_attachments?: unknown };
  userPrompt: string;
  historyMessages: Array<{ role: string; content: string; experimental_attachments?: unknown }>;
  images?: { mimeType: string; data: string }[];
  hasImages: boolean;
  agent: AgentDefinition;
  selectedPersona: ChatPersona;
  baseSystemPrompt: string;
  targetModel?: string;
  /** Set only when the caller asked for "auto": which capability the turn needs.
   *  Resolved against the user's real providers in stage 1b, which is the first
   *  stage that can see them. Absent means the caller named a model outright. */
  autoRule?: AutoRule;
  chain: ResolvedProvider[];
}

export interface RetrievedChatContext extends LoadedChatContext {
  intentResult: IntentResult;
  retrievedDocs: RetrievedDoc[];
  sources: string[];
  groundedContext: string | null;
  finalSystemPrompt: string;
}

export interface AgentToolsExecutionResult {
  mode: "tools";
  toolResultText: string;
  executedToolCalls: ToolCallRecord[];
  sources: string[];
}

export interface AgentStreamExecutionResult {
  mode: "stream";
  baseStream: ReadableStream<Uint8Array>;
  sources: string[];
  /** Tool calls already executed before the stream opened, emitted as a frame
   *  ahead of the tokens so the UI can render its tool chips immediately. */
  executedToolCalls?: ToolCallRecord[];
  /** Pending operations that require the user's interactive sign-off (e.g. a
   *  DELETE). Emitted as `approval` SSE frames so the UI can render Allow/Deny. */
  approvals?: ToolApproval[];
}

export type AgentExecutionResult = AgentToolsExecutionResult | AgentStreamExecutionResult;

export function parseAttachmentsToImages(rawAttachments: unknown): { mimeType: string; data: string }[] | undefined {
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

export function isSourceAllowed(toolSourceId: string | undefined, enabledSourceIds?: string[]): boolean {
  if (!toolSourceId || !enabledSourceIds) return true;
  if (enabledSourceIds.includes(toolSourceId)) return true;
  if (toolSourceId === "links" && enabledSourceIds.includes("contacts")) return true;
  if (toolSourceId === "contacts" && enabledSourceIds.includes("links")) return true;
  return false;
}

/** Newest turns kept verbatim; older ones dropped. Every turn re-sends this
 *  whole block inside the system prompt, so an uncapped transcript grows the
 *  input token count — and therefore time-to-first-token — without bound. */
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 6000;

export function formatConversationHistory(
  messages: Array<{ role: string; content: string; experimental_attachments?: unknown }>
): string {
  const usable = messages
    .filter((m): m is { role: string; content: string } => Boolean(m && typeof m.content === "string"))
    .slice(-MAX_HISTORY_TURNS);

  // Drop oldest-first until the block fits the char budget, so the turns
  // nearest the current question always survive.
  const kept: string[] = [];
  let total = 0;
  for (let i = usable.length - 1; i >= 0; i--) {
    const line = `${(usable[i].role || "user").toUpperCase()}: ${usable[i].content}`;
    if (total + line.length > MAX_HISTORY_CHARS && kept.length > 0) break;
    kept.unshift(line);
    total += line.length;
  }

  return kept.join("\n\n");
}

/**
 * Stage 1a: Everything about the request that needs no I/O — message parsing,
 * persona/agent resolution, system prompt assembly, target model selection.
 * Split out from `loadChatContext` so the caller can overlap the I/O-bound
 * chain resolution with retrieval (both only need this base).
 */
export function buildChatContextBase(
  input: ChatPipelineInput,
  traceId: string = newTraceId()
): Omit<LoadedChatContext, "chain"> {
  const messagesArray = Array.isArray(input.messages) ? input.messages : [];
  const lastMessage = messagesArray[messagesArray.length - 1];
  const userPrompt = messagesArray.length ? (lastMessage?.content ?? "") : "Hello.";
  const historyMessages = messagesArray.slice(0, -1);

  const images = parseAttachmentsToImages(
    (lastMessage as { experimental_attachments?: unknown })?.experimental_attachments
  );
  const hasImages = Boolean(images && images.length > 0);

  // 1. Resolve Agent & Persona
  const agent = getAgent(input.personaId);
  const selectedPersona = CHAT_PERSONAS.find((p) => p.id === input.personaId) || {
    id: agent.id,
    name: agent.name,
    badge: agent.badge || "Specialist",
    iconName: agent.icon || "Sparkles",
    description: agent.description,
    systemPrompt: typeof agent.systemPrompt === "string" ? agent.systemPrompt : "",
    heading: agent.name,
    subheading: agent.description,
    preferredSources: ["jobs", "resumes", "contacts"],
  };

  const conversationHistory = formatConversationHistory(historyMessages);

  const baseSystemPrompt = assembleChatSystemPrompt({
    persona: selectedPersona,
    personaPrompt: input.personaPrompt || null,
    conversationHistory,
    workspaceContext: typeof input.workspaceContext === "string" ? input.workspaceContext : null,
    webSearchActive: Boolean(input.webSearchActive),
  });

  // 2. Resolve the target model.
  //
  // An explicit pick is a model id copied straight off one of the user's own
  // ai_providers rows, so it names the provider outright. "auto" names a
  // *capability* instead — which provider serves it depends on what the user
  // actually has configured, and this stage does no I/O, so the decision is
  // deferred to stage 1b. It used to resolve here to a hardcoded vendor id
  // (gemini-2.0-flash / claude-3-5-sonnet / deepseek-r1); on any workspace
  // without those exact vendors every auto turn fell through to chain[0].
  const isAuto = !input.model || input.model === "auto" || input.model === "Auto Hybrid Agent";
  const autoRule: AutoRule | undefined = !isAuto
    ? undefined
    : hasImages
      ? "images"
      : /```|code|function|typescript|react/i.test(userPrompt)
        ? "code"
        : /think|deep|math|algorithm/i.test(userPrompt)
          ? "reasoning"
          : "default";
  const targetModel = isAuto ? undefined : input.model;

  // "explicit" means the caller named a model and no rule ran. Which provider
  // that lands on is reported separately by routeProvider — the two events
  // together explain why this turn is served by the model it is served by.
  aiEvent(AI_EVENTS.routeModel, {
    traceId,
    requestedModel: input.model ?? null,
    resolvedModel: targetModel ?? null,
    rule: autoRule ?? "explicit",
  });

  return {
    input,
    messagesArray,
    lastMessage,
    userPrompt,
    historyMessages,
    images,
    hasImages,
    agent,
    selectedPersona,
    baseSystemPrompt,
    targetModel,
    autoRule,
  };
}

/** Which capability an "auto" turn needs. Resolved against the user's own
 *  providers, never against a hardcoded vendor id. */
export type AutoRule = "images" | "code" | "reasoning" | "default";

/** Well-known shorthand ids a caller may still send (older saved sessions store
 *  them as `chat_sessions.model`), each with the vendor that actually serves it.
 *  Without the vendor, the id gets stamped onto whatever provider happens to
 *  head the chain and the request 400s. */
const MODEL_CATALOG: Record<string, { id: string; providerType: ProviderType }> = {
  "gemini-2.0-flash": { id: "models/gemini-2.0-flash", providerType: "gemini" },
  "gemini-1.5-pro": { id: "models/gemini-1.5-pro", providerType: "gemini" },
  "claude-3-5-sonnet": { id: "claude-3-5-sonnet-20241022", providerType: "anthropic" },
  "gpt-4o": { id: "gpt-4o", providerType: "openai_compatible" },
  "deepseek-r1": { id: "deepseek-reasoner", providerType: "openai_compatible" },
};

/**
 * Reorders a resolved chain so the provider that can actually serve
 * `targetModel` runs first. Pure — no I/O — so the routing rules can be
 * exercised directly. Mutates and returns `chain`.
 *
 * Never stamps a model id onto a provider that has not claimed it: doing so
 * produced live 400s ("Unsupported model") against OpenAI-compatible endpoints,
 * costing a full round-trip before the fallback path even started.
 */
export function selectProviderForModel(
  chain: ResolvedProvider[],
  targetModel?: string,
  traceId: string = newTraceId(),
  opts: {
    /** Every configured provider, not just the ones the "text" task route
     *  lists. The model picker offers all of them, so the router must be able
     *  to reach all of them. */
    owned?: ResolvedProvider[];
    autoRule?: AutoRule;
  } = {}
): ResolvedProvider[] {
  const owned = opts.owned ?? [];
  // Provider NAMES only: base_url and api_key live on the same rows.
  const chainBefore = chain.map((p) => p.name);
  const emit = (
    reason: "exact" | "adopted" | "vendor-catalog" | "auto-capability" | "unchanged",
    promoted: string | null,
    stampedModel: string | null
  ) =>
    aiEvent(AI_EVENTS.routeProvider, {
      traceId,
      targetModel: targetModel ?? null,
      autoRule: opts.autoRule ?? null,
      chainBefore,
      chainAfter: chain.map((p) => p.name),
      promoted,
      reason,
      stampedModel,
    });

  if ((!targetModel && !opts.autoRule) || (chain.length === 0 && owned.length === 0)) {
    emit("unchanged", null, null);
    return chain;
  }

  /** Move a provider to the head of the chain, keeping the rest of the
   *  fallback order intact. */
  const promote = (idx: number, model?: string) => {
    const [match] = chain.splice(idx, 1);
    chain.unshift(model ? { ...match, model } : match);
    return chain;
  };

  /** Put a provider the task route does not list at the head, keeping the
   *  route as the fallback order behind it. The picker is built from every
   *  configured provider, so a pick outside the route has to run — otherwise
   *  the dropdown silently no-ops and chain[0] answers every turn. */
  const adopt = (p: ResolvedProvider) => {
    chain.unshift(p);
    return chain;
  };

  /** The route's own order is the user's stated preference, so it is searched
   *  before providers the route leaves out. */
  const preferenceOrder = (): ResolvedProvider[] => [
    ...chain,
    ...owned.filter((p) => !chain.some((c) => c.id === p.id)),
  ];

  /** Head the chain with `p`, whether it is already in the route or not. */
  const install = (p: ResolvedProvider, reason: "adopted" | "auto-capability") => {
    const idx = chain.findIndex((c) => c.id === p.id);
    if (idx !== -1) promote(idx);
    else adopt(p);
    emit(reason, chain[0].name, null);
    return chain;
  };

  // "auto": pick by capability from what the user actually has. "default" has
  // no capability to match, so it leaves the user's own chain order alone.
  if (opts.autoRule) {
    const pool = preferenceOrder();
    const picked =
      opts.autoRule === "images"
        ? pool.find((p) => modelSupportsImages(p.provider_type, p.model))
        : opts.autoRule === "reasoning"
          ? pool.find((p) => isReasoningModel(p.model))
          : opts.autoRule === "code"
            ? pool.find((p) => p.provider_type === "anthropic")
            : undefined;
    if (picked) return install(picked, "auto-capability");
    emit("unchanged", null, null);
    return chain;
  }

  // The model picker is built from the user's own provider rows — each option's
  // id IS that provider's configured model. An exact match therefore names the
  // provider to run outright, with no guessing.
  const exact = chain.findIndex((p) => p.model === targetModel);
  if (exact !== -1) {
    promote(exact);
    emit("exact", chain[0].name, null);
    return chain;
  }

  // Same match, against a provider the "text" task route does not list. Without
  // this the pick is silently dropped: the picker offers every configured
  // provider but the chain only ever held the routed ones, so choosing an
  // off-route model left chain[0] serving the turn under the wrong name.
  const offRoute = owned.find((p) => p.model === targetModel);
  if (offRoute) return install(offRoute, "adopted");

  // Otherwise this is a well-known shorthand id, which names a specific vendor.
  // Promote a provider that can actually serve it, route first.
  const known = targetModel ? MODEL_CATALOG[targetModel] : undefined;
  if (known) {
    // "openai_compatible" spans OpenAI, Groq, DeepSeek, OpenRouter, Longcat
    // and local servers — the type alone doesn't say which model a given
    // provider row serves. With more than one openai_compatible row
    // configured, matching by type alone can promote the wrong one (e.g. a
    // local Llama row) for a shorthand id like "deepseek-r1". Prefer a row
    // whose own configured model is the catalog id; only fall back to "any
    // row of this type" when none does.
    const byExactModel = chain.findIndex((p) => p.provider_type === known.providerType && p.model === known.id);
    const byVendor = byExactModel !== -1 ? byExactModel : chain.findIndex((p) => p.provider_type === known.providerType);
    if (byVendor !== -1) {
      const stamped = known.providerType === "openai_compatible" ? undefined : known.id;
      promote(byVendor, stamped);
      emit("vendor-catalog", chain[0].name, stamped ?? null);
      return chain;
    }
    const ownedVendor =
      owned.find((p) => p.provider_type === known.providerType && p.model === known.id) ??
      owned.find((p) => p.provider_type === known.providerType);
    if (ownedVendor) return install(ownedVendor, "adopted");
  }

  // Unknown id and no provider claims it. Run the user's configured chain as it
  // stands rather than posting a model id the endpoint will reject with a 400 —
  // that costs a full round-trip and buys nothing.
  emit("unchanged", null, null);
  return chain;
}

/**
 * Stage 1b: Resolve the provider fallback chain and order it for the requested
 * model. Hits the DB and decrypts keys, so it is the I/O half of stage 1 —
 * safe to run concurrently with retrieval.
 */
export async function resolveChainForModel(
  userId: string,
  targetModel?: string,
  traceId: string = newTraceId(),
  autoRule?: AutoRule
): Promise<ResolvedProvider[]> {
  const [chain, owned] = await Promise.all([resolveProviderChain(userId, "text"), resolveAllProviders(userId)]);
  return selectProviderForModel(chain, targetModel, traceId, { owned, autoRule });
}

/**
 * Stage 1: Load context, resolve persona/agent, and prepare provider chain.
 * Sequential convenience wrapper — `executeChatPipeline` uses the two halves
 * directly so it can overlap the chain resolution with retrieval.
 */
export async function loadChatContext(
  input: ChatPipelineInput,
  traceId: string = newTraceId()
): Promise<LoadedChatContext> {
  const base = buildChatContextBase(input, traceId);
  return { ...base, chain: await resolveChainForModel(input.userId, base.targetModel, traceId, base.autoRule) };
}

/**
 * Stage 2: Intent classification & local workspace retrieval.
 */
export async function retrieveChatContext(
  ctx: LoadedChatContext,
  traceId: string = newTraceId()
): Promise<RetrievedChatContext> {
  let intentResult: IntentResult = { primary: "general_qa", secondary: [], method: "default" };
  let retrievedDocs: RetrievedDoc[] = [];
  let sources: string[] = [];
  // Reset once intent lands, so a slow classifier is not billed to retrieval.
  // If intent throws, this still bounds the whole failed attempt.
  let retrievalStartedAt = Date.now();

  try {
    const intentDone = aiSpan(AI_EVENTS.intent, { traceId });
    intentResult = await classifyIntentAsync(ctx.userPrompt, ctx.input.personaId);
    intentDone({
      primary: intentResult.primary,
      secondary: intentResult.secondary,
      method: intentResult.method,
    });

    retrievalStartedAt = Date.now();
    const retrieval = await retrieveContext(intentResult.primary, ctx.input.userId, ctx.userPrompt, ctx.input.enabledSourceIds);
    retrievedDocs = retrieval.docs;
    sources = retrieval.sources;
  } catch (err) {
    log.error({ err, traceId }, "[retrieveChatContext] retrieval error, continuing ungrounded");
  }

  const groundedContext = buildGroundedContext(retrievedDocs);

  // Emitted on the failure path too — "retrieval ran and grounded nothing" is
  // the shape an operator needs to tell an ungrounded answer from a broken one.
  const perSource: Record<string, number> = {};
  for (const doc of retrievedDocs) perSource[doc.source] = (perSource[doc.source] ?? 0) + 1;
  aiEvent(AI_EVENTS.retrieval, {
    traceId,
    sources,
    docCount: retrievedDocs.length,
    perSource,
    contextChars: sizeOf(groundedContext),
    durationMs: Date.now() - retrievalStartedAt,
  });

  let finalSystemPrompt =
    groundedContext && ctx.selectedPersona
      ? assembleGroundedSystemPrompt({
          persona: ctx.selectedPersona,
          personaPrompt: ctx.input.personaPrompt || null,
          baseSystemPrompt: ctx.baseSystemPrompt,
          groundedContext,
          webSearchActive: Boolean(ctx.input.webSearchActive),
        })
      : ctx.baseSystemPrompt;

  if (typeof ctx.agent.systemPrompt === "function") {
    const agentCtx: AgentContext = {
      userId: ctx.input.userId,
      personaId: ctx.input.personaId,
      personaPrompt: ctx.input.personaPrompt || null,
      workspaceContext: typeof ctx.input.workspaceContext === "string" ? ctx.input.workspaceContext : null,
      webSearchActive: Boolean(ctx.input.webSearchActive),
      enabledSourceIds: ctx.input.enabledSourceIds,
      sourceConfig: ctx.input.sourceConfig,
      retrievedDocs,
    };
    try {
      const dynamicPrompt = ctx.agent.systemPrompt(agentCtx);
      if (dynamicPrompt) {
        finalSystemPrompt = `${finalSystemPrompt}\n\n${dynamicPrompt}`;
      }
    } catch (err) {
      log.error({ err, traceId }, `[retrieveChatContext] Failed to generate dynamic prompt for agent ${ctx.agent.id}:`);
    }
  }

  return {
    ...ctx,
    intentResult,
    retrievedDocs,
    sources,
    groundedContext,
    finalSystemPrompt,
  };
}

/**
 * Stage 3: Dynamic tool execution or text generation.
 */
export async function executeAgent(
  ctx: RetrievedChatContext,
  traceId: string = newTraceId()
): Promise<AgentExecutionResult> {
  const agentTools = ctx.agent.tools
    .map((name) => getTool(name))
    .filter((t): t is NonNullable<typeof t> => t !== undefined && isSourceAllowed(t.sourceId, ctx.input.enabledSourceIds));

  const toolDeclarations = agentTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  const hasToolIntent =
    ctx.intentResult.primary !== "general_qa" ||
    /\b(search|find|query|lookup|fetch|show|list|get|check|calculate|analyze|run|save|update|create|delete|sql)\b/i.test(ctx.userPrompt);

  const needsTools = toolDeclarations.length > 0 && !ctx.hasImages && hasToolIntent;

  // All three inputs to the decision, not just its result: "no tools ran" is
  // ambiguous until you know whether the agent had none, an image vetoed them,
  // or the prompt read as conversational.
  aiEvent(AI_EVENTS.routeTools, {
    traceId,
    needsTools,
    toolCount: toolDeclarations.length,
    hasImages: ctx.hasImages,
    hasToolIntent,
    intentPrimary: ctx.intentResult.primary,
    agentId: ctx.agent.id,
  });

  if (needsTools) {
    const executedToolCalls: ToolCallRecord[] = [];
    // onStep fires twice per call — once at "called", once terminal. Timing the
    // gap is the only way to attribute latency to a specific tool.
    const toolStartedAt = new Map<string, number>();
    const toolCtx: ToolExecutionContext = {
      userId: ctx.input.userId,
      personaId: ctx.input.personaId,
      sourceConfig: ctx.input.sourceConfig,
      traceId,
    };

    const executor = async (name: string, args: Record<string, unknown>, ectx: ToolExecutionContext) => {
      const tool = getTool(name);
      if (!tool) return { content: `Unknown tool: ${name}`, citations: [] };
      return tool.execute(args, ectx);
    };

    try {
      const result = await generateTextWithToolsStream(
        ctx.chain,
        { systemPrompt: ctx.finalSystemPrompt, userPrompt: ctx.userPrompt },
        toolDeclarations,
        executor,
        toolCtx,
        (step) => {
          const existingIdx = executedToolCalls.findIndex((t) => t.name === step.name);
          if (existingIdx >= 0) {
            executedToolCalls[existingIdx] = step;
          } else {
            executedToolCalls.push(step);
          }

          if (step.status === "called") {
            toolStartedAt.set(step.name, Date.now());
            return;
          }
          // Argument NAMES and result SIZE only: the values are the user's own
          // job titles, contact names and search text.
          const fields = {
            traceId,
            name: step.name,
            ok: step.status === "done",
            durationMs: Date.now() - (toolStartedAt.get(step.name) ?? Date.now()),
            argKeys: argKeys(step.args),
            resultChars: sizeOf(step.result?.content),
            citationCount: step.result?.citations?.length ?? 0,
          };
          if (step.status === "done") aiEvent(AI_EVENTS.toolCall, fields);
          else aiWarn(AI_EVENTS.toolCall, fields, step.error);
        },
        // traceId is what joins every provider hop and its cost to this turn.
        // Without it providers.ts mints its own and the hops orphan.
        // The head of the resolved chain is what actually serves the turn;
        // ctx.targetModel is absent on an "auto" turn.
        {
          userId: ctx.input.userId,
          action: "ai_chatbot",
          traceId,
          metadata: { model: ctx.chain[0]?.model ?? ctx.targetModel, persona: ctx.input.personaId },
        }
      );

      const approvals = result.toolCalls
        .map((t) => t.result?.approval)
        .filter((a): a is ToolApproval => Boolean(a));

      return {
        mode: "stream",
        baseStream: result.stream,
        sources: ctx.sources,
        executedToolCalls: result.toolCalls,
        approvals,
      };
    } catch (toolErr) {
      log.error({ err: toolErr, traceId }, "[executeAgent] generateTextWithToolsStream failed, falling back to direct stream:");
    }
  }

  // Fallback / Text-only Direct SSE Stream
  const baseStream = await generateTextStream(
    ctx.chain,
    { systemPrompt: ctx.finalSystemPrompt, userPrompt: ctx.userPrompt, images: ctx.images },
    {
      userId: ctx.input.userId,
      action: "ai_chatbot",
      traceId,
      metadata: {
        model: ctx.chain[0]?.model ?? ctx.targetModel,
        persona: ctx.input.personaId,
        messageCount: ctx.messagesArray.length,
      },
    }
  );

  return {
    mode: "stream",
    baseStream,
    sources: ctx.sources,
  };
}

/**
 * Stage 4: True SSE Web ReadableStream response generator.
 */
export function streamResponse(result: AgentExecutionResult): Response {
  const encoder = new TextEncoder();

  if (result.mode === "tools") {
    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (result.executedToolCalls.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tool_calls: result.executedToolCalls })}\n\n`)
          );
        }
        if (result.sources.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ sources: result.sources })}\n\n`)
          );
        }
        if (result.toolResultText) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: result.toolResultText } }] })}\n\n`
            )
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Direct streaming mode
  const preludeFrames: Uint8Array[] = [];
  if (result.executedToolCalls && result.executedToolCalls.length > 0) {
    preludeFrames.push(
      encoder.encode(`data: ${JSON.stringify({ tool_calls: result.executedToolCalls })}\n\n`)
    );
  }
  if (result.approvals && result.approvals.length > 0) {
    for (const approval of result.approvals) {
      preludeFrames.push(
        encoder.encode(`data: ${JSON.stringify({ approval })}\n\n`)
      );
    }
  }
  if (result.sources.length > 0) {
    preludeFrames.push(encoder.encode(`data: ${JSON.stringify({ sources: result.sources })}\n\n`));
  }

  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const mergedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const frame of preludeFrames) {
        controller.enqueue(frame);
      }
      const reader = result.baseStream.getReader();
      activeReader = reader;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } catch {}
      } finally {
        activeReader = null;
        reader.releaseLock();
        try {
          controller.close();
        } catch {}
      }
    },
    async cancel(reason) {
      try {
        await activeReader?.cancel(reason);
      } catch {}
    },
  });

  return new Response(mergedStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * High-performance, framework-free native multi-agent pipeline.
 *
 * Executes:
 * 1. loadChatContext: Context loading & agent resolution.
 * 2. retrieveChatContext: Intent-aware local retrieval (jobs, contacts, resumes, links, prompts).
 * 3. executeAgent: Dynamic tool scoping based on active agent & user source permissions.
 * 4. streamResponse: Resilient streaming with true SSE token deltas, tool-call & source event frames.
 */
export async function executeChatPipeline(input: ChatPipelineInput): Promise<Response> {
  const traceId = newTraceId();
  const startedAt = Date.now();

  // Read at whichever exit fires, so an early return still reports how far the
  // turn actually got instead of leaving the fields off.
  let chainLength = 0;
  let sourceCount = 0;
  let toolCallCount = 0;

  /** Closes the trace. A start with no end is the signal that the process died
   *  mid-turn, so every exit — including the early ones — has to call this.
   *  Note "stream" closes when the Response is handed back, not when the last
   *  token lands: totalDurationMs is time-to-response, not time-to-complete. */
  const end = (outcome: "stream" | "tools" | "no-provider" | "error", err?: unknown) => {
    const fields = {
      traceId,
      outcome,
      totalDurationMs: Date.now() - startedAt,
      chainLength,
      sourceCount,
      toolCallCount,
    };
    if (outcome === "error") aiWarn(AI_EVENTS.requestEnd, fields, err);
    else aiEvent(AI_EVENTS.requestEnd, fields);
  };

  // Built first because it is pure — no I/O has started yet — and it is what
  // resolves the agent and parses attachments that the start event reports.
  const base = buildChatContextBase(input, traceId);
  aiEvent(AI_EVENTS.requestStart, {
    traceId,
    userId: input.userId,
    personaId: input.personaId,
    agentId: base.agent.id,
    requestedModel: input.model ?? null,
    messageCount: base.messagesArray.length,
    hasImages: base.hasImages,
    promptChars: sizeOf(base.userPrompt),
    webSearchActive: Boolean(input.webSearchActive),
    enabledSourceCount: input.enabledSourceIds?.length ?? 0,
  });

  try {
    // Chain resolution (DB read + key decryption) and retrieval (local SQLite)
    // are independent — retrieval never reads `chain`. Overlap them.
    const [chain, retrieved] = await Promise.all([
      resolveChainForModel(input.userId, base.targetModel, traceId, base.autoRule),
      retrieveChatContext({ ...base, chain: [] }, traceId),
    ]);
    chainLength = chain.length;
    sourceCount = retrieved.sources.length;

    if (chain.length === 0) {
      end("no-provider");
      return new Response(
        JSON.stringify({
          error: "No AI provider configured. Please connect an AI Provider with your API key in Settings > AI Providers.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const executionResult = await executeAgent({ ...retrieved, chain }, traceId);
    sourceCount = executionResult.sources.length;
    toolCallCount = executionResult.executedToolCalls?.length ?? 0;
    end(executionResult.mode);
    return streamResponse(executionResult);
  } catch (err) {
    end("error", err);
    throw err;
  }
}

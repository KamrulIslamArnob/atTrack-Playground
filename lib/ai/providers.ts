import { GoogleGenAI, type Part } from "@google/genai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { ProviderType, TaskType } from "@/lib/types/ai-providers";
import { moduleLogger } from "@/lib/log";
import { AI_EVENTS, aiEvent, aiWarn, newTraceId } from "@/lib/log/ai-events";
import { fetchWithLog } from "@/lib/log/fetch";
import { estimateCost } from "@/lib/ai/pricing";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import type { ToolApproval } from "./tools/types";
import type { ChatArtifact } from "@/lib/types/chat-artifact";
import type { PermissionMode } from "@/lib/ai-chatbot/composer-settings";

// createAdminClient/decrypt/logAiUsage stay dynamic imports: they drag the DB
// client and a "use server" module into the graph of every path that loads this
// file, including ones that never log a row.
//
// The "@/" alias is NOT a constraint here. An earlier version of this comment
// said these had to be lazy so `node lib/ai/providers.selfcheck.ts` could load
// the module without tsconfig path mapping — no such file exists, so the static
// "@/" imports above are safe.
/** Telemetry context threaded through every generation path. `traceId` ties
 *  each provider hop back to the chat turn that caused it — the chatbot
 *  pipeline mints one per request and passes it down. */
export interface AiLogContext {
  userId?: string;
  action: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

const aiLog = moduleLogger("ai");

type LogUsageParams = {
  userId: string;
  action: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  /** null when the model has no entry in lib/ai/pricing.ts. Deliberately not
   *  0 — see recordHop. */
  costUsd?: number | null;
  pricing?: "known" | "unknown";
  durationMs?: number;
  status?: "success" | "error";
  error?: string;
  metadata?: Record<string, unknown>;
};

async function logUsage(params: LogUsageParams): Promise<void> {
  const { logAiUsage } = await import("@/lib/actions/ai-usage");
  await logAiUsage(params);
}

/** Usage logging is best-effort telemetry, never part of the response path.
 *  Awaiting it inside the streaming loop stalls token delivery on a DB write,
 *  and awaiting it before a return adds that write to every request's latency.
 *  A failed log must not fail the generation. */
function logUsageDetached(params: LogUsageParams): void {
  void logUsage(params).catch((err) => {
    aiLog.warn({ err }, "AI usage logging failed (non-fatal):");
  });
}

/** Everything one provider attempt should record: the `ai.provider.hop` line,
 *  the `ai.usage` line, and the `ai_usage_logs` row — including what it cost.
 *
 *  Every generation path funnels through here so the cost is estimated in
 *  exactly one place. It used to be estimated in none: `cost_usd` was written
 *  as a literal 0 on every row, so the admin AI-usage page summed to $0.0000
 *  no matter how much had been spent.
 *
 *  An unpriced model reports `costUsd: null` with `pricing: "unknown"`. The
 *  database column keeps taking a number (the admin pages call `.toFixed(4)`
 *  on it unguarded), so the null is carried in `pricing` instead — that way a
 *  row that genuinely cost nothing stays distinguishable from one whose price
 *  we simply do not know. */
function recordHop(p: {
  logContext: AiLogContext;
  traceId: string;
  provider: ResolvedProvider;
  /** What the provider actually served, when it reports something different
   *  from what was configured. */
  model?: string;
  /** 0-based position in the fallback chain. */
  attempt: number;
  startedAt: number;
  ok: boolean;
  streaming: boolean;
  /** Time to first token. The number that decides whether the UI feels alive. */
  ttftMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  error?: string;
  err?: unknown;
}): void {
  const durationMs = Date.now() - p.startedAt;
  const model = p.model ?? p.provider.model;
  const hasTokens = p.inputTokens != null || p.outputTokens != null;

  const { costUsd, pricing } = hasTokens
    ? estimateCost(model, {
        inputTokens: p.inputTokens,
        outputTokens: p.outputTokens,
        cachedTokens: p.cachedTokens,
      })
    : { costUsd: null, pricing: "unknown" as const };

  const hop = {
    traceId: p.traceId,
    action: p.logContext.action,
    provider: p.provider.name,
    providerType: p.provider.provider_type,
    model,
    attempt: p.attempt,
    ok: p.ok,
    streaming: p.streaming,
    ...(p.ttftMs != null ? { ttftMs: p.ttftMs } : {}),
    durationMs,
  };

  // A failed hop is a warning, not an error: the chain falls through to the
  // next provider and the user still gets an answer.
  if (p.ok) aiEvent(AI_EVENTS.providerHop, hop);
  else aiWarn(AI_EVENTS.providerHop, { ...hop, errorMessage: p.error }, p.err);

  if (hasTokens) {
    aiEvent(AI_EVENTS.usage, {
      traceId: p.traceId,
      action: p.logContext.action,
      provider: p.provider.name,
      model,
      inputTokens: p.inputTokens ?? 0,
      outputTokens: p.outputTokens ?? 0,
      ...(p.cachedTokens != null ? { cachedTokens: p.cachedTokens } : {}),
      costUsd,
      pricing,
      durationMs,
    });
  }

  if (!p.logContext.userId) return;
  logUsageDetached({
    userId: p.logContext.userId,
    action: p.logContext.action,
    model: `${p.provider.name}/${model}`,
    ...(p.inputTokens != null ? { inputTokens: p.inputTokens } : {}),
    ...(p.outputTokens != null ? { outputTokens: p.outputTokens } : {}),
    ...(p.cachedTokens != null ? { cachedTokens: p.cachedTokens } : {}),
    costUsd,
    pricing,
    durationMs,
    ...(p.ok ? {} : { status: "error" as const, error: p.error }),
    metadata: p.logContext.metadata,
  });
}

export interface ResolvedProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  api_key: string;
}

interface ProviderRow {
  id: string;
  name: string;
  provider_type: ProviderType;
  base_url: string | null;
  model: string;
  encrypted_api_key: string;
}

const DEFAULT_GEMINI_MODEL = "models/gemini-2.0-flash";

/** Hard ceiling on one provider call. A hung provider must not stall the
 *  whole chain (non-streaming hops) or the UI's first token (streaming).
 *  Sized against the chat route's maxDuration, not under it: a slow endpoint
 *  answering a tool-grounded prompt was measured at 69s to first token, so a
 *  60s ceiling aborted work that would have succeeded. */
const HOP_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Zero-config fallback: today's single hardcoded Gemini client, used
 *  whenever a task has no configured chain — keeps the app working out of
 *  the box with nothing but GEMINI_API_KEY set. */
function defaultGeminiProvider(): ResolvedProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return {
    id: "default-gemini",
    name: "Gemini (default)",
    provider_type: "gemini",
    base_url: null,
    model: DEFAULT_GEMINI_MODEL,
    api_key: apiKey,
  };
}

/** Every provider the user has configured, decrypted, in creation order —
 *  independent of any task route. The chat model picker is built from this same
 *  set, so the router needs it to honour a pick the "text" route does not list.
 *  A row whose key fails to decrypt is skipped like any other unusable hop. */
export async function resolveAllProviders(userId: string): Promise<ResolvedProvider[]> {
  const { createDbClient: createAdminClient } = await import("@/lib/db/client");
  const admin = createAdminClient();
  const { decrypt } = await import("@/lib/encryption");

  const { data } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model, encrypted_api_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const resolved: ResolvedProvider[] = [];
  for (const row of (data ?? []) as unknown as ProviderRow[]) {
    try {
      resolved.push({ ...row, api_key: decrypt(row.encrypted_api_key) });
    } catch {
      // skip an unusable key, don't drop the rest
    }
  }
  return resolved;
}

/** Resolves a task's ordered fallback chain, decrypting each provider's key.
 *  A key that fails to decrypt, or a route pointing at a deleted provider, is
 *  skipped like any other unusable hop rather than failing the whole chain. */
export async function resolveProviderChain(userId: string, taskType: TaskType): Promise<ResolvedProvider[]> {
  const { createDbClient: createAdminClient } = await import("@/lib/db/client");
  const admin = createAdminClient();

  const { data: route } = await admin
    .from("ai_task_routes")
    .select("provider_ids")
    .eq("user_id", userId)
    .eq("task_type", taskType)
    .maybeSingle();

  const rawProviderIds = (route as Record<string, unknown> | null)?.provider_ids;
  let providerIds: string[] = [];
  if (Array.isArray(rawProviderIds)) {
    providerIds = rawProviderIds.filter((id): id is string => typeof id === "string" && Boolean(id));
  } else if (typeof rawProviderIds === "string") {
    try {
      const parsed = JSON.parse(rawProviderIds);
      if (Array.isArray(parsed)) {
        providerIds = parsed.filter((id): id is string => typeof id === "string" && Boolean(id));
      }
    } catch {}
  }

  const { decrypt } = await import("@/lib/encryption");

  if (providerIds.length === 0) {
    // If no explicit task route was assigned, auto-fallback to any configured active provider
    const resolvedFallback = await resolveAllProviders(userId);
    if (resolvedFallback.length > 0) {
      return resolvedFallback;
    }

    const fallback = defaultGeminiProvider();
    return fallback ? [fallback] : [];
  }

  const { data: providers } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model, encrypted_api_key")
    .eq("user_id", userId)
    .in("id", providerIds);

  const byId = new Map(((providers ?? []) as unknown as ProviderRow[]).map((p) => [p.id, p]));

  const resolved: ResolvedProvider[] = [];
  for (const id of providerIds) {
    const row = byId.get(id);
    if (!row) continue;
    try {
      resolved.push({ ...row, api_key: decrypt(row.encrypted_api_key) });
    } catch {
      // skip an unusable key, don't crash the whole chain
    }
  }

  if (resolved.length === 0) {
    const fallback = defaultGeminiProvider();
    if (fallback) resolved.push(fallback);
  }

  return resolved;
}

export interface GenerateTextInput {
  systemPrompt?: string;
  userPrompt: string;
  images?: { mimeType: string; data: string }[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  providerName: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

type HopCaller = (provider: ResolvedProvider, input: GenerateTextInput) => Promise<GenerateTextResult>;

export async function callGemini(provider: ResolvedProvider, input: GenerateTextInput): Promise<GenerateTextResult> {
  const ai = new GoogleGenAI({ apiKey: provider.api_key });

  const parts: Part[] = (input.images ?? []).map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data },
  }));
  parts.push({ text: input.userPrompt });

  const response = await ai.models.generateContent({
    model: provider.model,
    contents: [{ role: "user", parts }],
    config: {
      ...(input.systemPrompt ? { systemInstruction: input.systemPrompt } : {}),
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.maxOutputTokens != null ? { maxOutputTokens: input.maxOutputTokens } : {}),
    },
  });

  const text = response.text;
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: response.usageMetadata?.promptTokenCount,
    outputTokens: response.usageMetadata?.candidatesTokenCount,
  };
}

export async function callAnthropic(provider: ResolvedProvider, input: GenerateTextInput): Promise<GenerateTextResult> {
  const content: unknown[] = (input.images ?? []).map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.data },
  }));
  content.push({ type: "text", text: input.userPrompt });

  const res = await fetchWithLog("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: input.maxOutputTokens ?? 8192,
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const text = (json.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
  };
}

export async function callOpenAICompatible(
  provider: ResolvedProvider,
  input: GenerateTextInput
): Promise<GenerateTextResult> {
  const content: unknown[] = [{ type: "text", text: input.userPrompt }];
  for (const img of input.images ?? []) {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }

  const messages = [
    ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
    { role: "user", content },
  ];

  const baseUrl = (provider.base_url || "").replace(/\/+$/, "");
  const res = await fetchWithLog(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.maxOutputTokens != null ? { max_tokens: input.maxOutputTokens } : {}),
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider.name}: no text content in response`);

  return {
    text,
    providerName: provider.name,
    model: provider.model,
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
  };
}

function callerFor(providerType: ProviderType): HopCaller {
  switch (providerType) {
    case "gemini":
      return callGemini;
    case "anthropic":
      return callAnthropic;
    case "openai_compatible":
      return callOpenAICompatible;
  }
}

/** Walks the chain in order; a hop's failure is logged (when userId is given)
 *  and dispatch moves to the next hop. Only throws once every hop has
 *  failed. Exported (rather than folded into generateText) so the self-check
 *  can inject a fake `resolveCaller` and exercise the fallback logic without
 *  any real network calls. */
export async function runChain(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: AiLogContext,
  resolveCaller: (providerType: ProviderType) => HopCaller
): Promise<GenerateTextResult> {
  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task. Please add an API key in Settings > AI Providers.");
  }

  // One id for the whole chain. A caller that already has a trace (the chat
  // pipeline) passes it down so its hops join that turn; a caller without one
  // (background rescore, resume match, email drafting) gets its own.
  const traceId = logContext.traceId ?? newTraceId();

  const errors: string[] = [];
  for (const [attempt, provider] of chain.entries()) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(resolveCaller(provider.provider_type)(provider, input), HOP_TIMEOUT_MS, provider.name);
      recordHop({
        logContext,
        traceId,
        provider,
        model: result.model,
        attempt,
        startedAt,
        ok: true,
        streaming: false,
        inputTokens: result.inputTokens ?? 0,
        outputTokens: result.outputTokens ?? 0,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${message}`);
      recordHop({
        logContext,
        traceId,
        provider,
        attempt,
        startedAt,
        ok: false,
        streaming: false,
        error: message,
        err,
      });
    }
  }

  aiWarn(AI_EVENTS.providerHop, {
    traceId,
    action: logContext.action,
    chainLength: chain.length,
    exhausted: true,
  }, undefined, "All providers failed");

  throw new Error(`All providers failed: ${errors.join("; ")}`);
}

export async function generateText(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: AiLogContext
): Promise<GenerateTextResult> {
  return runChain(chain, input, logContext, callerFor);
}

/** One incremental piece of a provider stream: a text delta, a usage report,
 *  or both. Vendor-specific stream readers normalize to this. */
interface StreamDelta {
  text?: string;
  reasoning?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Reads an SSE response body and yields each `data:` payload as raw text,
 *  stopping at `[DONE]`. Handles chunk boundaries splitting mid-event, which
 *  is the usual way a naive line-splitting parser corrupts output. */
async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; keep the trailing partial.
      let sep: number;
      while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + buffer.slice(sep).match(/^\r?\n\r?\n/)![0].length);

        for (const line of rawEvent.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          if (payload) yield payload;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** OpenAI-compatible (OpenAI, Groq, DeepSeek, OpenRouter, local servers) SSE. */
async function* streamOpenAICompatible(
  provider: ResolvedProvider,
  input: GenerateTextInput
): AsyncGenerator<StreamDelta> {
  const content: unknown[] = [{ type: "text", text: input.userPrompt }];
  for (const img of input.images ?? []) {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }

  const messages = [
    ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
    { role: "user", content },
  ];

  const baseUrl = (provider.base_url || "").replace(/\/+$/, "");
  const res = await fetchWithLog(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.maxOutputTokens != null ? { max_tokens: input.maxOutputTokens } : {}),
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  if (!res.body) throw new Error(`${provider.name}: empty stream body`);

  for await (const payload of readSseData(res.body)) {
    let json: {
      choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      json = JSON.parse(payload);
    } catch {
      continue; // keep-alive comment or vendor noise
    }

    const reasoning = json.choices?.[0]?.delta?.reasoning_content ?? json.choices?.[0]?.delta?.reasoning;
    if (reasoning) yield { reasoning };

    const text = json.choices?.[0]?.delta?.content;
    if (text) yield { text };

    // Sent in a final usage-only chunk when stream_options is honored; providers
    // that ignore stream_options simply never emit it.
    if (json.usage) {
      yield { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens };
    }
  }
}

/** Anthropic Messages API SSE. */
async function* streamAnthropic(
  provider: ResolvedProvider,
  input: GenerateTextInput
): AsyncGenerator<StreamDelta> {
  const content: unknown[] = (input.images ?? []).map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.data },
  }));
  content.push({ type: "text", text: input.userPrompt });

  const res = await fetchWithLog("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: input.maxOutputTokens ?? 8192,
      stream: true,
      ...(input.temperature != null ? { temperature: input.temperature } : {}),
      ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  if (!res.body) throw new Error(`${provider.name}: empty stream body`);

  let inputTokens: number | undefined;

  for await (const payload of readSseData(res.body)) {
    let json: {
      type?: string;
      delta?: { type?: string; text?: string; thinking?: string };
      message?: { usage?: { input_tokens?: number } };
      usage?: { output_tokens?: number };
      error?: { message?: string };
    };
    try {
      json = JSON.parse(payload);
    } catch {
      continue;
    }

    if (json.type === "error") {
      throw new Error(`${provider.name}: ${json.error?.message ?? "stream error"}`);
    }
    if (json.type === "message_start") {
      inputTokens = json.message?.usage?.input_tokens;
    }
    if (json.type === "content_block_delta") {
      if (json.delta?.type === "thinking_delta" && json.delta.thinking) {
        yield { reasoning: json.delta.thinking };
      } else if (json.delta?.type === "text_delta" && json.delta.text) {
        yield { text: json.delta.text };
      }
    }
    if (json.type === "message_delta" && json.usage) {
      yield { inputTokens, outputTokens: json.usage.output_tokens };
    }
  }
}

/** SSE stream for the two streaming routes. Only chain[0] is used in practice —
 *  see the "no mid-stream fallback" global constraint: once a token has been
 *  enqueued, a later failure ends the stream rather than restarting on the next
 *  hop. All three provider types now stream token-by-token. */
export async function generateTextStream(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: AiLogContext
): Promise<ReadableStream<Uint8Array>> {
  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task. Please add an API key in Settings > AI Providers.");
  }

  const encoder = new TextEncoder();
  const traceId = logContext.traceId ?? newTraceId();

  return new ReadableStream({
    async start(controller) {
      const errors: string[] = [];

      for (const [attempt, provider] of chain.entries()) {
        const startedAt = Date.now();
        let enqueuedChunk = false;
        let usageCaptured = false;
        /** Set the instant the first byte reaches the client. The gap between
         *  this and durationMs is the difference between a UI that feels
         *  alive and one that looks hung. */
        let ttftMs: number | undefined;

        try {
          if (provider.provider_type === "gemini") {
            const ai = new GoogleGenAI({ apiKey: provider.api_key });
            
            const parts: Part[] = (input.images ?? []).map((img) => ({
              inlineData: { mimeType: img.mimeType, data: img.data },
            }));
            parts.push({ text: input.userPrompt });

            const response = await ai.models.generateContentStream({
              model: provider.model,
              contents: [{ role: "user", parts }],
              config: {
                ...(input.systemPrompt ? { systemInstruction: input.systemPrompt } : {}),
                ...(input.temperature != null ? { temperature: input.temperature } : {}),
                ...(input.maxOutputTokens != null ? { maxOutputTokens: input.maxOutputTokens } : {}),
              },
            });

            const iterator = response[Symbol.asyncIterator]();
            let chunk = await withTimeout(iterator.next(), HOP_TIMEOUT_MS, `${provider.name} first token`);
            while (!chunk.done) {
              const parts = chunk.value.candidates?.[0]?.content?.parts;
              if (parts && parts.length > 0) {
                for (const part of parts) {
                  const partObj = part as { thought?: boolean; text?: string };
                  if (partObj.thought && partObj.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: partObj.text } }] })}\n\n`)
                    );
                    if (!enqueuedChunk) ttftMs = Date.now() - startedAt;
                    enqueuedChunk = true;
                  } else if (partObj.text) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: partObj.text } }] })}\n\n`)
                    );
                    if (!enqueuedChunk) ttftMs = Date.now() - startedAt;
                    enqueuedChunk = true;
                  }
                }
              } else {
                const text = chunk.value.text;
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                  );
                  if (!enqueuedChunk) ttftMs = Date.now() - startedAt;
                  enqueuedChunk = true;
                }
              }
              const usage = chunk.value.usageMetadata;
              if (usage && !usageCaptured) {
                usageCaptured = true;
                recordHop({
                  logContext,
                  traceId,
                  provider,
                  attempt,
                  startedAt,
                  ok: true,
                  streaming: true,
                  ttftMs,
                  inputTokens: usage.promptTokenCount ?? 0,
                  outputTokens: usage.candidatesTokenCount ?? 0,
                  cachedTokens: usage.cachedContentTokenCount ?? undefined,
                });
              }
              chunk = await iterator.next();
            }
          } else {
            const source =
              provider.provider_type === "anthropic"
                ? streamAnthropic(provider, input)
                : streamOpenAICompatible(provider, input);

            const iterator = source[Symbol.asyncIterator]();
            // Only the first token is time-boxed: a hung provider must not
            // stall the UI, but a long legitimate answer must not be cut off.
            let step = await withTimeout(iterator.next(), HOP_TIMEOUT_MS, `${provider.name} first token`);
            while (!step.done) {
              const { text, reasoning, inputTokens, outputTokens } = step.value;
              if (reasoning) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: reasoning } }] })}\n\n`)
                );
                if (!enqueuedChunk) ttftMs = Date.now() - startedAt;
                enqueuedChunk = true;
              }
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                );
                if (!enqueuedChunk) ttftMs = Date.now() - startedAt;
                enqueuedChunk = true;
              }
              if ((inputTokens != null || outputTokens != null) && !usageCaptured) {
                usageCaptured = true;
                recordHop({
                  logContext,
                  traceId,
                  provider,
                  attempt,
                  startedAt,
                  ok: true,
                  streaming: true,
                  ttftMs,
                  inputTokens: inputTokens ?? 0,
                  outputTokens: outputTokens ?? 0,
                });
              }
              step = await iterator.next();
            }

            // Providers that never emit a usage frame still get one log line.
            // No token counts means no cost estimate is possible — the hop is
            // still recorded so the trace is not missing an attempt.
            if (enqueuedChunk && !usageCaptured) {
              usageCaptured = true;
              recordHop({
                logContext,
                traceId,
                provider,
                attempt,
                startedAt,
                ok: true,
                streaming: true,
                ttftMs,
              });
            }
          }

          if (enqueuedChunk) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // The hop ran to completion without producing a single token.
          // Falling through to the next provider is right — an empty answer is
          // no answer — but doing it silently is not: the turn is then served
          // by a provider the user never picked, the UI still labels it with
          // the picked one, and the trace shows no failure at all. Seen live:
          // a Gemini pick finished ok with 17 output tokens and zero text
          // parts, and the next chain entry answered under Gemini's name.
          errors.push(`${provider.name}: produced no output`);
          recordHop({
            logContext,
            traceId,
            provider,
            attempt,
            startedAt,
            ok: false,
            streaming: true,
            error: "empty stream",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${provider.name}: ${message}`);
          recordHop({
            logContext,
            traceId,
            provider,
            attempt,
            startedAt,
            ok: false,
            streaming: true,
            ttftMs,
            error: message,
            err,
          });
          if (enqueuedChunk) {
            // Mid-stream failure — clean to user-facing quota/timeout guidance
            const clean = cleanAiErrorMessage(message);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: clean })}\n\n`));
            controller.close();
            return;
          }
        }
      }

      // If all providers in chain failed before any token was enqueued — clean once so UI gets quota guidance
      const cleanFinal = cleanAiErrorMessage(`All providers failed: ${errors.join("; ")}`);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ error: cleanFinal })}\n\n`)
      );
      controller.close();
    },
  });
}

const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^127\./, // 127.0.0.0/8 loopback
  /^10\./, // 10.0.0.0/8 private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 private
  /^192\.168\./, // 192.168.0.0/16 private
  /^169\.254\./, // 169.254.0.0/16 link-local
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/, // IPv6 loopback
];

/** Guards every server-side "fetch a URL someone else supplied" call — the
 *  chatbot's web_search tool and the native scrape fallback below are the
 *  app's only two. Rejects requests aimed at the local machine or a private
 *  network before they go out, so a job description or chat message can't
 *  smuggle in an SSRF probe against localhost/the LAN. */
export function assertPublicHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }
  const hostname = parsed.hostname;
  if (hostname === "localhost" || BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(hostname))) {
    throw new Error("Requests to local or private network addresses are not allowed");
  }
}

/** Scraping-task substitute for Gemini's built-in url_context tool: plain
 *  fetch + tag-stripping, used only when the resolved scraping hop isn't
 *  Gemini. Capped at 20k chars — plenty for a job posting, keeps the prompt
 *  bounded. redirect:"manual" means a 3xx is treated as a failed fetch rather
 *  than followed — a public-looking URL can still redirect to a private one. */
export async function fetchUrlAsText(url: string): Promise<string> {
  assertPublicHttpUrl(url);
  const res = await fetchWithLog(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; atTrack/1.0)" },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return stripHtml(await res.text());
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool-calling (function calling). ADDITIVE: the existing generateText /
// generateTextStream single-turn functions are NOT modified. This path is used
// only when a route explicitly opts in (chatbot CHAT_TOOLS=on). Tool rounds are
// non-streaming by nature; the final answer is streamed separately by the graph.
// ─────────────────────────────────────────────────────────────────────────────

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
  id?: string; // OpenAI/Anthropic need an id to pair the tool result message
}

export interface ProviderToolRoundResult {
  text?: string;
  functionCalls?: FunctionCall[];
  /** Raw assistant/model turn that requested functionCalls, to replay verbatim
   *  into the next round's history — shape differs per provider (Gemini model
   *  turn, OpenAI assistant message, Anthropic content blocks). Only set
   *  alongside functionCalls. */
  assistantTurn?: unknown;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: { content: string; citations: string[]; approval?: ToolApproval; artifact?: ChatArtifact; artifacts?: ChatArtifact[] };
  status: "called" | "done" | "error";
  error?: string;
}

export interface ToolExecutionContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian path, GitHub token). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
  /** Per-turn id, threaded through so tools can tell "this turn" apart from
   *  "a later turn" (see delete_database's confirm gate). */
  traceId?: string;
  permissionMode?: PermissionMode;
}

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
) => Promise<{ content: string; citations: string[]; approval?: ToolApproval; artifact?: ChatArtifact; artifacts?: ChatArtifact[] }>;

const MAX_TOOL_ROUNDS = 4;

/** Per-tool ceiling on result text folded into the streaming follow-up prompt. */
const MAX_TOOL_RESULT_CHARS = 6000;

/** Budget for the tool-selection round, which returns only a small function-call
 *  payload. Deliberately well under HOP_TIMEOUT_MS: overrunning it costs the
 *  wait AND the ungrounded fallback that follows, so the two must fit together
 *  inside the route's maxDuration. */
const TOOL_ROUND_TIMEOUT_MS = 30_000;

/** Minimal instruction for the tool-selection round. Deliberately tiny — the
 *  tool declarations already carry the semantics, and every token here is paid
 *  back as latency before the user sees anything. */
const TOOL_SELECTION_PROMPT =
  "Select the tools needed to answer the user's question, with their arguments. " +
  "Call tools only when the question needs the user's own workspace data. " +
  "Do not write an answer or explanation in this step.";

/** Gemini function-calling round. `contents` carries the running conversation. */
async function callGeminiToolRound(
  provider: ResolvedProvider,
  systemPrompt: string | undefined,
  contents: { role: string; parts: { text?: string; functionResponse?: unknown }[] }[],
  toolDeclarations: Record<string, unknown>[],
  temperature?: number
): Promise<ProviderToolRoundResult> {
  const ai = new GoogleGenAI({ apiKey: provider.api_key });
  const response = await ai.models.generateContent({
    model: provider.model,
    contents: contents as unknown as Part[],
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toolDeclarations }],
      ...(temperature != null ? { temperature } : {}),
    },
  });

  // @google/genai exposes functionCalls on the response; type as any-safe.
  const fcs = (response as unknown as { functionCalls?: { name: string; args?: Record<string, unknown> }[] })
    .functionCalls;
  if (fcs && fcs.length > 0) {
    return {
      functionCalls: fcs.map((f) => ({ name: f.name, args: (f.args as Record<string, unknown>) ?? {} })),
      assistantTurn: {
        role: "model",
        parts: fcs.map((f) => ({ functionCall: { name: f.name, args: f.args ?? {} } })),
      },
    };
  }
  const text = response.text;
  return { text: text || undefined };
}

/**
 * LongCat-Flash's native tool-calling format is not the OpenAI `tool_calls`
 * JSON field — it's a custom XML tag the model writes straight into
 * `message.content`:
 *   <longcat_tool_call>tool_name
 *   <longcat_arg_key>k</longcat_arg_key><longcat_arg_value>v</longcat_arg_value>
 *   </longcat_tool_call>
 * A gateway with a matching "tool call parser" (e.g. vLLM's `longcat` parser)
 * translates this into real `tool_calls`; LongCat's own hosted API does not,
 * so it leaks straight through as text and the round looks like a plain
 * answer — the model narrates success while nothing ran. Parsed here so any
 * openai_compatible provider that leaks this tag is treated like a real
 * function call instead of silently losing the write.
 */
function parseLongcatToolCallTags(content: string): FunctionCall[] {
  const calls: FunctionCall[] = [];
  const blockRe = /<longcat_tool_call>([\s\S]*?)<\/longcat_tool_call>/g;
  const argRe = /<longcat_arg_key>([\s\S]*?)<\/longcat_arg_key>\s*<longcat_arg_value>([\s\S]*?)<\/longcat_arg_value>/g;
  let block: RegExpExecArray | null;
  let i = 0;
  while ((block = blockRe.exec(content))) {
    const body = block[1];
    const firstArgIdx = body.indexOf("<longcat_arg_key>");
    const name = (firstArgIdx === -1 ? body : body.slice(0, firstArgIdx)).trim();
    if (!name) continue;
    const args: Record<string, unknown> = {};
    let arg: RegExpExecArray | null;
    argRe.lastIndex = 0;
    while ((arg = argRe.exec(body))) {
      const key = arg[1].trim();
      const raw = arg[2].trim();
      try {
        args[key] = JSON.parse(raw);
      } catch {
        args[key] = raw;
      }
    }
    calls.push({ name, args, id: `longcat_${i++}` });
  }
  return calls;
}

async function callOpenAICompatibleToolRound(
  provider: ResolvedProvider,
  systemPrompt: string | undefined,
  messages: { role: string; content?: string; tool_calls?: unknown[]; name?: string }[],
  toolDeclarations: Record<string, unknown>[],
  temperature?: number
): Promise<ProviderToolRoundResult> {
  const baseUrl = (provider.base_url || "").replace(/\/+$/, "");
  const res = await fetchWithLog(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools: toolDeclarations.map((d) => ({ type: "function", function: d })),
      tool_choice: "auto",
      ...(temperature != null ? { temperature } : {}),
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const msg = json.choices?.[0]?.message;
  const toolCalls = msg?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return {
      functionCalls: toolCalls.map((tc: { function?: { name: string; arguments?: string } }) => ({
        name: tc.function?.name ?? "",
        args: safeParseArgs(tc.function?.arguments),
        id: (tc as { id?: string }).id,
      })),
      // Raw tool_calls (not the parsed FunctionCall[]) — OpenAI needs the exact
      // original shape (id, type, function.arguments string) to match the
      // subsequent tool_call_id-keyed tool-result messages.
      assistantTurn: { role: "assistant", content: msg?.content ?? null, tool_calls: msg?.tool_calls },
    };
  }

  const rawContent = typeof msg?.content === "string" ? msg.content : "";
  const tagCalls = rawContent.includes("<longcat_tool_call>") ? parseLongcatToolCallTags(rawContent) : [];
  if (tagCalls.length > 0) {
    const fabricatedToolCalls = tagCalls.map((c) => ({
      id: c.id,
      type: "function",
      function: { name: c.name, arguments: JSON.stringify(c.args) },
    }));
    return {
      functionCalls: tagCalls,
      assistantTurn: { role: "assistant", content: null, tool_calls: fabricatedToolCalls },
    };
  }

  return { text: rawContent || undefined };
}

async function callAnthropicToolRound(
  provider: ResolvedProvider,
  systemPrompt: string | undefined,
  messages: { role: string; content: unknown }[],
  toolDeclarations: Record<string, unknown>[],
  temperature?: number
): Promise<ProviderToolRoundResult> {
  const res = await fetchWithLog("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": provider.api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 8192,
      ...(temperature != null ? { temperature } : {}),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      tools: toolDeclarations,
      messages,
    }),
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${provider.name}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const blocks = json.content ?? [];
  const toolUses = blocks.filter((b: { type: string }) => b.type === "tool_use");
  if (toolUses.length > 0) {
    return {
      functionCalls: toolUses.map((b: { name: string; id: string; input?: Record<string, unknown> }) => ({
        name: b.name,
        args: (b.input as Record<string, unknown>) ?? {},
        id: b.id,
      })),
      // Raw blocks array, unmodified — Anthropic requires the assistant turn's
      // content blocks (including any interleaved text) echoed back verbatim.
      assistantTurn: { role: "assistant", content: blocks },
    };
  }
  const text = blocks
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");
  return { text: text || undefined };
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Runs the model with the given tools, executing any function calls it emits and
 * feeding results back, up to MAX_TOOL_ROUNDS. Returns the final answer text and
 * the recorded tool calls. Falls back to plain generateText if no provider in the
 * chain supports tools (resilience parity with runChain).
 */
export async function generateTextWithTools(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  toolDeclarations: Record<string, unknown>[],
  executor: ToolExecutor,
  ctx: ToolExecutionContext,
  onStep?: (record: ToolCallRecord) => void,
  logContext?: AiLogContext
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const hasTools = toolDeclarations.length > 0;
  const toolCalls: ToolCallRecord[] = [];

  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task. Please add an API key in Settings > AI Providers.");
  }
  if (!hasTools) {
    const r = await generateText(chain, input, logContext ?? { action: "ai_chatbot" });
    return { text: r.text, toolCalls };
  }

  const lc: AiLogContext = logContext ?? { action: "ai_chatbot" };
  const traceId = lc.traceId ?? newTraceId();
  let lastError = "";

  for (const [attempt, provider] of chain.entries()) {
    // Per-hop, not per-call: a shared clock would bill the second provider for
    // the time the first one spent timing out.
    const startedAt = Date.now();
    try {
      const records: ToolCallRecord[] = [];
      // Conversation accumulators per provider shape.
      const geminiParts: { role: string; parts: { text?: string; functionResponse?: unknown }[] }[] = [
        { role: "user", parts: [{ text: input.userPrompt }] },
      ];
      const oaMessages: { role: string; content?: string; tool_calls?: unknown[]; name?: string }[] = [
        ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
        { role: "user", content: input.userPrompt },
      ];
      const antMessages: { role: string; content: unknown }[] = [
        { role: "user", content: [{ type: "text", text: input.userPrompt }] },
      ];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let roundResult: ProviderToolRoundResult;
        if (provider.provider_type === "gemini") {
          roundResult = await callGeminiToolRound(provider, input.systemPrompt, geminiParts, toolDeclarations, input.temperature);
        } else if (provider.provider_type === "anthropic") {
          roundResult = await callAnthropicToolRound(provider, input.systemPrompt, antMessages, toolDeclarations, input.temperature);
        } else {
          roundResult = await callOpenAICompatibleToolRound(provider, input.systemPrompt, oaMessages, toolDeclarations, input.temperature);
        }

        if (!roundResult.functionCalls || roundResult.functionCalls.length === 0) {
          const text = roundResult.text ?? "";
          recordHop({
            logContext: lc,
            traceId,
            provider,
            attempt,
            startedAt,
            ok: true,
            streaming: false,
            outputTokens: 0,
          });
          return { text, toolCalls: records };
        }

        // Replay the assistant/model turn that requested these tool calls before
        // the tool-result turn(s) — Gemini/OpenAI/Anthropic all 400 without it.
        if (provider.provider_type === "gemini") {
          geminiParts.push(roundResult.assistantTurn as (typeof geminiParts)[number]);
        } else if (provider.provider_type === "anthropic") {
          antMessages.push(roundResult.assistantTurn as (typeof antMessages)[number]);
        } else {
          oaMessages.push(roundResult.assistantTurn as (typeof oaMessages)[number]);
        }

        // Execute each tool call and feed results back.
        for (const fc of roundResult.functionCalls) {
          const record: ToolCallRecord = { name: fc.name, args: fc.args, status: "called" };
          onStep?.(record);
          try {
            const res = await executor(fc.name, fc.args, ctx);
            record.result = res;
            record.status = "done";
            if (res.citations.length) {
              // store citations on the record so the caller can build source chips
              (record as ToolCallRecord & { citations?: string[] }).citations = res.citations;
            }
          } catch (err) {
            record.status = "error";
            record.error = err instanceof Error ? err.message : String(err);
            record.result = { content: `Tool error: ${record.error}`, citations: [] };
          }
          records.push(record);
          onStep?.(record);

          // Feed result back into each provider's conversation shape.
          if (provider.provider_type === "gemini") {
            geminiParts.push({
              role: "tool",
              parts: [{ functionResponse: { name: fc.name, response: { result: record.result?.content ?? "" } } }],
            });
          } else if (provider.provider_type === "anthropic") {
            antMessages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: fc.id ?? fc.name,
                  content: record.result?.content ?? "",
                },
              ],
            });
          } else {
            oaMessages.push({
              role: "tool",
              name: fc.name,
              content: record.result?.content ?? "",
              // @ts-expect-error tool_call_id is valid for OpenAI tool messages
              tool_call_id: fc.id,
            });
          }
        }
      }

      // Exhausted rounds without a final text — return whatever we have.
      const text = records.length ? "I gathered workspace data but could not finalize a response." : "";
      return { text, toolCalls: records };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `${provider.name}: ${message}`;
      recordHop({
        logContext: lc,
        traceId,
        provider,
        attempt,
        startedAt,
        ok: false,
        streaming: false,
        error: message,
        err,
      });
    }
  }

  throw new Error(`All providers failed (tool loop): ${lastError}`);
}

/** Renders executed tool calls as prompt text. Shared by the intermediate
 *  rounds of the streaming tool loop and by its final follow-up prompt. Each
 *  result is capped: a whole-workspace dump inflates the prompt, and every
 *  extra input token is paid back as time-to-first-token. */
function renderToolContext(records: ToolCallRecord[]): string {
  return records
    .map((r) => {
      const body = r.result?.content ?? "";
      const clipped =
        body.length > MAX_TOOL_RESULT_CHARS
          ? `${body.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated, ${body.length - MAX_TOOL_RESULT_CHARS} more chars]`
          : body;
      return `### ${r.name}\n${clipped}`;
    })
    .join("\n\n");
}

/**
 * Runs up to MAX_TOOL_ROUNDS non-streaming tool rounds so the model can chain
 * a lookup into an action within one turn, then streams the final prose answer
 * so the user sees tokens as they are generated instead of waiting for the
 * whole response to be buffered.
 *
 * Returns the executed tool calls (already complete, so the caller can emit its
 * tool_calls frame first) plus the token stream for the answer.
 *
 * Intermediate results are folded into the next round's prompt as text rather
 * than replayed as vendor-native tool-result turns — the rounds declare no
 * paired assistant turn, so the strict pairing those APIs require does not
 * apply.
 *
 * ponytail: results are folded in as text, so a very long chain re-sends every
 * earlier result on each round. Fine at MAX_TOOL_ROUNDS=4 with per-result caps;
 * switch to vendor-native tool-result turns if the budget is ever raised much.
 */
export async function generateTextWithToolsStream(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  toolDeclarations: Record<string, unknown>[],
  executor: ToolExecutor,
  ctx: ToolExecutionContext,
  onStep?: (record: ToolCallRecord) => void,
  logContext?: AiLogContext
): Promise<{ toolCalls: ToolCallRecord[]; stream: ReadableStream<Uint8Array> }> {
  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task. Please add an API key in Settings > AI Providers.");
  }

  const log = logContext ?? { action: "ai_chatbot" };

  if (toolDeclarations.length === 0) {
    return { toolCalls: [], stream: await generateTextStream(chain, input, log) };
  }

  const provider = chain[0];
  const records: ToolCallRecord[] = [];

  // Fold tool output into the prompt instead of replaying each vendor's native
  // tool-result message shape — the follow-up call declares no tools, so the
  // strict assistant-turn/tool-result pairing those APIs require doesn't apply.
  const finalAnswer = (): Promise<ReadableStream<Uint8Array>> => {
    const hasApproval = records.some((r) => r.result?.approval);
    const followUp: GenerateTextInput = {
      ...input,
      userPrompt: [
        input.userPrompt,
        "",
        "--- TOOL RESULTS ---",
        renderToolContext(records),
        "--- END TOOL RESULTS ---",
        hasApproval
          ? "CRITICAL MANDATORY INSTRUCTION: A deletion or sensitive action is currently PENDING USER CONFIRMATION via the approval card. The row has NOT been deleted yet. You MUST clearly inform the user that you prepared the deletion request and ask them to confirm by clicking Allow in the confirmation box above (or Deny to cancel). NEVER claim or suggest that the data has already been deleted or that the deletion was successful."
          : "Answer the question using the tool results above. Do not mention the tools themselves.",
      ].join("\n"),
    };
    return generateTextStream(chain, followUp, log);
  };

  // Include the grounded system prompt (conversation history, schema, and IDs)
  // along with the selection prompt so the model can resolve pronoun/contextual references.
  const selectionPrompt = [
    input.systemPrompt,
    TOOL_SELECTION_PROMPT,
  ]
    .filter(Boolean)
    .join("\n\n");

  const runRound = (prompt: string): Promise<ProviderToolRoundResult> => {
    if (provider.provider_type === "gemini") {
      return callGeminiToolRound(
        provider,
        selectionPrompt,
        [{ role: "user", parts: [{ text: prompt }] }],
        toolDeclarations,
        input.temperature
      );
    }
    if (provider.provider_type === "anthropic") {
      return callAnthropicToolRound(
        provider,
        selectionPrompt,
        [{ role: "user", content: [{ type: "text", text: prompt }] }],
        toolDeclarations,
        input.temperature
      );
    }
    return callOpenAICompatibleToolRound(
      provider,
      selectionPrompt,
      [
        { role: "system", content: selectionPrompt },
        { role: "user", content: prompt },
      ],
      toolDeclarations,
      input.temperature
    );
  };

  // Bounded multi-round loop. The buffered generateTextWithTools has done this
  // since it was written; the streaming path was capped at one round because
  // replaying vendor-native tool-result turns is fiddly. It does not have to —
  // results are folded in as prompt text below, and the round declares no
  // assistant turn to pair with, so plain text round-trips fine.
  //
  // The budget is the blast radius: a model that keeps calling tools stops
  // after MAX_TOOL_ROUNDS and answers with what it has.
  for (let roundIndex = 0; roundIndex < MAX_TOOL_ROUNDS; roundIndex++) {
    const roundPrompt =
      records.length === 0
        ? input.userPrompt
        : [
            input.userPrompt,
            "",
            "--- TOOL RESULTS SO FAR ---",
            renderToolContext(records),
            "--- END TOOL RESULTS ---",
            "Call another tool only if the question still cannot be answered. Otherwise call nothing.",
          ].join("\n");

    // Bounded separately from a full generation: this round returns a few dozen
    // tokens, so if it has not landed quickly the provider is not going to serve
    // tools usefully this turn.
    const round = await withTimeout(runRound(roundPrompt), TOOL_ROUND_TIMEOUT_MS, `${provider.name} tool round`);

    if (!round.functionCalls || round.functionCalls.length === 0) {
      // No tool wanted. On the first round there is nothing to ground the
      // answer in, so stream from the full grounded prompt — whatever text the
      // selection round produced was written against the lean prompt that told
      // it not to answer, so it is not usable. On a later round the model is
      // signalling it has enough, so fall through to the follow-up below.
      if (records.length === 0) {
        return { toolCalls: [], stream: await generateTextStream(chain, input, log) };
      }
      break;
    }

    for (const fc of round.functionCalls) {
      const record: ToolCallRecord = { name: fc.name, args: fc.args, status: "called" };
      onStep?.(record);
      try {
        const res = await executor(fc.name, fc.args, ctx);
        record.result = res;
        record.status = "done";
        if (res.citations.length) {
          (record as ToolCallRecord & { citations?: string[] }).citations = res.citations;
        }
      } catch (err) {
        record.status = "error";
        record.error = err instanceof Error ? err.message : String(err);
        record.result = { content: `Tool error: ${record.error}`, citations: [] };
      }
      records.push(record);
      onStep?.(record);

      // A pending delete never gets a second round: the approval card is the
      // next step, not another tool call. Stop immediately so the model can't
      // re-propose or chain past it.
      if (record.result?.approval) {
        return { toolCalls: records, stream: await finalAnswer() };
      }
    }
  }

  return { toolCalls: records, stream: await finalAnswer() };
}

/**
 * Returns a Vercel AI SDK LanguageModelV1 instance for the resolved provider.
 */
export function resolveVercelAIModel(provider: ResolvedProvider): LanguageModel {
  if (provider.provider_type === "gemini") {
    const google = createGoogleGenerativeAI({ apiKey: provider.api_key });
    return google(provider.model);
  } else if (provider.provider_type === "anthropic") {
    const anthropic = createAnthropic({ apiKey: provider.api_key });
    return anthropic(provider.model);
  } else if (provider.provider_type === "openai_compatible") {
    const openai = createOpenAI({ 
      apiKey: provider.api_key,
      baseURL: provider.base_url || undefined,
    });
    return openai(provider.model);
  }
  throw new Error(`Unsupported Vercel AI provider type: ${provider.provider_type}`);
}

export type { HopCaller };

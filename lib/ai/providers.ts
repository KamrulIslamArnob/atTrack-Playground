import { GoogleGenAI, type Part } from "@google/genai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import type { ProviderType, TaskType } from "@/lib/types/ai-providers";

// ponytail: createAdminClient/decrypt/logAiUsage are imported lazily (dynamic
// import) rather than statically, purely so `node lib/ai/providers.selfcheck.ts`
// can load this module without resolving the "@/" tsconfig path alias — Node's
// type-stripping (unlike webpack/turbopack) does not do path mapping, and
// lib/db/* dodges the same issue by never using "@/" at all (see tsconfig.json's
// comment). The self-check never exercises resolveProviderChain or a userId-
// bearing logContext, so these imports are never actually triggered there.
// Next.js resolves a dynamic "@/..." import identically to a static one, so
// production behavior is unchanged.
/** Telemetry context threaded through every generation path. `traceId` ties
 *  each provider hop back to the chat turn that caused it — the chatbot
 *  pipeline mints one per request and passes it down. */
export interface AiLogContext {
  userId?: string;
  action: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

type LogUsageParams = {
  userId: string;
  action: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
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
    console.warn("AI usage logging failed (non-fatal):", err);
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
    const { data: anyProviders } = await admin
      .from("ai_providers")
      .select("id, name, provider_type, base_url, model, encrypted_api_key")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (anyProviders && anyProviders.length > 0) {
      const resolvedFallback: ResolvedProvider[] = [];
      for (const row of anyProviders as unknown as ProviderRow[]) {
        try {
          resolvedFallback.push({ ...row, api_key: decrypt(row.encrypted_api_key) });
        } catch {
          // skip corrupt key
        }
      }
      if (resolvedFallback.length > 0) {
        return resolvedFallback;
      }
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
  const prompt = [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n");

  const parts: Part[] = (input.images ?? []).map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data },
  }));
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: provider.model,
    contents: [{ role: "user", parts }],
    config: {
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  const res = await fetch(`${baseUrl}/chat/completions`, {
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

  const errors: string[] = [];
  for (const provider of chain) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(resolveCaller(provider.provider_type)(provider, input), HOP_TIMEOUT_MS, provider.name);
      if (logContext.userId) {
        logUsageDetached({
          userId: logContext.userId,
          action: logContext.action,
          model: `${provider.name}/${result.model}`,
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
          durationMs: Date.now() - startedAt,
          metadata: logContext.metadata,
        });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${message}`);
      if (logContext.userId) {
        logUsageDetached({
          userId: logContext.userId,
          action: logContext.action,
          model: `${provider.name}/${provider.model}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: message,
          metadata: logContext.metadata,
        });
      }
    }
  }

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
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
      choices?: { delta?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      json = JSON.parse(payload);
    } catch {
      continue; // keep-alive comment or vendor noise
    }

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      delta?: { type?: string; text?: string };
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
    if (json.type === "content_block_delta" && json.delta?.type === "text_delta" && json.delta.text) {
      yield { text: json.delta.text };
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

  return new ReadableStream({
    async start(controller) {
      const errors: string[] = [];

      for (const provider of chain) {
        const startedAt = Date.now();
        let enqueuedChunk = false;
        let usageCaptured = false;

        try {
          if (provider.provider_type === "gemini") {
            const ai = new GoogleGenAI({ apiKey: provider.api_key });
            const prompt = [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n");
            
            const parts: Part[] = (input.images ?? []).map((img) => ({
              inlineData: { mimeType: img.mimeType, data: img.data },
            }));
            parts.push({ text: prompt });

            const response = await ai.models.generateContentStream({
              model: provider.model,
              contents: [{ role: "user", parts }],
              config: {
                ...(input.temperature != null ? { temperature: input.temperature } : {}),
                ...(input.maxOutputTokens != null ? { maxOutputTokens: input.maxOutputTokens } : {}),
              },
            });

            const iterator = response[Symbol.asyncIterator]();
            let chunk = await withTimeout(iterator.next(), HOP_TIMEOUT_MS, `${provider.name} first token`);
            while (!chunk.done) {
              const text = chunk.value.text;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                );
                enqueuedChunk = true;
              }
              const usage = chunk.value.usageMetadata;
              if (usage && !usageCaptured && logContext.userId) {
                usageCaptured = true;
                logUsageDetached({
                  userId: logContext.userId,
                  action: logContext.action,
                  model: `${provider.name}/${provider.model}`,
                  inputTokens: usage.promptTokenCount ?? 0,
                  outputTokens: usage.candidatesTokenCount ?? 0,
                  durationMs: Date.now() - startedAt,
                  metadata: logContext.metadata,
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
              const { text, inputTokens, outputTokens } = step.value;
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
                );
                enqueuedChunk = true;
              }
              if ((inputTokens != null || outputTokens != null) && !usageCaptured && logContext.userId) {
                usageCaptured = true;
                logUsageDetached({
                  userId: logContext.userId,
                  action: logContext.action,
                  model: `${provider.name}/${provider.model}`,
                  inputTokens: inputTokens ?? 0,
                  outputTokens: outputTokens ?? 0,
                  durationMs: Date.now() - startedAt,
                  metadata: logContext.metadata,
                });
              }
              step = await iterator.next();
            }

            // Providers that never emit a usage frame still get one log line.
            if (enqueuedChunk && !usageCaptured && logContext.userId) {
              usageCaptured = true;
              logUsageDetached({
                userId: logContext.userId,
                action: logContext.action,
                model: `${provider.name}/${provider.model}`,
                durationMs: Date.now() - startedAt,
                metadata: logContext.metadata,
              });
            }
          }

          if (enqueuedChunk) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${provider.name}: ${message}`);
          if (logContext.userId) {
            logUsageDetached({
              userId: logContext.userId,
              action: logContext.action,
              model: `${provider.name}/${provider.model}`,
              durationMs: Date.now() - startedAt,
              status: "error",
              error: message,
              metadata: logContext.metadata,
            });
          }
          if (enqueuedChunk) {
            // Mid-stream failure
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
            controller.close();
            return;
          }
        }
      }

      // If all providers in chain failed before any token was enqueued
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ error: `All providers failed: ${errors.join("; ")}` })}\n\n`)
      );
      controller.close();
    },
  });
}

/** Scraping-task substitute for Gemini's built-in url_context tool: plain
 *  fetch + tag-stripping, used only when the resolved scraping hop isn't
 *  Gemini. Capped at 20k chars — plenty for a job posting, keeps the prompt
 *  bounded. */
export async function fetchUrlAsText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; atTrack/1.0)" },
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
  result?: { content: string; citations: string[] };
  status: "called" | "done" | "error";
  error?: string;
}

export interface ToolExecutionContext {
  userId: string;
  personaId?: string;
  /** Per-source config (Obsidian path, GitHub token). NEVER logged. */
  sourceConfig?: Record<string, Record<string, unknown>>;
}

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
) => Promise<{ content: string; citations: string[] }>;

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

async function callOpenAICompatibleToolRound(
  provider: ResolvedProvider,
  systemPrompt: string | undefined,
  messages: { role: string; content?: string; tool_calls?: unknown[]; name?: string }[],
  toolDeclarations: Record<string, unknown>[],
  temperature?: number
): Promise<ProviderToolRoundResult> {
  const baseUrl = (provider.base_url || "").replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
  return { text: typeof msg?.content === "string" ? msg.content : undefined };
}

async function callAnthropicToolRound(
  provider: ResolvedProvider,
  systemPrompt: string | undefined,
  messages: { role: string; content: unknown }[],
  toolDeclarations: Record<string, unknown>[],
  temperature?: number
): Promise<ProviderToolRoundResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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

  const startedAt = Date.now();
  let lastError = "";

  for (const provider of chain) {
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
          if (logContext?.userId) {
            logUsageDetached({
              userId: logContext.userId,
              action: logContext.action,
              model: `${provider.name}/${provider.model}`,
              outputTokens: 0,
              durationMs: Date.now() - startedAt,
              metadata: logContext.metadata,
            });
          }
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
      if (logContext?.userId) {
        logUsageDetached({
          userId: logContext.userId,
          action: logContext.action,
          model: `${provider.name}/${provider.model}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: message,
          metadata: logContext.metadata,
        });
      }
    }
  }

  throw new Error(`All providers failed (tool loop): ${lastError}`);
}

/**
 * Streaming variant of the tool loop. Runs ONE non-streaming tool round to let
 * the model pick its tools, executes them, then streams the final prose answer
 * so the user sees tokens as they are generated instead of waiting for the
 * whole response to be buffered.
 *
 * Returns the executed tool calls (already complete, so the caller can emit its
 * tool_calls frame first) plus the token stream for the answer.
 *
 * ponytail: exactly one tool round, because streaming a round means parsing
 * partial tool-call deltas out of three different vendor stream formats. Every
 * tool in the registry is a single-shot lookup, so nothing chains today. If a
 * tool ever needs another tool's output, either add streamed tool-call parsing
 * or route that agent through the buffered generateTextWithTools.
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

  // The selection round only has to name tools and arguments — it never writes
  // prose. Sending the full grounded system prompt (retrieved docs, workspace
  // context, history) makes that trivial call as expensive as the answer
  // itself, and input size is what dominates time-to-first-token. The heavy
  // prompt goes to the follow-up call, which is the one that actually writes.
  const selectionPrompt = TOOL_SELECTION_PROMPT;

  const runRound = (): Promise<ProviderToolRoundResult> => {
    if (provider.provider_type === "gemini") {
      return callGeminiToolRound(
        provider,
        selectionPrompt,
        [{ role: "user", parts: [{ text: input.userPrompt }] }],
        toolDeclarations,
        input.temperature
      );
    }
    if (provider.provider_type === "anthropic") {
      return callAnthropicToolRound(
        provider,
        selectionPrompt,
        [{ role: "user", content: [{ type: "text", text: input.userPrompt }] }],
        toolDeclarations,
        input.temperature
      );
    }
    return callOpenAICompatibleToolRound(
      provider,
      selectionPrompt,
      [
        { role: "system", content: selectionPrompt },
        { role: "user", content: input.userPrompt },
      ],
      toolDeclarations,
      input.temperature
    );
  };

  // Bounded separately from a full generation: this round returns a few dozen
  // tokens, so if it has not landed quickly the provider is not going to serve
  // tools usefully this turn. Failing fast here hands the remaining budget to
  // the ungrounded fallback instead of burning it twice.
  const round = await withTimeout(runRound(), TOOL_ROUND_TIMEOUT_MS, `${provider.name} tool round`);

  // No tool wanted. Whatever text the selection round produced was written
  // against the lean prompt that told it not to answer, so it is not usable —
  // stream the real answer from the full grounded prompt instead.
  if (!round.functionCalls || round.functionCalls.length === 0) {
    return { toolCalls: [], stream: await generateTextStream(chain, input, log) };
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
  }

  // Fold tool output into the prompt instead of replaying each vendor's native
  // tool-result message shape — the follow-up call declares no tools, so the
  // strict assistant-turn/tool-result pairing those APIs require doesn't apply.
  // Each result is capped: a whole-workspace dump inflates the prompt and every
  // extra input token is paid back as time-to-first-token.
  const toolContext = records
    .map((r) => {
      const body = r.result?.content ?? "";
      const clipped =
        body.length > MAX_TOOL_RESULT_CHARS
          ? `${body.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated, ${body.length - MAX_TOOL_RESULT_CHARS} more chars]`
          : body;
      return `### ${r.name}\n${clipped}`;
    })
    .join("\n\n");

  const followUp: GenerateTextInput = {
    ...input,
    userPrompt: [
      input.userPrompt,
      "",
      "--- TOOL RESULTS ---",
      toolContext,
      "--- END TOOL RESULTS ---",
      "Answer the question using the tool results above. Do not mention the tools themselves.",
    ].join("\n"),
  };

  return { toolCalls: records, stream: await generateTextStream(chain, followUp, log) };
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

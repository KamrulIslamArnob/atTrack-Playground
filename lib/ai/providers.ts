import { GoogleGenAI, type Part } from "@google/genai";
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
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: route } = await admin
    .from("ai_task_routes")
    .select("provider_ids")
    .eq("user_id", userId)
    .eq("task_type", taskType)
    .maybeSingle();

  const providerIds = (route as unknown as { provider_ids: string[] } | null)?.provider_ids ?? [];
  if (providerIds.length === 0) {
    const fallback = defaultGeminiProvider();
    return fallback ? [fallback] : [];
  }

  const { data: providers } = await admin
    .from("ai_providers")
    .select("id, name, provider_type, base_url, model, encrypted_api_key")
    .eq("user_id", userId)
    .in("id", providerIds);

  const byId = new Map(((providers ?? []) as unknown as ProviderRow[]).map((p) => [p.id, p]));

  const { decrypt } = await import("@/lib/encryption");
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
      max_tokens: 8192,
      ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
      messages: [{ role: "user", content }],
    }),
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

  const res = await fetch(`${provider.base_url}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({ model: provider.model, messages }),
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
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> },
  resolveCaller: (providerType: ProviderType) => HopCaller
): Promise<GenerateTextResult> {
  if (chain.length === 0) {
    throw new Error("No AI provider configured for this task and no GEMINI_API_KEY fallback available.");
  }

  const errors: string[] = [];
  for (const provider of chain) {
    const startedAt = Date.now();
    try {
      const result = await resolveCaller(provider.provider_type)(provider, input);
      if (logContext.userId) {
        await logUsage({
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
        await logUsage({
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
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> }
): Promise<GenerateTextResult> {
  return runChain(chain, input, logContext, callerFor);
}

/** SSE stream for the two streaming routes. Only chain[0] is used — see the
 *  "no mid-stream fallback" global constraint. Gemini streams token-by-token
 *  via generateContentStream; Anthropic/OpenAI-compatible providers are
 *  called non-streaming and flushed as a single SSE chunk.
 *  ponytail: real incremental streaming for those two needs vendor-specific
 *  SSE parsing per type — add it if latency-to-first-token matters. */
export async function generateTextStream(
  chain: ResolvedProvider[],
  input: GenerateTextInput,
  logContext: { userId?: string; action: string; metadata?: Record<string, unknown> }
): Promise<ReadableStream<Uint8Array>> {
  const provider = chain[0];
  if (!provider) {
    throw new Error("No AI provider configured for this task and no GEMINI_API_KEY fallback available.");
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  if (provider.provider_type === "gemini") {
    const ai = new GoogleGenAI({ apiKey: provider.api_key });
    const prompt = [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n");
    const response = await ai.models.generateContentStream({ model: provider.model, contents: prompt });

    let usageCaptured = false;
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
              );
            }
            const usage = chunk.usageMetadata;
            if (usage && !usageCaptured && logContext.userId) {
              usageCaptured = true;
              await logUsage({
                userId: logContext.userId,
                action: logContext.action,
                model: `${provider.name}/${provider.model}`,
                inputTokens: usage.promptTokenCount ?? 0,
                outputTokens: usage.candidatesTokenCount ?? 0,
                durationMs: Date.now() - startedAt,
                metadata: logContext.metadata,
              });
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } finally {
          controller.close();
          if (!usageCaptured && logContext.userId) {
            await logUsage({
              userId: logContext.userId,
              action: logContext.action,
              model: `${provider.name}/${provider.model}`,
              durationMs: Date.now() - startedAt,
              metadata: logContext.metadata,
            });
          }
        }
      },
    });
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const result = await callerFor(provider.provider_type)(provider, input);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: result.text } }] })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        if (logContext.userId) {
          await logUsage({
            userId: logContext.userId,
            action: logContext.action,
            model: `${provider.name}/${result.model}`,
            inputTokens: result.inputTokens ?? 0,
            outputTokens: result.outputTokens ?? 0,
            durationMs: Date.now() - startedAt,
            metadata: logContext.metadata,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        if (logContext.userId) {
          await logUsage({
            userId: logContext.userId,
            action: logContext.action,
            model: `${provider.name}/${provider.model}`,
            durationMs: Date.now() - startedAt,
            status: "error",
            error: message,
            metadata: logContext.metadata,
          });
        }
      } finally {
        controller.close();
      }
    },
  });
}

/** Scraping-task substitute for Gemini's built-in url_context tool: plain
 *  fetch + tag-stripping, used only when the resolved scraping hop isn't
 *  Gemini. Capped at 20k chars — plenty for a job posting, keeps the prompt
 *  bounded. */
export async function fetchUrlAsText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; AtTrack/1.0)" },
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

export type { HopCaller };

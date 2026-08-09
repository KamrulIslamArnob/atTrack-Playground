import { extractionSchema, type ExtractionResult } from "./schema";
import { EXTRACTION_PROMPT } from "./prompts";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { GoogleGenAI } from "@google/genai";
import { resolveProviderChain, generateText, fetchUrlAsText, type ResolvedProvider } from "./providers";

type ImagePart = { type: "image"; mime_type: string; data: string };
type TextPart = { type: "text"; text: string };

function parseExtraction(responseText: string): ExtractionResult {
  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error("Failed to extract JSON from model response");

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success) throw new Error(`Invalid extraction result: ${validated.error.message}`);
  return validated.data;
}

/** Gemini hop: native interactions API + url_context tool — this is the
 *  exact behavior extractJob had before providers existed. Every other
 *  provider type can't fetch a URL itself, so extractJob pre-fetches it once
 *  (see fetchUrlAsText below) and folds the text into the prompt instead. */
async function extractViaGemini(
  provider: ResolvedProvider,
  imagesBase64: string[],
  promptText: string,
  hasUrl: boolean
): Promise<{
  result: ExtractionResult;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}> {
  const ai = new GoogleGenAI({ apiKey: provider.api_key });
  const input: Array<ImagePart | TextPart> = [
    ...imagesBase64.map((data): ImagePart => ({ type: "image", mime_type: "image/png", data })),
    { type: "text", text: promptText },
  ];

  const interaction = await ai.interactions.create({
    model: provider.model,
    input,
    tools: hasUrl ? [{ type: "url_context" }] : undefined,
    generation_config: { max_output_tokens: 8192, thinking_level: "low" },
  });

  const responseText =
    interaction.output_text ||
    interaction.steps
      ?.flatMap((step) => ("content" in step ? step.content ?? [] : []))
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");

  if (!responseText) throw new Error("No text content in response");

  const usage = interaction.usage;
  return {
    result: parseExtraction(responseText),
    inputTokens: usage?.total_input_tokens ?? 0,
    outputTokens: usage?.total_output_tokens ?? 0,
    cachedTokens: usage?.total_cached_tokens,
    reasoningTokens: usage?.total_thought_tokens,
  };
}

/**
 * One job posting, extracted from any mix of screenshots, pasted text, and a
 * source URL (career page, LinkedIn post, Facebook post, ...) — at least one
 * of the three must be provided. All sources go into the same call so the
 * model merges them itself instead of us running separate extractions and
 * reconciling the results in code.
 *
 * Resolves the user's "scraping" provider chain and tries each hop in order.
 * A Gemini hop uses its native url_context tool to fetch the URL; any other
 * hop gets the URL's text content pre-fetched and folded into the prompt.
 */
export async function extractJob(
  imagesBase64: string[],
  text: string,
  url: string,
  userId?: string
): Promise<ExtractionResult> {
  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  if (imagesBase64.length === 0 && !trimmedText && !trimmedUrl) {
    throw new Error("Provide a screenshot, pasted text, a link, or a combination");
  }

  const startedAt = Date.now();
  const metadata = { screenshots: imagesBase64.length, hasText: !!trimmedText, hasUrl: !!trimmedUrl };

  const chain = userId ? await resolveProviderChain(userId, "scraping") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for scraping and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "extract_job", durationMs: Date.now() - startedAt, status: "error", error: message, metadata });
    }
    throw new Error(message);
  }

  let prefetchedUrlText = "";
  if (trimmedUrl && chain.some((p) => p.provider_type !== "gemini")) {
    try {
      prefetchedUrlText = await fetchUrlAsText(trimmedUrl);
    } catch {
      prefetchedUrlText = ""; // best-effort: fall through with whatever other sources were given
    }
  }

  const buildPrompt = (includeUrlFetchTool: boolean, includePrefetchedText: boolean) =>
    EXTRACTION_PROMPT +
    (imagesBase64.length > 1
      ? "\n\nNote: multiple screenshots of the same job posting are provided — analyze them together."
      : "") +
    (trimmedUrl && includeUrlFetchTool
      ? `\n\nJob posting URL: ${trimmedUrl}\nFetch this page with the url_context tool and use it as a source.`
      : "") +
    (trimmedText ? "\n\nPasted job posting text:\n" + trimmedText : "") +
    (includePrefetchedText && prefetchedUrlText ? "\n\nFetched job posting page content:\n" + prefetchedUrlText : "") +
    (trimmedUrl && trimmedText
      ? "\n\nNote: the pasted text and the URL may describe the same posting with different levels of detail (e.g. a shorter social-media blurb vs. the fuller career-page listing) — merge them into one complete result rather than preferring one over the other."
      : "");

  const errors: string[] = [];
  for (const provider of chain) {
    try {
      if (provider.provider_type === "gemini") {
        const promptText = buildPrompt(true, false);
        const { result, inputTokens, outputTokens, cachedTokens, reasoningTokens } = await extractViaGemini(
          provider,
          imagesBase64,
          promptText,
          !!trimmedUrl
        );
        if (userId) {
          await logAiUsage({
            userId,
            action: "extract_job",
            model: `${provider.name}/${provider.model}`,
            inputTokens,
            outputTokens,
            cachedTokens,
            reasoningTokens,
            durationMs: Date.now() - startedAt,
            metadata,
          });
        }
        return result;
      }

      const promptText = buildPrompt(false, true);
      const images = imagesBase64.map((data) => ({ mimeType: "image/png", data }));
      const generated = await generateText([provider], { userPrompt: promptText, images }, {
        userId,
        action: "extract_job",
        metadata,
      });
      return parseExtraction(generated.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${message}`);
      // Non-gemini hop failures are already logged inside generateText/runChain;
      // this covers the gemini branch, which bypasses that shared path.
      if (userId && provider.provider_type === "gemini") {
        await logAiUsage({
          userId,
          action: "extract_job",
          model: `${provider.name}/${provider.model}`,
          durationMs: Date.now() - startedAt,
          status: "error",
          error: message,
          metadata,
        });
      }
    }
  }

  const message = `All providers failed: ${errors.join("; ")}`;
  if (userId) {
    await logAiUsage({ userId, action: "extract_job", durationMs: Date.now() - startedAt, status: "error", error: message, metadata });
  }
  throw new Error(message);
}

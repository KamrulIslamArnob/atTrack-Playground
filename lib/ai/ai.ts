import { OpenRouter } from "@openrouter/sdk";
import { extractionSchema, type ExtractionResult } from "./schema";
import { EXTRACTION_PROMPT } from "./prompts";
import { logAiUsage } from "@/lib/actions/ai-usage";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function extractJobFromScreenshots(
  imagesBase64: string[],
  userId?: string
): Promise<ExtractionResult> {
  if (imagesBase64.length === 0) {
    throw new Error("No images provided");
  }

  const startedAt = Date.now();

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; imageUrl: { url: string } }
  > = [
    {
      type: "text",
      text: EXTRACTION_PROMPT + "\n\nNote: Multiple screenshots of the same job posting are provided. Analyze all images together to extract complete job information.",
    },
  ];

  for (const base64 of imagesBase64) {
    content.push({
      type: "image_url",
      imageUrl: {
        url: `data:image/png;base64,${base64}`,
      },
    });
  }

  const response = await openrouter.chat.send({
    chatRequest: {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      messages: [
        {
          role: "user",
          content,
        },
      ],
    },
  });

  if (!response || !("choices" in response) || !response.choices?.length) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_screenshots",
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No response from model",
        metadata: { screenshots: imagesBase64.length },
      });
    }
    throw new Error("No response from model");
  }

  const message = response.choices[0].message;
  const text = typeof message.content === "string" ? message.content : null;

  if (!text) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_screenshots",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No text content in response",
        metadata: { screenshots: imagesBase64.length },
      });
    }
    throw new Error("No text content in response");
  }

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_screenshots",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Failed to extract JSON from model response",
        metadata: { screenshots: imagesBase64.length },
      });
    }
    throw new Error("Failed to extract JSON from model response");
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const validated = extractionSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_screenshots",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid extraction result: ${validated.error.message}`,
        metadata: { screenshots: imagesBase64.length },
      });
    }
    throw new Error(`Invalid extraction result: ${validated.error.message}`);
  }

  if (userId) {
    const usage = "usage" in response ? (response as { usage?: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; reasoningTokens?: number; cost?: number | null } }).usage : undefined;
    await logAiUsage({
      userId,
      action: "extract_screenshots",
      model: response.model,
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      cachedTokens: usage?.cachedTokens,
      reasoningTokens: usage?.reasoningTokens,
      costUsd: usage?.cost ?? undefined,
      durationMs: Date.now() - startedAt,
      metadata: { screenshots: imagesBase64.length },
    });
  }

  return validated.data;
}

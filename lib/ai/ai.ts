import { OpenRouter } from "@openrouter/sdk";
import { extractionSchema, type ExtractionResult } from "./schema";
import { EXTRACTION_PROMPT } from "./prompts";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function extractJobFromScreenshots(
  imagesBase64: string[]
): Promise<ExtractionResult> {
  if (imagesBase64.length === 0) {
    throw new Error("No images provided");
  }

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
    throw new Error("No response from model");
  }

  const message = response.choices[0].message;
  const text = typeof message.content === "string" ? message.content : null;

  if (!text) {
    throw new Error("No text content in response");
  }

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from model response");
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const validated = extractionSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Invalid extraction result: ${validated.error.message}`);
  }

  return validated.data;
}

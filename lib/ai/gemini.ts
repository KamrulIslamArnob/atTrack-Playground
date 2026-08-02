import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractionSchema, type ExtractionResult } from "./schema";
import { EXTRACTION_PROMPT } from "./prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function extractJobFromScreenshot(
  imageBase64: string
): Promise<ExtractionResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
  });

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    {
      inlineData: {
        mimeType: "image/png",
        data: imageBase64,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from Gemini response");
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const validated = extractionSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Invalid extraction result: ${validated.error.message}`);
  }

  return validated.data;
}

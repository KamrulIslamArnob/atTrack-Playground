import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const resumeMatchDataSchema = z.object({
  skills: z.array(z.string()),
  experience: z.array(z.string()),
  education: z.array(z.string()),
  summary: z.string(),
});

export type ResumeMatchData = z.infer<typeof resumeMatchDataSchema>;

export const matchScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type MatchScore = z.infer<typeof matchScoreSchema>;

function parseJsonResponse(text: string): unknown {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from model response");
  }
  return JSON.parse(jsonMatch[1] || jsonMatch[0]);
}

export async function extractResumeContent(
  pdfText: string
): Promise<ResumeMatchData> {
  const response = await openrouter.chat.send({
    chatRequest: {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      messages: [
        {
          role: "user",
          content: `Extract structured information from this resume text. Return JSON with:
- skills: array of technical and soft skills mentioned
- experience: array of work experience entries (job title + company + brief description)
- education: array of education entries (degree + institution)
- summary: 2-3 sentence professional summary

Resume text:
${pdfText.slice(0, 8000)}`,
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

  const parsed = parseJsonResponse(text);
  const validated = resumeMatchDataSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Invalid resume extraction: ${validated.error.message}`);
  }

  return validated.data;
}

export async function calculateMatchScore(
  jobTitle: string,
  jobDescription: string | null,
  resumeMatchData: ResumeMatchData
): Promise<MatchScore> {
  const jobContext = [
    jobTitle,
    jobDescription,
  ]
    .filter(Boolean)
    .join("\n");

  const resumeContext = [
    `Skills: ${resumeMatchData.skills.join(", ")}`,
    `Experience: ${resumeMatchData.experience.join("; ")}`,
    `Education: ${resumeMatchData.education.join("; ")}`,
    `Summary: ${resumeMatchData.summary}`,
  ].join("\n");

  const response = await openrouter.chat.send({
    chatRequest: {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      messages: [
        {
          role: "user",
          content: `You are a job-match analyst. Compare this job posting against this candidate's resume and give a match score from 0-100.

Consider:
- Skills alignment (most important)
- Experience relevance
- Education match
- Overall fit

Job:
${jobContext}

Candidate Resume:
${resumeContext}

Return JSON: { "score": <number 0-100>, "reasoning": "<1-2 sentence explanation>" }`,
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

  const parsed = parseJsonResponse(text);
  const validated = matchScoreSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`Invalid match score: ${validated.error.message}`);
  }

  return validated.data;
}

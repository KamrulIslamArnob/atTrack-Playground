import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";
import { logAiUsage } from "@/lib/actions/ai-usage";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const resumeMatchDataSchema = z.object({
  skills: z.array(z.string()),
  experience: z.array(
    z.union([
      z.string(),
      z.object({
        company: z.string().optional(),
        role: z.string().optional(),
        title: z.string().optional(),
        duration: z.string().optional(),
        description: z.string().optional(),
      }).passthrough(),
    ])
  ).transform((items) =>
    items.map((item) =>
      typeof item === "string"
        ? item
        : [item.role || item.title, item.company, item.duration]
            .filter(Boolean)
            .join(" at ") || item.description || JSON.stringify(item)
    )
  ),
  education: z.array(
    z.union([
      z.string(),
      z.object({
        school: z.string().optional(),
        institution: z.string().optional(),
        degree: z.string().optional(),
        field: z.string().optional(),
        duration: z.string().optional(),
      }).passthrough(),
    ])
  ).transform((items) =>
    items.map((item) =>
      typeof item === "string"
        ? item
        : [item.degree, item.field, item.school || item.institution, item.duration]
            .filter(Boolean)
            .join(" — ") || JSON.stringify(item)
    )
  ),
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
  pdfText: string,
  userId?: string
): Promise<ResumeMatchData> {
  const startedAt = Date.now();
  const response = await openrouter.chat.send({
    chatRequest: {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      messages: [
        {
          role: "user",
          content: `Extract structured information from this resume text. Return JSON with:
- skills: array of strings (technical and soft skills mentioned)
- experience: array of strings describing each role (e.g. "Software Engineer at Google, 2020-2023")
- education: array of strings describing each entry (e.g. "BS Computer Science — MIT, 2016-2020")
- summary: 2-3 sentence professional summary

IMPORTANT: All array items must be plain strings, not objects.

Resume text:
${pdfText.slice(0, 8000)}`,
        },
      ],
    },
  });

  if (!response || !("choices" in response) || !response.choices?.length) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_resume",
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No response from model",
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
        action: "extract_resume",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No text content in response",
      });
    }
    throw new Error("No text content in response");
  }

  const parsed = parseJsonResponse(text);
  const validated = resumeMatchDataSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_resume",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid resume extraction: ${validated.error.message}`,
      });
    }
    console.error("[ResumeExtract] Validation error:", validated.error.flatten());
    throw new Error(`Invalid resume extraction: ${validated.error.message}`);
  }

  if (userId) {
    const usage = "usage" in response ? (response as { usage?: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; reasoningTokens?: number; cost?: number | null } }).usage : undefined;
    await logAiUsage({
      userId,
      action: "extract_resume",
      model: response.model,
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      cachedTokens: usage?.cachedTokens,
      reasoningTokens: usage?.reasoningTokens,
      costUsd: usage?.cost ?? undefined,
      durationMs: Date.now() - startedAt,
    });
  }

  return validated.data;
}

export async function calculateMatchScore(
  jobTitle: string,
  jobDescription: string | null,
  resumeMatchData: ResumeMatchData,
  userId?: string
): Promise<MatchScore> {
  const startedAt = Date.now();
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
    if (userId) {
      await logAiUsage({
        userId,
        action: "match_score",
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No response from model",
        metadata: { job_title: jobTitle },
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
        action: "match_score",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No text content in response",
        metadata: { job_title: jobTitle },
      });
    }
    throw new Error("No text content in response");
  }

  const parsed = parseJsonResponse(text);
  const validated = matchScoreSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "match_score",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid match score: ${validated.error.message}`,
        metadata: { job_title: jobTitle },
      });
    }
    throw new Error(`Invalid match score: ${validated.error.message}`);
  }

  if (userId) {
    const usage = "usage" in response ? (response as { usage?: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; reasoningTokens?: number; cost?: number | null } }).usage : undefined;
    await logAiUsage({
      userId,
      action: "match_score",
      model: response.model,
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      cachedTokens: usage?.cachedTokens,
      reasoningTokens: usage?.reasoningTokens,
      costUsd: usage?.cost ?? undefined,
      durationMs: Date.now() - startedAt,
      metadata: { job_title: jobTitle },
    });
  }

  return validated.data;
}

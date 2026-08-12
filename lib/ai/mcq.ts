import type { MCQQuestion } from "@/lib/types/mcq";
import { z } from "zod";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { resolveProviderChain, generateText } from "./providers";

const mcqQuestionSchema = z.object({
  question: z.string().min(5).max(500),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().min(1).max(1000),
});

const mcqArraySchema = z.array(mcqQuestionSchema).min(1).max(20);

const MCQ_PROMPT = `You are an interview preparation assistant. Generate multiple-choice questions (MCQs) to help a candidate prepare for a job interview.

Rules:
- Generate exactly 12 questions
- Each question must have exactly 4 options (A, B, C, D)
- Questions should cover: technical skills, problem-solving, behavioral scenarios, and role-specific knowledge
- Mark the correct answer index (0-3)
- Provide a brief explanation for each answer
- Questions should be relevant to the job title and description
- Mix difficulty levels: easy (3-4), medium (4-5), hard (3-4)

Return a JSON array of objects with these fields:
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "string"
  }
]

Return ONLY the JSON array, no other text.`;

export async function generateMCQQuestions(params: {
  jobTitle: string;
  description: string | null;
  employmentType: string | null;
  notes: Array<{ title: string; bullets: string[] }> | null;
  userId?: string;
}): Promise<MCQQuestion[]> {
  const startedAt = Date.now();
  const context = [
    `Job Title: ${params.jobTitle}`,
    params.employmentType ? `Employment Type: ${params.employmentType}` : null,
    params.description ? `Job Description:\n${params.description}` : null,
    params.notes
      ? `Skills & Requirements:\n${params.notes.map((n) => `${n.title}: ${n.bullets.join(", ")}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `${MCQ_PROMPT}\n\n---\n\nJob Context:\n${context}`;

  const chain = params.userId ? await resolveProviderChain(params.userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: message,
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, {
    userId: params.userId,
    action: "generate_mcq",
    metadata: { job_title: params.jobTitle },
  });

  const jsonMatch = generated.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Failed to extract JSON from model response",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("Failed to extract JSON from model response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = mcqArraySchema.safeParse(parsed);

  if (!validated.success) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid MCQ format: ${validated.error.message}`,
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error(`Invalid MCQ format: ${validated.error.message}`);
  }

  return validated.data.map((q, i) => ({
    id: `q-${i}`,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));
}

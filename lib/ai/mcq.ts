import { OpenRouter } from "@openrouter/sdk";
import type { MCQQuestion } from "@/lib/types/mcq";
import { logAiUsage } from "@/lib/actions/ai-usage";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

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

  const response = await openrouter.chat.send({
    chatRequest: {
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      messages: [
        {
          role: "user",
          content: `${MCQ_PROMPT}\n\n---\n\nJob Context:\n${context}`,
        },
      ],
    },
  });

  if (!response || !("choices" in response) || !response.choices?.length) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No response from model",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("No response from model");
  }

  const message = response.choices[0].message;
  const text = typeof message.content === "string" ? message.content : null;

  if (!text) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "No text content in response",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("No text content in response");
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Failed to extract JSON from model response",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("Failed to extract JSON from model response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    if (params.userId) {
      await logAiUsage({
        userId: params.userId,
        action: "generate_mcq",
        model: response.model,
        durationMs: Date.now() - startedAt,
        status: "error",
        error: "Invalid response format",
        metadata: { job_title: params.jobTitle },
      });
    }
    throw new Error("Invalid response format");
  }

  if (params.userId) {
    const usage = "usage" in response ? (response as { usage?: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; reasoningTokens?: number; cost?: number | null } }).usage : undefined;
    await logAiUsage({
      userId: params.userId,
      action: "generate_mcq",
      model: response.model,
      inputTokens: usage?.promptTokens ?? 0,
      outputTokens: usage?.completionTokens ?? 0,
      cachedTokens: usage?.cachedTokens,
      reasoningTokens: usage?.reasoningTokens,
      costUsd: usage?.cost ?? undefined,
      durationMs: Date.now() - startedAt,
      metadata: { job_title: params.jobTitle },
    });
  }

  return parsed.map((q: MCQQuestion, i: number) => ({
    id: `q-${i}`,
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }));
}

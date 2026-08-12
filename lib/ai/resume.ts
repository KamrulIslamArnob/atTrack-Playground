import { z } from "zod";
import { logAiUsage } from "@/lib/actions/ai-usage";
import { resolveProviderChain, generateText } from "./providers";

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

export async function extractResumeContent(pdfText: string, userId?: string): Promise<ResumeMatchData> {
  const startedAt = Date.now();
  const prompt = `Extract structured information from this resume text. Return JSON with:
- skills: array of strings (technical and soft skills mentioned)
- experience: array of strings describing each role (e.g. "Software Engineer at Google, 2020-2023")
- education: array of strings describing each entry (e.g. "BS Computer Science — MIT, 2016-2020")
- summary: 2-3 sentence professional summary

IMPORTANT: All array items must be plain strings, not objects.

Resume text:
${pdfText.slice(0, 8000)}`;

  const chain = userId ? await resolveProviderChain(userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "extract_resume", durationMs: Date.now() - startedAt, status: "error", error: message });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, { userId, action: "extract_resume" });

  const parsed = parseJsonResponse(generated.text);
  const validated = resumeMatchDataSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "extract_resume",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid resume extraction: ${validated.error.message}`,
      });
    }
    console.error("[ResumeExtract] Validation error:", validated.error.flatten());
    throw new Error(`Invalid resume extraction: ${validated.error.message}`);
  }

  return validated.data;
}

export interface TotalJobInfo {
  companyName?: string | null;
  positionName?: string | null;
  location?: string | null;
  workLocation?: string | null;
  employmentType?: string | null;
  salaryRange?: string | null;
  notes?: Array<{ title: string; bullets: string[] }> | null;
}

export async function calculateMatchScore(
  jobTitle: string,
  jobDescription: string | null,
  resumeMatchData: ResumeMatchData,
  userId?: string,
  totalJobInfo?: TotalJobInfo
): Promise<MatchScore> {
  const startedAt = Date.now();

  const notesContext =
    totalJobInfo?.notes && totalJobInfo.notes.length > 0
      ? totalJobInfo.notes.map((n) => `${n.title}: ${n.bullets.join(", ")}`).join("\n")
      : null;

  const jobContextDetails = [
    `Job Title: ${jobTitle}`,
    totalJobInfo?.companyName ? `Company: ${totalJobInfo.companyName}` : null,
    totalJobInfo?.positionName ? `Position/Role: ${totalJobInfo.positionName}` : null,
    totalJobInfo?.location ? `Location: ${totalJobInfo.location}` : null,
    totalJobInfo?.workLocation ? `Work Setup: ${totalJobInfo.workLocation}` : null,
    totalJobInfo?.employmentType ? `Employment Type: ${totalJobInfo.employmentType}` : null,
    totalJobInfo?.salaryRange ? `Salary Range: ${totalJobInfo.salaryRange}` : null,
    jobDescription ? `Job Description:\n${jobDescription}` : null,
    notesContext ? `Additional Job Details & Keywords:\n${notesContext}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const resumeContext = [
    `Skills: ${resumeMatchData.skills.join(", ")}`,
    `Experience: ${resumeMatchData.experience.join("; ")}`,
    `Education: ${resumeMatchData.education.join("; ")}`,
    `Summary: ${resumeMatchData.summary}`,
  ].join("\n");

  const prompt = `You are an expert ATS and job-match analyst. Compare this job posting and its total job information against this candidate's resume and calculate an accurate fit match score from 0-100.

Consider:
- Core Skills & Technical Alignment (highest weight)
- Experience & Role Relevance
- Education & Domain Match
- Work Setup, Location & Salary fit (if specified)

Job Context & Requirements:
${jobContextDetails}

Candidate Resume:
${resumeContext}

Return ONLY valid JSON: { "score": <number 0-100>, "reasoning": "<1-2 sentence explanation of match strength and key gaps or fits>" }`;

  const chain = userId ? await resolveProviderChain(userId, "text") : [];
  if (chain.length === 0) {
    const message = "No AI provider configured for text and no GEMINI_API_KEY fallback available.";
    if (userId) {
      await logAiUsage({ userId, action: "match_score", durationMs: Date.now() - startedAt, status: "error", error: message, metadata: { job_title: jobTitle } });
    }
    throw new Error(message);
  }

  const generated = await generateText(chain, { userPrompt: prompt }, { userId, action: "match_score", metadata: { job_title: jobTitle } });

  const parsed = parseJsonResponse(generated.text);
  const validated = matchScoreSchema.safeParse(parsed);

  if (!validated.success) {
    if (userId) {
      await logAiUsage({
        userId,
        action: "match_score",
        durationMs: Date.now() - startedAt,
        status: "error",
        error: `Invalid match score: ${validated.error.message}`,
        metadata: { job_title: jobTitle },
      });
    }
    throw new Error(`Invalid match score: ${validated.error.message}`);
  }

  return validated.data;
}

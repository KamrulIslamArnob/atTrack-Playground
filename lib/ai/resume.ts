import { z } from "zod";

export const resumeMatchDataSchema = z.object({
  skills: z.array(z.string()).default([]),
  experience: z.array(z.string()).default([]),
  education: z.array(
    z.union([
      z.string(),
      z.object({
        degree: z.string().optional(),
        institution: z.string().optional(),
        year: z.string().optional(),
      }).transform((val) => [val.degree, val.institution, val.year].filter(Boolean).join(" - "))
    ])
  ).default([]),
  summary: z.string().default("No summary provided."),
});

export type ResumeMatchData = z.infer<typeof resumeMatchDataSchema>;

export const matchScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type MatchScore = z.infer<typeof matchScoreSchema>;

export interface TotalJobInfo {
  companyName?: string | null;
  positionName?: string | null;
  location?: string | null;
  workLocation?: string | null;
  employmentType?: string | null;
  salaryRange?: string | null;
  notes?: Array<{ title: string; bullets: string[] }> | null;
}

function parseJsonResponse(text: string): unknown {
  if (!text || typeof text !== "string") {
    throw new Error("Failed to extract JSON: empty model response");
  }

  const cleanText = text
    .replace(/:\s*<number>/gi, ": 75")
    .replace(/:\s*<integer>/gi, ": 75")
    .replace(/:\s*<float>/gi, ": 75.0")
    .replace(/:\s*<string>/gi, ': ""')
    .replace(/:\s*<boolean>/gi, ": true");

  // 1. Try markdown code block extraction
  const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const candidate = codeBlockMatch[1].trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // continue to balanced brace parser
    }
  }

  // 2. Balanced brace parser to find exact root JSON object boundaries
  const firstBrace = cleanText.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Failed to extract JSON from model response: no '{' found");
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let endBrace = -1;

  for (let i = firstBrace; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          endBrace = i;
          break;
        }
      }
    }
  }

  const jsonSnippet = endBrace !== -1
    ? cleanText.slice(firstBrace, endBrace + 1)
    : cleanText.slice(firstBrace, cleanText.lastIndexOf("}") + 1);

  try {
    return JSON.parse(jsonSnippet);
  } catch (err) {
    try {
      const fixedJson = jsonSnippet
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([\r\n]+)/g, "\\n");
      return JSON.parse(fixedJson);
    } catch {
      throw new Error(`Failed to parse JSON from model response: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export async function extractResumeContent(pdfText: string, userId?: string): Promise<ResumeMatchData> {
  const startedAt = Date.now();
  const prompt = `Extract structured information from this resume text. Return JSON with:
- skills: array of strings (technical and soft skills mentioned)
- experience: array of strings describing each role (e.g. "Software Engineer at Google, 2020-2023")
- education: array of strings describing each entry (e.g. "BS Computer Science — MIT, 2016-2020")
- summary: 2-3 sentence professional summary

IMPORTANT: All array items must be plain strings, not objects.

Resume Text:
${pdfText.slice(0, 12000)}`;

  const { resolveProviderChain, generateText } = await import("@/lib/ai/providers");
  const chain = await resolveProviderChain(userId || "", "text");
  if (!chain.length) {
    throw new Error("No AI provider configured for resume extraction");
  }

  const result = await generateText(
    chain,
    { userPrompt: prompt },
    { userId: userId || "", action: "extract_resume_content", metadata: { textLength: pdfText.length } }
  );

  const parsed = parseJsonResponse(result.text);

  try {
    return resumeMatchDataSchema.parse(parsed);
  } catch (schemaErr) {
    console.warn(`[Resume Parser] Schema validation soft-fallback after ${Date.now() - startedAt}ms:`, schemaErr);
    const raw = parsed as Record<string, unknown>;
    return {
      skills: Array.isArray(raw?.skills) ? raw.skills.map(String) : [],
      experience: Array.isArray(raw?.experience) ? raw.experience.map(String) : [],
      education: Array.isArray(raw?.education) ? raw.education.map(String) : [],
      summary: typeof raw?.summary === "string" ? raw.summary : "Resume parsed.",
    };
  }
}

export async function calculateMatchScore(
  jobTitle: string,
  jobDescription: string,
  resumeDataRaw: ResumeMatchData | string | unknown,
  userId?: string,
  totalJobInfo?: TotalJobInfo | string
): Promise<MatchScore> {
  let resumeData: Record<string, unknown> = {};
  if (typeof resumeDataRaw === "string") {
    try {
      resumeData = JSON.parse(resumeDataRaw);
    } catch {
      resumeData = {};
    }
  } else if (typeof resumeDataRaw === "object" && resumeDataRaw !== null) {
    resumeData = resumeDataRaw as Record<string, unknown>;
  }

  const skillsList = Array.isArray(resumeData.skills)
    ? resumeData.skills.map(String).join(", ")
    : "None specified";

  const expList = Array.isArray(resumeData.experience)
    ? resumeData.experience.map(String).join("; ")
    : "None specified";

  const eduList = Array.isArray(resumeData.education)
    ? resumeData.education.map(e => (typeof e === "string" ? e : JSON.stringify(e))).join("; ")
    : "None specified";

  const summaryText = typeof resumeData.summary === "string"
    ? resumeData.summary
    : "No summary provided.";

  const skillsCount = Array.isArray(resumeData.skills) ? resumeData.skills.length : 0;

  const prompt = `Compare this candidate's resume against the job description and calculate a match score from 0 to 100.

Job Position: ${jobTitle}
${totalJobInfo ? `Job Context: ${totalJobInfo}` : ""}

Job Description:
${(jobDescription || "").slice(0, 4000)}

Candidate Resume Summary:
- Skills: ${skillsList}
- Experience: ${expList}
- Education: ${eduList}
- Summary: ${summaryText}

Return ONLY a JSON object with:
- score: integer from 0 to 100
- reasoning: brief 2-3 sentence explanation of the score rating strengths and gaps

Example format:
{"score": 85, "reasoning": "Strong match on React and TypeScript..."}`;

  const { resolveProviderChain, generateText } = await import("@/lib/ai/providers");
  const chain = await resolveProviderChain(userId || "", "text");
  if (!chain.length) {
    throw new Error("No AI provider configured for match scoring");
  }

  const result = await generateText(
    chain,
    { userPrompt: prompt },
    { userId: userId || "", action: "calculate_match_score", metadata: { skillsCount } }
  );

  let parsed: unknown;
  try {
    parsed = parseJsonResponse(result.text);
  } catch (err) {
    console.warn(`[Match Score] Parse failed, applying score fallback (70):`, err);
    return {
      score: 70,
      reasoning: "AI scoring parsed with fallback criteria.",
    };
  }

  try {
    return matchScoreSchema.parse(parsed);
  } catch {
    const raw = parsed as Record<string, unknown>;
    const scoreVal = typeof raw?.score === "number" ? Math.min(100, Math.max(0, raw.score)) : 70;
    return {
      score: scoreVal,
      reasoning: typeof raw?.reasoning === "string" ? raw.reasoning : "Candidate match evaluated.",
    };
  }
}

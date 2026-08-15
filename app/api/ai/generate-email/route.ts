import { createDbClient as createClient } from "@/lib/db/client";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";
import { getCachedOutput, setCachedOutput } from "@/lib/actions/ai-cache";
import { withRoute } from "@/lib/log/route";

const EMAIL_SYSTEM_PROMPT = `You are a professional job application email writer. Write a compelling, personalized application email that will stand out while avoiding spam filters.

STRICT RULES FOR SPAM AVOIDANCE:
- Use PLAIN TEXT formatting only, no HTML
- Write in a natural, conversational professional tone
- NEVER use spam trigger words: "guarantee", "amazing", "incredible", "urgent", "limited time", "act now", "free", "winner", "congratulations", "exclusive deal", "no obligation", "risk free"
- NEVER use ALL CAPS for emphasis
- NEVER use excessive exclamation marks (max 1 per email)
- Use proper sentence structure with varied sentence lengths
- Include specific details from the job posting to show genuine interest
- Keep subject line under 60 characters, no ALL CAPS, no spammy punctuation (!!!, ???)
- Personalize greetings and references to the company
- Use standard professional email structure
- Keep the email between 150-300 words
- Include a clear call to action without being pushy
- Reference specific skills/experiences that match the job requirements

OUTPUT FORMAT:
CRITICAL: DO NOT include any thinking process, reasoning text, scratchpad, or preamble (e.g. "Thinking Process:").
Return ONLY a valid JSON object with this exact structure, no markdown wrappers, no code blocks:
{"subject": "your subject line here", "body": "your email body here"}

The body should use \\n for line breaks. Do not wrap in quotes.

EXAMPLES:

Example 1 — Frontend role:
{"subject": "Application for Senior Frontend Engineer — React & TypeScript Experience", "body": "Hi Hiring Manager,\\n\\nI came across the Senior Frontend Engineer position at Acme Corp and wanted to express my interest. With 5 years building production React applications and a focus on TypeScript and performance optimization, I believe I'd be a strong fit.\\n\\nAt my current role at TechCo, I led the migration from JavaScript to TypeScript across a 200k LOC codebase, reducing production bugs by 40%. I also implemented a component library that cut new feature development time by 30%.\\n\\nI'm particularly drawn to Acme's mission of making data accessible to non-technical teams — it aligns with my passion for building intuitive interfaces.\\n\\nI'd love to discuss how my experience with React, TypeScript, and design systems could contribute to your team. Looking forward to hearing from you.\\n\\nBest regards,"}

Example 2 — Data analyst role:
{"subject": "Interested in the Data Analyst Position — Python & SQL Background", "body": "Dear Recruiting Team,\\n\\nI'm writing to express my interest in the Data Analyst role at DataDriven Inc. My background in Python, SQL, and statistical modeling aligns well with the requirements you've outlined.\\n\\nIn my previous position at Analytics Co, I built automated reporting pipelines that reduced manual analysis time by 60% and developed predictive models that improved customer retention forecasting accuracy by 25%.\\n\\nI'm excited about DataDriven's focus on democratizing data access — it resonates with my belief that insights should be actionable for everyone, not just data teams.\\n\\nI would welcome the opportunity to discuss how my skills can support your data initiatives.\\n\\nThank you for your consideration."}`;

export const POST = withRoute("/api/ai/generate-email", async (req: Request) => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { jobTitle, companyName, jobDescription, applicationProcess, applicantName, applicantHeadline, resumeContent } = body;

  const resumeSection = resumeContent ? `\n\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent.slice(0, 4000)}` : "";
  const processSection = applicationProcess ? `\n\nAPPLICATION PROCESS NOTES: ${applicationProcess}` : "";

  const userPrompt = `Write a job application email for:

POSITION: ${jobTitle}
COMPANY: ${companyName}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : "No description provided."}
${processSection}

APPLICANT: ${applicantName}${applicantHeadline ? `, ${applicantHeadline}` : ""}
${resumeSection}

The applicant's resume will be attached to this email. Write a personalized, professional email that references relevant experience from the resume. Do NOT include "Please find my resume attached" or similar phrases — just write a strong email. Return ONLY the JSON object with "subject" and "body" fields.`;

  const chain = await resolveProviderChain(user.id, "text");
  if (chain.length === 0) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured. Please add your API key in Settings > AI Providers." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const cacheParams = {
    kind: "email",
    jobTitle,
    companyName,
    jobDescription,
    applicationProcess,
    applicantName,
    applicantHeadline,
    resumeContent,
  };

  const cached = await getCachedOutput("email", cacheParams);
  if (cached) {
    const encoder = new TextEncoder();
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(cached) } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(encoder.encode(sse), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const stream = await generateTextStream(
    chain,
    { systemPrompt: EMAIL_SYSTEM_PROMPT, userPrompt },
    { userId: user.id, action: "generate_email", metadata: { job_title: jobTitle, company_name: companyName } }
  );

  // Tee: one branch to the client, one branch captures the full output for caching.
  const [clientStream, cacheStream] = stream.tee();
  captureEmailCache(cacheStream, "email", cacheParams).catch(() => {});

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

/**
 * Reads the cache-branch of a tee'd SSE stream, extracts the final
 * {subject, body} JSON from the LLM output, and persists it so the next
 * mount of the same composer is instant.
 */
async function captureEmailCache(
  cacheStream: ReadableStream<Uint8Array>,
  kind: string,
  params: Record<string, unknown>
): Promise<void> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let readComplete = false;
  try {
    reader = cacheStream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let raw = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        readComplete = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) raw += content;
        } catch {
          // partial JSON — ignore
        }
      }
    }

    const jsonMatch = raw.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/i) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const rawJsonStr = jsonMatch[0];
      let output: Record<string, unknown> | null = null;
      try {
        output = JSON.parse(rawJsonStr);
      } catch {
        try {
          const sanitized = rawJsonStr.replace(/(?<=:\s*"[\s\S]*?)\n(?=[\s\S]*?")/g, "\\n");
          output = JSON.parse(sanitized);
        } catch {
          const subMatch = rawJsonStr.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
          const bodyMatch = rawJsonStr.match(/"body"\s*:\s*"([\s\S]*?)"(?:\s*\}|\s*$)/i);
          if (subMatch && bodyMatch) {
            output = {
              subject: subMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
              body: bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
            };
          }
        }
      }
      if (output && typeof output.subject === "string" && typeof output.body === "string") {
        await setCachedOutput(kind, params, { subject: output.subject.trim(), body: output.body.trim() });
      }
    }
  } catch {
    // non-fatal
    if (reader && !readComplete) {
      try {
        await reader.cancel();
      } catch {}
    }
  } finally {
    reader?.releaseLock();
  }
}

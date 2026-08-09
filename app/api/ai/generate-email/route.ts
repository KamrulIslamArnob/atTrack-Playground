import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";

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
Return ONLY a JSON object with this exact structure, no markdown, no code blocks:
{"subject": "your subject line here", "body": "your email body here"}

The body should use \\n for line breaks. Do not wrap in quotes.`;

export async function POST(req: NextRequest) {
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

  const resumeSection = resumeContent ? `\n\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent}` : "";
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
      JSON.stringify({ error: "No AI provider configured and no GEMINI_API_KEY fallback available." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = await generateTextStream(
    chain,
    { systemPrompt: EMAIL_SYSTEM_PROMPT, userPrompt },
    { userId: user.id, action: "generate_email", metadata: { job_title: jobTitle, company_name: companyName } }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

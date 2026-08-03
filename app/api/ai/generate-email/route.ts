import { NextRequest } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENROUTER_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { jobTitle, companyName, jobDescription, applicationProcess, applicantName, applicantHeadline, resumeContent } = body;

  const resumeSection = resumeContent
    ? `\n\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent}`
    : "";

  const processSection = applicationProcess
    ? `\n\nAPPLICATION PROCESS NOTES: ${applicationProcess}`
    : "";

  const userPrompt = `Write a job application email for:

POSITION: ${jobTitle}
COMPANY: ${companyName}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : "No description provided."}
${processSection}

APPLICANT: ${applicantName}${applicantHeadline ? `, ${applicantHeadline}` : ""}
${resumeSection}

The applicant's resume will be attached to this email. Write a personalized, professional email that references relevant experience from the resume. Do NOT include "Please find my resume attached" or similar phrases — just write a strong email. Return ONLY the JSON object with "subject" and "body" fields.`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aven.app",
      "X-Title": "Aven Job Tracker",
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      stream: true,
      messages: [
        { role: "system", content: EMAIL_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenRouter error:", response.status, text);
    return new Response(JSON.stringify({ error: `AI request failed: ${response.status}` }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the response back to the client
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

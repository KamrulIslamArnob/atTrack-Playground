import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AiToolKind } from "@/lib/types/ai-tools";
import { resolveProviderChain, generateTextStream } from "@/lib/ai/providers";

// Shared across all 8 kinds — only the purpose paragraph below changes.
const SPAM_RULES = `STRICT RULES FOR SPAM AVOIDANCE:
- Use PLAIN TEXT formatting only, no HTML
- Write in a natural, conversational professional tone
- NEVER use spam trigger words: "guarantee", "amazing", "incredible", "urgent", "limited time", "act now", "free", "winner", "congratulations", "exclusive deal", "no obligation", "risk free"
- NEVER use ALL CAPS for emphasis
- NEVER use excessive exclamation marks (max 1 per email)
- Use proper sentence structure with varied sentence lengths
- Keep subject line under 60 characters, no ALL CAPS, no spammy punctuation (!!!, ???)
- Personalize greetings and references to the company
- Use standard professional email structure
- Keep the email between 100-300 words

OUTPUT FORMAT:
CRITICAL: DO NOT include any thinking process, reasoning text, scratchpad, or preamble (e.g. "Thinking Process:").
Return ONLY a valid JSON object with this exact structure, no markdown wrappers, no code blocks:
{"subject": "your subject line here", "body": "your email body here"}

The body should use \n for line breaks. Do not wrap in quotes.`;

const PURPOSE: Record<AiToolKind, string> = {
  cover_letter:
    "You are writing a cover-letter-style application email. Reference specific skills/experience from the resume that match the job requirements, and show genuine interest in the role and company.",
  follow_up_application:
    "You are writing a polite follow-up email sent after submitting an application, checking on its status without being pushy. Reference the role and the date applied if given.",
  reschedule_interview:
    "You are writing an email asking to reschedule a previously confirmed interview. Be apologetic but professional, propose flexibility on timing, and don't over-explain the reason.",
  follow_up_interview:
    "You are writing a thank-you / follow-up email sent after an interview. Thank the interviewer, reference something specific from the conversation if given, and reaffirm interest in the role.",
  offer_negotiation:
    "You are writing an email negotiating the terms of a job offer (salary, start date, benefits, etc). Be confident, gracious, and specific about what is being asked for, without sounding demanding.",
  offer_acceptance:
    "You are writing an email formally accepting a job offer. Be warm and enthusiastic, confirm key terms if given, and ask about next steps.",
  offer_decline:
    "You are writing an email formally declining a job offer. Be gracious and appreciative, keep the door open for the future, and do not over-explain the reason.",
  offer_time_extension:
    "You are writing an email requesting more time to consider a job offer before responding. Be respectful of the employer's timeline and give a reasonable new date.",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const {
    kind,
    jobTitle,
    companyName,
    jobDescription,
    applicantName,
    applicantHeadline,
    resumeContent,
    context,
  }: {
    kind: AiToolKind;
    jobTitle: string;
    companyName: string;
    jobDescription: string | null;
    applicantName: string;
    applicantHeadline: string | null;
    resumeContent: string | null;
    context: string | null;
  } = body;

  const purpose = PURPOSE[kind];
  if (!purpose) {
    return new Response(JSON.stringify({ error: `Unknown AI Tools kind: ${kind}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let systemPrompt = `${purpose}\n\n${SPAM_RULES}`;
  const { data: customPromptRow } = await supabase
    .from("ai_tool_prompts")
    .select("system_prompt")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .single();

  if (customPromptRow?.system_prompt?.trim()) {
    systemPrompt = customPromptRow.system_prompt.trim();
  }

  const userPrompt = `POSITION: ${jobTitle}
COMPANY: ${companyName}
${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : "No description provided."}
${context ? `\nADDITIONAL CONTEXT:\n${context}` : ""}

APPLICANT: ${applicantName}${applicantHeadline ? `, ${applicantHeadline}` : ""}
${resumeContent ? `\nAPPLICANT'S RESUME/EXPERIENCE:\n${resumeContent}` : ""}

Return ONLY the JSON object with "subject" and "body" fields.`;

  const chain = await resolveProviderChain(user.id, "text");
  if (chain.length === 0) {
    return new Response(
      JSON.stringify({ error: "No AI provider configured and no GEMINI_API_KEY fallback available." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = await generateTextStream(
    chain,
    { systemPrompt, userPrompt },
    { userId: user.id, action: "generate_ai_tool", metadata: { kind, job_title: jobTitle, company_name: companyName } }
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

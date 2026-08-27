import type { AiToolKind } from "@/lib/types/ai-tools";

export const DEFAULT_SPAM_RULES = `STRICT RULES FOR SPAM AVOIDANCE:
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
{
  "subject": "<Concise, professional subject line tailored to the job and company>",
  "body": "<Full text of the email or cover letter with proper paragraphs and salutation/sign-off>"
}

The body should use \\n for line breaks. Do not wrap in quotes. Write the actual email content based on the applicant and job details provided; NEVER output placeholder text.`;

export const DEFAULT_PURPOSES: Record<AiToolKind, string> = {
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

export function getDefaultPrompt(kind: AiToolKind): string {
  const purpose = DEFAULT_PURPOSES[kind] || DEFAULT_PURPOSES.cover_letter;
  return `${purpose}\n\n${DEFAULT_SPAM_RULES}`;
}

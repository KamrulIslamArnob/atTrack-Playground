export interface EmailGenerationParams {
  jobTitle: string;
  companyName: string;
  jobDescription: string | null;
  applicationProcess: string | null;
  applicantName: string;
  applicantHeadline: string | null;
  resumeContent: string | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export async function* streamGenerateEmail(
  params: EmailGenerationParams
): AsyncGenerator<string, void, unknown> {
  const response = await fetch("/api/ai/generate-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected token") {
          throw e;
        }
      }
    }
  }
}

export function parseEmailFromStream(rawStream: string): GeneratedEmail | null {
  if (!rawStream || !rawStream.trim()) return null;

  let text = rawStream.trim();
  // Strip code block markers if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 1. Try finding JSON block
  const jsonMatch = text.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/i) || text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const rawJsonStr = jsonMatch[0];

    // Attempt direct JSON.parse first
    try {
      const parsed = JSON.parse(rawJsonStr);
      if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
        return { subject: parsed.subject.trim(), body: parsed.body.trim() };
      }
    } catch {
      // Fix unescaped newlines inside JSON string literals
      try {
        const sanitized = rawJsonStr.replace(/(?<=:\s*"[\s\S]*?)\n(?=[\s\S]*?")/g, "\\n");
        const parsed = JSON.parse(sanitized);
        if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
          return { subject: parsed.subject.trim(), body: parsed.body.trim() };
        }
      } catch {
        // Fall through to regex extraction
      }

      // Extract subject and body fields via regex if JSON syntax was malformed by LLM
      const subMatch = rawJsonStr.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
      const bodyMatch = rawJsonStr.match(/"body"\s*:\s*"([\s\S]*?)"(?:\s*\}|\s*$)/i);

      if (subMatch && bodyMatch) {
        const sub = subMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
        const body = bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
        return { subject: sub.trim(), body: body.trim() };
      }
    }
  }

  // 2. Extract bullet or labeled "* Subject:" and "* Body:" format from reasoning text
  const bulletSubjectMatch = text.match(/(?:\*|-)?\s*Subject:\s*"?([^"\n]+)"?/i);
  const bulletBodyMatch = text.match(/(?:\*|-)?\s*Body:\s*"?([\s\S]+?)"?\s*$/i);
  if (bulletSubjectMatch && bulletBodyMatch) {
    const sub = bulletSubjectMatch[1].replace(/\\"/g, '"').trim();
    const body = bulletBodyMatch[1].replace(/\\"/g, '"').trim();
    if (sub && body) {
      return { subject: sub, body: body };
    }
  }

  // Strip reasoning/thinking process preamble for plain text fallbacks
  const cleanedText = text.replace(/^(?:Thinking Process|Thought|Reasoning):[\s\S]*?(?=(?:Subject:|Hello|Hi|Dear|\n\n[A-Z]))/i, "").trim();

  // 3. Fallback for plain text output with Subject: header
  const subjectHeaderMatch = cleanedText.match(/^Subject:\s*(.+)$/im);
  if (subjectHeaderMatch) {
    const subject = subjectHeaderMatch[1].trim();
    const body = cleanedText.replace(/^Subject:\s*.+$/im, "").trim();
    if (subject && body) {
      return { subject, body };
    }
  }

  // 4. Fallback for plain text output without JSON or headers
  if (cleanedText.length > 20) {
    const lines = cleanedText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const subject = lines[0].replace(/^#+\s*/, "").replace(/^Subject:\s*/i, "").trim();
      const body = lines.slice(1).join("\n\n").trim();
      return { subject: subject || "Cover Letter", body: body || cleanedText };
    }
    return { subject: "Cover Letter", body: cleanedText };
  }

  return null;
}

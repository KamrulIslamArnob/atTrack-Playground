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
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function parseEmailFromStream(rawStream: string): GeneratedEmail | null {
  const jsonMatch = rawStream.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.subject === "string" && typeof parsed.body === "string") {
      return { subject: parsed.subject, body: parsed.body };
    }
  } catch {
    // partial JSON during streaming, not ready yet
  }

  return null;
}

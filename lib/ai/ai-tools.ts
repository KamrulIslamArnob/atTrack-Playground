import type { AiToolKind } from "@/lib/types/ai-tools";

// Mirrors lib/ai/email.ts's streamGenerateEmail — same SSE shape, different
// route (parametrized by `kind` instead of always writing a cover email).
// parseEmailFromStream from lib/ai/email.ts is reused as-is since the output
// shape ({subject, body}) is identical for all 8 kinds.
export { parseEmailFromStream, type GeneratedEmail } from "@/lib/ai/email";

export interface AiToolGenerationParams {
  kind: AiToolKind;
  jobTitle: string;
  companyName: string;
  jobDescription: string | null;
  applicantName: string;
  applicantHeadline: string | null;
  resumeContent: string | null;
  /** Free-text extra detail: interview date, offer terms, requested new date, etc. */
  context: string | null;
}

export async function* streamGenerateAiTool(
  params: AiToolGenerationParams,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const response = await fetch("/api/ai/generate-ai-tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
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
        if (content) yield content;
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected token") {
          throw e;
        }
      }
    }
  }
}

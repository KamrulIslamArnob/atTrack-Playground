import { getDocuments } from "@/lib/actions/documents";
import type { RetrievedDoc } from "./types";

const RESUME_CONTENT_CAP = 4000;
const RESUME_COUNT_CAP = 2;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…(truncated)";
}

/** Resume documents for resume_review intent. */
export async function getResumes(userId: string): Promise<RetrievedDoc[]> {
  const docs = await getDocuments().catch(() => []);
  const resumes = docs
    .filter((d) => d.type === "resume" || d.generated_kind === "resume")
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)))
    .slice(0, RESUME_COUNT_CAP);

  const out: RetrievedDoc[] = [];
  for (const r of resumes) {
    const text = [
      `Resume name: ${r.name}${r.is_default ? " (default)" : ""}`,
      r.content ? `Content:\n${truncate(r.content, RESUME_CONTENT_CAP)}` : "(no extracted text content)",
    ].join("\n");
    out.push({
      source: "resumes",
      id: `resume:${r.id}`,
      title: r.name,
      text,
      citeRef: `resume:${r.id}`,
    });
  }
  void userId;
  return out;
}

// Relative import, not "@/..." — this file is run directly via `node` by its
// self-check, and plain node doesn't resolve tsconfig path aliases (only the
// bundler does). SECTION_ORDER is a real value, so (unlike seed.ts's type-only
// import) it can't be erased away; type-only imports would work with "@/" too,
// but keep the whole statement relative for one consistent import line.
import { SECTION_ORDER, type ResumeDoc, type ProjectEntry, type SubheadingEntry } from "../types/resume-builder.ts";

// This is NOT the Task 2 inline-markup parser (lib/resume/inline.ts, not yet
// implemented) — resumeToPlainText only needs to feed a language model, so a
// few regex replacements are enough to strip the grammar down to readable text.
function stripMarkup(text: string): string {
  return text
    // [live|repo|api|cred|port](url "Label") -> Label
    .replace(/\[(?:live|repo|api|cred|port)\]\([^)]*"([^"]*)"\)/g, "$1")
    // [cat|type](Label) -> Label
    .replace(/\[(?:cat|type)\]\(([^)]*)\)/g, "$1")
    // **bold** -> bold, *italic* -> italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function subheadingLines(entries: SubheadingEntry[]): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`${stripMarkup(e.left1)} — ${stripMarkup(e.right1)}`);
    lines.push(`${stripMarkup(e.left2)} — ${stripMarkup(e.right2)}`);
    for (const bullet of e.bullets) lines.push(`- ${stripMarkup(bullet)}`);
  }
  return lines;
}

function projectLines(entries: ProjectEntry[]): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(e.right ? `${stripMarkup(e.left)} — ${stripMarkup(e.right)}` : stripMarkup(e.left));
    if (e.note) lines.push(stripMarkup(e.note));
    for (const bullet of e.bullets) lines.push(`- ${stripMarkup(bullet)}`);
  }
  return lines;
}

const TITLES = new Map<string, string>(SECTION_ORDER);

/** Flattens a ResumeDoc to plain text for documents.content (AI match-scoring input). */
export function resumeToPlainText(doc: ResumeDoc): string {
  const blocks: string[] = [];

  const { header } = doc;
  const headerLines = [stripMarkup(header.name), stripMarkup(header.title)];
  if (header.summary) headerLines.push(stripMarkup(header.summary));
  blocks.push(headerLines.join("\n"));

  // Driven by SECTION_ORDER's fixed order, but read from doc.<key> directly
  // (rather than doc[key] in a loop) so each section keeps its own shape.
  const sections: Array<{ key: string; lines: string[]; visible: boolean }> = [
    { key: "experience", visible: doc.experience.visible, lines: subheadingLines(doc.experience.entries) },
    {
      key: "skills",
      visible: doc.skills.visible,
      lines: [
        ...doc.skills.rows.map((row) => `${stripMarkup(row.label)}: ${stripMarkup(row.value)}`),
        ...(doc.skills.callout ? [stripMarkup(doc.skills.callout)] : []),
      ],
    },
    { key: "projects", visible: doc.projects.visible, lines: projectLines(doc.projects.entries) },
    { key: "education", visible: doc.education.visible, lines: subheadingLines(doc.education.entries) },
    { key: "training", visible: doc.training.visible, lines: projectLines(doc.training.entries) },
    { key: "awards", visible: doc.awards.visible, lines: projectLines(doc.awards.entries) },
    { key: "certifications", visible: doc.certifications.visible, lines: projectLines(doc.certifications.entries) },
    { key: "leadership", visible: doc.leadership.visible, lines: projectLines(doc.leadership.entries) },
  ];

  for (const { key, visible, lines } of sections) {
    if (!visible) continue;
    blocks.push([TITLES.get(key)!, ...lines].join("\n"));
  }

  return blocks.join("\n\n");
}

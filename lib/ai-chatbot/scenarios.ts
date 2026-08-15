import type { MiniScenario } from "./types";

/** Retrieval reports which sources it used as display labels ("Job
 *  Applications"), while scenarios declare the source ids they need ("jobs").
 *  This maps one back to the other so a finished answer can suggest the
 *  scenarios its own evidence supports. */
function sourceLabelToId(label: string): string | null {
  const lower = label.toLowerCase();
  if (lower.includes("job") || lower.includes("application")) return "jobs";
  if (lower.includes("resume") || lower.includes("cv")) return "resume";
  if (lower.includes("contact") || lower.includes("crm")) return "contacts";
  if (lower.includes("github") || lower.includes("code")) return "github";
  return null;
}

/**
 * Scenarios worth offering after an answer that drew on `sourceLabels`.
 * Returns nothing when no source maps to a scenario — an empty list is the
 * correct answer, not a reason to fall back to generic suggestions.
 */
export function followUpScenarios(sourceLabels: string[], limit = 2): MiniScenario[] {
  const ids = new Set(
    sourceLabels.map(sourceLabelToId).filter((id): id is string => id !== null)
  );
  if (ids.size === 0) return [];

  return MINI_SCENARIOS.filter((scenario) =>
    scenario.requiredSources.some((required) => ids.has(required))
  ).slice(0, limit);
}

export const MINI_SCENARIOS: MiniScenario[] = [
  {
    id: "resume-review",
    title: "Resume Review",
    description: "Analyze resume ATS match score and highlight impactful bullet points.",
    iconName: "FileText",
    agentId: "ats_coach",
    starterPrompt: "Review my resume against my target job role and identify the highest-impact improvements for ATS compatibility.",
    requiredSources: ["resume", "jobs"],
  },
  {
    id: "interview-prep",
    title: "Interview Prep",
    description: "Practice behavioral STAR questions & technical domain prep.",
    iconName: "UserCheck",
    agentId: "interviewer",
    starterPrompt: "Help me prepare for my upcoming interview. Ask me realistic interview questions one by one using the STAR method.",
    requiredSources: ["jobs", "resume"],
  },
  {
    id: "cold-outreach",
    title: "Cold Outreach",
    description: "Draft personalized cold LinkedIn/Email messages to recruiters.",
    iconName: "Send",
    agentId: "outreach",
    starterPrompt: "Help me write a concise, compelling cold outreach email to a recruiter for my target position.",
    requiredSources: ["contacts", "jobs"],
  },
  {
    id: "code-review",
    title: "Code Review",
    description: "Inspect code snippets or repos for architecture, performance & bugs.",
    iconName: "Code2",
    agentId: "code_architect",
    starterPrompt: "Review my code snippet for performance, cleanliness, and modern best practices.",
    requiredSources: ["github", "projects"],
  },
];

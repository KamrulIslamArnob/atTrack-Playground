import type { MiniScenario } from "./types";

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

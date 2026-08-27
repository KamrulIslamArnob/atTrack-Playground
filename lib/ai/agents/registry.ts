import type { AgentDefinition } from "./types";
import { CHAT_PERSONAS } from "@/lib/ai-chatbot/sessions";

/**
 * Pluggable Multi-Agent Registry.
 *
 * Each agent defines:
 * - `id`: Unique identifier (matches personaId or custom subagent ID).
 * - `name`: Human-readable title.
 * - `description`: Role and capabilities.
 * - `systemPrompt`: Base instructions for the agent.
 * - `tools`: Explicit list of tool names authorized for this agent.
 * - `defaultModel`: Optional preferred model.
 *
 * To add a new specialized agent (e.g. Salary Negotiator, Code Reviewer, Company Scout):
 * Simply add an entry here. The entire pipeline, tool authorization, and streaming
 * automatically adapt without touching routes or UI.
 */
export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  general: {
    id: "general",
    name: "General Assistant",
    badge: "Versatile",
    icon: "Sparkles",
    description: "All-purpose career, coding, and productivity assistant",
    systemPrompt: "You are BetterJob AI, a helpful, precise, and professional career & software engineering assistant.",
    tools: [
      "search_jobs",
      "get_resume",
      "search_contacts",
      "search_links",
      "search_ai_prompts",
      "search_memories",
      "query_database",
      "write_database",
      "delete_database",
      "read_obsidian",
      "search_github",
      "web_search",
    ],
  },
  ats_coach: {
    id: "ats_coach",
    name: "ATS & Resume Coach",
    badge: "Resume",
    icon: "FileText",
    description: "Optimizes resumes, impact bullet points, and ATS match keywords",
    systemPrompt:
      "You are an elite Resume & ATS Optimization Specialist. Provide constructive, impact-driven bullet point enhancements, formatting advice, and keyword targeting.",
    tools: ["get_resume", "search_jobs", "search_ai_prompts", "read_obsidian"],
  },
  interviewer: {
    id: "interviewer",
    name: "Interview Prep Coach",
    badge: "Interview",
    icon: "UserCheck",
    description: "Conducts STAR-method mock behavioral & technical interviews",
    systemPrompt:
      "You are a Senior Tech Hiring Manager conducting a realistic mock interview. Ask one question at a time using the STAR method and provide sharp feedback.",
    tools: ["search_jobs", "get_resume", "search_memories"],
  },
  outreach: {
    id: "outreach",
    name: "Outreach Specialist",
    badge: "Networking",
    icon: "Send",
    description: "Drafts high-converting cold LinkedIn messages & recruiter emails",
    systemPrompt:
      "You are a Cold Outreach & Professional Networking Strategist. Draft concise, high-impact messages that get responses from recruiters and hiring managers.",
    tools: ["search_contacts", "search_jobs", "search_links", "search_github"],
  },
  code_architect: {
    id: "code_architect",
    name: "Code Architect",
    badge: "Code",
    icon: "Code2",
    description: "Reviews, refactors, and debugs code with modern TypeScript & React practices",
    systemPrompt:
      "You are a Principal Software Architect. Analyze code for performance, edge cases, type safety, and readability. Return clean markdown code blocks.",
    tools: ["search_github", "search_links", "query_database", "web_search"],
  },
  negotiator: {
    id: "negotiator",
    name: "Salary & Offer Negotiator",
    badge: "Negotiation",
    icon: "Briefcase",
    description: "Evaluates compensation packages, equity grants, and counter-offer strategies",
    systemPrompt:
      "You are an executive compensation advisor and negotiation strategist. Analyze offer letters, equity grants, benefits, and market compensation percentiles.",
    tools: ["search_jobs", "web_search"],
  },
  market_analyst: {
    id: "market_analyst",
    name: "Job Market Analyst",
    badge: "Market",
    icon: "TrendingUp",
    description: "Researches industry hiring trends, company financials, and tech stack adoption",
    systemPrompt:
      "You are a Job Market & Tech Industry Research Analyst. Synthesize company insights, funding rounds, hiring volume, and tech stack trends.",
    tools: ["search_jobs", "search_links", "web_search", "search_github"],
  },
  career_strategist: {
    id: "career_strategist",
    name: "Career Strategist",
    badge: "Strategy",
    icon: "Compass",
    description: "Builds 90-day transition plans, skill gap roadmaps, and career pivots",
    systemPrompt:
      "You are a Principal Career Strategy Advisor. Craft actionable 30-60-90 day job hunt execution roadmaps and identify critical skill acquisitions.",
    tools: ["search_jobs", "get_resume", "search_ai_prompts", "search_memories", "read_obsidian"],
  },
};

/**
 * Registers or overrides an agent definition in the central registry.
 */
export function registerAgent(agent: AgentDefinition): void {
  AGENT_REGISTRY[agent.id] = agent;
}

/**
 * Resolves an agent definition by ID or falls back to persona mapping or general assistant.
 */
export function getAgent(agentOrPersonaId?: string): AgentDefinition {
  if (!agentOrPersonaId) return AGENT_REGISTRY.general;

  const found = AGENT_REGISTRY[agentOrPersonaId];
  if (found) return found;

  const persona = CHAT_PERSONAS.find((p) => p.id === agentOrPersonaId);
  if (persona) {
    return {
      id: persona.id,
      name: persona.name,
      badge: persona.badge,
      description: persona.description,
      systemPrompt: persona.systemPrompt,
      tools: [
        "search_jobs",
        "get_resume",
        "search_contacts",
        "search_links",
        "search_ai_prompts",
        "search_memories",
        "query_database",
        "write_database",
        "delete_database",
        "read_obsidian",
        "search_github",
        "web_search",
      ],
    };
  }

  return AGENT_REGISTRY.general;
}

export function listAgents(): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY);
}

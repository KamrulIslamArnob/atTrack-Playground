// This module is imported by client components (the chatbot page pulls
// CHAT_PERSONAS, readCache and fetchSessions straight out of it), so it must
// never reach for the pino logger: lib/log imports node:fs, and dragging that
// into a browser chunk fails the Turbopack build outright. The two catch
// blocks below run in the browser against localStorage and use console
// deliberately — eslint.config.mjs exempts this file from no-console.
import type { AIModel, ChatPersona } from "./types";
import type { ToolExecutionStep } from "./use-chat";

export type { AIModel, ChatPersona, ToolExecutionStep };

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  experimental_attachments?: { url: string; contentType?: string }[];
  thinking?: string;
  personaId?: string;
  feedback?: "up" | "down" | null;
  sources?: string[];
  toolSteps?: ToolExecutionStep[];
}

export const CHAT_PERSONAS: ChatPersona[] = [
  {
    id: "general",
    name: "General Assistant",
    badge: "Versatile",
    iconName: "Sparkles",
    description: "All-purpose career, coding, and productivity assistant",
    systemPrompt: "You are atTrack AI, a helpful, precise, and professional career & software engineering assistant.",
    heading: "What would you like to accomplish today?",
    subheading: "Ask questions, generate content, or explore career strategies.",
    preferredSources: ["jobs", "resumes", "contacts"],
  },
  {
    id: "ats_coach",
    name: "ATS & Resume Coach",
    badge: "Resume",
    iconName: "FileText",
    description: "Optimizes resumes, impact bullet points, and ATS match keywords",
    systemPrompt: "You are an elite Resume & ATS Optimization Specialist. Provide constructive, impact-driven bullet point enhancements, formatting advice, and keyword targeting.",
    heading: "Optimize your resume for ATS algorithms",
    subheading: "Tailor bullet points, analyze keyword match rates, and format for maximum impact.",
    preferredSources: ["resume", "jobs"],
  },
  {
    id: "interviewer",
    name: "Interview Prep Coach",
    badge: "Interview",
    iconName: "UserCheck",
    description: "Conducts STAR-method mock behavioral & technical interviews",
    systemPrompt: "You are a Senior Tech Hiring Manager conducting a realistic mock interview. Ask one question at a time using the STAR method and provide sharp feedback.",
    heading: "Practice mock behavioral & technical interviews",
    subheading: "Simulate real interview questions using the STAR framework with instant feedback.",
    preferredSources: ["jobs", "resume"],
  },
  {
    id: "outreach",
    name: "Outreach Specialist",
    badge: "Networking",
    iconName: "Send",
    description: "Drafts high-converting cold LinkedIn messages & recruiter emails",
    systemPrompt: "You are a Cold Outreach & Professional Networking Strategist. Draft concise, high-impact messages that get responses from recruiters and hiring managers.",
    heading: "Draft high-converting outreach messages",
    subheading: "Create personalized cold messages and follow-up emails for recruiters and hiring managers.",
    preferredSources: ["contacts", "jobs"],
  },
  {
    id: "code_architect",
    name: "Code Architect",
    badge: "Code",
    iconName: "Code2",
    description: "Reviews, refactors, and debugs code with modern TypeScript & React practices",
    systemPrompt: "You are a Principal Software Architect. Analyze code for performance, edge cases, type safety, and readability. Return clean markdown code blocks.",
    heading: "Review code, debug errors & design software",
    subheading: "Get expert feedback on TypeScript, React, algorithms, and architectural decisions.",
    preferredSources: ["github", "projects"],
  },
];

export const AI_MODELS: AIModel[] = [
  {
    id: "auto",
    name: "Auto Hybrid Agent",
    provider: "auto",
    description: "Smart Hybrid: Automatically routes turn to Vision, Code, or Reasoning models per context",
    supportsImages: true,
    isReasoning: true,
    isFast: true,
    isPopular: true,
    badge: "Smart Hybrid",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    description: "Multimodal, ultra-fast responses for general career & technical tasks",
    supportsImages: true,
    isReasoning: false,
    isFast: true,
    isPopular: true,
    badge: "Recommended",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    description: "High intelligence with deep understanding for complex documents",
    supportsImages: true,
    isReasoning: false,
    badge: "High IQ",
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description: "Superior coding, structural analysis & resume drafting",
    supportsImages: true,
    isReasoning: false,
    badge: "Code & Logic",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Versatile flagship model with image reasoning capabilities",
    supportsImages: true,
    isReasoning: false,
    badge: "Versatile",
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    description: "Chain-of-thought reasoning engine for math, architecture & logic",
    supportsImages: false,
    isReasoning: true,
    badge: "Reasoning",
  },
];

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  personaId?: string;
  messages: Message[];
  isPinned?: boolean;
  category?: "notebooks" | "recent";
  /** Sources connected for THIS chat (per-chat workspace selection). */
  connectedSourceIds?: string[];
}

const STORAGE_KEY = "attrack_ai_chat_sessions";
const ACTIVE_SESSION_KEY = "attrack_ai_chat_active_id";
const LAST_MODEL_KEY = "attrack_ai_chat_selected_model";

// --- Mirror tier: localStorage -------------------------------------------
// SQLite owns chat history. localStorage exists only so the sidebar paints
// without waiting for a round trip; it is written FROM the database and is
// never merged back into it. That asymmetry is the entire design. Because
// load never writes to the database, a deleted chat cannot come back — the
// previous two-authority merge had no way to express "deleted", so a delete
// always lost to a row that still existed.

export function readCache(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch (err) {
    console.error("Couldn't read cached chat sessions:", err);
    return [];
  }
}

export function writeCache(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error("Couldn't cache chat sessions:", err);
  }
}

// --- Authority tier: SQLite via /api/chat/sessions ------------------------
// Each of these awaits and throws. A caller that swallows the error recreates
// the bug this replaced: the UI showing a delete the database never performed.

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch("/api/chat/sessions");
  if (!res.ok) throw new Error(`Couldn't load chat sessions (${res.status})`);
  const payload = await res.json();
  return (payload?.sessions ?? []) as ChatSession[];
}

export async function persistSession(session: ChatSession): Promise<void> {
  const res = await fetch("/api/chat/sessions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, messages: session.messages }),
  });
  if (!res.ok) throw new Error(`Couldn't save chat session (${res.status})`);
}

export async function deleteSessionRemote(id: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Couldn't delete chat session (${res.status})`);
}

export async function clearAllSessionsRemote(): Promise<void> {
  const res = await fetch("/api/chat/sessions?all=true", { method: "DELETE" });
  if (!res.ok) throw new Error(`Couldn't clear chat sessions (${res.status})`);
}

// ponytail: re-upserts the whole conversation per turn; send only new message ids if a chat ever grows past a few hundred messages.

export function loadActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function saveActiveSessionId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

export function loadLastSelectedModel(): string {
  if (typeof window === "undefined") return AI_MODELS[0].id;
  return localStorage.getItem(LAST_MODEL_KEY) || AI_MODELS[0].id;
}

export function saveSelectedModel(modelId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_MODEL_KEY, modelId);
}

export function createNewSession(modelId?: string, initialTitle?: string, personaId?: string): ChatSession {
  const model = modelId || loadLastSelectedModel();
  const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  return {
    id,
    title: initialTitle || "New Chat",
    createdAt: now,
    updatedAt: now,
    model,
    personaId: personaId || "general",
    messages: [],
    isPinned: false,
    category: "recent",
  };
}

export function generateSessionTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/^[^a-zA-Z0-9]+/, "");
  if (!clean) return "New Conversation";
  const words = clean.split(/\s+/).slice(0, 6).join(" ");
  return words.length < clean.length ? `${words}...` : words;
}

export function exportSessionToMarkdown(session: ChatSession): string {
  let md = `# ${session.title}\n\n`;
  md += `*Exported from atTrack AI Chatbot on ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  session.messages.forEach((msg) => {
    const roleName = msg.role === "user" ? "User" : "atTrack AI";
    md += `### ${roleName}\n${msg.content}\n\n`;
  });
  return md;
}

export function exportSessionToJSON(session: ChatSession): string {
  return JSON.stringify(session, null, 2);
}

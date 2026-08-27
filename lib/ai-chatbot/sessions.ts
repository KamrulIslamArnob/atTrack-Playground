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
    systemPrompt: "Your name is Tracky. You are the helpful, precise, and professional career & software engineering co-pilot in BetterJob.",
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

/**
 * The one model option that is not an `ai_providers` row. "auto" names a
 * capability, not a vendor — the server resolves it against the user's own
 * configured providers, so it can never route somewhere the user has no key
 * for. Every other option in the picker is built at runtime from
 * `listProviders()`.
 *
 * This list used to also carry a hardcoded vendor catalog (Gemini 2.0 Flash,
 * Gemini 1.5 Pro, Claude 3.5 Sonnet, GPT-4o, DeepSeek R1). It is the picker's
 * seed and its fallback, so on a workspace configured with none of those
 * vendors the dropdown offered five models that could not be served, and
 * picking one landed the turn on whatever headed the fallback chain. Settings >
 * AI Providers is the only place a model may come from.
 */
export const AI_MODELS: AIModel[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "auto",
    description: "",
    supportsImages: true,
    isReasoning: true,
    isFast: true,
    isPopular: true,
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

export function normalizeSessionMessages(messages: Message[]): Message[] {
  return [...(messages ?? [])].sort((a, b) => {
    const timeA = String(a.createdAt ?? "");
    const timeB = String(b.createdAt ?? "");
    if (timeA && timeB && timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    if (a.role !== b.role) {
      return a.role === "user" ? -1 : 1;
    }
    return 0;
  });
}

export function readCache(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return parsed.map((s) => ({
      ...s,
      messages: normalizeSessionMessages(s.messages),
    }));
  } catch (err) {
    console.error("Couldn't read cached chat sessions:", err);
    return [];
  }
}

export function writeCache(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = sessions.map((s) => ({
      ...s,
      messages: normalizeSessionMessages(s.messages),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("attrack-chat-sessions-updated", { detail: normalized }));
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
  md += `*Exported from BetterJob AI Chatbot on ${new Date().toLocaleDateString()}*\n\n---\n\n`;
  session.messages.forEach((msg) => {
    const roleName = msg.role === "user" ? "User" : "BetterJob AI";
    md += `### ${roleName}\n${msg.content}\n\n`;
  });
  return md;
}

export function exportSessionToJSON(session: ChatSession): string {
  return JSON.stringify(session, null, 2);
}

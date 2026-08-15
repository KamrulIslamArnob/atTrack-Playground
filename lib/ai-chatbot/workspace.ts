"use client";

import type { ChatPersona, ContextSource } from "./types";

export interface WorkspaceJobDeadline {
  id?: string;
  title: string;
  type?: "deadline" | "milestone";
  dueDate: string;
  stageKind?: string | null;
  isCompleted?: boolean;
  notes?: string | null;
}

export interface WorkspaceJob {
  id: string;
  title: string;
  company: string | null;
  stage: string | null;
  state: string | null;
  deadline?: string | null;
  sectionDeadline?: string | null;
  deadlines?: WorkspaceJobDeadline[];
  matchScore: number | null;
  resumeName: string | null;
  applicationStatus: string | null;
}

export interface WorkspaceResume {
  id: string;
  name: string;
  isDefault: boolean;
  hasBuilderData: boolean;
  hasContent: boolean;
}

export interface WorkspaceContact {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
}

export interface WorkspaceSnapshot {
  jobs: WorkspaceJob[];
  resumes: WorkspaceResume[];
  contacts: WorkspaceContact[];
  links?: { id: string; title: string; url: string; category: string }[];
  memories?: { id: string; title: string | null; description: string; updatedAt?: string }[];
  aiToolPrompts?: number;
  counts: { jobs: number; resumes: number; contacts: number; links?: number; memories?: number; aiToolPrompts?: number };
  generatedAt?: string;
}

export interface WorkspaceContext {
  hasData: boolean;
  jobCount: number;
  resumeCount: number;
  contactCount: number;
  defaultResumeName: string | null;
  topResumeName: string | null;
  recentJobTitle: string | null;
  recentCompany: string | null;
  interviewJobTitle: string | null;
  interviewCompany: string | null;
}

const CACHE_KEY = "attrack_ai_chat_workspace";
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const cached = readCache();
    if (cached) return cached;

    const res = await fetch("/api/chat/workspace", { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as WorkspaceSnapshot;
    writeCache(data);
    return data;
  } catch {
    return null;
  }
}

export function deriveWorkspaceSources(
  snapshot: WorkspaceSnapshot | null,
  customSources: ContextSource[] = []
): ContextSource[] {
  const resumeCount = snapshot?.counts?.resumes ?? snapshot?.resumes?.length ?? 0;
  const jobCount = snapshot?.counts?.jobs ?? snapshot?.jobs?.length ?? 0;
  const contactCount = snapshot?.counts?.contacts ?? snapshot?.contacts?.length ?? 0;
  const linkCount = snapshot?.links?.length ?? 0;
  const memoryCount = snapshot?.counts?.memories ?? snapshot?.memories?.length ?? 0;
  const promptCount = snapshot?.aiToolPrompts ?? snapshot?.counts?.aiToolPrompts ?? 0;

  const now = "Just now";

  const seeded: ContextSource[] = [
    {
      id: "jobs",
      type: "jobs",
      name: "Job Applications",
      kind: "native",
      recordCount: jobCount,
      lastSync: jobCount > 0 ? now : null,
      enabled: true,
      toolName: "search_jobs",
    },
    {
      id: "resume",
      type: "resume",
      name: "Resumes & CVs",
      kind: "native",
      recordCount: resumeCount,
      lastSync: resumeCount > 0 ? now : null,
      enabled: true,
      toolName: "get_resume",
    },
    {
      id: "contacts",
      type: "contacts",
      name: "Contacts CRM & Social Links",
      kind: "native",
      recordCount: contactCount + linkCount,
      lastSync: contactCount > 0 || linkCount > 0 ? now : null,
      enabled: true,
      toolName: "search_contacts",
    },
    {
      id: "memories",
      type: "memories",
      name: "AI Memories",
      kind: "native",
      recordCount: memoryCount,
      lastSync: memoryCount > 0 ? now : null,
      enabled: true,
      toolName: "search_memories",
    },
    {
      id: "ai_prompts",
      type: "ai_prompts",
      name: "AI Prompts",
      kind: "native",
      recordCount: promptCount,
      lastSync: now,
      enabled: true,
      toolName: "search_ai_prompts",
    },
    {
      id: "obsidian",
      type: "obsidian",
      name: "Obsidian Vault",
      kind: "fs",
      recordCount: 0,
      lastSync: null,
      enabled: false,
      toolName: "read_obsidian",
      auth: { status: "needed", method: "fs-path" },
    },
    {
      id: "github",
      type: "github",
      name: "GitHub Repositories",
      kind: "pat",
      recordCount: 0,
      lastSync: null,
      enabled: false,
      toolName: "search_github",
      auth: { status: "needed", method: "pat" },
    },
    {
      id: "db_query",
      type: "db_query",
      name: "Database Access",
      kind: "native",
      recordCount: 0,
      lastSync: null,
      enabled: false,
      toolName: "query_database",
      auth: { status: "none" },
    },
  ];

  // Merge in user-defined custom sources, omitting legacy native types like "links".
  const filteredCustom = customSources.filter(
    (s) => s.id !== "links" && s.type !== "links" && !seeded.some((p) => p.id === s.id)
  );
  return [...seeded, ...filteredCustom];
}

export async function fetchWorkspaceSources(): Promise<ContextSource[]> {
  const snapshot = await fetchWorkspace();
  return deriveWorkspaceSources(snapshot);
}

export function deriveContext(snapshot: WorkspaceSnapshot | null): WorkspaceContext {
  if (!snapshot) {
    return {
      hasData: false,
      jobCount: 0,
      resumeCount: 0,
      contactCount: 0,
      defaultResumeName: null,
      topResumeName: null,
      recentJobTitle: null,
      recentCompany: null,
      interviewJobTitle: null,
      interviewCompany: null,
    };
  }

  const defaultResume = snapshot.resumes.find((r) => r.isDefault) ?? snapshot.resumes[0];
  const recent = snapshot.jobs[0];
  const interview = snapshot.jobs.find((j) => j.stage === "interview" || j.stage === "Interviewing");

  return {
    hasData: snapshot.counts.jobs > 0 || snapshot.counts.resumes > 0 || snapshot.counts.contacts > 0,
    jobCount: snapshot.counts.jobs,
    resumeCount: snapshot.counts.resumes,
    contactCount: snapshot.contacts.length,
    defaultResumeName: defaultResume?.name ?? null,
    topResumeName: snapshot.resumes[0]?.name ?? null,
    recentJobTitle: recent?.title ?? null,
    recentCompany: recent?.company ?? null,
    interviewJobTitle: interview?.title ?? null,
    interviewCompany: interview?.company ?? null,
  };
}

/** Builds a compact, token-bounded context block from the workspace snapshot and active sources. */
export function buildWorkspaceContextBlock(
  snapshot: WorkspaceSnapshot | null,
  sources?: ContextSource[]
): string | null {
  if (!snapshot || snapshot.counts.jobs === 0) return null;

  const isEnabled = (type: string) => {
    if (!sources || sources.length === 0) return true;
    const match = sources.find((s) => s.id === type || s.type === type);
    return match ? match.enabled : true;
  };

  const lines: string[] = [];
  lines.push("The user is working inside atTrack, a personal career workspace. Relevant local data:");

  if (isEnabled("jobs") && snapshot.jobs.length > 0) {
    const top = snapshot.jobs.slice(0, 15);
    lines.push(`- Tracked job applications (${snapshot.counts.jobs} total):`);
    for (const job of top) {
      const deadlineParts: string[] = [];
      if (job.deadline) deadlineParts.push(`Overall Deadline: ${job.deadline}`);
      if (job.sectionDeadline) deadlineParts.push(`Section Deadline: ${job.sectionDeadline}`);
      if (job.deadlines && job.deadlines.length > 0) {
        const active = job.deadlines
          .filter((d) => !d.isCompleted)
          .map((d) => `${d.title}: ${d.dueDate}${d.notes ? ` (${d.notes})` : ""}`);
        if (active.length > 0) deadlineParts.push(`Milestones: ${active.join("; ")}`);
      }

      const deadlineStr = deadlineParts.length > 0 ? `[${deadlineParts.join(" | ")}]` : "[No explicit deadline set]";

      const parts = [
        job.title,
        job.company ? `@ ${job.company}` : null,
        `[Stage: ${job.stage || "Saved"}]`,
        deadlineStr,
        job.matchScore != null ? `(Fit match: ${job.matchScore}%)` : null,
      ].filter(Boolean);
      lines.push(`  · ${parts.join(" ")}`);
    }
  }

  if (isEnabled("resume") && snapshot.resumes.length > 0) {
    const names = snapshot.resumes.map((r) => (r.isDefault ? `${r.name} (default)` : r.name));
    lines.push(`- Resume documents: ${names.join(", ")}`);
  }

  if (isEnabled("contacts") && snapshot.contacts.length > 0) {
    lines.push(
      `- Professional network: ${snapshot.counts.contacts} contacts (e.g. ${snapshot.contacts
        .slice(0, 3)
        .map((c) => c.name)
        .join(", ")})`
    );
  }

  if ((isEnabled("contacts") || isEnabled("links")) && snapshot.links && snapshot.links.length > 0) {
    lines.push(
      `- Saved links & resources: ${snapshot.links.length} links (e.g. ${snapshot.links
        .slice(0, 3)
        .map((l) => l.title)
        .join(", ")})`
    );
  }

  if (isEnabled("memories") && snapshot.memories && snapshot.memories.length > 0) {
    lines.push(`- Saved AI Memories & Markdown Context (${snapshot.memories.length} entries):`);
    for (const mem of snapshot.memories.slice(0, 10)) {
      const titleStr = mem.title ? `[${mem.title}] ` : "";
      const textPreview = mem.description.length > 200 ? `${mem.description.slice(0, 200)}...` : mem.description;
      lines.push(`  · ${titleStr}${textPreview.replace(/\n+/g, " ")}`);
    }
  }

  if (isEnabled("ai_prompts") && (snapshot.aiToolPrompts ?? 0) > 0) {
    lines.push(`- Inbuilt AI prompt templates: ${snapshot.aiToolPrompts} system prompts available`);
  }

  if (lines.length === 1) return null;

  lines.push(
    "When the user references 'my resume', 'my application', 'my jobs', 'my contacts', or 'my memories', use the data above. Do not invent details that contradict it."
  );

  return lines.join("\n");
}

export function workspaceAwarePrompt(
  basePrompt: string,
  persona: ChatPersona,
  ctx: WorkspaceContext
): string {
  if (!ctx.hasData) return basePrompt;

  const tail: string[] = [];

  switch (persona.id) {
    case "ats_coach":
      if (ctx.defaultResumeName) {
        tail.push(`The user's default resume is titled "${ctx.defaultResumeName}". Offer to review it when relevant.`);
      }
      break;
    case "interviewer":
      if (ctx.interviewJobTitle) {
        tail.push(
          `The user has an interview-stage application for "${ctx.interviewJobTitle}"${
            ctx.interviewCompany ? ` at ${ctx.interviewCompany}` : ""
          }. Frame practice around that role when relevant.`
        );
      }
      break;
    case "outreach":
      if (ctx.contactCount > 0) {
        tail.push(
          `The user has ${ctx.contactCount} contacts in their CRM (recruiters, hiring managers, peers). Suggest referencing a real contact when outreach is the goal.`
        );
      }
      break;
  }

  if (ctx.recentJobTitle) {
    tail.push(
      `Context: the user's most recent tracked application is "${ctx.recentJobTitle}"${
        ctx.recentCompany ? ` at ${ctx.recentCompany}` : ""
      }.`
    );
  }

  return tail.length ? `${basePrompt}\n\n${tail.join("\n")}` : basePrompt;
}

function readCache(): WorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WorkspaceSnapshot; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: WorkspaceSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* ignore quota / serialization errors */
  }
}

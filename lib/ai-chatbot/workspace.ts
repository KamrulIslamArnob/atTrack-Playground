"use client";

import type { ChatPersona, ContextSource } from "./types";

export interface WorkspaceJob {
  id: string;
  title: string;
  company: string | null;
  stage: string | null;
  state: string | null;
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
  counts: { jobs: number; resumes: number; contacts: number };
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

export function deriveWorkspaceSources(snapshot: WorkspaceSnapshot | null): ContextSource[] {
  const resumeCount = snapshot?.counts?.resumes ?? snapshot?.resumes?.length ?? 3;
  const jobCount = snapshot?.counts?.jobs ?? snapshot?.jobs?.length ?? 12;
  const contactCount = snapshot?.counts?.contacts ?? snapshot?.contacts?.length ?? 8;

  return [
    {
      id: "resume",
      type: "resume",
      name: "Resumes & CVs",
      recordCount: resumeCount,
      lastSync: "Just now",
      enabled: true,
    },
    {
      id: "jobs",
      type: "jobs",
      name: "Job Applications",
      recordCount: jobCount,
      lastSync: "Just now",
      enabled: true,
    },
    {
      id: "contacts",
      type: "contacts",
      name: "Contacts CRM",
      recordCount: contactCount,
      lastSync: "Just now",
      enabled: true,
    },
    {
      id: "github",
      type: "github",
      name: "GitHub Repositories",
      recordCount: 5,
      lastSync: "1 hour ago",
      enabled: true,
    },
    {
      id: "gdrive",
      type: "gdrive",
      name: "Google Drive Docs",
      recordCount: 14,
      lastSync: "2 hours ago",
      enabled: false,
    },
    {
      id: "notion",
      type: "notion",
      name: "Notion Workspace",
      recordCount: 9,
      lastSync: "3 hours ago",
      enabled: false,
    },
    {
      id: "linkedin",
      type: "linkedin",
      name: "LinkedIn Profile Data",
      recordCount: 1,
      lastSync: "Yesterday",
      enabled: true,
    },
    {
      id: "email",
      type: "email",
      name: "Email Threads",
      recordCount: 27,
      lastSync: "4 hours ago",
      enabled: false,
    },
    {
      id: "projects",
      type: "projects",
      name: "Projects & Tasks",
      recordCount: 4,
      lastSync: "Just now",
      enabled: true,
    },
  ];
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
  const interview = snapshot.jobs.find((j) => j.stage === "interview");

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

/** Builds a compact, token-bounded context block from the workspace snapshot. */
export function buildWorkspaceContextBlock(snapshot: WorkspaceSnapshot | null): string | null {
  if (!snapshot || snapshot.counts.jobs === 0) return null;

  const lines: string[] = [];
  lines.push("The user is working inside AtTrack, a personal career workspace. Relevant local data:");

  if (snapshot.jobs.length > 0) {
    const top = snapshot.jobs.slice(0, 8);
    lines.push(`- Active job applications (${snapshot.counts.jobs} total):`);
    for (const job of top) {
      const parts = [
        job.title,
        job.company ? `@ ${job.company}` : null,
        job.stage ? `[stage: ${job.stage}]` : null,
        job.matchScore != null ? `(fit: ${job.matchScore})` : null,
      ].filter(Boolean);
      lines.push(`  · ${parts.join(" ")}`);
    }
  }

  if (snapshot.resumes.length > 0) {
    const names = snapshot.resumes.map((r) => (r.isDefault ? `${r.name} (default)` : r.name));
    lines.push(`- Resume documents: ${names.join(", ")}`);
  }

  if (snapshot.contacts.length > 0) {
    lines.push(
      `- Professional network: ${snapshot.counts.contacts} contacts (e.g. ${snapshot.contacts
        .slice(0, 3)
        .map((c) => c.name)
        .join(", ")})`
    );
  }

  lines.push(
    "When the user references 'my resume', 'my application', 'my jobs', or 'my contacts', use the data above. Do not invent details that contradict it."
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

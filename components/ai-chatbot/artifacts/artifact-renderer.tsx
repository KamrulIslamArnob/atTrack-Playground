"use client";

import type { ChatArtifact } from "@/lib/types/chat-artifact";
import { JobChatCard } from "./job-chat-card";
import { ContactChatCard } from "./contact-chat-card";
import { LinkChatCard } from "./link-chat-card";
import { MemoryChatCard } from "./memory-chat-card";
import { InterviewChatCard } from "./interview-chat-card";
import type { ToolExecutionStep } from "@/lib/ai-chatbot/use-chat";

interface ArtifactRendererProps {
  steps?: ToolExecutionStep[];
  artifacts?: ChatArtifact[];
}

export function ArtifactRenderer({ steps, artifacts }: ArtifactRendererProps) {
  const fromSteps: ChatArtifact[] = [];
  for (const step of steps ?? []) {
    if (step.artifact) fromSteps.push(step.artifact);
    if (step.artifacts) fromSteps.push(...step.artifacts);
  }
  const all = [...(artifacts ?? []), ...fromSteps];
  if (all.length === 0) return null;

  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    const key = `${a.kind}:${a.rowId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {deduped.map((artifact) => (
        <div key={artifact.id} className="w-full max-w-[520px]">
          <ArtifactCard artifact={artifact} />
        </div>
      ))}
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ChatArtifact }) {
  switch (artifact.kind) {
    case "job":
      return <JobChatCard snapshot={artifact.snapshot as any} artifactId={artifact.id} />;
    case "contact":
      return <ContactChatCard snapshot={artifact.snapshot as any} />;
    case "link":
      return <LinkChatCard snapshot={artifact.snapshot as any} />;
    case "memory":
      return <MemoryChatCard snapshot={artifact.snapshot as any} />;
    case "interview":
      return <InterviewChatCard snapshot={artifact.snapshot as any} />;
    default:
      return (
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-sm font-medium">{artifact.title}</p>
          {artifact.subtitle && <p className="text-xs text-muted-foreground">{artifact.subtitle}</p>}
        </div>
      );
  }
}

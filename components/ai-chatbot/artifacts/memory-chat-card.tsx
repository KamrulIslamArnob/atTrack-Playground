"use client";

import { Brain } from "lucide-react";
import type { MemoryArtifactSnapshot } from "@/lib/types/chat-artifact";

export function MemoryChatCard({ snapshot }: { snapshot: MemoryArtifactSnapshot }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-3.5">
      <p className="text-sm font-semibold leading-snug tracking-tight flex items-center gap-1.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Brain className="size-3.5" />
        </span>
        {snapshot.title ?? "Memory updated"}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{snapshot.description}</p>
    </div>
  );
}

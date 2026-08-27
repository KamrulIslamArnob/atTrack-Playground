"use client";

import { ExternalLink } from "lucide-react";
import type { LinkArtifactSnapshot } from "@/lib/types/chat-artifact";

export function LinkChatCard({ snapshot }: { snapshot: LinkArtifactSnapshot }) {
  return (
    <a
      href={snapshot.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1.5 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-accent/30"
    >
      <p className="text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary flex items-center gap-1.5">
        {snapshot.title}
        <ExternalLink className="size-3.5 shrink-0 opacity-60" />
      </p>
      <p className="text-xs text-muted-foreground truncate">{snapshot.url}</p>
      {snapshot.category_name && (
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {snapshot.category_name}
        </span>
      )}
      {snapshot.notes && <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{snapshot.notes}</p>}
    </a>
  );
}

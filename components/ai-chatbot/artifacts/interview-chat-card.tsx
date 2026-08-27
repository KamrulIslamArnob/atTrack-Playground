"use client";

import Link from "next/link";
import { CalendarClock, MapPin, User } from "lucide-react";
import type { InterviewArtifactSnapshot } from "@/lib/types/chat-artifact";

export function InterviewChatCard({ snapshot }: { snapshot: InterviewArtifactSnapshot }) {
  const when = snapshot.scheduled_at ? new Date(snapshot.scheduled_at).toLocaleString() : "Not scheduled";
  return (
    <Link
      href={snapshot.job_id ? `/jobs/${snapshot.job_id}` : "/jobs"}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-3.5 hover:border-primary/30 hover:bg-accent/30"
    >
      <p className="text-sm font-semibold tracking-tight group-hover:text-primary">
        {snapshot.job_title ?? "Interview"} {snapshot.company_name ? `· ${snapshot.company_name}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
          <CalendarClock className="size-3" /> {when}
        </span>
        {snapshot.type && (
          <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize">{snapshot.type}</span>
        )}
        {snapshot.status && <span className="text-[11px] capitalize">{snapshot.status}</span>}
      </div>
      {(snapshot.interviewer_name || snapshot.location) && (
        <div className="flex gap-1.5 text-xs text-muted-foreground">
          {snapshot.interviewer_name && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" /> {snapshot.interviewer_name}
            </span>
          )}
          {snapshot.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {snapshot.location}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

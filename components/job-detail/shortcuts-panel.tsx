"use client";

import { formatDistanceToNow } from "@/lib/utils";
import type { JobDetailData } from "@/lib/types/job-detail";

interface ShortcutsPanelProps {
  data: JobDetailData;
}

export function ShortcutsPanel({ data }: ShortcutsPanelProps) {
  const { applications, interviews } = data;

  if (applications.length === 0 && interviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
        <div className="space-y-1.5 text-xs">
          {applications.map((app) => (
            <div key={app.id} className="rounded-xl border border-border bg-muted/20 p-2">
              <p className="font-medium capitalize">{app.status}</p>
              <p className="text-[11px] text-muted-foreground">
                {app.applied_at
                  ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })
                  : formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
              </p>
            </div>
          ))}
          {interviews.map((iv) => (
            <div key={iv.id} className="rounded-xl border border-border bg-muted/20 p-2">
              <p className="font-medium capitalize">{iv.type ?? "Interview"} — {iv.status}</p>
              {iv.scheduled_at && (
                <p className="text-[11px] text-muted-foreground">
                  {new Date(iv.scheduled_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

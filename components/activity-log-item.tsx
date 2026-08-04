"use client";

import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { ActivityLog } from "@/lib/actions/activity-log";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  delete: "bg-red-100 text-red-700",
  update: "bg-blue-100 text-blue-700",
  send: "bg-purple-100 text-purple-700",
  upload: "bg-orange-100 text-orange-700",
  extract: "bg-cyan-100 text-cyan-700",
  sign_in: "bg-indigo-100 text-indigo-700",
  sign_up: "bg-emerald-100 text-emerald-700",
  sign_out: "bg-gray-100 text-gray-700",
};

export function ActivityLogItem({ log }: { log: ActivityLog }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <Badge
        variant="secondary"
        className={`shrink-0 text-[10px] ${ACTION_COLORS[log.action] ?? ""}`}
      >
        {log.action}
      </Badge>
      <div className="flex-1 min-w-0">
        <span className="text-muted-foreground">
          {log.resource}
          {log.resource_id ? ` • ${log.resource_id.slice(0, 8)}` : ""}
        </span>
      </div>
      <span className="shrink-0 text-muted-foreground">
        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

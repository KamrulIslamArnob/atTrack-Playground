"use client";

import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { ActivityLog } from "@/lib/actions/activity-log";
import { formatActivityMessage, ACTION_COLORS } from "@/lib/activity-messages";

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
        <span className="text-muted-foreground">{formatActivityMessage(log)}</span>
      </div>
      <span className="shrink-0 text-muted-foreground">
        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { formatActivityMessage, ACTION_COLORS } from "@/lib/activity-messages";
import { logJobActivity } from "@/lib/actions/jobs";
import type { JobDetailData } from "@/lib/types/job-detail";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivitiesTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function ActivitiesTab({ data, onRefresh }: ActivitiesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setPending(true);
    try {
      await logJobActivity(data.job.id, title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
      setShowForm(false);
      onRefresh();
    } catch {
      toast.error("Could not log activity");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {showForm ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened?" className="h-9" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit} disabled={pending || !title.trim()}>
              {pending && <Spinner className="mr-2" />}
              Log activity
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Log other activity
        </Button>
      )}

      <div className="space-y-3">
        {data.activity.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3">
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", (ACTION_COLORS[entry.action] ?? "bg-muted").split(" ")[0])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{formatActivityMessage(entry)}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        {data.activity.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </div>
    </div>
  );
}

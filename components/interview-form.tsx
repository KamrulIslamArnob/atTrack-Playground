"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Calendar, ExternalLink } from "lucide-react";
import { updateInterview, deleteInterview } from "@/lib/actions/interviews";
import { getCalendarLinkFromInterview } from "@/lib/calendar";
import type { Interview } from "@/lib/actions/interviews";

const interviewTypes = [
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video Call" },
  { value: "onsite", label: "Onsite" },
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "panel", label: "Panel" },
];

const statusOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];

interface InterviewFormProps {
  interview: Interview;
  onClose: () => void;
}

export function InterviewForm({ interview, onClose }: InterviewFormProps) {
  const [pending, setPending] = useState(false);
  const [type, setType] = useState(interview.type ?? "");
  const [status, setStatus] = useState(interview.status);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const scheduledAtRaw = formData.get("scheduled_at") as string;
    const scheduled_at = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;

    await updateInterview(interview.id, {
      scheduled_at,
      type: type || null,
      location: formData.get("location") as string || null,
      meeting_url: formData.get("meeting_url") as string || null,
      interviewer_name: formData.get("interviewer_name") as string || null,
      interviewer_email: formData.get("interviewer_email") as string || null,
      notes: formData.get("notes") as string || null,
      prep_notes: formData.get("prep_notes") as string || null,
      status,
      duration_minutes: formData.get("duration_minutes") as string ? Number(formData.get("duration_minutes")) : null,
    });

    setPending(false);
    onClose();
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this interview?")) return;
    setPending(true);
    await deleteInterview(interview.id);
    setPending(false);
    onClose();
    router.refresh();
  };

  const formatDateTimeLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Interview Details</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {interview.job?.title} — {interview.job?.company?.name}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Date & Time</Label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(interview.scheduled_at)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                name="duration_minutes"
                type="number"
                min={15}
                step={15}
                defaultValue={interview.duration_minutes ?? ""}
                placeholder="e.g. 60"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {interviewTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "scheduled")}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={interview.location ?? ""}
              placeholder="e.g. Office address"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting_url">Meeting URL</Label>
            <Input
              id="meeting_url"
              name="meeting_url"
              type="url"
              defaultValue={interview.meeting_url ?? ""}
              placeholder="https://..."
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interviewer_name">Interviewer Name</Label>
              <Input
                id="interviewer_name"
                name="interviewer_name"
                defaultValue={interview.interviewer_name ?? ""}
                placeholder="e.g. John Smith"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interviewer_email">Interviewer Email</Label>
              <Input
                id="interviewer_email"
                name="interviewer_email"
                type="email"
                defaultValue={interview.interviewer_email ?? ""}
                placeholder="john@company.com"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={interview.notes ?? ""}
              placeholder="Any notes about this interview..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prep_notes">Prep Notes</Label>
            <Textarea
              id="prep_notes"
              name="prep_notes"
              rows={3}
              defaultValue={interview.prep_notes ?? ""}
              placeholder="Topics to prepare, questions to ask..."
            />
          </div>

          {/* Calendar link preview */}
          {interview.scheduled_at && (
            <div className="rounded-2xl border border-border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-2">Calendar event preview</p>
              <a
                href={getCalendarLinkFromInterview({
                  ...interview,
                  type: type || interview.type,
                }) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Calendar className="size-3" />
                Open in Google Calendar
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
              disabled={pending}
            >
              Delete
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Spinner className="mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

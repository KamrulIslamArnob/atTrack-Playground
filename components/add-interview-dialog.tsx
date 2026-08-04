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
import { Plus, X } from "lucide-react";
import { createInterview } from "@/lib/actions/interviews";

export interface PreparingJob {
  id: string;
  title: string;
  company_name: string;
}

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

interface AddInterviewDialogProps {
  jobs: PreparingJob[];
  trigger?: React.ReactNode;
}

export function AddInterviewDialog({ jobs, trigger }: AddInterviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [jobId, setJobId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("scheduled");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jobId) return;
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const scheduledAtRaw = formData.get("scheduled_at") as string;
    const scheduled_at = scheduledAtRaw ? new Date(scheduledAtRaw).toISOString() : null;

    await createInterview({
      job_id: jobId,
      scheduled_at,
      type: type || null,
      location: (formData.get("location") as string) || null,
      meeting_url: (formData.get("meeting_url") as string) || null,
      interviewer_name: (formData.get("interviewer_name") as string) || null,
      interviewer_email: (formData.get("interviewer_email") as string) || null,
      notes: (formData.get("notes") as string) || null,
      prep_notes: (formData.get("prep_notes") as string) || null,
      status,
      duration_minutes: formData.get("duration_minutes")
        ? Number(formData.get("duration_minutes"))
        : null,
    });

    setPending(false);
    setOpen(false);
    setJobId("");
    setType("");
    setStatus("scheduled");
    router.refresh();
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add interview
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-4xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Interview</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="mt-4 rounded-4xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No jobs in &ldquo;Preparing&rdquo; status yet.
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Move a job to Preparing before scheduling an interview for it.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Job *</Label>
                  <Select value={jobId} onValueChange={(v) => setJobId(v ?? "")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} &mdash; {job.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only jobs in &ldquo;Preparing&rdquo; status are eligible for interviews.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled_at">Date & Time</Label>
                    <Input
                      id="scheduled_at"
                      name="scheduled_at"
                      type="datetime-local"
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
                    <Select
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "scheduled")}
                    >
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
                    placeholder="Any notes about this interview..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prep_notes">Prep Notes</Label>
                  <Textarea
                    id="prep_notes"
                    name="prep_notes"
                    rows={3}
                    placeholder="Topics to prepare, questions to ask..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={pending || !jobId}>
                    {pending && <Spinner className="mr-2" />}
                    Add interview
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

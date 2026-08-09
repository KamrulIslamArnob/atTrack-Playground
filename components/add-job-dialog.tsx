"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/lib/actions/jobs";
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
import { Plus, UserRound, X } from "lucide-react";
import type { ExtractionResult } from "@/lib/ai/schema";
import { JobNotesEditor, type JobNote } from "@/components/job-notes-editor";

const employmentTypes = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
  "Internship",
  "Temporary",
  "Apprenticeship",
  "Volunteer",
];

const statusOptions = [
  { value: "saved", label: "Saved" },
  { value: "interested", label: "Interested" },
  { value: "preparing", label: "Preparing" },
];

interface AddJobDialogProps {
  initialData?: ExtractionResult;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Board column to drop the new job into. Omitted => createJob falls back to Wishlist. */
  listId?: string;
}

export function AddJobDialog({ initialData, trigger, open: controlledOpen, onOpenChange, listId }: AddJobDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState<JobNote[]>(
    initialData?.notes?.map((n) => ({
      id: crypto.randomUUID(),
      title: n.title,
      bullets: n.bullets,
    })) ?? []
  );
  const [workLocation, setWorkLocation] = useState(initialData?.work_location ?? "");
  const [employmentType, setEmploymentType] = useState(initialData?.employment_type ?? "Full-time");
  const [status, setStatus] = useState("saved");
  // A recruiter/hiring-manager the AI found in the posting — CRM feed, not a
  // form field. Dismissible so the user can opt out of adding it.
  const [contact, setContact] = useState(initialData?.contact ?? null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.append("notes", JSON.stringify(notes));
    formData.append("work_location", workLocation);
    formData.append("employment_type", employmentType);
    formData.append("status", status);
    if (listId) formData.append("list_id", listId);
    if (contact?.name || contact?.email) {
      if (contact.name) formData.append("contact_name", contact.name);
      if (contact.email) formData.append("contact_email", contact.email);
      if (contact.role) formData.append("contact_role", contact.role);
    }
    const result = await createJob(formData);
    setOpen(false);
    setPending(false);
    setNotes([]);
    setWorkLocation("");
    setEmploymentType("Full-time");
    setStatus("saved");
    setContact(null);
    // Opened from the board: stay on the board instead of navigating away.
    if (result?.jobId && !listId) {
      router.push("/jobs/" + result.jobId);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : controlledOpen === undefined ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add Job
        </Button>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Job title *</Label>
                <Input id="title" name="title" required placeholder="e.g. Senior Frontend Engineer" defaultValue={initialData?.title ?? ""} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input id="company" name="company" required placeholder="e.g. Acme Technologies" defaultValue={initialData?.company ?? ""} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application_url">Job URL</Label>
                <Input id="application_url" name="application_url" type="url" placeholder="https://..." defaultValue={initialData?.application_url ?? ""} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="application_email">Application email</Label>
                  <Input id="application_email" name="application_email" type="email" placeholder="careers@example.com" defaultValue={initialData?.application_email ?? ""} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="application_process">Application instructions</Label>
                  <Input id="application_process" name="application_process" placeholder="e.g. Send resume with subject..." defaultValue={initialData?.application_process ?? ""} className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" placeholder="e.g. San Francisco, CA" defaultValue={initialData?.location ?? ""} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_range">Salary range</Label>
                  <Input id="salary_range" name="salary_range" placeholder="e.g. $150k - $200k" defaultValue={initialData?.salary_range ?? ""} className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment type</Label>
                  <Select value={employmentType} onValueChange={(v) => setEmploymentType(v ?? "Full-time")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {employmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_location">Work location</Label>
                  <Select value={workLocation} onValueChange={(v) => setWorkLocation(v ?? "")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? "saved")}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" name="deadline" type="date" defaultValue={initialData?.deadline ?? ""} className="h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input id="source" name="source" placeholder="e.g. LinkedIn" defaultValue={initialData?.source ?? ""} className="h-10" />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Paste the full job posting here..."
                  defaultValue={initialData?.description ?? ""}
                />
              </div>

              {contact && (contact.name || contact.email) && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">
                    Found a contact: <span className="font-medium text-foreground">{contact.name ?? contact.email}</span>
                    {contact.name && contact.email ? ` (${contact.email})` : null} — saved to your CRM
                  </span>
                  <button
                    type="button"
                    onClick={() => setContact(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <JobNotesEditor notes={notes} onChange={setNotes} />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Spinner className="mr-2" /> : null}
                  Save job
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

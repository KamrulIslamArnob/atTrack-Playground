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
import { Plus, X, Trash2 } from "lucide-react";
import type { ExtractionResult } from "@/lib/ai/schema";

interface JobNote {
  id: string;
  title: string;
  bullets: string[];
}

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
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

interface AddJobDialogProps {
  initialData?: ExtractionResult;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddJobDialog({ initialData, trigger, open: controlledOpen, onOpenChange }: AddJobDialogProps) {
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
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBullets, setNoteBullets] = useState<string[]>([""]);
  const [workLocation, setWorkLocation] = useState(initialData?.work_location ?? "");
  const [employmentType, setEmploymentType] = useState(initialData?.employment_type ?? "Full-time");
  const [status, setStatus] = useState("saved");
  const router = useRouter();

  const addNote = () => {
    if (!noteTitle.trim()) return;
    const filteredBullets = noteBullets.filter((b) => b.trim());
    setNotes([
      ...notes,
      {
        id: crypto.randomUUID(),
        title: noteTitle.trim(),
        bullets: filteredBullets,
      },
    ]);
    setNoteTitle("");
    setNoteBullets([""]);
    setShowNoteForm(false);
  };

  const removeNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
  };

  const addBullet = () => {
    setNoteBullets([...noteBullets, ""]);
  };

  const updateBullet = (index: number, value: string) => {
    const updated = [...noteBullets];
    updated[index] = value;
    setNoteBullets(updated);
  };

  const removeBullet = (index: number) => {
    if (noteBullets.length <= 1) return;
    setNoteBullets(noteBullets.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.append("notes", JSON.stringify(notes));
    formData.append("work_location", workLocation);
    formData.append("employment_type", employmentType);
    formData.append("status", status);
    const result = await createJob(formData);
    setOpen(false);
    setPending(false);
    setNotes([]);
    setWorkLocation("");
    setEmploymentType("Full-time");
    setStatus("saved");
    if (result?.jobId) {
      router.push("/jobs/" + result.jobId);
    } else {
      router.refresh();
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" />
          Add Job
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-4xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  <Label htmlFor="application_process">How to apply</Label>
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
                <Label htmlFor="description">Job description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Paste the job description here..."
                  defaultValue={initialData?.description ?? ""}
                />
              </div>

              {/* Notes section */}
              <div className="space-y-2">
                <Label>Notes</Label>
                {notes.length > 0 && (
                  <div className="space-y-2">
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-4xl border border-border bg-muted/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{note.title}</p>
                            {note.bullets.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {note.bullets.map((bullet, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground" />
                                    {bullet}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeNote(note.id)}
                            className="flex size-6 shrink-0 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showNoteForm ? (
                  <div className="space-y-3 rounded-4xl border border-border p-3">
                    <Input
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Title (e.g. Backend Integration)"
                      className="h-9"
                    />
                    <div className="space-y-2">
                      {noteBullets.map((bullet, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                          <Input
                            value={bullet}
                            onChange={(e) => updateBullet(index, e.target.value)}
                            placeholder="Add a bullet point..."
                            className="h-8"
                          />
                          {noteBullets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBullet(index)}
                              className="flex size-6 shrink-0 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={addBullet}>
                      <Plus className="mr-1 size-3" />
                      Add bullet
                    </Button>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNoteForm(false); setNoteTitle(""); setNoteBullets([""]); }}>
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={addNote} disabled={!noteTitle.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowNoteForm(true)}
                  >
                    <Plus className="mr-1 size-4" />
                    Add note
                  </Button>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? <Spinner className="mr-2" /> : null}
                  Save Job
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

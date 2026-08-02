"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Plus, X, Trash2 } from "lucide-react";

interface JobNote {
  id: string;
  title: string;
  description: string;
}

export function AddJobDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const router = useRouter();

  const addNote = () => {
    if (!noteTitle.trim()) return;
    setNotes([
      ...notes,
      {
        id: crypto.randomUUID(),
        title: noteTitle.trim(),
        description: noteDescription.trim(),
      },
    ]);
    setNoteTitle("");
    setNoteDescription("");
    setShowNoteForm(false);
  };

  const removeNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.append("notes", JSON.stringify(notes));
    await createJob(formData);
    setOpen(false);
    setPending(false);
    setNotes([]);
    router.refresh();
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" />
        Add Job
      </Button>

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
                <Input id="title" name="title" required placeholder="e.g. Senior Frontend Engineer" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input id="company" name="company" required placeholder="e.g. Acme Technologies" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application_url">Job URL</Label>
                <Input id="application_url" name="application_url" type="url" placeholder="https://..." className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" name="location" placeholder="e.g. San Francisco, CA" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary_range">Salary range</Label>
                  <Input id="salary_range" name="salary_range" placeholder="e.g. $150k - $200k" className="h-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment_type">Employment type</Label>
                  <Input id="employment_type" name="employment_type" placeholder="e.g. Full-time" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Input id="source" name="source" placeholder="e.g. LinkedIn" className="h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" name="deadline" type="date" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Job description</Label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  className="flex w-full rounded-4xl border border-border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Paste the job description here..."
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
                            {note.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{note.description}</p>
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
                  <div className="space-y-2 rounded-4xl border border-border p-3">
                    <Input
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Title (e.g. Backend Integration)"
                      className="h-9"
                    />
                    <textarea
                      value={noteDescription}
                      onChange={(e) => setNoteDescription(e.target.value)}
                      rows={2}
                      className="flex w-full rounded-4xl border border-border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Description (optional)"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNoteForm(false); setNoteTitle(""); setNoteDescription(""); }}>
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

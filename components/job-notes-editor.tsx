"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { XIcon } from "@/components/ui/x";

export interface JobNote {
  id: string;
  title: string;
  bullets: string[];
}

interface JobNotesEditorProps {
  notes: JobNote[];
  onChange: (notes: JobNote[]) => void;
  label?: string;
}

/**
 * Shared note-add UI: title + bullet list. Used by AddJobDialog, EditJobDialog,
 * and the job-detail-sheet Notes tab — extracted so all three edit the same
 * `jobs.notes` JSON shape through one implementation.
 */
export function JobNotesEditor({ notes, onChange, label = "Notes" }: JobNotesEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState<string[]>([""]);

  const resetForm = () => {
    setTitle("");
    setBullets([""]);
  };

  const addNote = () => {
    if (!title.trim()) return;
    onChange([
      ...notes,
      { id: crypto.randomUUID(), title: title.trim(), bullets: bullets.filter((b) => b.trim()) },
    ]);
    resetForm();
    setShowForm(false);
  };

  const removeNote = (id: string) => onChange(notes.filter((n) => n.id !== id));

  const startEdit = (note: JobNote) => {
    setShowForm(false);
    setEditingId(note.id);
    setTitle(note.title);
    setBullets(note.bullets.length > 0 ? note.bullets : [""]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const saveEdit = () => {
    if (!title.trim() || !editingId) return;
    onChange(
      notes.map((n) =>
        n.id === editingId
          ? { ...n, title: title.trim(), bullets: bullets.filter((b) => b.trim()) }
          : n
      )
    );
    setEditingId(null);
    resetForm();
  };

  const addBullet = () => setBullets([...bullets, ""]);
  const updateBullet = (index: number, value: string) => {
    const updated = [...bullets];
    updated[index] = value;
    setBullets(updated);
  };
  const removeBullet = (index: number) => {
    if (bullets.length <= 1) return;
    setBullets(bullets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) =>
            editingId === note.id ? (
              <div key={note.id} className="space-y-3 rounded-2xl border border-border p-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title (e.g. Backend Integration)"
                  className="h-9"
                />
                <div className="space-y-2">
                  {bullets.map((bullet, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <Input
                        value={bullet}
                        onChange={(e) => updateBullet(index, e.target.value)}
                        placeholder="Add a bullet point..."
                        className="h-8"
                      />
                      {bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBullet(index)}
                          className="flex size-6 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <XIcon className="size-3" />
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
                  <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={saveEdit} disabled={!title.trim()}>
                    Save changes
                  </Button>
                </div>
              </div>
            ) : (
              <div key={note.id} className="rounded-2xl border border-border bg-muted/50 p-3">
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
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="flex size-6 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNote(note.id)}
                      className="flex size-6 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {showForm && !editingId ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Backend Integration)"
            className="h-9"
          />
          <div className="space-y-2">
            {bullets.map((bullet, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <Input
                  value={bullet}
                  onChange={(e) => updateBullet(index, e.target.value)}
                  placeholder="Add a bullet point..."
                  className="h-8"
                />
                {bullets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBullet(index)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <XIcon className="size-3" />
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setTitle("");
                setBullets([""]);
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={addNote} disabled={!title.trim()}>
              Add
            </Button>
          </div>
        </div>
      ) : !editingId ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Add note
        </Button>
      ) : null}
    </div>
  );
}

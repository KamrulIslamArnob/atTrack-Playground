"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JobNotesEditor, type JobNote } from "@/components/job-notes-editor";
import { setJobNotes } from "@/lib/actions/jobs";
import type { JobDetailData } from "@/lib/types/job-detail";

interface NotesTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function NotesTab({ data, onRefresh }: NotesTabProps) {
  const [notes, setNotes] = useState<JobNote[]>(
    (data.job.notes ?? []).map((n) => ({ id: crypto.randomUUID(), title: n.title, bullets: n.bullets }))
  );
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify(notes.map((n) => ({ title: n.title, bullets: n.bullets }))) !==
    JSON.stringify(data.job.notes ?? []);

  const handleSave = async () => {
    setPending(true);
    try {
      await setJobNotes(
        data.job.id,
        notes.map((n) => ({ title: n.title, bullets: n.bullets }))
      );
      onRefresh();
      toast.success("Notes saved");
    } catch {
      toast.error("Couldn't save notes");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <JobNotesEditor notes={notes} onChange={setNotes} />
      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={pending}>
            {pending && <Spinner className="mr-2" />}
            Save notes
          </Button>
        </div>
      )}
    </div>
  );
}

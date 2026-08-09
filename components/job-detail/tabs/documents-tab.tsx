"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentsUpload } from "@/components/documents-upload";
import { setJobResume, setJobProjectLinks } from "@/lib/actions/jobs";
import { getDocuments, linkDocument, unlinkDocument, type Document } from "@/lib/actions/documents";
import type { ProjectLink } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { FileText, Link2, Plus, Trash2, Upload, X } from "lucide-react";

interface DocumentsTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function DocumentsTab({ data, onRefresh }: DocumentsTabProps) {
  const { job, documents, resumeOptions } = data;
  const [resumePending, setResumePending] = useState(false);
  const [links, setLinks] = useState<ProjectLink[]>(job.project_links ?? []);
  const [linksPending, setLinksPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<Document[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const linksDirty = JSON.stringify(links) !== JSON.stringify(job.project_links ?? []);

  const handleResumeChange = async (value: string | null) => {
    setResumePending(true);
    try {
      await setJobResume(job.id, value === "__none__" ? null : value);
      onRefresh();
    } catch {
      toast.error("Could not update resume");
    } finally {
      setResumePending(false);
    }
  };

  const handleSaveLinks = async () => {
    setLinksPending(true);
    try {
      await setJobProjectLinks(job.id, links);
      onRefresh();
      toast.success("Project links saved");
    } catch {
      toast.error("Could not save project links");
    } finally {
      setLinksPending(false);
    }
  };

  const openPicker = async () => {
    setPicking(true);
    const all = await getDocuments();
    setLibrary(all);
  };

  const handleLink = async (documentId: string) => {
    try {
      await linkDocument(job.id, documentId);
      setPicking(false);
      onRefresh();
    } catch {
      toast.error("Could not link document");
    }
  };

  const handleUnlink = async (documentId: string) => {
    try {
      await unlinkDocument(job.id, documentId);
      onRefresh();
    } catch {
      toast.error("Could not remove document");
    }
  };

  const linkedIds = new Set(documents.map((d) => d.id));
  const pickable = (library ?? []).filter((d) => !linkedIds.has(d.id));

  return (
    <div className="space-y-6">
      {/* Resume picker */}
      <div>
        <Label>Resume</Label>
        <Select value={job.resume_id ?? "__none__"} onValueChange={(v) => handleResumeChange(v ?? "__none__")}>
          <SelectTrigger className="mt-2 h-10 w-full" disabled={resumePending}>
            <SelectValue placeholder="No resume attached">{job.resume_name ?? undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No resume attached</SelectItem>
            {resumeOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Picking a resume re-scores this job&apos;s match against it.
        </p>
      </div>

      {/* Project links */}
      <div>
        <div className="flex items-center justify-between">
          <Label>Project links</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLinks([...links, { id: crypto.randomUUID(), label: "", url: "" }])}
          >
            <Plus className="mr-1 size-3.5" />
            Add link
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {links.map((link, i) => (
            <div key={link.id} className="flex items-center gap-2">
              <Input
                value={link.label}
                onChange={(e) => {
                  const updated = [...links];
                  updated[i] = { ...link, label: e.target.value };
                  setLinks(updated);
                }}
                placeholder="Label (e.g. Portfolio)"
                className="h-9 w-1/3"
              />
              <Input
                value={link.url}
                onChange={(e) => {
                  const updated = [...links];
                  updated[i] = { ...link, url: e.target.value };
                  setLinks(updated);
                }}
                placeholder="https://..."
                className="h-9 flex-1"
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                className="flex size-8 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {links.length === 0 && (
            <p className="text-xs text-muted-foreground">No project links yet.</p>
          )}
        </div>
        {linksDirty && (
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleSaveLinks} disabled={linksPending}>
              {linksPending && <Spinner className="mr-2" />}
              Save links
            </Button>
          </div>
        )}
      </div>

      {/* Linked documents */}
      <div>
        <div className="flex items-center justify-between">
          <Label>Documents</Label>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={openPicker}>
              <Link2 className="mr-1 size-3.5" />
              Link document
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1 size-3.5" />
              Upload
            </Button>
          </div>
        </div>

        {picking && (
          <div className="mt-2 rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Pick a document to link</p>
              <button onClick={() => setPicking(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
            {library === null ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : pickable.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nothing left to link — upload a new document instead.
              </p>
            ) : (
              <div className="space-y-1">
                {pickable.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleLink(d.id)}
                    className="flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-2xl border border-border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  {doc.generated_kind && (
                    <p className="text-xs text-muted-foreground">{doc.generated_kind.replace(/_/g, " ")}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleUnlink(doc.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-xs text-muted-foreground">No documents linked to this job yet.</p>
          )}
        </div>
      </div>

      <DocumentsUpload open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

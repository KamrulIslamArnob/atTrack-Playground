"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DocumentsUpload } from "@/components/documents-upload";
import { setJobProjectLinks } from "@/lib/actions/jobs";
import { getDocuments, linkDocument, unlinkDocument, type Document } from "@/lib/actions/documents";
import type { ProjectLink } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { FileText, Trash2 } from "lucide-react";
import { Link2Icon } from "@/components/ui/link-2";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { UploadIcon } from "@/components/ui/upload";
import { XIcon } from "@/components/ui/x";

interface DocumentsTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function DocumentsTab({ data, onRefresh }: DocumentsTabProps) {
  const { job, documents } = data;
  const [links, setLinks] = useState<ProjectLink[]>(job.project_links ?? []);
  const [linksPending, setLinksPending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<Document[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const linksDirty = JSON.stringify(links) !== JSON.stringify(job.project_links ?? []);

  const handleSaveLinks = async () => {
    setLinksPending(true);
    try {
      await setJobProjectLinks(job.id, links);
      onRefresh();
      toast.success("Project links saved");
    } catch {
      toast.error("Couldn't save project links");
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
      toast.error("Couldn't link document");
    }
  };

  const handleUnlink = async (documentId: string) => {
    try {
      await unlinkDocument(job.id, documentId);
      onRefresh();
    } catch {
      toast.error("Couldn't remove document");
    }
  };

  const linkedIds = new Set(documents.map((d) => d.id));
  const pickable = (library ?? []).filter((d) => !linkedIds.has(d.id));

  return (
    <div className="space-y-6">
      {/* The resume selector and the fit score live in the Overview rail —
          this tab is the asset list only, so the score renders exactly once. */}

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
            <PlusIcon className="mr-1 size-3.5" />
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
              <Link2Icon className="mr-1 size-3.5" />
              Link document
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <UploadIcon className="mr-1 size-3.5" />
              Upload
            </Button>
          </div>
        </div>

        {picking && (
          <div className="mt-2 rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Pick a document to link</p>
              <button onClick={() => setPicking(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-3.5" />
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

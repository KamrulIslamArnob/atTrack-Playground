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
import { setJobResume, setJobProjectLinks, checkJobResumeScore } from "@/lib/actions/jobs";
import { getDocuments, linkDocument, unlinkDocument, type Document } from "@/lib/actions/documents";
import type { ProjectLink } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { FileText, Link2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";

import { matchScoreBand } from "@/lib/types/board";
import { cn } from "@/lib/utils";

interface DocumentsTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

export function DocumentsTab({ data, onRefresh }: DocumentsTabProps) {
  const { job, documents, resumeOptions } = data;
  const [resumePending, setResumePending] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
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

  const handleCheckScore = async () => {
    if (!job.resume_id) {
      toast.error("Please attach a resume first.");
      return;
    }
    setIsScoring(true);
    try {
      const res = await checkJobResumeScore(job.id, job.resume_id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Resume scored: ${Math.round(res.score)}% match score!`);
        onRefresh();
      }
    } catch {
      toast.error("Failed to check resume score.");
    } finally {
      setIsScoring(false);
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
      {/* Resume Section */}
      <div className="space-y-3.5 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary shrink-0" />
            <Label className="text-sm font-semibold">Resume</Label>
          </div>
          {job.resume_id && job.match_score != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs border",
                matchScoreBand(job.match_score)?.className
              )}
            >
              <Sparkles className="size-3" />
              <span>{Math.round(job.match_score)}% Match</span>
              <span className="font-medium text-[10px] uppercase opacity-80">• {matchScoreBand(job.match_score)?.label} Fit</span>
            </span>
          )}
        </div>

        {/* Dropdown & Check Button */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Select value={job.resume_id ?? "__none__"} onValueChange={(v) => handleResumeChange(v ?? "__none__")}>
            <SelectTrigger className="h-10 flex-1 bg-background" disabled={resumePending || isScoring}>
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

          {job.resume_id && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 gap-1.5 font-medium border-border/80 hover:bg-muted"
              onClick={handleCheckScore}
              disabled={isScoring || resumePending}
            >
              {isScoring ? (
                <>
                  <Spinner className="size-3.5" />
                  <span>Scoring...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-lime-500" />
                  <span>{job.match_score != null ? "Re-check Score" : "Check Match Score"}</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Score & Reasoning Card */}
        {job.resume_id && job.match_score != null ? (
          <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/30 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-lime-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  AI Fit Score: <span className="text-lime-600 dark:text-lime-400 font-bold">{Math.round(job.match_score)}%</span>
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">({matchScoreBand(job.match_score)?.label} Fit)</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full overflow-hidden rounded-full bg-muted/70 h-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  job.match_score >= 80
                    ? "bg-lime-500"
                    : job.match_score >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, job.match_score))}%` }}
              />
            </div>

            {/* Reasoning Box */}
            {job.match_reasoning && (
              <p className="text-xs leading-relaxed text-foreground/90 pt-1 border-t border-border/30">
                {job.match_reasoning}
              </p>
            )}
          </div>
        ) : job.resume_id ? (
          <div className="rounded-xl border border-dashed border-border/70 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Not scored yet. Click <span className="font-semibold text-foreground">"Check Match Score"</span> above for instant analysis, or background AI will score it automatically when idle.
            </p>
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground">
          Click button to score immediately against full job info. If not clicked, background AI will score it once when idle.
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

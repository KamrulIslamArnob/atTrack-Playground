"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDocumentPreview, type DocumentPreviewResult } from "@/lib/actions/documents";
import { ResumePreview } from "@/lib/resume/render-html";
import {
  FileText,
  Mail,
  Briefcase,
  ExternalLink,
  Code2,
} from "lucide-react";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { DownloadIcon } from "@/components/ui/download";
import { SparklesIcon } from "@/components/ui/sparkles";
import { Link2Icon } from "@/components/ui/link-2";
import { XIcon } from "@/components/ui/x";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    ),
  }
);

interface DocumentQuickViewDialogProps {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentQuickViewDialog({
  documentId,
  open,
  onOpenChange,
}: DocumentQuickViewDialogProps) {
  const [data, setData] = useState<DocumentPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!open || !documentId) {
      setData(null);
      return;
    }

    let active = true;
    setLoading(true);

    getDocumentPreview(documentId)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load document preview:", err);
          toast.error("Couldn't load document preview");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, documentId]);

  const doc = data?.document;
  const job = data?.job;
  const pdfUrl = data?.pdfUrl;

  const isExternal = doc?.generated_kind === "external_link";
  const isBuilder = Boolean(doc?.builder_data);
  const isText =
    Boolean(doc?.content && doc.content.trim().length > 0) ||
    Boolean(doc?.file_path && doc.file_path.startsWith("generated/")) ||
    doc?.generated_kind != null;

  const kind = doc?.generated_kind ?? (doc?.type === "cover_letter" ? "cover_letter" : "other");
  const isCoverLetter = kind === "cover_letter" || doc?.type === "cover_letter";
  const isEmailType =
    kind === "follow_up_application" ||
    kind === "follow_up_interview" ||
    kind === "reschedule_interview" ||
    kind === "offer_negotiation" ||
    kind === "offer_acceptance" ||
    kind === "offer_decline" ||
    kind === "offer_time_extension";

  // Parse subject line if text document is formatted as "Subject: ... \n\n ..."
  let subject = "";
  let body = doc?.content ?? "";

  if (body.startsWith("Subject:")) {
    const doubleNewlineIdx = body.indexOf("\n\n");
    if (doubleNewlineIdx !== -1) {
      subject = body.slice("Subject:".length, doubleNewlineIdx).trim();
      body = body.slice(doubleNewlineIdx + 2).trim();
    }
  }

  const handleCopySubject = () => {
    if (!subject) return;
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    toast.success("Subject copied to clipboard");
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    if (!body) return;
    navigator.clipboard.writeText(body);
    setCopiedBody(true);
    toast.success("Body content copied to clipboard");
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyAll = () => {
    if (!doc?.content) return;
    navigator.clipboard.writeText(doc.content);
    setCopiedAll(true);
    toast.success("Full document copied to clipboard");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!doc?.content) return;
    const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.name || "document").replace(/[^a-zA-Z0-9.-]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as text file");
  };

  const fullViewHref = isExternal
    ? doc?.file_path ?? "#"
    : isBuilder
      ? `/documents/builder/${doc?.id}`
      : `/documents/${doc?.id}`;

  const generatedLabel = doc?.generated_kind
    ? doc.generated_kind.replace(/_/g, " ")
    : doc?.type === "cover_letter"
      ? "Cover Letter"
      : doc?.type === "resume"
        ? "Resume"
        : "Document";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-3xl max-w-4xl w-full max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-2xl"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              {isExternal ? (
                <Link2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : doc?.generated_kind === "latex_raw" ? (
                <Code2 className="size-4 text-amber-600 dark:text-amber-400" />
              ) : doc?.generated_kind ? (
                <SparklesIcon className="size-4 text-purple-500" />
              ) : (
                <FileText className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-semibold text-foreground">
                {loading ? "Loading document..." : doc?.name || "Document Preview"}
              </DialogTitle>
              {doc && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                  <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0 h-4.5 font-medium">
                    {generatedLabel}
                  </Badge>
                  {doc.is_default && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5 text-lime-600 border-lime-500/30 dark:text-lime-400">
                      Default
                    </Badge>
                  )}
                  {job && (
                    <span className="flex items-center gap-1 truncate text-xs">
                      <Briefcase className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        For {job.title} {job.company_name ? `at ${job.company_name}` : ""}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {doc && !loading && (
              <TooltipProvider delay={100}>
                {isText && (
                  <>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        onClick={handleCopyAll}
                        className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Copy full text"
                      >
                        {copiedAll ? <CheckIcon className="size-4 text-emerald-500" /> : <CopyIcon className="size-4" />}
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy Full Text</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        onClick={handleDownloadTxt}
                        className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Download as text file"
                      >
                        <DownloadIcon className="size-4" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Download .txt</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Open full page in new tab */}
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    onClick={() => {
                      if (isExternal) {
                        window.open(doc.file_path, "_blank", "noopener,noreferrer");
                      } else {
                        window.open(fullViewHref, "_blank");
                      }
                    }}
                    className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Open full document"
                  >
                    <ExternalLink className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Open in Resume/CV</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Spinner className="size-7" />
              <p className="text-xs text-muted-foreground">Loading preview...</p>
            </div>
          ) : !doc ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="size-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-foreground">Document not found</p>
              <p className="text-xs text-muted-foreground mt-1">This document may have been deleted or moved.</p>
            </div>
          ) : isBuilder && doc.builder_data ? (
            /* Resume Builder Document */
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <SparklesIcon className="size-4 shrink-0" />
                  <span>Editable resume format from Resume Builder</span>
                </div>
                <Link
                  href={`/documents/builder/${doc.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Open Editor <ExternalLink className="size-3" />
                </Link>
              </div>
              <div className="overflow-x-auto flex justify-center py-2 bg-muted/20 rounded-xl border border-border/50">
                <div className="scale-[0.85] origin-top sm:scale-90 md:scale-95 transition-transform">
                  <ResumePreview document={doc.builder_data} />
                </div>
              </div>
            </div>
          ) : isExternal ? (
            /* External Link Document */
            <div className="rounded-xl border border-border bg-muted/20 p-6 text-center space-y-4">
              <div className="flex size-12 mx-auto items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Link2Icon className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{doc.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all max-w-md mx-auto">
                  {doc.file_path}
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => window.open(doc.file_path, "_blank", "noopener,noreferrer")}
                className="gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                Open External Document
              </Button>
            </div>
          ) : isText ? (
            /* Purpose-driven Text Document Rendering */
            <div className="space-y-4">
              {isCoverLetter ? (
                /* Formal Cover Letter Paper View */
                <div className="rounded-2xl border border-border/80 bg-background p-5 sm:p-8 shadow-xs space-y-5 text-foreground font-sans select-text">
                  <div className="flex items-start justify-between border-b border-border/60 pb-4">
                    <div>
                      <h4 className="font-heading text-base font-bold text-foreground">Applicant / Candidate</h4>
                      <p className="text-xs text-muted-foreground">Application Letter</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span>{new Date(doc.created_at || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                  </div>

                  {job && (
                    <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/20 p-3 rounded-xl border border-border/50">
                      <p className="font-semibold text-foreground">{job.company_name || "Hiring Organization"}</p>
                      <p>Hiring Team · Position: {job.title}</p>
                    </div>
                  )}

                  {subject && (
                    <div className="text-xs font-bold text-foreground border-l-2 border-primary pl-2.5 py-0.5">
                      RE: {subject}
                    </div>
                  )}

                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-normal space-y-3">
                    {body || <span className="text-muted-foreground italic">No content.</span>}
                  </div>

                  <div className="border-t border-border/50 pt-4 mt-6 space-y-1">
                    <p className="text-xs text-foreground">Sincerely,</p>
                    <p className="text-xs font-semibold text-foreground pt-2">Applicant</p>
                  </div>
                </div>
              ) : isEmailType ? (
                /* Modern Email Client View */
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
                    {subject && (
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Subject
                          </span>
                          <span className="font-semibold text-xs text-foreground truncate select-text">
                            {subject}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopySubject}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 ml-2 cursor-pointer transition-colors"
                        >
                          {copiedSubject ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                          <span>{copiedSubject ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>From: You (Applicant)</span>
                      <span>To: {job?.company_name ? `${job.company_name} Team` : "Recruiter"}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4 sm:p-5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Mail className="size-3 text-cyan-500" />
                        Message Body
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyBody}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedBody ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                        <span>{copiedBody ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 select-text font-sans">
                      {body}
                    </div>
                  </div>
                </div>
              ) : (
                /* General Document / Note View */
                <div className="rounded-xl border border-border bg-background p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <FileText className="size-3 text-indigo-500" />
                      Document Content
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBody}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedBody ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                      <span>{copiedBody ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 select-text">
                    {body || <span className="text-muted-foreground italic">No text content in this document.</span>}
                  </div>
                </div>
              )}
            </div>
          ) : pdfUrl ? (
            /* Uploaded PDF Document */
            <div className="space-y-4">
              <PdfViewer url={pdfUrl} fileName={doc.name} />
            </div>
          ) : (
            /* Fallback */
            <div className="rounded-xl border border-border bg-muted/20 p-6 text-center space-y-3">
              <FileText className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">{doc.name}</p>
              <p className="text-xs text-muted-foreground">Preview not directly available for this document format.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(fullViewHref, "_blank")}
                className="gap-1.5 mt-2"
              >
                <ExternalLink className="size-3.5" />
                Open Full Document
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

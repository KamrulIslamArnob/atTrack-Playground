"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Document, LinkedJobInfo } from "@/lib/actions/documents";
import { updateDocumentContent } from "@/lib/actions/documents";
import { aiToolLabel } from "@/lib/types/ai-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Printer,
  Pencil,
  Save,
  Briefcase,
  Mail,
  Eye,
  Code2,
  Calendar,
  Building2,
  User,
  Check,
  Copy,
  Download,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TextDocumentViewerProps {
  doc: Document;
  job: LinkedJobInfo | null;
}

type ViewMode = "purpose" | "raw" | "edit";

export function TextDocumentViewer({ doc, job }: TextDocumentViewerProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("purpose");
  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content ?? "");
  const [saving, setSaving] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Determine kind and purpose
  const kind = doc.generated_kind ?? (doc.type === "cover_letter" ? "cover_letter" : "other");
  const isCoverLetter = kind === "cover_letter" || doc.type === "cover_letter";
  const isEmailType =
    kind === "follow_up_application" ||
    kind === "follow_up_interview" ||
    kind === "reschedule_interview" ||
    kind === "offer_negotiation" ||
    kind === "offer_acceptance" ||
    kind === "offer_decline" ||
    kind === "offer_time_extension";

  // Parse subject and body
  const { subject, body } = useMemo(() => {
    let s = "";
    let b = content;
    if (content.startsWith("Subject:")) {
      const doubleNewlineIdx = content.indexOf("\n\n");
      if (doubleNewlineIdx !== -1) {
        s = content.slice("Subject:".length, doubleNewlineIdx).trim();
        b = content.slice(doubleNewlineIdx + 2).trim();
      }
    }
    return { subject: s, body: b };
  }, [content]);

  const wordCount = useMemo(() => {
    const text = body.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [body]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Document name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateDocumentContent(doc.id, name.trim(), content);
      setViewMode("purpose");
      toast.success("Document updated successfully");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleCopySubject = () => {
    if (!subject) return;
    navigator.clipboard.writeText(subject);
    setCopiedSubject(true);
    toast.success("Subject copied to clipboard");
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(body);
    setCopiedBody(true);
    toast.success("Body content copied to clipboard");
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopiedAll(true);
    toast.success("Full document copied to clipboard");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-zA-Z0-9.-]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as text file");
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const generatedLabel = aiToolLabel(kind);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Toolbar Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            {viewMode === "edit" ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-heading text-lg font-semibold h-10 max-w-md"
                placeholder="Document title"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                  {name}
                </h2>
                <Badge variant="secondary" className="capitalize text-xs gap-1">
                  <Sparkles className="size-3 text-primary" />
                  {generatedLabel}
                </Badge>
              </div>
            )}

            {job && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
                <span>Job target:</span>
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {job.title} {job.company_name ? `at ${job.company_name}` : ""}
                  <ExternalLink className="size-3 opacity-70" />
                </Link>
              </div>
            )}
          </div>

          {/* Actions & View Modes */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {viewMode === "edit" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("purpose")}
                  disabled={saving}
                  className="cursor-pointer"
                >
                  <X className="mr-1.5 size-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="cursor-pointer font-semibold">
                  {saving ? <Spinner className="mr-1.5" /> : <Save className="mr-1.5 size-3.5" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                {/* View Switcher */}
                <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("purpose")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                      viewMode === "purpose"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Eye className="size-3" />
                    <span>Formatted</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("raw")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                      viewMode === "raw"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Code2 className="size-3" />
                    <span>Plain</span>
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode("edit")}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <Pencil className="mr-1.5 size-3.5 text-muted-foreground" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTxt}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <Download className="mr-1.5 size-3.5 text-muted-foreground" />
                  .txt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPdf}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  <Printer className="mr-1.5 size-3.5 text-muted-foreground" />
                  Print / PDF
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCopyAll}
                  className="rounded-xl text-xs cursor-pointer font-semibold"
                >
                  {copiedAll ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                  {copiedAll ? "Copied" : "Copy Text"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Views */}
        {viewMode === "edit" ? (
          /* Editor Mode */
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-semibold text-muted-foreground">Document Content (Markdown / Plain Text)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              className="font-mono text-sm leading-relaxed rounded-xl"
              placeholder="Write or edit document text..."
            />
          </div>
        ) : viewMode === "raw" ? (
          /* Raw Plain Text Mode */
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/50 pb-2">
              <span>Plain text format · {wordCount} words</span>
              <button
                type="button"
                onClick={handleCopyAll}
                className="hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                {copiedAll ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                <span>{copiedAll ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/70 select-text overflow-x-auto">
              {content}
            </pre>
          </div>
        ) : isCoverLetter ? (
          /* Formal Cover Letter Paper View */
          <div className="pt-2">
            <div className="rounded-2xl border border-border/80 bg-background p-6 sm:p-12 shadow-sm space-y-6 text-foreground font-sans print:border-none print:shadow-none print:p-0 select-text">
              {/* Letterhead Header */}
              <div className="flex items-start justify-between border-b border-border/60 pb-6">
                <div>
                  <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                    Applicant / Candidate
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Application Letter</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 justify-end font-medium text-foreground">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>{new Date(doc.created_at || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                  </div>
                </div>
              </div>

              {/* Recipient Details */}
              {job && (
                <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/20 p-3 rounded-xl border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 block">
                    Recipient
                  </span>
                  <p className="font-semibold text-foreground">{job.company_name || "Hiring Organization"}</p>
                  <p>Hiring Committee / Recruitment Team</p>
                  <p className="font-medium text-primary">Position: {job.title}</p>
                </div>
              )}

              {/* Subject (if present) */}
              {subject && (
                <div className="text-xs font-bold text-foreground border-l-2 border-primary pl-3 py-0.5">
                  RE: {subject}
                </div>
              )}

              {/* Letter Body */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-normal space-y-4">
                {body}
              </div>

              {/* Letter Sign-off Footer */}
              <div className="border-t border-border/50 pt-6 mt-8 space-y-1">
                <p className="text-sm text-foreground">Sincerely,</p>
                <p className="text-sm font-semibold text-foreground pt-3">Applicant</p>
              </div>
            </div>
          </div>
        ) : isEmailType ? (
          /* Email Message View */
          <div className="pt-2 space-y-4">
            {/* Email Metadata Card */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
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
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                  >
                    {copiedSubject ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span>{copiedSubject ? "Copied" : "Copy Subject"}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <User className="size-3.5 text-muted-foreground shrink-0" />
                  <span>From: You (Applicant)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground shrink-0" />
                  <span>To: {job?.company_name ? `${job.company_name} Team` : "Recruitment Contact"}</span>
                </div>
              </div>
            </div>

            {/* Email Body Container */}
            <div className="rounded-2xl border border-border bg-background p-5 sm:p-6 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    ✉
                  </div>
                  <span className="text-xs font-semibold text-foreground">Message Body</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBody}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  {copiedBody ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  <span>{copiedBody ? "Copied" : "Copy Body"}</span>
                </button>
              </div>

              <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 select-text font-sans">
                {body}
              </div>
            </div>
          </div>
        ) : (
          /* General Document / Note View */
          <div className="pt-2 space-y-4">
            <div className="rounded-2xl border border-border bg-background p-5 sm:p-6 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" />
                  Document Content
                </span>
                <span className="text-[11px] text-muted-foreground">{wordCount} words</span>
              </div>
              <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 select-text font-sans">
                {body}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

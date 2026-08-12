"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Document, LinkedJobInfo } from "@/lib/actions/documents";
import { updateDocumentContent } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  Pencil,
  Save,
  X,
  Briefcase,
  Sparkles,
  ExternalLink,
  Mail,
} from "lucide-react";

interface TextDocumentViewerProps {
  doc: Document;
  job: LinkedJobInfo | null;
}

export function TextDocumentViewer({ doc, job }: TextDocumentViewerProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(doc.name);
  const [content, setContent] = useState(doc.content ?? "");
  const [saving, setSaving] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Parse subject line if content formatted as "Subject: ... \n\n ..."
  let subject = "";
  let body = content;

  if (content.startsWith("Subject:")) {
    const doubleNewlineIdx = content.indexOf("\n\n");
    if (doubleNewlineIdx !== -1) {
      subject = content.slice("Subject:".length, doubleNewlineIdx).trim();
      body = content.slice(doubleNewlineIdx + 2).trim();
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Document name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateDocumentContent(doc.id, name.trim(), content);
      setIsEditing(false);
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

  const generatedLabel = doc.generated_kind
    ? doc.generated_kind.replace(/_/g, " ")
    : doc.type === "cover_letter"
      ? "Cover Letter"
      : "AI Text Document";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Toolbar Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            {isEditing ? (
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
                  <Sparkles className="size-3 text-purple-500" />
                  {generatedLabel}
                </Badge>
              </div>
            )}

            {job && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
                <span>Generated for:</span>
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

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
                  <X className="mr-1.5 size-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner className="mr-1.5" /> : <Save className="mr-1.5 size-3.5" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-1.5 size-3.5 text-muted-foreground" />
                  Edit Text
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
                  <Download className="mr-1.5 size-3.5 text-muted-foreground" />
                  Download .txt
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrintPdf}>
                  <Printer className="mr-1.5 size-3.5 text-muted-foreground" />
                  Print / PDF
                </Button>
                <Button variant="default" size="sm" onClick={handleCopyAll}>
                  {copiedAll ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                  {copiedAll ? "Copied All" : "Copy Full Text"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Viewer / Editor */}
        {isEditing ? (
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-semibold text-muted-foreground">Document Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              className="font-mono text-sm leading-relaxed"
              placeholder="Write or edit document text..."
            />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {subject && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Mail className="size-3 text-cyan-500" />
                    Subject Line
                  </span>
                  <button
                    onClick={handleCopySubject}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {copiedSubject ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedSubject ? "Copied" : "Copy Subject"}</span>
                  </button>
                </div>
                <p className="text-sm font-semibold text-foreground font-mono selection:bg-primary/20">
                  {subject}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-background p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <FileText className="size-3 text-indigo-500" />
                  Document Body
                </span>
                <button
                  onClick={handleCopyBody}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copiedBody ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copiedBody ? "Copied" : "Copy Body"}</span>
                </button>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90 select-text">
                {body}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

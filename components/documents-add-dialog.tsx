"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, createLinkDocument, createRawTexDocument } from "@/lib/actions/documents";
import { extractTextFromPDF } from "@/lib/utils/pdf-extract";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, FileText, Check, Link2, Code2, Maximize2, Minimize2, Sparkles, FileCode } from "lucide-react";
import { InfoTooltip } from "@/components/ui/tooltip";

interface DocumentsAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "upload" | "link" | "tex";
}

const documentTypes = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
];

const SAMPLE_TEX_TEMPLATE = `\\documentclass[10pt, a4paper]{article}
\\usepackage[utf8]{utf8}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}

\\begin{document}
\\author{Full Name}
\\title{Software Engineer Resume}
\\maketitle

\\section*{Summary}
Results-driven Full Stack Engineer with expertise in React, Next.js, and Node.js.

\\section*{Experience}
\\textbf{Senior Developer} \\hfill 2024 -- Present\\\\
Led team building scalable web applications and REST APIs.

\\section*{Skills}
JavaScript, TypeScript, React, Python, PostgreSQL, Git

\\end{document}`;

export function DocumentsAddDialog({ open, onOpenChange, defaultTab = "upload" }: DocumentsAddDialogProps) {
  const [tab, setTab] = useState<"upload" | "link" | "tex">(defaultTab);
  const [pending, setPending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isExpandedTex, setIsExpandedTex] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Common State
  const [name, setName] = useState("");
  const [type, setType] = useState("resume");
  const [isDefault, setIsDefault] = useState(false);

  // Upload Tab State
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Tab State
  const [url, setUrl] = useState("");

  // TEX Tab State
  const [texCode, setTexCode] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type !== "application/pdf") {
        setError("Only PDF files are supported");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setFile(selected);
      if (!name) {
        setName(selected.name.replace(".pdf", ""));
      }
      setError(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setName("");
    setUrl("");
    setTexCode("");
    setType("resume");
    setIsDefault(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setPending(true);
    setExtracting(true);
    setError(null);

    try {
      const extractedText = await extractTextFromPDF(file);
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("Could not extract text from PDF. Ensure the PDF contains selectable text.");
      }

      setExtracting(false);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name.replace(".pdf", ""));
      formData.append("type", type);
      formData.append("is_default", String(isDefault));
      formData.append("extracted_text", extractedText);

      await uploadDocument(formData);

      handleClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(false);
      setExtracting(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for your document");
      return;
    }
    if (!url.trim()) {
      setError("Please enter a valid link URL");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await createLinkDocument({
        name,
        url,
        type,
        isDefault,
      });

      handleClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save link resume");
    } finally {
      setPending(false);
    }
  };

  const handleTexSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name for your .TEX document");
      return;
    }
    if (!texCode.trim()) {
      setError("Please enter your .TEX code content");
      return;
    }

    setPending(true);
    setError(null);

    try {
      await createRawTexDocument({
        name,
        texCode,
        type,
        isDefault,
      });

      handleClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save .TEX document");
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  const lineCount = texCode ? texCode.split("\n").length : 0;
  const charCount = texCode ? texCode.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={cn(
          "w-full rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4 transition-all duration-300 ease-out",
          tab === "tex" && isExpandedTex ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-lg"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
              <span>Add Resume or Document</span>
              {tab === "tex" && (
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                  LaTeX Support
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload a PDF, link an editable document, or paste .TEX code.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setTab("upload"); setError(null); }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              tab === "upload"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="size-3.5" />
            Upload PDF
          </button>

          <button
            type="button"
            onClick={() => { setTab("link"); setError(null); }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              tab === "link"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="size-3.5" />
            External Link
          </button>

          <button
            type="button"
            onClick={() => { setTab("tex"); setError(null); }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
              tab === "tex"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="size-3.5" />
            .TEX Code
          </button>
        </div>

        {/* TAB 1: UPLOAD PDF */}
        {tab === "upload" && (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">PDF File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border p-3 bg-muted/20">
                  <FileText className="size-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 p-6 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <Upload className="size-4 text-primary" />
                  Choose PDF file from computer
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doc-name" className="text-xs">Document Name</Label>
              <Input
                id="doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Full-Stack Resume 2026"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? "resume")}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "resume" && (
                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsDefault(!isDefault)}
                    className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isDefault
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {isDefault && <Check className="size-3" />}
                  </button>
                  <span className="text-xs font-medium text-muted-foreground">Set as default</span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !file} className="rounded-xl">
                {pending && <Spinner className="mr-2" />}
                {extracting ? "Extracting..." : "Upload PDF"}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: EXTERNAL LINK */}
        {tab === "link" && (
          <form onSubmit={handleLinkSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="link-name" className="text-xs">Document Name</Label>
              <Input
                id="link-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Notion Master Resume, Canva Portfolio, Google Doc CV"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="link-url" className="text-xs">Editable / Overlay Link URL</Label>
              <Input
                id="link-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://notion.so/... or https://docs.google.com/..."
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Clicking this document will directly redirect to this URL.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? "resume")}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "resume" && (
                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsDefault(!isDefault)}
                    className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isDefault
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {isDefault && <Check className="size-3" />}
                  </button>
                  <span className="text-xs font-medium text-muted-foreground">Set as default</span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !name.trim() || !url.trim()} className="rounded-xl">
                {pending && <Spinner className="mr-2" />}
                Save Link Resume
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: .TEX / LATEX CODE */}
        {tab === "tex" && (
          <form onSubmit={handleTexSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tex-name" className="text-xs">Document Name</Label>
              <Input
                id="tex-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Modern_LaTeX_Resume.tex"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="tex-code" className="text-xs font-semibold">Raw .TEX / LaTeX Code</Label>
                  <InfoTooltip
                    content="LaTeX Editor View: Toggle between compact mode for quick pastes and a spacious workspace for editing extensive LaTeX templates."
                    side="top"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {!texCode.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setTexCode(SAMPLE_TEX_TEMPLATE);
                        if (!name) setName("Sample_Resume.tex");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
                    >
                      <Sparkles className="size-3" />
                      <span>Insert Sample Template</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsExpandedTex((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shadow-2xs"
                  >
                    {isExpandedTex ? (
                      <>
                        <Minimize2 className="size-3 text-primary" />
                        <span>Compact View</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="size-3 text-amber-500" />
                        <span>Larger TEX Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <Textarea
                  id="tex-code"
                  value={texCode}
                  onChange={(e) => setTexCode(e.target.value)}
                  placeholder="\documentclass{article}&#10;\begin{document}&#10;\section{Experience}&#10;...&#10;\end{document}"
                  className={cn(
                    "font-mono text-xs resize-y bg-muted/20 border border-border/80 transition-all duration-200 leading-relaxed",
                    isExpandedTex ? "h-[360px] md:h-[420px]" : "h-36"
                  )}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5 px-0.5">
                <span>Paste or edit your LaTeX source code. AI will parse skills & experience automatically.</span>
                <span className="tabular-nums font-mono text-[10px] shrink-0 text-muted-foreground/80">
                  {lineCount} lines • {charCount} chars
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v ?? "resume")}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "resume" && (
                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsDefault(!isDefault)}
                    className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isDefault
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {isDefault && <Check className="size-3" />}
                  </button>
                  <span className="text-xs font-medium text-muted-foreground">Set as default</span>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || !name.trim() || !texCode.trim()} className="rounded-xl">
                {pending && <Spinner className="mr-2" />}
                Save .TEX Code
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

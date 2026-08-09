"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/lib/actions/documents";
import { extractTextFromPDF } from "@/lib/utils/pdf-extract";
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
import { Upload, X, FileText, Check } from "lucide-react";

interface DocumentsUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const documentTypes = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover Letter" },
  { value: "other", label: "Other" },
];

export function DocumentsUpload({ open, onOpenChange }: DocumentsUploadProps) {
  const [pending, setPending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("resume");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    setPending(true);
    setExtracting(true);
    setError(null);

    try {
      // Extract text client-side
      const extractedText = await extractTextFromPDF(file);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("Could not extract text from PDF. Please ensure the PDF contains selectable text.");
      }

      setExtracting(false);

      // Upload with extracted text
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name.replace(".pdf", ""));
      formData.append("type", type);
      formData.append("is_default", String(isDefault));
      formData.append("extracted_text", extractedText);

      await uploadDocument(formData);

      setFile(null);
      setName("");
      setType("resume");
      setIsDefault(false);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(false);
      setExtracting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setName("");
    setType("resume");
    setIsDefault(false);
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-md">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Upload Document</h2>
          <button
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Upload a PDF resume, cover letter, or other document.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <FileText className="size-8 text-muted-foreground" />
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Upload className="size-4" />
                Choose PDF file
              </button>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">Name</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Resume, PM Cover Letter"
              className="h-10"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "resume")}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default toggle */}
          {type === "resume" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDefault(!isDefault)}
                className={`flex size-5 items-center justify-center rounded border transition-colors ${
                  isDefault
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {isDefault && <Check className="size-3" />}
              </button>
              <div>
                <p className="text-sm font-medium">Set as default resume</p>
                <p className="text-xs text-muted-foreground">
                  Used for AI job matching when no better match is found
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !file}>
              {pending && <Spinner className="mr-2" />}
              {extracting ? "Extracting text..." : "Upload"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Upload,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  X,
  Plus,
  Link2,
  FileText,
  Building2,
  MapPin,
  Banknote,
  GraduationCap,
  Bot,
} from "lucide-react";
import {
  uploadScreenshot,
  extractJobImport,
  deleteScreenshots,
} from "@/lib/actions/job-imports";
import { enrichJobFromAi } from "@/lib/actions/jobs";
import { toast } from "sonner";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import { useAITaskQueue } from "@/lib/ai-tasks/task-queue-context";
import type { ExtractionResult } from "@/lib/ai/schema";
import type { JobDetailData } from "@/lib/types/job-detail";

interface JobAiUpdateDialogProps {
  data: JobDetailData;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpenEditWithExtraction?: (extracted: ExtractionResult) => void;
}

interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export function JobAiUpdateDialog({
  data,
  open,
  onClose,
  onRefresh,
  onOpenEditWithExtraction,
}: JobAiUpdateDialogProps) {
  const { job, company } = data;
  const router = useRouter();
  const { enqueueJobUpdateTask } = useAITaskQueue();

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<UploadedImage[]>([]);

  // Initialize input state when dialog opens
  useEffect(() => {
    if (open) {
      setUrl(job.application_url || (job.source?.startsWith("http") ? job.source : "") || "");
      setText("");
      setImages([]);
      setExtractionResult(null);
      setError(null);
    }
  }, [open, job]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Clean up screenshots on unmount
  useEffect(() => {
    return () => {
      if (imagesRef.current.length > 0) {
        deleteScreenshots(imagesRef.current.map((img) => img.id)).catch(() => {});
      }
    };
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const newImages: UploadedImage[] = [];
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadScreenshot(formData);
        newImages.push({
          id: result.screenshotId,
          url: result.screenshotUrl,
          name: file.name,
        });
      }
      setImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const handleRemoveImage = async (id: string) => {
    await deleteScreenshots([id]);
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const canExtract = images.length > 0 || text.trim().length > 0 || url.trim().length > 0;

  const handleExtract = async () => {
    if (!canExtract) return;

    setExtracting(true);
    setError(null);

    try {
      const result = await extractJobImport(
        images.map((img) => img.id),
        text,
        url
      );
      setExtractionResult(result);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Extraction failed. Please try again.";
      setError(cleanAiErrorMessage(raw));
    } finally {
      setExtracting(false);
    }
  };

  const handleApplyUpdates = async () => {
    if (!extractionResult) return;
    setApplying(true);
    setError(null);

    try {
      const res = await enrichJobFromAi(job.id, extractionResult);
      if (res.success) {
        const count = res.updatedFields.length;
        toast.success(
          `Job updated with AI! (${count} field${count === 1 ? "" : "s"} enhanced)`
        );
        onClose();
        onRefresh();
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply updates.");
    } finally {
      setApplying(false);
    }
  };

  const handleQueueInBackground = () => {
    if (!canExtract) return;
    enqueueJobUpdateTask({
      jobId: job.id,
      jobTitle: job.title,
      companyName: company?.name,
      url: url.trim() || undefined,
      text: text.trim() || undefined,
      imageIds: images.map((img) => img.id),
    });
    toast.success(`AI task queued for "${job.title}"`, {
      description: "You can track progress in the AI Task panel at the bottom.",
    });
    onClose();
  };

  const handleReviewInForm = () => {
    if (!extractionResult) return;
    if (onOpenEditWithExtraction) {
      onOpenEditWithExtraction(extractionResult);
    }
    onClose();
  };

  const handleCancel = async () => {
    if (images.length > 0) {
      await deleteScreenshots(images.map((img) => img.id));
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold">Update with AI</h2>
              <p className="text-xs text-muted-foreground">
                Enhance &ldquo;{job.title}&rdquo; ({company?.name ?? "Company"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {!extractionResult ? (
          <>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Add a link to the job posting, upload screenshots, or paste the text. AI will extract new details and fill in missing fields.
            </p>

            {/* Option 1: URL Input */}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="ai-update-url" className="text-xs font-medium text-foreground">
                Job posting link
              </Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ai-update-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste link to job listing (e.g. LinkedIn, careers page)..."
                  className="h-9 pl-9 text-xs"
                />
              </div>
            </div>

            {/* Option 2: Image Dropzone */}
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Screenshots</Label>
              {images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border h-20 bg-muted/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.name} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(img.id)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-black"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}

                  {images.length < 6 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-border transition-colors hover:border-muted-foreground/50 hover:bg-muted/30 cursor-pointer"
                    >
                      {uploading ? <Spinner className="size-4 text-muted-foreground" /> : <Plus className="size-4 text-muted-foreground" />}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-4 transition-colors hover:border-muted-foreground/50 hover:bg-muted/20 text-center"
                >
                  <Upload className="size-5 text-muted-foreground" />
                  <p className="mt-1.5 text-xs font-medium">Drop screenshots or click to upload</p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP up to 5MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleFiles(files);
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* Option 3: Textarea */}
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="ai-update-text" className="text-xs font-medium text-foreground">
                Or paste job text
              </Label>
              <Textarea
                id="ai-update-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste any additional job description, requirements, or responsibilities text..."
                rows={4}
                className="text-xs resize-none rounded-xl"
              />
            </div>

            {error && (
              <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!canExtract || extracting}
                onClick={handleQueueInBackground}
                className="rounded-xl text-xs gap-1.5 cursor-pointer font-medium"
              >
                <Bot className="size-3.5 text-primary" />
                Run in Background
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canExtract || extracting}
                onClick={handleExtract}
                className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-medium"
              >
                {extracting ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
                {extracting ? "Analyzing..." : "Extract & Preview"}
              </Button>
            </div>
          </>
        ) : (
          /* Extraction Preview & Merge Mode */
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-success-border bg-success-surface p-3.5">
              <div className="flex items-center gap-2 text-success font-semibold text-xs mb-2">
                <CheckCircle2 className="size-4" />
                <span>AI successfully extracted job data!</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Review the newly extracted fields below. You can apply them directly to update the job or review them in the edit form.
              </p>
            </div>

            {/* Extracted Fields Summary */}
            <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-3.5 text-xs">
              {extractionResult.title && (
                <div className="flex items-start gap-2">
                  <FileText className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Title</span>
                    <span className="font-medium text-foreground">{extractionResult.title}</span>
                  </div>
                </div>
              )}

              {extractionResult.company && (
                <div className="flex items-start gap-2">
                  <Building2 className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Company</span>
                    <span className="font-medium text-foreground">{extractionResult.company}</span>
                  </div>
                </div>
              )}

              {extractionResult.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Location</span>
                    <span className="font-medium text-foreground">{extractionResult.location}</span>
                  </div>
                </div>
              )}

              {extractionResult.salary_range && (
                <div className="flex items-start gap-2">
                  <Banknote className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Salary</span>
                    <span className="font-medium text-foreground">{extractionResult.salary_range}</span>
                  </div>
                </div>
              )}

              {Array.isArray(extractionResult.skills) && extractionResult.skills.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                    Skills ({extractionResult.skills.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractionResult.skills.slice(0, 10).map((skill, idx) => (
                      <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {skill}
                      </span>
                    ))}
                    {extractionResult.skills.length > 10 && (
                      <span className="text-[10px] text-muted-foreground">+{extractionResult.skills.length - 10} more</span>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(extractionResult.benefits) && extractionResult.benefits.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                    Benefits ({extractionResult.benefits.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {extractionResult.benefits.slice(0, 5).map((b, idx) => (
                      <span key={idx} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {extractionResult.educational_requirements && (
                <div className="flex items-start gap-2">
                  <GraduationCap className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Education</span>
                    <span className="font-medium text-foreground">{extractionResult.educational_requirements}</span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            {/* Actions for applying */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExtractionResult(null)}
                className="rounded-xl text-xs cursor-pointer"
              >
                Back / Re-try
              </Button>
              {onOpenEditWithExtraction && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReviewInForm}
                  className="rounded-xl text-xs cursor-pointer"
                >
                  Review in Edit Form
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={applying}
                onClick={handleApplyUpdates}
                className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-medium"
              >
                {applying ? <Spinner className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                {applying ? "Applying..." : "Apply & Update Job"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

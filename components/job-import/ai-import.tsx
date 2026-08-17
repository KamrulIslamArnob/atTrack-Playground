"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Upload, AlertCircle } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { Link2Icon } from "@/components/ui/link-2";
import {
  uploadScreenshot,
  extractJobImport,
  deleteScreenshots,
} from "@/lib/actions/job-imports";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import { AddJobDialog } from "@/components/add-job-dialog";
import type { ExtractionResult } from "@/lib/ai/schema";
import type { BoardList } from "@/lib/types/board";

interface AiImportProps {
  onClose: () => void;
  /** User's board lists, for the section-deadline target picker. */
  lists?: BoardList[];
  /** Optional target board list to preselect */
  listId?: string;
}

interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export function AiImport({ onClose, lists = [], listId }: AiImportProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const imagesRef = useRef<UploadedImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup screenshots on unmount (safety net)
  useEffect(() => {
    return () => {
      if (imagesRef.current.length > 0) {
        deleteScreenshots(imagesRef.current.map((img) => img.id)).catch(() => {});
      }
    };
  }, []); // Empty deps — only run on unmount

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload image files only");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File too large (max 5MB per image)");
        return;
      }
    }

    setError(null);
    setUploading(true);

    try {
      const newImages: UploadedImage[] = [];

      for (const file of fileArray) {
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
      setError(err instanceof Error ? err.message : "Upload failed");
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
      setJobDialogOpen(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Extraction failed. Please try again.";
      setError(cleanAiErrorMessage(raw));
    } finally {
      setExtracting(false);
    }
  };

  const handleCancel = async () => {
    if (images.length > 0) {
      await deleteScreenshots(images.map((img) => img.id));
    }
    onClose();
  };

  const handleJobDialogClose = async (open: boolean) => {
    setJobDialogOpen(open);
    if (!open) {
      // Fire-and-forget deletion — images are temporary, clean up in background
      if (images.length > 0) {
        deleteScreenshots(images.map((img) => img.id)).catch((err) =>
          console.error("Failed to cleanup screenshots:", err)
        );
      }
      onClose();
      router.refresh();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-md max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Import with AI</h2>
            <button
              onClick={handleCancel}
              className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Add a screenshot, a link, pasted text — any combination. AI merges whatever you give it.
          </p>

          <div className="mt-4 space-y-2">
            <Label htmlFor="import-url">Job posting link</Label>
            <div className="relative">
              <Link2Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="import-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a link to the job posting..."
                className="h-10 pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              atTrack fetches the page and merges it with anything else you&apos;ve added — useful when a social post links to a longer listing.
            </p>
          </div>

          {/* Image grid */}
          <div className="mt-4">
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-32 object-cover rounded-2xl border border-border"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveImage(img.id)}
                        className="size-8 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-[10px] text-white bg-black/60 rounded px-1.5 py-0.5 truncate">
                        {img.name}
                      </p>
                    </div>
                  </div>
                ))}

                {images.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-border transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
                  >
                    {uploading ? (
                      <Spinner className="size-6 text-muted-foreground" />
                    ) : (
                      <PlusIcon className="size-6 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
              >
                <Upload className="size-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  Drop screenshots here or click to upload
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WebP up to 5MB each. Optional if you gave a link or text.
                </p>
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

          {images.length > 0 && !extracting && !extractionResult && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              {images.length} image{images.length !== 1 ? "s" : ""} uploaded.
            </p>
          )}

          <div className="mt-4 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Or paste the job posting text here..."
              rows={6}
            />
          </div>

          {error && (
            <div className="mt-3 rounded-2xl bg-destructive/10 p-3.5 text-xs text-destructive border border-destructive/20 overflow-hidden">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1 overflow-hidden break-words leading-relaxed">
                  <p className="font-semibold text-xs sm:text-sm">Extraction Failed</p>
                  <p className="whitespace-pre-line text-destructive/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExtract} disabled={!canExtract || uploading || extracting}>
              {(uploading || extracting) && <Spinner className="mr-2" />}
              {uploading ? "Uploading..." : extracting ? "Analyzing..." : "Extract"}
            </Button>
          </div>
        </div>
      </div>

      {extractionResult && (
        <AddJobDialog
          initialData={extractionResult}
          open={jobDialogOpen}
          onOpenChange={handleJobDialogClose}
          lists={lists}
          listId={listId}
        />
      )}
    </>
  );
}

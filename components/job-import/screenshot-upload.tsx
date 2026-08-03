"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload, X, AlertCircle, Plus, ImageIcon } from "lucide-react";
import {
  uploadScreenshot,
  extractFromScreenshots,
  deleteScreenshots,
} from "@/lib/actions/job-imports";
import { AddJobDialog } from "@/components/add-job-dialog";
import type { ExtractionResult } from "@/lib/ai/schema";

interface ScreenshotUploadProps {
  onClose: () => void;
}

interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export function ScreenshotUpload({ onClose }: ScreenshotUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<ExtractionResult | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const imagesRef = useRef<UploadedImage[]>([]);

  // Keep ref in sync with state
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

    // Validate all files first
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

  const handleExtract = async () => {
    if (images.length === 0) return;

    setExtracting(true);
    setError(null);

    try {
      const screenshotIds = images.map((img) => img.id);
      const result = await extractFromScreenshots(screenshotIds);
      setExtractionResult(result);
      setJobDialogOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Extraction failed. Please try again."
      );
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
        <div className="w-full max-w-lg rounded-4xl border border-border bg-card p-6 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">
              Import from Screenshot
            </h2>
            <button
              onClick={handleCancel}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Upload screenshots of a job posting. Multiple images supported for long posts.
          </p>

          {/* Image grid */}
          <div className="mt-4">
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-32 object-cover rounded-4xl border border-border"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-4xl flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveImage(img.id)}
                        className="size-8 rounded-full bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-[10px] text-white bg-black/60 rounded px-1.5 py-0.5 truncate">
                        {img.name}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Add more button */}
                {images.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex h-32 items-center justify-center rounded-4xl border-2 border-dashed border-border transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
                  >
                    {uploading ? (
                      <Spinner className="size-6 text-muted-foreground" />
                    ) : (
                      <Plus className="size-6 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-4xl border-2 border-dashed border-border p-8 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
              >
                <Upload className="size-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  Drop images here or click to upload
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WebP up to 5MB each. Multiple images supported.
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
              {images.length} image{images.length !== 1 ? "s" : ""} uploaded. AI will analyze all images together.
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-4xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExtract}
              disabled={images.length === 0 || uploading || extracting}
            >
              {(uploading || extracting) && <Spinner className="mr-2" />}
              {uploading
                ? "Uploading..."
                : extracting
                  ? "Analyzing screenshots..."
                  : "Extract"}
            </Button>
          </div>
        </div>
      </div>

      {extractionResult && (
        <AddJobDialog
          initialData={extractionResult}
          open={jobDialogOpen}
          onOpenChange={handleJobDialogClose}
        />
      )}
    </>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload, X, AlertCircle } from "lucide-react";
import {
  uploadScreenshot,
  extractFromScreenshot,
  deleteScreenshot,
} from "@/lib/actions/job-imports";
import { AddJobDialog } from "@/components/add-job-dialog";
import type { ExtractionResult } from "@/lib/ai/schema";

interface ScreenshotUploadProps {
  onClose: () => void;
}

export function ScreenshotUpload({ onClose }: ScreenshotUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [screenshotId, setScreenshotId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<ExtractionResult | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5MB)");
      return;
    }

    setError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadScreenshot(formData);
      setScreenshotId(result.screenshotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleExtract = async () => {
    if (!screenshotId) return;

    setExtracting(true);
    setError(null);

    try {
      const result = await extractFromScreenshot(screenshotId);
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
    if (screenshotId) {
      await deleteScreenshot(screenshotId);
    }
    onClose();
  };

  const handleJobDialogClose = async (open: boolean) => {
    setJobDialogOpen(open);
    if (!open) {
      if (screenshotId) {
        await deleteScreenshot(screenshotId);
      }
      onClose();
      router.refresh();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 shadow-md">
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
            Upload a screenshot of a job posting and AI will extract the details.
          </p>

          <div className="mt-4">
            {!preview ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-4xl border-2 border-dashed border-border p-8 transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
              >
                <Upload className="size-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">
                  Drop an image here or click to upload
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WebP up to 5MB
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Screenshot preview"
                  className="w-full rounded-4xl border border-border object-contain"
                  style={{ maxHeight: "300px" }}
                />
                {!extracting && !extractionResult && (
                  <button
                    onClick={() => {
                      setPreview(null);
                      setScreenshotId(null);
                    }}
                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-4xl bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

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
              disabled={!screenshotId || uploading || extracting}
            >
              {(uploading || extracting) && <Spinner className="mr-2" />}
              {uploading
                ? "Uploading..."
                : extracting
                  ? "Analyzing screenshot..."
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

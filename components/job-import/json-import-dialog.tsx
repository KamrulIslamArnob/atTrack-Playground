"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { FileJson, UploadCloud, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { importJobsFromJson, type JsonImportResult } from "@/lib/actions/job-imports";
import { toast } from "sonner";

interface JsonImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedPreview {
  count: number;
  sampleJobs: Array<{ title: string; company: string; interviewsCount: number }>;
}

export function JsonImportDialog({ open, onOpenChange }: JsonImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const analyzeJson = useCallback((text: string) => {
    setJsonText(text);
    if (!text.trim()) {
      setPreview(null);
      setParseError(null);
      return;
    }

    try {
      const parsed = JSON.parse(text.trim());
      let items: Array<Record<string, unknown>> = [];

      if (Array.isArray(parsed)) {
        items = parsed as Array<Record<string, unknown>>;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.jobs)) {
          items = obj.jobs as Array<Record<string, unknown>>;
        } else if (Array.isArray(obj.data)) {
          items = obj.data as Array<Record<string, unknown>>;
        } else if (obj.job || obj.title) {
          items = [obj];
        }
      }

      if (items.length === 0) {
        setPreview(null);
        setParseError("No recognizable job objects found in JSON.");
        return;
      }

      const sample = items.slice(0, 5).map((it) => {
        const j = (it.job && typeof it.job === "object" ? it.job : it) as Record<string, unknown>;
        const c = (it.company && typeof it.company === "object" ? it.company : null) as Record<string, unknown> | null;
        const ivs = Array.isArray(it.interviews) ? it.interviews : Array.isArray(j.interviews) ? j.interviews : [];
        return {
          title: (j.title as string) || "Untitled Position",
          company: (c?.name as string) || (j.company_name as string) || (typeof j.company === "string" ? j.company : "Unknown Company"),
          interviewsCount: ivs.length,
        };
      });

      setPreview({
        count: items.length,
        sampleJobs: sample,
      });
      setParseError(null);
    } catch {
      setPreview(null);
      setParseError("Invalid JSON syntax.");
    }
  }, []);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please select a valid .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        analyzeJson(content);
        toast.success(`Loaded "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!jsonText.trim()) return;
    setLoading(true);
    try {
      const result: JsonImportResult = await importJobsFromJson(jsonText);
      if (result.success) {
        toast.success(
          `Import complete: ${result.created} new job${result.created === 1 ? "" : "s"} added, ${result.updated} updated.`
        );
        onOpenChange(false);
        setJsonText("");
        setPreview(null);
        router.refresh();
      } else {
        toast.error(result.errors[0] || "Failed to import jobs from JSON.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error importing JSON.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl md:max-w-2xl max-h-[88vh] flex flex-col rounded-3xl p-6 overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FileJson className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">Import Job from JSON</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 truncate">
                Paste copied job JSON or drop backup files from another device with smart duplicate merge.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-3.5 py-2 pr-1">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border/80 hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <UploadCloud className="size-5 text-muted-foreground mb-1" />
            <p className="text-xs font-medium text-foreground">
              Drop <code className="font-mono text-primary font-semibold">.json</code> file here or click to browse
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Supports single job exports and bulk database dumps
            </p>
          </div>

          {/* Paste Raw JSON Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Or Paste JSON Data</label>
              {jsonText && (
                <button
                  type="button"
                  onClick={() => analyzeJson("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <Textarea
              placeholder='Paste { "job": { "title": "...", "company": "..." } } or [ { ... } ]'
              value={jsonText}
              onChange={(e) => analyzeJson(e.target.value)}
              rows={4}
              className="font-mono text-xs rounded-xl resize-none max-h-32 overflow-y-auto w-full break-all"
            />
          </div>

          {/* Live Preview / Validation Banner */}
          {preview && (
            <div className="rounded-2xl border border-success-border bg-success-surface p-3 space-y-2 max-w-full overflow-hidden">
              <div className="flex items-center gap-2 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="truncate">
                  Valid BetterJob JSON: {preview.count} {preview.count === 1 ? "job" : "jobs"} detected
                </span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {preview.sampleJobs.map((j, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs bg-background/80 rounded-lg px-2.5 py-1.5 border border-border min-w-0 max-w-full overflow-hidden"
                  >
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-foreground truncate">{j.title}</span>
                      <span className="text-muted-foreground ml-1.5 truncate">@ {j.company}</span>
                    </div>
                    {j.interviewsCount > 0 && (
                      <Badge variant="outline" className="text-[10px] shrink-0 font-normal ml-2">
                        {j.interviewsCount} round{j.interviewsCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                ))}
                {preview.count > 5 && (
                  <p className="text-[11px] text-muted-foreground italic text-center pt-0.5">
                    ...and {preview.count - 5} more
                  </p>
                )}
              </div>
            </div>
          )}

          {parseError && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span className="truncate">{parseError}</span>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3 text-primary shrink-0" />
              Smart Duplicate Handling
            </p>
            <p className="leading-normal">
              If a job with the same ID or title & company exists, BetterJob updates it in-place with latest fields and interviews instead of creating duplicate cards.
            </p>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 flex items-center justify-between pt-3 border-t border-border mt-2 bg-popover">
          <div className="text-xs text-muted-foreground truncate">
            {preview ? (
              <span className="text-success font-medium">Ready to import {preview.count} item{preview.count === 1 ? "" : "s"}</span>
            ) : (
              <span>Paste JSON or drop file to start</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading || !preview}
              onClick={handleImport}
              className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Spinner className="size-3.5" />
                  Importing...
                </>
              ) : (
                <>
                  <FileJson className="size-3.5" />
                  Import {preview ? `${preview.count} Job${preview.count === 1 ? "" : "s"}` : "JSON"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

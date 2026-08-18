"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  UploadCloud,
  FileJson,
  AlertCircle,
  FolderTree,
  ExternalLink,
  Zap,
  RefreshCw,
} from "lucide-react";
import { importLinksFromJson, type LinksImportResult } from "@/lib/actions/data-management";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LinksJsonImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: (result: LinksImportResult) => void;
}

export function LinksJsonImportDialog({ open, onOpenChange, onImportSuccess }: LinksJsonImportDialogProps) {
  const router = useRouter();
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick live summary of parsed payload
  const preview = (() => {
    if (!jsonText.trim()) return null;
    try {
      const parsed = JSON.parse(jsonText.trim());
      let catCount = 0;
      let linkCount = 0;
      let shortcutCount = 0;

      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.categories)) catCount = parsed.categories.length;
        if (Array.isArray(parsed.links)) linkCount = parsed.links.length;
        if (Array.isArray(parsed.shortcuts)) shortcutCount = parsed.shortcuts.length;
        if (Array.isArray(parsed)) {
          linkCount = parsed.length;
        }
      }
      return { catCount, linkCount, shortcutCount, valid: catCount > 0 || linkCount > 0 || shortcutCount > 0 };
    } catch {
      return null;
    }
  })();

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please upload a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setJsonText(content);
        setError(null);
        toast.success(`Loaded "${file.name}"`);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!jsonText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await importLinksFromJson(jsonText.trim());
      if (res.success) {
        toast.success(
          `Links import complete: ${res.linksCreated + res.linksUpdated} links, ${res.categoriesCreated} categories, ${res.shortcutsCreated} shortcuts processed.`
        );
        onImportSuccess?.(res);
        onOpenChange(false);
        setJsonText("");
        router.refresh();
      } else {
        setError(res.errors[0] || "Failed to import links data.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl max-h-[88vh] flex flex-col rounded-3xl p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Link2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">Import Links & Bookmarks</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 truncate">
                Paste JSON or drop a backup file to import links, categories, and shortcuts.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-3.5 py-2 pr-1">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-border/80 hover:border-primary/50 hover:bg-muted/40"
            }`}
          >
            <UploadCloud className="size-5 text-muted-foreground mb-1" />
            <p className="text-xs font-medium text-foreground">
              Drop <code className="font-mono text-primary font-semibold">.json</code> file here
            </p>
          </div>

          {/* Paste Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Paste Raw Links JSON</label>
              {jsonText && (
                <button
                  type="button"
                  onClick={() => setJsonText("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <Textarea
              placeholder='{ "categories": [{ "name": "Portals" }], "links": [{ "title": "LinkedIn", "url": "https://linkedin.com" }] }'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={5}
              className="font-mono text-xs rounded-xl resize-none max-h-36 overflow-y-auto w-full break-all"
            />
          </div>

          {/* Live Preview Badge */}
          {preview && preview.valid && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs flex-wrap">
              {preview.linkCount > 0 && (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <ExternalLink className="size-3" />
                  {preview.linkCount} {preview.linkCount === 1 ? "Link" : "Links"}
                </Badge>
              )}
              {preview.catCount > 0 && (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <FolderTree className="size-3" />
                  {preview.catCount} {preview.catCount === 1 ? "Category" : "Categories"}
                </Badge>
              )}
              {preview.shortcutCount > 0 && (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <Zap className="size-3" />
                  {preview.shortcutCount} Shortcuts
                </Badge>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3 text-primary shrink-0" />
              Smart Duplicate Handling
            </p>
            <p className="leading-normal">
              Existing categories and links matching existing URLs will be merged and updated cleanly.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-border mt-2 bg-popover">
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
            disabled={loading || !jsonText.trim()}
            onClick={handleSubmit}
            className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? <Spinner className="size-3.5" /> : <FileJson className="size-3.5" />}
            Import Links
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

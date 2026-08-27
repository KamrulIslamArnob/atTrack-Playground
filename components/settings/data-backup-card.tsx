"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Download,
  Upload,
  FileJson,
  UploadCloud,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  exportAllJobsData,
  exportCrmData,
  importCrmFromJson,
  exportLinksData,
  importLinksFromJson,
} from "@/lib/actions/data-management";
import { JsonImportDialog } from "@/components/job-import/json-import-dialog";
import { useJsonSyncPreference } from "@/lib/hooks/use-json-sync-preference";
import { Switch } from "@/components/settings/startup-service-card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const BACKUP_TARGETS = [
  {
    key: "jobs",
    label: "Jobs and applications",
    hint: "Postings, board columns, milestones, and notes",
    copy: "copyJobs",
    export: "exportJobs",
    import: "jobsImportOpen",
  },
  {
    key: "crm",
    label: "Contacts and companies",
    hint: "People, recruiters, and company profiles",
    copy: "copyCrm",
    export: "exportCrm",
    import: "crmImportOpen",
  },
  {
    key: "links",
    label: "Links and resources",
    hint: "Portals, categorized bookmarks, and shortcuts",
    copy: "copyLinks",
    export: "exportLinks",
    import: "linksImportOpen",
  },
] as const;

export function DataBackupCard() {
  const router = useRouter();
  const { enabled: jsonSyncEnabled, setEnabled: setJsonSyncEnabled } = useJsonSyncPreference();
  const [copyingCategory, setCopyingCategory] = useState<string | null>(null);
  const [exportingCategory, setExportingCategory] = useState<string | null>(null);

  // Modals state
  const [jobsImportOpen, setJobsImportOpen] = useState(false);
  const [crmImportOpen, setCrmImportOpen] = useState(false);
  const [linksImportOpen, setLinksImportOpen] = useState(false);

  // Helper: Download JSON file
  const downloadJsonFile = (data: unknown, filename: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 1. Jobs Handlers
  const handleCopyJobs = async () => {
    setCopyingCategory("jobs");
    try {
      const data = await exportAllJobsData();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success(`Copied ${data.count} jobs`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't copy jobs");
    } finally {
      setCopyingCategory(null);
    }
  };

  const handleExportJobs = async () => {
    setExportingCategory("jobs");
    try {
      const data = await exportAllJobsData();
      const dateStr = new Date().toISOString().split("T")[0];
      downloadJsonFile(data, `attrack-jobs-backup-${dateStr}.json`);
      toast.success(`Exported ${data.count} jobs`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't export jobs");
    } finally {
      setExportingCategory(null);
    }
  };

  // 2. CRM Handlers
  const handleCopyCrm = async () => {
    setCopyingCategory("crm");
    try {
      const data = await exportCrmData();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success(`Copied ${data.companiesCount} companies, ${data.contactsCount} contacts`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't copy CRM data");
    } finally {
      setCopyingCategory(null);
    }
  };

  const handleExportCrm = async () => {
    setExportingCategory("crm");
    try {
      const data = await exportCrmData();
      const dateStr = new Date().toISOString().split("T")[0];
      downloadJsonFile(data, `attrack-crm-backup-${dateStr}.json`);
      toast.success("CRM data exported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't export CRM data");
    } finally {
      setExportingCategory(null);
    }
  };

  // 3. Links Handlers
  const handleCopyLinks = async () => {
    setCopyingCategory("links");
    try {
      const data = await exportLinksData();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast.success(`Copied ${data.linksCount} links, ${data.categoriesCount} categories`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't copy links");
    } finally {
      setCopyingCategory(null);
    }
  };

  const handleExportLinks = async () => {
    setExportingCategory("links");
    try {
      const data = await exportLinksData();
      const dateStr = new Date().toISOString().split("T")[0];
      downloadJsonFile(data, `attrack-links-backup-${dateStr}.json`);
      toast.success("Links exported");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't export links");
    } finally {
      setExportingCategory(null);
    }
  };

  const handlers = {
    jobs: { copy: handleCopyJobs, export: handleExportJobs, open: () => setJobsImportOpen(true), copying: copyingCategory === "jobs", exporting: exportingCategory === "jobs" },
    crm: { copy: handleCopyCrm, export: handleExportCrm, open: () => setCrmImportOpen(true), copying: copyingCategory === "crm", exporting: exportingCategory === "crm" },
    links: { copy: handleCopyLinks, export: handleExportLinks, open: () => setLinksImportOpen(true), copying: copyingCategory === "links", exporting: exportingCategory === "links" },
  };

  return (
    <>
      {/* JSON import shortcuts toggle */}
      <div className="flex items-center justify-between gap-4 py-3 px-1">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground">Show import shortcuts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Displays quick JSON import shortcuts on board, contact, and link views
          </p>
        </div>
        <Switch
          checked={jsonSyncEnabled}
          onCheckedChange={() => setJsonSyncEnabled(!jsonSyncEnabled)}
          label="Toggle JSON import shortcuts across application"
        />
      </div>

      {BACKUP_TARGETS.map((t) => {
        const h = handlers[t.key];
        return (
          <div
            key={t.key}
            className="flex flex-col gap-2.5 py-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-foreground">{t.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={h.copying}
                onClick={h.copy}
                className="h-8 px-2.5 text-xs gap-1.5"
              >
                {h.copying ? <Spinner className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={h.exporting}
                onClick={h.export}
                className="h-8 px-2.5 text-xs gap-1.5"
              >
                {h.exporting ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={h.open}
                className="h-8 px-2.5 text-xs gap-1.5"
              >
                <Upload className="size-3.5" />
                Import
              </Button>
            </div>
          </div>
        );
      })}

      {/* Jobs Import Dialog */}
      <JsonImportDialog open={jobsImportOpen} onOpenChange={setJobsImportOpen} />

      {/* CRM Import Dialog */}
      <GenericJsonImportModal
        open={crmImportOpen}
        onOpenChange={setCrmImportOpen}
        title="Import CRM data"
        description="Companies and contacts, merged by name."
        samplePlaceholder='{ "companies": [ ... ], "contacts": [ ... ] }'
        onImport={async (json) => {
          const res = await importCrmFromJson(json);
          if (res.success) {
            toast.success(
              `Imported ${res.companiesCreated + res.companiesUpdated} companies, ${res.contactsCreated + res.contactsUpdated} contacts`
            );
            router.refresh();
          } else {
            toast.error(res.errors[0] || "Couldn't import CRM data");
          }
          return res.success;
        }}
      />

      {/* Links Import Dialog */}
      <GenericJsonImportModal
        open={linksImportOpen}
        onOpenChange={setLinksImportOpen}
        title="Import links"
        description="Saved links, categories, and shortcuts."
        samplePlaceholder='{ "categories": [ ... ], "links": [ ... ], "shortcuts": [ ... ] }'
        onImport={async (json) => {
          const res = await importLinksFromJson(json);
          if (res.success) {
            toast.success(
              `Imported ${res.linksCreated + res.linksUpdated} links, ${res.categoriesCreated} categories`
            );
            router.refresh();
          } else {
            toast.error(res.errors[0] || "Couldn't import links");
          }
          return res.success;
        }}
      />
    </>
  );
}

interface GenericJsonImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  samplePlaceholder: string;
  onImport: (rawJson: string) => Promise<boolean>;
}

function GenericJsonImportModal({
  open,
  onOpenChange,
  title,
  description,
  samplePlaceholder,
  onImport,
}: GenericJsonImportModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const ok = await onImport(jsonText.trim());
      if (ok) {
        onOpenChange(false);
        setJsonText("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't import file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl max-h-[88vh] flex flex-col rounded-3xl p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="truncate text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="mt-0.5 truncate text-xs">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-3.5 py-2 pr-1">
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
              Drop <code className="font-mono font-semibold text-primary">.json</code> file here
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Paste JSON</label>
              {jsonText && (
                <button
                  type="button"
                  onClick={() => setJsonText("")}
                  className="text-xs text-muted-foreground underline hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <Textarea
              placeholder={samplePlaceholder}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={5}
              className="font-mono text-xs rounded-xl resize-none max-h-36 overflow-y-auto w-full break-all"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          <p className="flex items-start gap-1.5 rounded-xl bg-muted/50 p-2.5 text-xs leading-normal text-muted-foreground">
            <RefreshCw className="mt-0.5 size-3 shrink-0 text-primary" />
            Matching records are updated with imported data, keeping custom fields.
          </p>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 pt-3 mt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading || !jsonText.trim()}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            {loading ? <Spinner className="size-3.5" /> : <FileJson className="size-3.5" />}
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

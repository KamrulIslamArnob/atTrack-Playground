"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Database,
  Briefcase,
  Users,
  Link2,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
      toast.success(`Copied ${data.count} jobs & board configuration to clipboard!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to copy jobs data");
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
      toast.success(`Exported ${data.count} jobs to JSON file`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export jobs data");
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
      toast.success(
        `Copied CRM data (${data.companiesCount} companies, ${data.contactsCount} contacts) to clipboard!`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to copy CRM data");
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
      toast.success(`Exported CRM data to JSON file`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export CRM data");
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
      toast.success(
        `Copied Links data (${data.linksCount} links, ${data.categoriesCount} categories) to clipboard!`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to copy links data");
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
      toast.success(`Exported links to JSON file`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export links data");
    } finally {
      setExportingCategory(null);
    }
  };

  return (
    <>
      <Card className="rounded-3xl border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Data Backup & Portability</CardTitle>
                <CardDescription className="text-xs">
                  One-click copy, export JSON files, or restore backups to easily sync your data between devices.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center bg-muted/40 px-3 py-1.5 rounded-2xl border border-border">
              <span className="text-xs font-medium text-foreground cursor-pointer select-none">
                Enable JSON Import Buttons
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={jsonSyncEnabled}
                aria-label="Toggle JSON Import Buttons across application"
                onClick={() => {
                  const next = !jsonSyncEnabled;
                  setJsonSyncEnabled(next);
                  toast.success(
                    next
                      ? "JSON import buttons enabled across all pages"
                      : "JSON import buttons hidden from all pages"
                  );
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
                  jsonSyncEnabled ? "bg-primary" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                    jsonSyncEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Section 1: Jobs & Board */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Briefcase className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">Jobs & Applications</h3>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                      Full Job Package
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Job postings, board columns, timeline milestones, interview rounds, and notes.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={copyingCategory === "jobs"}
                  onClick={handleCopyJobs}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {copyingCategory === "jobs" ? <Spinner className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingCategory === "jobs"}
                  onClick={handleExportJobs}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {exportingCategory === "jobs" ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
                  Export
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setJobsImportOpen(true)}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="size-3.5" />
                  Import
                </Button>
              </div>
            </div>
          </div>

          {/* Section 2: CRM & Networking */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Users className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">CRM & Networking</h3>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                      Companies & Contacts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Companies, network contacts, emails, phone numbers, roles, and interactions.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={copyingCategory === "crm"}
                  onClick={handleCopyCrm}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {copyingCategory === "crm" ? <Spinner className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingCategory === "crm"}
                  onClick={handleExportCrm}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {exportingCategory === "crm" ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
                  Export
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCrmImportOpen(true)}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="size-3.5" />
                  Import
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Links & Bookmarks */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 transition-all hover:bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Link2 className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">Links & Bookmarks</h3>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                      Links & Shortcuts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saved recruitment portals, career links, custom categories, tags, and quick shortcuts.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={copyingCategory === "links"}
                  onClick={handleCopyLinks}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {copyingCategory === "links" ? <Spinner className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingCategory === "links"}
                  onClick={handleExportLinks}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer hover:bg-muted"
                >
                  {exportingCategory === "links" ? <Spinner className="size-3.5" /> : <Download className="size-3.5" />}
                  Export
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setLinksImportOpen(true)}
                  className="rounded-xl text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Upload className="size-3.5" />
                  Import
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Import Dialog */}
      <JsonImportDialog open={jobsImportOpen} onOpenChange={setJobsImportOpen} />

      {/* CRM Import Dialog */}
      <GenericJsonImportModal
        open={crmImportOpen}
        onOpenChange={setCrmImportOpen}
        title="Import CRM Data (Companies & Contacts)"
        description="Paste CRM JSON or drop a backup file to import companies and contacts with smart duplicate merge."
        icon={<Users className="size-5" />}
        samplePlaceholder='{ "companies": [ ... ], "contacts": [ ... ] }'
        onImport={async (json) => {
          const res = await importCrmFromJson(json);
          if (res.success) {
            toast.success(
              `CRM import complete: ${res.companiesCreated + res.companiesUpdated} companies, ${res.contactsCreated + res.contactsUpdated} contacts processed.`
            );
            router.refresh();
          } else {
            toast.error(res.errors[0] || "Failed to import CRM data.");
          }
          return res.success;
        }}
      />

      {/* Links Import Dialog */}
      <GenericJsonImportModal
        open={linksImportOpen}
        onOpenChange={setLinksImportOpen}
        title="Import Links & Bookmarks"
        description="Paste links JSON or drop a backup file to import saved links, categories, and quick shortcuts."
        icon={<Link2 className="size-5" />}
        samplePlaceholder='{ "categories": [ ... ], "links": [ ... ], "shortcuts": [ ... ] }'
        onImport={async (json) => {
          const res = await importLinksFromJson(json);
          if (res.success) {
            toast.success(
              `Links import complete: ${res.linksCreated + res.linksUpdated} links, ${res.categoriesCreated} categories processed.`
            );
            router.refresh();
          } else {
            toast.error(res.errors[0] || "Failed to import links data.");
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
  icon: React.ReactNode;
  samplePlaceholder: string;
  onImport: (rawJson: string) => Promise<boolean>;
}

function GenericJsonImportModal({
  open,
  onOpenChange,
  title,
  description,
  icon,
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
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">{title}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 truncate">{description}</DialogDescription>
            </div>
          </div>
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
              Drop <code className="font-mono text-primary font-semibold">.json</code> file here
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Paste Raw JSON Data</label>
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

          <div className="rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3 text-primary shrink-0" />
              Smart Duplicate Handling
            </p>
            <p className="leading-normal">
              Existing records with matching names or URLs will be updated with imported data, preserving custom properties.
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
            Import JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

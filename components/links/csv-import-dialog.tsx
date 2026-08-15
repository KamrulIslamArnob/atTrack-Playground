"use client";

import { useMemo, useState } from "react";
import type { CsvLinkRow, LinkCategory } from "@/lib/types/links";
import {
  formatLinksWithAi,
  importLinks,
} from "@/lib/actions/links-import";
import { parseCsvRaw } from "@/lib/links-csv";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, ClipboardPaste, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: LinkCategory[];
  initialCategoryId?: string;
  onDone: (created: number) => void;
}

type Tab = "upload" | "paste";
type Stage = "input" | "preview" | "done";

export function CsvImportDialog({
  open,
  onOpenChange,
  categories,
  initialCategoryId,
  onDone,
}: CsvImportDialogProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [rows, setRows] = useState<CsvLinkRow[]>([]);
  const [useAi, setUseAi] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{
    created: number;
    failed: number;
    skipped: { title: string; reason: string }[];
  } | null>(null);

  const sourceText = tab === "upload" ? fileText : pasted;

  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) {
      m[c.name] = c.id;
      m[c.name.toLowerCase()] = c.id;
    }
    return m;
  }, [categories]);

  const defaultCatId = initialCategoryId || categories[0]?.id || "";

  const rowTargetCat = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of rows) {
      const cat = (r.categoryName ?? "").trim();
      m[r.id] = (cat && categoryMap[cat]) || (cat && categoryMap[cat.toLowerCase()]) || defaultCatId;
    }
    return m;
  }, [rows, categoryMap, defaultCatId]);

  const [chosen, setChosen] = useState<Record<string, string>>({});

  const setRowCat = (rowId: string, catId: string) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, categoryName: categories.find((c) => c.id === catId)?.name } : r)));
    // store the chosen id in a parallel map via a ref-like state
    setChosen((prev) => ({ ...prev, [rowId]: catId }));
  };

  const effectiveTarget = (rowId: string): string =>
    chosen[rowId] ?? rowTargetCat[rowId] ?? defaultCatId;

  const hasInput = sourceText.trim().length > 0;

  const startParse = async () => {
    if (!hasInput) return;
    setProcessing(true);
    try {
      let parsed: CsvLinkRow[] = [];
      if (useAi) {
        const ai = await formatLinksWithAi(sourceText);
        if (ai && ai.rows.length > 0) parsed = ai.rows;
      }
      if (parsed.length === 0) {
        parsed = parseCsvRaw(sourceText);
      }
      if (parsed.length === 0) {
        toast.error("No links detected. Check the format and try again.");
        return;
      }
      setRows(parsed);
      setChosen({});
      setStage("preview");
    } finally {
      setProcessing(false);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setFileText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      // Rebuild a name->id map including any chosen overrides.
      const overrides: Record<string, string> = { ...categoryMap };
      for (const r of rows) {
        const targetId = effectiveTarget(r.id);
        const cat = categories.find((c) => c.id === targetId);
        if (cat) overrides[cat.name] = cat.id;
      }
      const res = await importLinks(rows, overrides, defaultCatId);
      setReport(res);
      setStage("done");
      if (res.created > 0) {
        toast.success(`Imported ${res.created} link${res.created === 1 ? "" : "s"}.`);
      }
      if (res.failed > 0 || res.skipped.length > 0) {
        toast.warning(`${res.failed} failed, ${res.skipped.length} skipped.`);
      }
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStage("input");
    setRows([]);
    setChosen({});
    setReport(null);
    setPasted("");
    setFileText("");
    setFileName("");
  };

  const close = () => {
    const created = report?.created ?? 0;
    onOpenChange(false);
    if (created > 0) onDone(created);
    reset();
  };

  const previewRows = rows.slice(0, 50);
  const extraCount = rows.length - previewRows.length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Import Links from CSV</DialogTitle>
        </DialogHeader>

        {stage !== "done" && (
          <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 mb-4">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                tab === "upload" ? "bg-card shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="size-3.5" /> Upload File
            </button>
            <button
              type="button"
              onClick={() => setTab("paste")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                tab === "paste" ? "bg-card shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardPaste className="size-3.5" /> Paste Text
            </button>
          </div>
        )}

        {stage === "input" && (
          <div className="space-y-4">
            {tab === "upload" ? (
              <label
                htmlFor="csv-file"
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/30 py-10 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <FileSpreadsheet className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {fileName || "Drop a CSV file or click to browse"}
                </span>
                <span className="text-xs text-muted-foreground">.csv or .txt</span>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Paste CSV or link list
                </Label>
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={8}
                  placeholder={"title,url,category,notes,tags\nLinkedIn,https://linkedin.com,Recruitment Portals,,social\nJobBoard,https://jobboard.com"}
                  className="rounded-lg text-xs font-mono resize-none"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              Use AI to format messy / irregular rows (falls back to auto-parse if no AI key)
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={startParse}
                disabled={!hasInput || processing}
                className="rounded-lg bg-gradient-brand text-foreground font-medium"
              >
                {processing ? "Parsing..." : "Parse & Preview"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "preview" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {rows.length} link{rows.length === 1 ? "" : "s"} detected. Review and set the target category, then import.
            </p>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="max-h-[40vh] overflow-y-auto divide-y divide-border/50">
                {previewRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{r.title || "(no title)"}</div>
                      <div className="text-muted-foreground truncate">{r.url || "(no url)"}</div>
                    </div>
                    {r.needsReview && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-3" /> review
                      </span>
                    )}
                    <Select
                      value={effectiveTarget(r.id)}
                      onValueChange={(v) => v && setRowCat(r.id, v)}
                    >
                      <SelectTrigger className="w-40 h-8 rounded-lg text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {extraCount > 0 && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
                  + {extraCount} more row{extraCount === 1 ? "" : "s"} (all will be imported)
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStage("input")}
                className="rounded-lg"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={runImport}
                disabled={importing}
                className="rounded-lg bg-gradient-brand text-foreground font-medium"
              >
                {importing ? "Importing..." : `Import ${rows.length} Link${rows.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "done" && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm">
                <div className="font-medium text-foreground">{report.created} link{report.created === 1 ? "" : "s"} imported</div>
                {report.failed > 0 && (
                  <div className="text-muted-foreground">{report.failed} failed</div>
                )}
              </div>
            </div>
            {report.skipped.length > 0 && (
              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs font-medium text-foreground mb-1">Skipped ({report.skipped.length})</div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {report.skipped.map((s, i) => (
                    <li key={i}>
                      {s.title} — <span className="text-destructive/80">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={close} className="rounded-lg bg-gradient-brand text-foreground font-medium">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

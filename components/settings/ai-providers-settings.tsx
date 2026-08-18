"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  deleteProvider,
  getTaskRoutes,
  listProviders,
  testProviderConnection,
  exportAiProviders,
  importAiProviders,
} from "@/lib/actions/ai-providers";
import { AiProviderDialog } from "@/components/settings/ai-provider-dialog";
import { AiTaskRoutePicker } from "@/components/settings/ai-task-route-picker";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Trash2, Plug, ChevronDown } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { DownloadIcon } from "@/components/ui/download";
import { UploadIcon } from "@/components/ui/upload";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PROVIDER_TYPE_LABELS, type AiProviderSummary, type TaskType } from "@/lib/types/ai-providers";

interface AiProvidersSettingsProps {
  initialProviders: AiProviderSummary[];
  initialRoutes: Record<TaskType, AiProviderSummary[]>;
}

const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  text: "Resume matching, MCQ generation, email and AI Tools drafting.",
  scraping: "Job-posting extraction, including fetching a source URL.",
  image: "Reserved for a future feature — nothing uses this yet.",
};

export function AiProvidersSettings({ initialProviders, initialRoutes }: AiProvidersSettingsProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [routes, setRoutes] = useState(initialRoutes);
  const [dialogOpen, setDialogOpen] = useState<"add" | AiProviderSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attrack_ai_providers_collapsed");
      if (stored === "true") {
        setCollapsed(true);
      }
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("attrack_ai_providers_collapsed", String(next));
      return next;
    });
  };

  const refreshProviders = async () => {
    const [next, freshRoutes] = await Promise.all([listProviders(), getTaskRoutes()]);
    setProviders(next);
    setRoutes(freshRoutes);
    setDialogOpen(null);
  };

  const handleTest = async (p: AiProviderSummary) => {
    setTestingId(p.id);
    const res = await testProviderConnection({
      id: p.id,
      provider_type: p.provider_type,
      base_url: p.base_url,
      model: p.model,
    });
    setTestingId(null);
    await refreshProviders();

    if (res.success) {
      toast.success(`Connected to ${p.name} (${res.latencyMs ?? 0}ms)`);
    } else {
      toast.error(`Connection failed for ${p.name}: ${res.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteProvider(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider deleted");
      const freshRoutes = await getTaskRoutes();
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setRoutes(freshRoutes);
    }
    setDeletingId(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleExportJson = async () => {
    try {
      const data = await exportAiProviders();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attrack-ai-providers-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("AI Providers exported to JSON file");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't export AI providers");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const result = await importAiProviders(text);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Successfully imported ${result.count ?? 0} AI provider(s)!`);
        await refreshProviders();
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read JSON file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const providerSetKey = providers.map((p) => p.id).join(",");

  return (
    <Card className="border-border shadow-xs overflow-hidden transition-all py-0 gap-0">
      <CardHeader
        onClick={toggleCollapsed}
        className={cn(
          "cursor-pointer select-none px-6 py-5 hover:bg-muted/40 transition-colors",
          collapsed ? "rounded-2xl" : "rounded-t-2xl"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <SparklesIcon className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-foreground">
                  AI Providers & Task Routing
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal">
                  {providers.length} {providers.length === 1 ? "provider" : "providers"}
                </Badge>
              </div>
              <CardDescription className="text-xs sm:text-sm mt-0.5">
                Connect LLM credentials and set fallback priority routes for generation and scraping.
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand AI Providers" : "Minimize AI Providers"}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                collapsed ? "-rotate-90" : "rotate-0"
              )}
            />
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-6 px-6 pb-6 pt-2">
              {/* Providers List Section */}
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">Configured Providers</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
                    >
                      <UploadIcon className="size-3.5" />
                      {importing ? "Importing..." : "Import JSON"}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
                    >
                      <DownloadIcon className="size-3.5" />
                      Export JSON
                    </button>

                    <button
                      type="button"
                      onClick={() => setDialogOpen("add")}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
                    >
                      <PlusIcon className="size-3.5" />
                      Add provider
                    </button>
                  </div>
                </div>

                {providers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No AI providers connected yet. Click <strong>Add provider</strong> above to connect Google Gemini, OpenAI, or Anthropic.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {providers.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col gap-3 rounded-2xl border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline">{PROVIDER_TYPE_LABELS[p.provider_type]}</Badge>
                          <Badge
                            variant="outline"
                            className={p.verified ? "border-success/30 text-success" : "border-warning/30 text-warning"}
                          >
                            {p.verified ? "Verified" : "Not verified"}
                          </Badge>
                          <span className="min-w-0 truncate font-medium">{p.name}</span>
                          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{p.model}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 self-start sm:shrink-0 sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleTest(p)}
                            disabled={testingId === p.id}
                            title="Test connection"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
                          >
                            {testingId === p.id ? <Spinner className="size-3.5" /> : <Plug className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDialogOpen(p)}
                            title="Edit provider"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            title="Delete provider"
                            className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer"
                          >
                            {deletingId === p.id ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/80" />

              {/* Task Routing Section */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Task Routing Hierarchy</p>
                  <p className="text-xs text-muted-foreground">
                    Define the priority sequence of models for each task. Top priority model is attempted first; fallback occurs in order.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {(Object.keys(TASK_DESCRIPTIONS) as TaskType[]).map((taskType) => (
                    <AiTaskRoutePicker
                      key={`${taskType}-${providerSetKey}`}
                      taskType={taskType}
                      description={TASK_DESCRIPTIONS[taskType]}
                      allProviders={providers}
                      initialSelectedIds={(routes[taskType] ?? []).map((p) => p.id)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>

      {dialogOpen && (
        <AiProviderDialog
          provider={dialogOpen === "add" ? null : dialogOpen}
          onClose={() => setDialogOpen(null)}
          onSaved={refreshProviders}
        />
      )}
    </Card>
  );
}

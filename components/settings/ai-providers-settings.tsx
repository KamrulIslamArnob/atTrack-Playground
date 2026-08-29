"use client";

import { useState, useRef } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, Plug, MoreHorizontal, KeyRound } from "lucide-react";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { DownloadIcon } from "@/components/ui/download";
import { UploadIcon } from "@/components/ui/upload";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PROVIDER_TYPE_LABELS, type AiProviderSummary, type TaskType } from "@/lib/types/ai-providers";

interface AiProvidersSettingsProps {
  initialProviders: AiProviderSummary[];
  initialRoutes: Record<TaskType, AiProviderSummary[]>;
}

const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  text: "Chat, drafting, resume matching, MCQs",
  scraping: "Job-posting extraction",
  image: "Nothing uses this yet",
};

function VerificationDot({ verified }: { verified: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex size-2.5 shrink-0 cursor-default items-center justify-center"
            aria-label={verified ? "Verified" : "Not verified"}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                verified ? "bg-success" : "bg-warning"
              )}
            />
          </span>
        }
      />
      <TooltipContent side="top">
        {verified ? "Key tested and working" : "Not tested yet"}
      </TooltipContent>
    </Tooltip>
  );
}

export function AiProvidersSettings({ initialProviders, initialRoutes }: AiProvidersSettingsProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [routes, setRoutes] = useState(initialRoutes);
  const [dialogOpen, setDialogOpen] = useState<"add" | AiProviderSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

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
      toast.error(`Couldn't connect to ${p.name}`, {
        description: res.error,
      });
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
      a.download = `betterjob-ai-providers-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Providers exported to JSON");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't export providers");
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
        const count = result.count ?? 0;
        toast.success(count === 1 ? "Imported 1 provider" : `Imported ${count} providers`);
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
    <>
      <section
        aria-labelledby="ai-providers-heading"
        className="rounded-2xl bg-muted p-4 sm:p-5"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex min-w-0 items-center gap-2">
              <h2 id="ai-providers-heading" className="text-sm font-semibold tracking-tight text-foreground">
                AI model providers
              </h2>
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
                {providers.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Configure your BYOK API keys and assign models to specific tasks
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen("add")}
            >
              <PlusIcon className="size-3.5" />
              Add provider
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                            aria-label="More provider actions"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          disabled={importing}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadIcon className="size-3.5" />
                          {importing ? "Importing…" : "Import JSON"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportJson}>
                          <DownloadIcon className="size-3.5" />
                          Export JSON
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-background/60 px-4 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <KeyRound className="size-4" />
            </span>
            <p className="font-heading text-sm font-semibold">No providers yet</p>
            <p className="max-w-[36ch] text-xs text-muted-foreground">
              Add a key so AI features have a model to use.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {providers.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                          <VerificationDot verified={p.verified} />
                          <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                            {p.model}
                          </span>
                          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                            {PROVIDER_TYPE_LABELS[p.provider_type]}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 self-end sm:self-auto">
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <button
                                type="button"
                                onClick={() => handleTest(p)}
                                disabled={testingId === p.id}
                                aria-label={`Test connection for ${p.name}`}
                                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:opacity-50"
                              >
                                {testingId === p.id ? (
                                  <Spinner className="size-3.5" />
                                ) : (
                                  <Plug className="size-3.5" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Test connection</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <button
                                type="button"
                                onClick={() => setDialogOpen(p)}
                                aria-label={`Edit ${p.name}`}
                                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Edit provider</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                disabled={deletingId === p.id}
                                aria-label={`Delete ${p.name}`}
                                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                              >
                                {deletingId === p.id ? (
                                  <Spinner className="size-3.5" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete provider</TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    ))}
                  </ul>
        )}

        <div className="my-4 border-t border-border/50" />

        {/* Routing lanes */}
        <section aria-label="Task routing" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Task routing matrix</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assign primary and fallback models for text processing, scraping, and generation
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
        </section>
      </section>

      {dialogOpen && (
        <AiProviderDialog
          provider={dialogOpen === "add" ? null : dialogOpen}
          onClose={() => setDialogOpen(null)}
          onSaved={refreshProviders}
        />
      )}
    </>
  );
}

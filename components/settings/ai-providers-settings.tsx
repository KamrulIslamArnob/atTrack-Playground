"use client";

import { useState } from "react";
import { deleteProvider, getTaskRoutes, listProviders } from "@/lib/actions/ai-providers";
import { AiProviderDialog } from "@/components/settings/ai-provider-dialog";
import { AiTaskRoutePicker } from "@/components/settings/ai-task-route-picker";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

  const refreshProviders = async () => {
    const next = await listProviders();
    setProviders(next);
    // The DB is the source of truth for routes — re-fetching (rather than
    // filtering the previous in-memory state) picks up any assignment made
    // earlier in the session that the picker's local state never reported
    // back up to us.
    setRoutes(await getTaskRoutes());
    setDialogOpen(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteProvider(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Provider deleted.");
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setRoutes(await getTaskRoutes());
    }
    setDeletingId(null);
  };

  // Forces the three pickers to remount (and re-read routes/providers into
  // their own local state) whenever the provider set changes — otherwise a
  // deleted provider would linger in a picker's already-initialized state.
  const providerSetKey = providers.map((p) => p.id).join(",");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Providers</p>
          <button
            type="button"
            onClick={() => setDialogOpen("add")}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="size-3.5" />
            Add provider
          </button>
        </div>

        {providers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No providers configured — using the default Gemini key from GEMINI_API_KEY for everything.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{PROVIDER_TYPE_LABELS[p.provider_type]}</Badge>
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{p.model}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setDialogOpen(p)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deletingId === p.id ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Task routing</p>
        <div className="grid gap-3 sm:grid-cols-3">
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

      {dialogOpen !== null && (
        <AiProviderDialog
          provider={dialogOpen === "add" ? null : dialogOpen}
          onClose={() => setDialogOpen(null)}
          onSaved={refreshProviders}
        />
      )}
    </div>
  );
}

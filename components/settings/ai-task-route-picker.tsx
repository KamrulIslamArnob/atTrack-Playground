"use client";

import { useState, useEffect } from "react";
import { saveTaskRoute } from "@/lib/actions/ai-providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, X, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { TASK_TYPE_LABELS, type AiProviderSummary, type TaskType } from "@/lib/types/ai-providers";

interface AiTaskRoutePickerProps {
  taskType: TaskType;
  description: string;
  allProviders: AiProviderSummary[];
  initialSelectedIds: string[];
}

export function AiTaskRoutePicker({ taskType, description, allProviders, initialSelectedIds }: AiTaskRoutePickerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds.join(",")]);

  const save = async (next: string[]) => {
    const prev = selectedIds;
    setSelectedIds(next);
    setSaving(true);
    try {
      const result = await saveTaskRoute(taskType, next);
      if (result.error) {
        setSelectedIds(prev);
        toast.error(result.error);
      } else {
        toast.success("Routing updated");
      }
    } catch {
      setSelectedIds(prev);
      toast.error("Couldn't save routing");
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = allProviders.filter((p) => !selectedIds.includes(p.id));
  const selected = selectedIds.map((id) => allProviders.find((p) => p.id === id)).filter((p): p is AiProviderSummary => !!p);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= selected.length) return;
    const next = selected.map((p) => p.id);
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    save(next);
  };

  const remove = (id: string) => {
    save(selectedIds.filter((sid) => sid !== id));
  };

  return (
    <div className="rounded-xl bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-none">{TASK_TYPE_LABELS[taskType]}</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {saving && (
          <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
            Saving…
          </span>
        )}
      </div>

      <div className="mt-3">
        {selected.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-center">
            <p className="text-xs text-muted-foreground">
              No chain yet — falls back to any available provider.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-0.5">
            {selected.length > 1 && (
              <span
                aria-hidden="true"
                className="absolute bottom-[13px] left-[7px] top-[13px] w-px bg-border"
              />
            )}
            {selected.map((p, i) => (
              <li key={p.id} className="relative flex items-start gap-2 py-1 pr-0.5">
                <span
                  aria-hidden="true"
                  className="relative z-10 mt-[5px] flex w-4 shrink-0 justify-center"
                >
                  <span className="size-2 rounded-full bg-primary" />
                </span>
                <span className="min-w-0 flex-1 pt-px">
                  <span className="block truncate text-sm font-medium leading-tight">
                    <span className="sr-only">Priority {i + 1}: </span>
                    {p.name}
                    {!p.verified && (
                      <>
                        {" "}
                        <TriangleAlert
                          aria-label="Not verified"
                          className="inline size-3 shrink-0 text-warning"
                        />
                      </>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || saving}
                    aria-label={`Move ${p.name} up`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1 || saving}
                    aria-label={`Move ${p.name} down`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={saving}
                    aria-label={`Remove ${p.name} from ${TASK_TYPE_LABELS[taskType]}`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {availableToAdd.length > 0 && (
        <Select
          onValueChange={(value) => {
            if (typeof value === "string" && value) save([...selectedIds, value]);
          }}
        >
          <SelectTrigger className="mt-2.5 h-8 w-full text-xs">
            <SelectValue placeholder="Add provider" />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name} — {p.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

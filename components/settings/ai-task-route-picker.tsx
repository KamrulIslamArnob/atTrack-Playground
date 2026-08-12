"use client";

import { useState } from "react";
import { saveTaskRoute } from "@/lib/actions/ai-providers";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, X } from "lucide-react";
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

  const save = async (next: string[]) => {
    const prev = selectedIds;
    setSelectedIds(next);
    setSaving(true);
    const result = await saveTaskRoute(taskType, next);
    if (result.error) {
      setSelectedIds(prev);
      toast.error(result.error);
    }
    setSaving(false);
  };

  const availableToAdd = allProviders.filter((p) => !selectedIds.includes(p.id));
  const selected = selectedIds
    .map((id) => allProviders.find((p) => p.id === id))
    .filter((p): p is AiProviderSummary => !!p);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border p-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{TASK_TYPE_LABELS[taskType]}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
      </div>

      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">Using default Gemini (from GEMINI_API_KEY).</p>
      ) : (
        <ul className="space-y-1.5">
          {selected.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Badge variant="secondary">{i + 1}</Badge>
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="min-w-0 truncate text-muted-foreground">({p.model})</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => save(selectedIds.filter((id) => id !== p.id))}
                  className="rounded p-1 text-destructive hover:bg-destructive/10"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {availableToAdd.length > 0 && (
        <Select onValueChange={(id) => save([...selectedIds, id as string])}>
          <SelectTrigger className="h-9 w-full text-xs">
            <SelectValue placeholder="+ Add provider to this task" />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} ({p.model})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

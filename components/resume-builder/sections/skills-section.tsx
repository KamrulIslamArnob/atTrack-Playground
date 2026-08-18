"use client";

import { EntryCard } from "../interactive/entry-card";
import { ClickToEditField } from "../interactive/click-to-edit-field";
import { InlineRichText } from "../interactive/inline-rich-text";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { SkillRow } from "@/lib/types/resume-builder";
import { generateUUID } from "@/lib/utils";

interface SkillsSectionEditorProps {
  visible: boolean;
  rows: SkillRow[];
  callout: string;
  onChange: (rows: SkillRow[], callout: string, visible: boolean) => void;
}

export function SkillsSectionEditor({
  visible,
  rows,
  callout,
  onChange,
}: SkillsSectionEditorProps) {
  const handleUpdate = (id: string, updates: Partial<SkillRow>) => {
    onChange(
      rows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      callout,
      visible
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rows.length) return;
    const newRows = [...rows];
    const [moved] = newRows.splice(index, 1);
    newRows.splice(newIndex, 0, moved);
    onChange(newRows, callout, visible);
  };

  const handleDelete = (id: string) => {
    onChange(
      rows.filter((r) => r.id !== id),
      callout,
      visible
    );
  };

  const handleAdd = () => {
    onChange(
      [...rows, { id: generateUUID(), label: "", value: "" }],
      callout,
      visible
    );
  };

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
          No skill categories yet.
        </div>
      )}
      {rows.map((row, index) => (
        <EntryCard
          key={row.id}
          index={index}
          total={rows.length}
          ariaLabel={`Skill row ${index + 1}: ${row.label || "untitled"}`}
          onMoveUp={() => handleMove(index, "up")}
          onMoveDown={() => handleMove(index, "down")}
          onDelete={() => handleDelete(row.id)}
        >
          <div className="grid gap-3 sm:grid-cols-[0.35fr_0.65fr]">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Label</p>
              <ClickToEditField
                value={row.label}
                onChange={(v) => handleUpdate(row.id, { label: v })}
                placeholder="e.g. Languages"
                ariaLabel={`Skill row ${index + 1} label`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Skills</p>
              <InlineRichText
                value={row.value}
                onChange={(v) => handleUpdate(row.id, { value: v })}
                placeholder="Click to add skills…"
                ariaLabel={`Skill row ${index + 1} value`}
              />
            </div>
          </div>
        </EntryCard>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-3.5" /> Add skill category
      </Button>
      <div>
        <p className="text-xs text-muted-foreground mb-1">AI development callout</p>
        <InlineRichText
          value={callout}
          onChange={(v) => onChange(rows, v, visible)}
          placeholder="Click to add callout…"
          ariaLabel="AI development callout"
        />
      </div>
    </div>
  );
}

"use client";

import { EntryCard } from "../interactive/entry-card";
import { ClickToEditField } from "../interactive/click-to-edit-field";
import { InlineRichText } from "../interactive/inline-rich-text";
import { DateField } from "../interactive/date-field";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { SubheadingEntry } from "@/lib/types/resume-builder";
import { generateUUID } from "@/lib/utils";

interface SubheadingSectionEditorProps {
  title: string;
  visible: boolean;
  entries: SubheadingEntry[];
  onChange: (entries: SubheadingEntry[], visible: boolean) => void;
}

export function SubheadingSectionEditor({
  title,
  visible,
  entries,
  onChange,
}: SubheadingSectionEditorProps) {
  const handleUpdate = (id: string, updates: Partial<SubheadingEntry>) => {
    onChange(
      entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      visible
    );
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= entries.length) return;
    const newEntries = [...entries];
    const [moved] = newEntries.splice(index, 1);
    newEntries.splice(newIndex, 0, moved);
    onChange(newEntries, visible);
  };

  const handleDelete = (id: string) => {
    onChange(
      entries.filter((e) => e.id !== id),
      visible
    );
  };

  const handleAdd = () => {
    onChange(
      [
        ...entries,
        {
          id: generateUUID(),
          left1: "",
          right1: "",
          left2: "",
          right2: "",
          bullets: [],
        },
      ],
      visible
    );
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} yet.
        </div>
      )}
      {entries.map((entry, index) => (
        <EntryCard
          key={entry.id}
          index={index}
          total={entries.length}
          ariaLabel={`${title} entry ${index + 1}: ${entry.left1 || "untitled"}`}
          onMoveUp={() => handleMove(index, "up")}
          onMoveDown={() => handleMove(index, "down")}
          onDelete={() => handleDelete(entry.id)}
          onAddAfter={() => {
            const newEntries = [...entries];
            newEntries.splice(index + 1, 0, {
              id: generateUUID(),
              left1: "",
              right1: "",
              left2: "",
              right2: "",
              bullets: [],
            });
            onChange(newEntries, visible);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Organization / School</p>
              <ClickToEditField
                value={entry.left1}
                onChange={(v) => handleUpdate(entry.id, { left1: v })}
                placeholder="Click to add organization…"
                ariaLabel={`${title} entry ${index + 1} organization`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Right-side detail</p>
              <InlineRichText
                value={entry.right1}
                onChange={(v) => handleUpdate(entry.id, { right1: v })}
                placeholder="Click to add detail…"
                ariaLabel={`${title} entry ${index + 1} detail`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Role / Degree</p>
              <ClickToEditField
                value={entry.left2}
                onChange={(v) => handleUpdate(entry.id, { left2: v })}
                placeholder="Click to add role…"
                ariaLabel={`${title} entry ${index + 1} role`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date</p>
              <DateField
                value={entry.right2}
                onChange={(v) => handleUpdate(entry.id, { right2: v })}
                ariaLabel={`${title} entry ${index + 1} date`}
              />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Bullets</p>
            <BulletListEditor
              bullets={entry.bullets}
              onChange={(bullets) => handleUpdate(entry.id, { bullets })}
            />
          </div>
        </EntryCard>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="size-3.5" /> Add {title.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}

function BulletListEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  return (
    <div className="space-y-2 border-l-2 border-muted pl-3">
      {bullets.map((bullet, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-muted-foreground mt-1">•</span>
          <div className="flex-1">
            <InlineRichText
              value={bullet}
              onChange={(v) => onChange(bullets.map((b, i) => (i === index ? v : b)))}
              placeholder="Click to add bullet…"
              ariaLabel={`Bullet ${index + 1}`}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(bullets.filter((_, i) => i !== index))}
            aria-label={`Remove bullet ${index + 1}`}
          >
            <span className="size-4 text-xs">✕</span>
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...bullets, ""])}
      >
        <Plus className="size-3" /> Add bullet
      </Button>
    </div>
  );
}

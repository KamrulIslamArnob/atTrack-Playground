"use client";

import { ClickToEditField } from "../interactive/click-to-edit-field";
import { InlineRichText } from "../interactive/inline-rich-text";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ResumeLink } from "@/lib/types/resume-builder";

interface HeaderSectionEditorProps {
  name: string;
  title: string;
  summary: string;
  topLinks: ResumeLink[];
  bottomLinks: ResumeLink[];
  onUpdateName: (name: string) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateSummary: (summary: string) => void;
  onUpdateTopLinks: (links: ResumeLink[]) => void;
  onUpdateBottomLinks: (links: ResumeLink[]) => void;
}

export function HeaderSectionEditor({
  name,
  title,
  summary,
  topLinks,
  bottomLinks,
  onUpdateName,
  onUpdateTitle,
  onUpdateSummary,
  onUpdateTopLinks,
  onUpdateBottomLinks,
}: HeaderSectionEditorProps) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Full name</p>
        <ClickToEditField
          value={name}
          onChange={onUpdateName}
          placeholder="Click to add name…"
          ariaLabel="Full name"
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Professional title</p>
        <ClickToEditField
          value={title}
          onChange={onUpdateTitle}
          placeholder="Click to add title…"
          ariaLabel="Professional title"
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Summary</p>
        <InlineRichText
          value={summary}
          onChange={onUpdateSummary}
          placeholder="Click to write a 2-3 sentence professional summary…"
          ariaLabel="Summary"
        />
      </div>
      <LinkGroup title="Top links" links={topLinks} onChange={onUpdateTopLinks} />
      <LinkGroup title="Bottom links" links={bottomLinks} onChange={onUpdateBottomLinks} />
    </div>
  );
}

function LinkGroup({
  title,
  links,
  onChange,
}: {
  title: string;
  links: ResumeLink[];
  onChange: (links: ResumeLink[]) => void;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...links,
              { id: crypto.randomUUID(), variant: "contact", icon: "globe", label: "", url: "" },
            ])
          }
        >
          <Plus className="size-3.5" /> Add link
        </Button>
      </div>
      {links.map((link, index) => (
        <div key={link.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Label</p>
            <ClickToEditField
              value={link.label}
              onChange={(v) =>
                onChange(links.map((l) => (l.id === link.id ? { ...l, label: v } : l)))
              }
              placeholder="e.g. GitHub"
              ariaLabel={`${title} ${index + 1} label`}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">URL (optional)</p>
            <ClickToEditField
              value={link.url ?? ""}
              onChange={(v) =>
                onChange(links.map((l) => (l.id === link.id ? { ...l, url: v || undefined } : l)))
              }
              placeholder="https://…"
              ariaLabel={`${title} ${index + 1} URL`}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Pill style</p>
            <select
              value={link.variant}
              onChange={(e) =>
                onChange(
                  links.map((l) =>
                    l.id === link.id ? { ...l, variant: e.target.value as "port" | "contact" } : l
                  )
                )
              }
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            >
              <option value="port">Portfolio accent</option>
              <option value="contact">Contact</option>
            </select>
          </div>
          <div className="flex items-end justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(links.filter((l) => l.id !== link.id))}
            >
              <Trash2 className="size-3.5" /> Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

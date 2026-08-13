"use client";

import { useState } from "react";
import { QuickShortcut } from "@/lib/types/links";
import { QuickShortcutDialog } from "./quick-shortcut-dialog";
import { RenderShortcutIcon } from "./social-icons";
import { InfoTooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Plus,
  Pencil,
} from "lucide-react";

interface QuickShortcutsBarProps {
  shortcuts: QuickShortcut[];
  onAddShortcut: (input: { title: string; value: string; icon?: string }) => Promise<void>;
  onUpdateShortcut: (id: string, input: { title?: string; value?: string; icon?: string }) => Promise<void>;
  onDeleteShortcut: (id: string) => Promise<void>;
}

export function QuickShortcutsBar({
  shortcuts,
  onAddShortcut,
  onUpdateShortcut,
  onDeleteShortcut,
}: QuickShortcutsBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<QuickShortcut | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingShortcut(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (sc: QuickShortcut) => {
    setEditingShortcut(sc);
    setDialogOpen(true);
  };

  const handleCopy = async (sc: QuickShortcut) => {
    if (!sc.value || !sc.value.trim()) {
      toast.info(`Set value for "${sc.title}" to copy with one click`);
      handleOpenEdit(sc);
      return;
    }

    try {
      await navigator.clipboard.writeText(sc.value.trim());
      setCopiedId(sc.id);
      toast.success(`Copied ${sc.title} to clipboard!`);
      setTimeout(() => {
        setCopiedId((curr) => (curr === sc.id ? null : curr));
      }, 1800);
    } catch {
      toast.error(`Failed to copy ${sc.title}`);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-3 shadow-2xs backdrop-blur-xs">
      <div className="flex flex-wrap items-center gap-2">
        {shortcuts.map((sc) => {
          const isCopied = copiedId === sc.id;
          const hasValue = Boolean(sc.value && sc.value.trim());

          return (
            <div
              key={sc.id}
              onClick={() => handleCopy(sc)}
              title={
                isCopied
                  ? "Copied to clipboard!"
                  : hasValue
                  ? `Click to copy ${sc.title}: ${sc.value}`
                  : `Click to set ${sc.title} value`
              }
              className={`group relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200 ease-out cursor-pointer select-none active:scale-[0.96] hover:-translate-y-0.5 ${
                isCopied
                  ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/20"
                  : hasValue
                  ? "border-border/80 bg-background/80 hover:bg-card hover:border-zinc-400 dark:hover:border-zinc-600 text-foreground shadow-2xs hover:shadow-xs"
                  : "border-dashed border-border/70 bg-muted/30 hover:bg-muted/60 text-muted-foreground"
              }`}
            >
              {/* Platform Icon */}
              <span className="shrink-0 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-translate-y-0.5 text-zinc-800 dark:text-zinc-200">
                {isCopied ? (
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-150" />
                ) : (
                  <RenderShortcutIcon icon={sc.icon} className="size-4 text-zinc-700 dark:text-zinc-300" />
                )}
              </span>

              {/* Title */}
              <span className="font-semibold tracking-tight truncate max-w-[120px] text-zinc-800 dark:text-zinc-200">
                {sc.title}
              </span>

              {/* Quick Edit Action Button (Revealed on Hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(sc);
                }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100 rounded-md hover:bg-muted/80 active:scale-90 shrink-0 -mr-1"
                title="Edit Link / Value"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          );
        })}

        {/* Add Shortcut (+) Button & Info Tooltip */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-muted/60 hover:-translate-y-0.5 active:scale-[0.96]"
            title="Add New Quick Copy Shortcut"
          >
            <Plus className="size-4 text-zinc-700 dark:text-zinc-300 transition-transform duration-200 group-hover:rotate-90" />
            <span>Add Shortcut</span>
          </button>
          <InfoTooltip
            content="Quick Copy Bar: Pin your most-used portfolio links, emails, handles, or phone numbers here for 1-click clipboard copying while applying to jobs."
            side="top"
          />
        </div>
      </div>

      {/* Dialog for Add / Edit */}
      <QuickShortcutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        shortcutToEdit={editingShortcut}
        onSubmit={async (input, editId) => {
          if (editId) {
            await onUpdateShortcut(editId, input);
            toast.success("Shortcut updated");
          } else {
            await onAddShortcut(input);
            toast.success("Shortcut added");
          }
        }}
        onDelete={async (id) => {
          await onDeleteShortcut(id);
          toast.success("Shortcut deleted");
        }}
      />
    </div>
  );
}

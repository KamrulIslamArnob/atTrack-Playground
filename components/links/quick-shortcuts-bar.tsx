"use client";

import { useState } from "react";
import { QuickShortcut } from "@/lib/types/links";
import { QuickShortcutDialog } from "./quick-shortcut-dialog";
import { RenderShortcutIcon } from "./social-icons";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";

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
    <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
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
              className={`group relative h-8 inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition-all duration-150 ease-out cursor-pointer select-none active:scale-[0.97] ${
                isCopied
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500/30"
                  : hasValue
                  ? "border-border bg-background hover:bg-accent text-foreground shadow-2xs"
                  : "border-dashed border-border bg-muted/40 hover:bg-muted text-muted-foreground"
              }`}
            >
              {/* Platform Icon */}
              <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                {isCopied ? (
                  <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-150" />
                ) : (
                  <RenderShortcutIcon icon={sc.icon} className="size-3.5" />
                )}
              </span>

              {/* Title */}
              <span className="font-medium tracking-tight truncate max-w-[120px] leading-none">
                {sc.title}
              </span>

              {/* Quick Edit Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(sc);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted active:scale-90 inline-flex items-center justify-center shrink-0 -mr-0.5"
                title="Edit Shortcut"
              >
                <Pencil className="size-2.5" />
              </button>
            </div>
          );
        })}

        {/* Add Shortcut (+) Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-8 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-[0.97]"
          title="Add Quick Copy Shortcut"
        >
          <PlusIcon className="size-3.5 shrink-0" />
          <span>Add Quick Copy Shortcut</span>
        </button>
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

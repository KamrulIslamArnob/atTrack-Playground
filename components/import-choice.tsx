"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { XIcon } from "@/components/ui/x";
import { AddJobDialog } from "@/components/add-job-dialog";
import { AiImport } from "@/components/job-import/ai-import";
import type { BoardList } from "@/lib/types/board";

export interface ImportChoiceProps {
  /** User's board lists, for the section-deadline target picker. */
  lists?: BoardList[];
  /** Preselected board list/column ID */
  listId?: string;
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Controlled open change handler */
  onOpenChange?: (open: boolean) => void;
  /** Optional button styling when using default trigger */
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ImportChoice({
  lists = [],
  listId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  className,
  variant,
  size = "sm",
}: ImportChoiceProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [choice, setChoice] = useState<"manual" | "ai" | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChoice(null);
    }
    if (isControlled) {
      onOpenChange?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen || choice !== null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, choice]);

  return (
    <>
      {trigger ? (
        React.isValidElement(trigger) ? (
          React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
            onClick: () => handleOpenChange(true),
          })
        ) : (
          <span onClick={() => handleOpenChange(true)} className="cursor-pointer">
            {trigger}
          </span>
        )
      ) : !isControlled ? (
        <Button variant={variant} size={size} className={className} onClick={() => handleOpenChange(true)}>
          <Plus className="mr-1 size-4" />
          Add Job
        </Button>
      ) : null}

      {/* Choice Modal */}
      {isOpen && choice === null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleOpenChange(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-foreground">Add Job</h2>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              How do you want to add this job?
            </p>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setChoice("manual")}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-border/80 bg-background p-4 text-left transition-all hover:bg-muted/60 hover:border-border cursor-pointer active:scale-[0.98]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Plus className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Enter it yourself</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Type in the title, company, and details manually
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChoice("ai")}
                className="group flex w-full items-center gap-3.5 rounded-2xl border border-border/80 bg-background p-4 text-left transition-all hover:bg-muted/60 hover:border-border cursor-pointer active:scale-[0.98]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <SparklesIcon className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">Import with AI</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Screenshot or paste text — atTrack reads and fills in details
                  </p>
                </div>
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full cursor-pointer"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Manual Entry Flow */}
      <AddJobDialog
        trigger={<span className="hidden" />}
        open={isOpen && choice === "manual"}
        onOpenChange={(o) => {
          if (!o) {
            handleOpenChange(false);
          }
        }}
        listId={listId}
        lists={lists}
      />

      {/* AI Import Flow */}
      {isOpen && choice === "ai" && (
        <AiImport
          lists={lists}
          listId={listId}
          onClose={() => {
            handleOpenChange(false);
          }}
        />
      )}
    </>
  );
}

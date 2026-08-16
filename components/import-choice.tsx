"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { XIcon } from "@/components/ui/x";
import { AddJobDialog } from "@/components/add-job-dialog";
import { AiImport } from "@/components/job-import/ai-import";
import type { BoardList } from "@/lib/types/board";

interface ImportChoiceProps {
  /** User's board lists, for the section-deadline target picker. */
  lists?: BoardList[];
}

export function ImportChoice({ lists = [] }: ImportChoiceProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"manual" | "ai" | null>(null);

  if (choice === "ai") {
    return <AiImport lists={lists} onClose={() => { setChoice(null); setOpen(false); }} />;
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" />
        Add Job
      </Button>

      {open && choice !== "manual" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              How do you want to add this job?
            </p>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => setChoice("manual")}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  <Plus className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Enter it yourself</p>
                  <p className="text-xs text-muted-foreground">
                    Type in the title, company, and details
                  </p>
                </div>
              </button>

              <button
                onClick={() => setChoice("ai")}
                className="flex w-full items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  <SparklesIcon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Import with AI</p>
                  <p className="text-xs text-muted-foreground">
                    Screenshot or paste text — atTrack reads it and fills in the details
                  </p>
                </div>
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <AddJobDialog
        trigger={<span className="hidden" />}
        open={choice === "manual"}
        onOpenChange={(o) => {
          if (!o) {
            setChoice(null);
            setOpen(false);
          }
        }}
        lists={lists}
      />
    </>
  );
}

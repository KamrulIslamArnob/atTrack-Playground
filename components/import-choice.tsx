"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Camera, X } from "lucide-react";
import { AddJobDialog } from "@/components/add-job-dialog";
import { ScreenshotUpload } from "@/components/job-import/screenshot-upload";

export function ImportChoice() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"manual" | "import" | null>(null);

  if (choice === "import") {
    return <ScreenshotUpload onClose={() => { setChoice(null); setOpen(false); }} />;
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" />
        Add Job
      </Button>

      {open && choice !== "manual" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-4xl border border-border bg-card p-6 shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Add Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              How would you like to add this job?
            </p>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => setChoice("manual")}
                className="flex w-full items-center gap-3 rounded-4xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-4xl bg-muted">
                  <Plus className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Enter Manually</p>
                  <p className="text-xs text-muted-foreground">
                    Fill in the job details yourself
                  </p>
                </div>
              </button>

              <button
                onClick={() => setChoice("import")}
                className="flex w-full items-center gap-3 rounded-4xl border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-4xl bg-muted">
                  <Camera className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Import from Screenshot</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a screenshot and AI will extract the details
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
        open={choice === "manual"}
        onOpenChange={(o) => {
          if (!o) {
            setChoice(null);
            setOpen(false);
          }
        }}
      />
    </>
  );
}

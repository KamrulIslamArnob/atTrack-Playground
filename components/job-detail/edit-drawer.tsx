"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EditTab } from "@/components/job-detail/tabs/edit-tab";
import type { JobDetailData } from "@/lib/types/job-detail";

interface EditDrawerProps {
  data: JobDetailData;
  companyName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

/**
 * Editing is a slide-over rather than a tab: inspecting a job should never put
 * the user inside a form they can silently abandon. Closing with unsaved edits
 * asks first — Escape, the backdrop and the close button all route through the
 * same guard.
 */
export function EditDrawer({ data, companyName, open, onOpenChange, onRefresh }: EditDrawerProps) {
  const [dirty, setDirty] = useState(false);
  const { confirm, dialog } = useConfirm();

  const handleOpenChange = async (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!dirty) {
      onOpenChange(false);
      return;
    }
    const discard = await confirm({
      title: "Discard your changes?",
      description: `Your edits to "${data.job.title}" haven't been saved. This can't be undone.`,
      confirmText: "Discard changes",
      variant: "destructive",
    });
    if (discard) {
      setDirty(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto p-5 data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-3xl">
          <SheetTitle className="text-base font-semibold">Edit job details</SheetTitle>
          <SheetDescription className="sr-only">
            Change this job&apos;s title, location, salary, requirements and description.
          </SheetDescription>
          <div className="mt-4">
            {/* Remounted per open so a discarded edit doesn't survive as state. */}
            <EditTab
              key={open ? "open" : "closed"}
              data={data}
              companyName={companyName}
              onRefresh={onRefresh}
              onDirtyChange={setDirty}
              onSaved={() => onOpenChange(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      {dialog}
    </>
  );
}

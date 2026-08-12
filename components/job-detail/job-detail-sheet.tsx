"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { JobDetailContent } from "@/components/job-detail/job-detail-content";
import { getJobDetail } from "@/lib/actions/job-detail";
import { useIsElectron } from "@/lib/hooks/use-is-electron";
import type { JobDetailData } from "@/lib/types/job-detail";
import type { BoardList } from "@/lib/types/board";

// Matches WindowTitlebar's h-9 (Tailwind: 9 * 4px = 36px).
const ELECTRON_TITLEBAR_HEIGHT = "36px";

interface JobDetailSheetProps {
  jobId: string | null;
  lists?: BoardList[];
  onOpenChange: (open: boolean) => void;
  onMoveTo?: (jobId: string, listId: string) => void;
}

/**
 * Fetches getJobDetail() client-side on open (a server action call, not a
 * route) so it can be triggered from the board without a page navigation.
 * /jobs/[id]/page.tsx fetches the same shape server-side and renders
 * JobDetailContent directly, without this wrapper.
 */
export function JobDetailSheet({ jobId, lists, onOpenChange, onMoveTo }: JobDetailSheetProps) {
  const router = useRouter();
  const isElectron = useIsElectron();
  const [data, setData] = useState<JobDetailData | null>(null);
  // Derived, not stored: avoids a synchronous setState at the top of the
  // fetch effect (react-hooks/set-state-in-effect) — the spinner shows
  // whenever the loaded data doesn't match the currently open job yet.
  const isLoading = jobId !== null && data?.job.id !== jobId;

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    getJobDetail(jobId).then((fresh) => {
      if (!cancelled) setData(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const handleRefresh = useCallback(() => {
    if (jobId) getJobDetail(jobId).then((fresh) => setData(fresh));
    router.refresh(); // keeps the board's cards (match score, resume pill, etc.) in sync
  }, [jobId, router]);

  return (
    <Sheet open={jobId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        style={isElectron ? { top: ELECTRON_TITLEBAR_HEIGHT } : undefined}
        className="w-full max-w-full overflow-y-auto overflow-x-hidden p-0 data-[side=right]:sm:max-w-3xl data-[side=right]:md:max-w-4xl data-[side=right]:lg:max-w-6xl data-[side=right]:xl:max-w-7xl data-[side=right]:2xl:max-w-[1440px]"
      >
        <SheetTitle className="sr-only">Job details</SheetTitle>
        <SheetDescription className="sr-only">
          View and edit this job&apos;s details, notes, documents, contacts, and AI tools.
        </SheetDescription>
        {isLoading || !data ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <JobDetailContent
            data={data}
            onRefresh={handleRefresh}
            lists={lists}
            onMoveTo={onMoveTo ? (listId) => onMoveTo(data.job.id, listId) : undefined}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

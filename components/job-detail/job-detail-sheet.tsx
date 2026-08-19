"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { JobDetailContent } from "@/components/job-detail/job-detail-content";
import { getJobDetail } from "@/lib/actions/job-detail";
import type { JobDetailData } from "@/lib/types/job-detail";
import type { BoardList } from "@/lib/types/board";
import { AlertCircle, RefreshCw, X } from "lucide-react";

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
  const [data, setData] = useState<JobDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const fresh = await getJobDetail(id);
      if (!fresh) {
        setError("Job details could not be loaded or the job has been deleted.");
        setData(null);
      } else {
        setData(fresh);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job details.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchDetail(jobId);
  }, [jobId, fetchDetail]);

  const handleRefresh = useCallback(() => {
    if (jobId) {
      fetchDetail(jobId);
    }
    router.refresh(); // keeps the board's cards (match score, resume pill, etc.) in sync
  }, [jobId, fetchDetail, router]);

  return (
    <Sheet open={jobId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:max-w-full overflow-y-auto overflow-x-hidden p-0 data-[side=right]:sm:max-w-3xl data-[side=right]:md:max-w-4xl data-[side=right]:lg:max-w-6xl data-[side=right]:xl:max-w-7xl data-[side=right]:2xl:max-w-[1440px]">
        <SheetTitle className="sr-only">Job details</SheetTitle>
        <SheetDescription className="sr-only">
          View and edit this job&apos;s details, notes, documents, contacts, and AI tools.
        </SheetDescription>

        {isLoading ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-12">
            <Spinner className="size-7 text-primary" />
            <p className="text-xs text-muted-foreground animate-pulse">Loading job details...</p>
          </div>
        ) : error || !data ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-sm font-semibold text-foreground">Couldn&apos;t load job details</h4>
              <p className="text-xs text-muted-foreground">{error || "The selected job could not be retrieved from the database."}</p>
            </div>
            <div className="flex items-center gap-2">
              {jobId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchDetail(jobId)}
                  className="cursor-pointer gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer gap-1.5"
              >
                <X className="size-3.5" />
                Close
              </Button>
            </div>
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

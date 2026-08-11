"use client";

import { MCQHistory } from "@/components/mcq-history";
import type { JobDetailData } from "@/lib/types/job-detail";

interface InsightsTabProps {
  data: JobDetailData;
}

export function InsightsTab({ data }: InsightsTabProps) {
  const { job } = data;

  return (
    <div className="space-y-4">
      {job.description ? (
        <div>
          <h3 className="text-xs font-semibold text-foreground/80">Job description</h3>
          <div className="mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-foreground/90">
            {job.description}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No job description saved.</p>
      )}

      <div>
        <h3 className="text-xs font-semibold text-foreground/80">Profile match</h3>
        {job.match_score != null ? (
          <div className="mt-1.5 flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-2.5">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                job.match_score >= 80
                  ? "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400"
                  : job.match_score >= 50
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {Math.round(job.match_score)}%
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              {job.match_reasoning || "Based on your resume vs. this job."}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No match score yet — attach a resume in the Documents tab to get one.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-foreground/80">Keywords</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          No keywords extracted, try adding/editing the job description to see relevant keywords here.
        </p>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-foreground/80">Practice tests</h3>
        <MCQHistory jobId={job.id} />
      </div>
    </div>
  );
}

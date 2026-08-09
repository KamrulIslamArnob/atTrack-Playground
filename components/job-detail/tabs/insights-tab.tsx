"use client";

import { MCQHistory } from "@/components/mcq-history";
import type { JobDetailData } from "@/lib/types/job-detail";

interface InsightsTabProps {
  data: JobDetailData;
}

export function InsightsTab({ data }: InsightsTabProps) {
  const { job } = data;

  return (
    <div className="space-y-6">
      {job.description ? (
        <div>
          <h3 className="text-sm font-semibold">Job description</h3>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {job.description}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No job description saved.</p>
      )}

      <div>
        <h3 className="text-sm font-semibold">Profile match</h3>
        {job.match_score != null ? (
          <div className="mt-2 flex items-start gap-3">
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${
                job.match_score >= 80
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : job.match_score >= 50
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {Math.round(job.match_score)}%
            </div>
            <p className="text-sm text-muted-foreground">
              {job.match_reasoning || "Based on your resume vs. this job."}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No match score yet — attach a resume in the Documents tab to get one.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Keywords</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No keywords extracted, try adding/editing the job description to see relevant keywords here.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Practice tests</h3>
        <MCQHistory jobId={job.id} />
      </div>
    </div>
  );
}

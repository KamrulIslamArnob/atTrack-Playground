"use client";

import { useState } from "react";
import { Sparkles, Tag, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { extractJobKeywords } from "@/lib/actions/jobs";
import { matchScoreBand } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";

interface InsightsTabProps {
  data: JobDetailData;
  onRefresh?: () => void;
}

export function InsightsTab({ data, onRefresh }: InsightsTabProps) {
  const { job } = data;
  const [isExtracting, setIsExtracting] = useState(false);

  // Find keywords note if present
  const keywordNote = (job.notes ?? []).find(
    (n) => n.title.toLowerCase() === "keywords" || n.title === "__keywords__"
  );
  const keywords = keywordNote ? keywordNote.bullets : [];

  const band = matchScoreBand(job.match_score);

  const handleExtractKeywords = async () => {
    if (!job.description) {
      toast.error("Please add a job description first to analyze keywords.");
      return;
    }

    setIsExtracting(true);
    try {
      const res = await extractJobKeywords(job.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Extracted ${res.keywords.length} keywords with AI!`);
        onRefresh?.();
      }
    } catch {
      toast.error("Failed to perform AI keyword research.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Job Description */}
      <div>
        <h3 className="text-xs font-semibold text-foreground/80 mb-1.5">Job description</h3>
        {job.description ? (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground/90 select-text">
            {job.description}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-xs text-muted-foreground">No job description saved yet.</p>
          </div>
        )}
      </div>

      {/* Profile Match */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-semibold text-foreground/80">Profile match</h3>
          <span className="text-[11px] font-medium text-muted-foreground">AI Fit Analysis</span>
        </div>

        {job.match_score != null ? (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-2xs space-y-3.5 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Badge fitting - spacious, scalable, tabular numbers */}
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-2xs border transition-all",
                  job.match_score >= 80
                    ? "bg-lime-400/25 border-lime-500/50 text-lime-950 dark:bg-lime-500/20 dark:border-lime-400/40 dark:text-lime-200"
                    : job.match_score >= 50
                      ? "bg-amber-400/25 border-amber-500/50 text-amber-950 dark:bg-amber-500/20 dark:border-amber-400/40 dark:text-amber-200"
                      : "bg-rose-400/25 border-rose-500/50 text-rose-950 dark:bg-rose-500/20 dark:border-rose-400/40 dark:text-rose-200"
                )}
              >
                <Sparkles className="size-4 shrink-0" />
                <span className="tabular-nums text-base">{Math.round(job.match_score)}%</span>
                <span className="text-xs font-semibold tracking-wide uppercase opacity-90">
                  • {band?.label || (job.match_score >= 80 ? "Strong" : job.match_score >= 50 ? "Fair" : "Weak")} Fit
                </span>
              </div>
            </div>

            {/* Visual score progress bar */}
            <div className="w-full overflow-hidden rounded-full bg-muted/70 h-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  job.match_score >= 80
                    ? "bg-lime-500"
                    : job.match_score >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                )}
                style={{ width: `${Math.min(100, Math.max(0, job.match_score))}%` }}
              />
            </div>

            {/* Match reasoning text */}
            <div className="text-xs leading-relaxed text-foreground/80 bg-muted/30 rounded-lg p-3 border border-border/40">
              {job.match_reasoning || "Based on candidate resume vs. job requirements."}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              No match score calculated yet. Attach a resume in the Documents tab to analyze your match score.
            </p>
          </div>
        )}
      </div>

      {/* Keywords */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold text-foreground/80">Keywords</h3>
            {keywords.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-lime-500/60 bg-lime-400/25 px-2.5 py-0.5 text-[10px] font-semibold text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200">
                {keywords.length} extracted
              </span>
            )}
          </div>
          {keywords.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={handleExtractKeywords}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <Spinner className="mr-1 size-3" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
              Re-analyze
            </Button>
          )}
        </div>

        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-3">
            {keywords.map((kw, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lime-500/50 bg-lime-400/25 px-2.5 py-1 text-xs font-semibold text-lime-950 transition-colors hover:border-lime-600 hover:bg-lime-400/35 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200 dark:hover:border-lime-300 dark:hover:bg-lime-500/30"
              >
                <Tag className="size-3 text-lime-900 dark:text-lime-300" />
                {kw}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/60 p-6 shadow-2xs text-center flex justify-center items-center">
            <button
              type="button"
              onClick={handleExtractKeywords}
              disabled={isExtracting || !job.description}
              className={cn(
                "group relative inline-flex items-center justify-center gap-3 rounded-full px-7 py-3 text-xs font-semibold tracking-wide border-0 outline-hidden transition-all duration-500 ease-in-out cursor-pointer select-none mx-auto",
                "bg-[#1C1A1C] text-[#AAAAAA]",
                "hover:bg-[linear-gradient(0deg,#A47CF3,#683FEA)] hover:text-white hover:-translate-y-0.5",
                "hover:shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.4),inset_0px_-4px_0px_0px_rgba(0,0,0,0.2),0px_0px_0px_4px_rgba(255,255,255,0.2),0px_0px_50px_0px_#9917FF]",
                "active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              {isExtracting ? (
                <>
                  <Spinner className="size-4 text-white" />
                  <span className="font-semibold text-white">Analyzing & Extracting...</span>
                </>
              ) : (
                <>
                  <svg
                    height="18"
                    width="18"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    className="text-[#AAAAAA] transition-all duration-700 ease-in-out group-hover:scale-125 group-hover:text-white"
                  >
                    <path d="M10,21.236,6.755,14.745.264,11.5,6.755,8.255,10,1.764l3.245,6.491L19.736,11.5l-6.491,3.245ZM18,21l1.5,3L21,21l3-1.5L21,18l-1.5-3L18,18l-3,1.5ZM19.333,4.667,20.5,7l1.167-2.333L24,3.5,21.667,2.333,20.5,0,19.333,2.333,17,3.5Z" />
                  </svg>
                  <span className="font-semibold text-[#AAAAAA] transition-colors duration-450 group-hover:text-white">
                    AI Keyword Research
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

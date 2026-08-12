"use client";

import { useState } from "react";
import { Sparkles, Tag, RefreshCw, MapPin, DollarSign, GraduationCap, Gift, Clock, Calendar, ExternalLink, Code2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { extractJobKeywords, checkJobResumeScore } from "@/lib/actions/jobs";
import { matchScoreBand } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";

interface InsightsTabProps {
  data: JobDetailData;
  onRefresh?: () => void;
}

export function InsightsTab({ data, onRefresh }: InsightsTabProps) {
  const { job, company } = data;
  const [isExtracting, setIsExtracting] = useState(false);
  const [isScoringMatch, setIsScoringMatch] = useState(false);

  const handleScoreMatch = async () => {
    if (!job.resume_id) {
      toast.error("Please attach a resume in the Documents tab first.");
      return;
    }
    setIsScoringMatch(true);
    try {
      const res = await checkJobResumeScore(job.id, job.resume_id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Match score updated: ${Math.round(res.score)}%!`);
        onRefresh?.();
      }
    } catch {
      toast.error("Failed to calculate match score.");
    } finally {
      setIsScoringMatch(false);
    }
  };

  const skillsList = job.skills ?? [];
  const benefitsList = job.benefits ?? [];

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

  const handleOpenMap = () => {
    const query = job.location || company?.name || "Job Location";
    const targetUrl = job.map_url?.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      {/* Key Job Badges & Location Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {job.location && (
            <div className="flex items-center gap-1 font-medium text-foreground">
              <MapPin className="size-3.5 text-cyan-500 shrink-0" />
              <span>{job.location}</span>
            </div>
          )}
          {job.is_unpaid ? (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30">
              Unpaid Position
            </Badge>
          ) : job.salary_range ? (
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30">
              <DollarSign className="size-3 mr-0.5" />
              {job.salary_range}
            </Badge>
          ) : null}
          {job.employment_type && (
            <Badge variant="outline" className="text-[11px]">
              {job.employment_type}
            </Badge>
          )}
          {job.work_location && (
            <Badge variant="outline" className="text-[11px] capitalize">
              {job.work_location}
            </Badge>
          )}
        </div>

        {(job.location || job.map_url) && (
          <Button
            variant="outline"
            size="xs"
            onClick={handleOpenMap}
            className="gap-1 text-[11px] h-7 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
          >
            <MapPin className="size-3" /> View Map <ExternalLink className="size-3 ml-0.5 opacity-70" />
          </Button>
        )}
      </div>

      {/* Required Tech Skills (First-Class Badges) */}
      {skillsList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Code2 className="size-3.5 text-cyan-500" />
            <h3 className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
              Required Tech Skills ({skillsList.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
            {skillsList.map((skill, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="bg-cyan-500/15 text-cyan-900 dark:text-cyan-200 border-cyan-500/30 text-xs py-1 px-2.5 font-mono font-medium"
              >
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Educational Requirements */}
      {job.educational_requirements && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-xs uppercase tracking-wider">
            <GraduationCap className="size-4" /> Educational Requirements
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed font-medium">
            {job.educational_requirements}
          </p>
        </div>
      )}

      {/* Benefits & What We Offer */}
      {benefitsList.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Gift className="size-3.5 text-pink-500" />
            <h3 className="text-xs font-semibold text-foreground/90 uppercase tracking-wider">
              Benefits & What We Offer
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-pink-500/30 bg-pink-500/5 p-3">
            {benefitsList.map((benefit, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="bg-pink-500/15 text-pink-900 dark:text-pink-200 border-pink-500/30 text-xs py-1 px-2.5"
              >
                ✓ {benefit}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Schedule & Holiday Policy */}
      {(job.work_schedule || job.holiday_policy) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {job.work_schedule && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                <Clock className="size-3.5" /> Working Schedule
              </div>
              <p className="text-xs text-foreground/90">{job.work_schedule}</p>
            </div>
          )}
          {job.holiday_policy && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs">
                <Calendar className="size-3.5" /> Holidays & Leave
              </div>
              <p className="text-xs text-foreground/90">{job.holiday_policy}</p>
            </div>
          )}
        </div>
      )}

      {/* Job Description */}
      <div>
        <h3 className="text-xs font-semibold text-foreground/80 mb-1.5">Full Job Description</h3>
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
          <div className="flex items-center gap-2">
            {job.resume_id && (
              <Button
                variant="ghost"
                size="xs"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleScoreMatch}
                disabled={isScoringMatch}
              >
                {isScoringMatch ? (
                  <Spinner className="mr-1 size-3" />
                ) : (
                  <Sparkles className="mr-1 size-3 text-lime-500" />
                )}
                {job.match_score != null ? "Re-calculate Match" : "Check Match Score"}
              </Button>
            )}
            <span className="text-[11px] font-medium text-muted-foreground">AI Fit Analysis</span>
          </div>
        </div>

        {job.match_score != null ? (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-2xs space-y-3.5 transition-all">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
            <h3 className="text-xs font-semibold text-foreground/80">AI Extracted Keywords</h3>
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

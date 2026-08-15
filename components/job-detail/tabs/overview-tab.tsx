"use client";

import { useState } from "react";
import {
  Sparkles,
  Tag,
  RefreshCw,
  MapPin,
  Banknote,
  GraduationCap,
  Gift,
  Clock,
  CalendarDays,
  ExternalLink,
  Code2,
  Building2,
  Mail,
  Pencil,
  Send,
  FileText,
  Globe,
  ScanSearch,
  CircleCheck,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractJobKeywords, checkJobResumeScore, setJobResume } from "@/lib/actions/jobs";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";

interface OverviewTabProps {
  data: JobDetailData;
  onRefresh: () => void;
  /** Opens the edit slide-over owned by job-detail-content. */
  onEditJob: () => void;
}

/** Circumference of the score ring at r=28 — precomputed so the arc math stays readable. */
const RING_LENGTH = 2 * Math.PI * 28;

/**
 * Score bands drive three things at once (ring, number, band label), so they
 * resolve to semantic tokens here rather than reusing `matchScoreBand()`, whose
 * className is a pill fill built for the board card.
 */
function scoreTone(score: number) {
  if (score >= 80) return { label: "Strong fit", stroke: "stroke-success", text: "text-success" };
  if (score >= 50) return { label: "Fair fit", stroke: "stroke-warning", text: "text-warning" };
  return { label: "Weak fit", stroke: "stroke-destructive", text: "text-destructive" };
}

/** One labelled fact in the meta bar: what it says on top, what it means below. */
function Stat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tint)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground first-letter:uppercase">{value}</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Every block on this page is the same card so the eye can stop parsing containers. */
function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Design.md §8: icon in a size-10 muted circle, headline, one muted line, one action. */
function EmptyState({
  icon: Icon,
  headline,
  hint,
  action,
}: {
  icon: LucideIcon;
  headline: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <div>
        <p className="font-heading text-sm font-semibold">{headline}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * The read-only master view of a job: everything the posting says on the left,
 * everything atTrack thinks about it in the right rail. Editing lives in a
 * slide-over so inspecting a job can never overwrite it.
 */
export function OverviewTab({ data, onRefresh, onEditJob }: OverviewTabProps) {
  const { job, company, resumeOptions } = data;
  const [isExtracting, setIsExtracting] = useState(false);
  const [isScoringMatch, setIsScoringMatch] = useState(false);
  const [resumePending, setResumePending] = useState(false);

  const skillsList = job.skills ?? [];
  const benefitsList = job.benefits ?? [];
  const tone = job.match_score == null ? null : scoreTone(job.match_score);

  // The keyword list is stashed as a reserved note rather than its own column.
  const keywordNote = (job.notes ?? []).find(
    (n) => n.title.toLowerCase() === "keywords" || n.title === "__keywords__"
  );
  const keywords = keywordNote ? keywordNote.bullets : [];

  const roleDetails = [
    job.educational_requirements && { icon: GraduationCap, label: "Education", value: job.educational_requirements },
    job.work_schedule && { icon: Clock, label: "Working schedule", value: job.work_schedule },
    job.holiday_policy && { icon: CalendarDays, label: "Holidays & leave", value: job.holiday_policy },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string }[];

  const applyRoutes = [
    job.application_email && {
      icon: Mail,
      label: "Application email",
      value: job.application_email,
      href: `mailto:${job.application_email}`,
    },
    job.application_process && { icon: Send, label: "Process", value: job.application_process, href: null },
    job.source && { icon: Globe, label: "Source", value: job.source, href: null },
  ].filter(Boolean) as { icon: LucideIcon; label: string; value: string; href: string | null }[];

  const handleResumeChange = async (value: string | null) => {
    setResumePending(true);
    try {
      await setJobResume(job.id, value === "__none__" ? null : value);
      onRefresh();
    } catch {
      toast.error("Couldn't update resume");
    } finally {
      setResumePending(false);
    }
  };

  const handleScoreMatch = async () => {
    if (!job.resume_id) {
      toast.error("Couldn't score this job — attach a resume first");
      return;
    }
    setIsScoringMatch(true);
    try {
      const res = await checkJobResumeScore(job.id, job.resume_id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Match score updated to ${Math.round(res.score)}%`);
        onRefresh();
      }
    } catch {
      toast.error("Couldn't calculate match score");
    } finally {
      setIsScoringMatch(false);
    }
  };

  const handleExtractKeywords = async () => {
    if (!job.description) {
      toast.error("Couldn't extract keywords — add a job description first");
      return;
    }
    setIsExtracting(true);
    try {
      const res = await extractJobKeywords(job.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Extracted ${res.keywords.length} keywords`);
        onRefresh();
      }
    } catch {
      toast.error("Couldn't perform AI keyword research");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleOpenMap = () => {
    const query = job.location || company?.name || "Job Location";
    const targetUrl =
      job.map_url?.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
      {/* ---------- Right rail: what atTrack thinks (first on narrow screens) ---------- */}
      <aside className="order-1 space-y-4 lg:order-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <header className="mb-3 flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-3 text-primary" />
            </span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">AI fit analysis</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">AI analysis</span>
          </header>

          <Select value={job.resume_id ?? "__none__"} onValueChange={(v) => handleResumeChange(v ?? "__none__")}>
            <SelectTrigger className="h-9 w-full bg-background text-xs" disabled={resumePending || isScoringMatch}>
              <SelectValue placeholder="No resume attached">{job.resume_name ?? undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No resume attached</SelectItem>
              {resumeOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!job.resume_id ? (
            <div className="mt-3">
              <EmptyState
                icon={FileText}
                headline="No resume attached"
                hint="Attach one to see your fit score"
                action={null}
              />
            </div>
          ) : job.match_score == null ? (
            <div className="mt-3">
              <EmptyState
                icon={Sparkles}
                headline="Not scored yet"
                hint="atTrack scores it in the background, or check now"
                action={
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleScoreMatch} disabled={isScoringMatch}>
                    {isScoringMatch ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5 text-primary" />}
                    Check match score
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <svg viewBox="0 0 64 64" className="size-[68px] -rotate-90" aria-hidden="true">
                    <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" className="stroke-muted" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={RING_LENGTH}
                      strokeDashoffset={RING_LENGTH * (1 - Math.min(100, Math.max(0, job.match_score)) / 100)}
                      className={cn("transition-[stroke-dashoffset] duration-500 ease-out", tone?.stroke)}
                    />
                  </svg>
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center text-base font-bold tabular-nums",
                      tone?.text
                    )}
                  >
                    {Math.round(job.match_score)}%
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", tone?.text)}>{tone?.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Scored against {job.resume_name ?? "your attached resume"}
                  </p>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    job.match_score >= 80 ? "bg-success" : job.match_score >= 50 ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, job.match_score))}%` }}
                />
              </div>

              <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-foreground/80">
                  {job.match_reasoning || "Based on your resume against this job's requirements."}
                </p>
              </div>

              <Button
                variant="ghost"
                size="xs"
                className="w-full text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleScoreMatch}
                disabled={isScoringMatch}
              >
                {isScoringMatch ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
                Re-check score
              </Button>
            </div>
          )}
        </div>

        <Section
          icon={Tag}
          title="Extracted keywords"
          action={
            keywords.length > 0 ? (
              <Button
                variant="ghost"
                size="xs"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={handleExtractKeywords}
                disabled={isExtracting}
              >
                {isExtracting ? <Spinner className="size-3" /> : <RefreshCw className="size-3" />}
                Re-analyse
              </Button>
            ) : undefined
          }
        >
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/90"
                >
                  <Tag className="size-3 text-muted-foreground" />
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ScanSearch}
              headline="No keywords yet"
              hint="Pull them from the description"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExtractKeywords}
                  disabled={isExtracting || !job.description}
                >
                  {isExtracting ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5 text-primary" />}
                  {isExtracting ? "Analysing…" : "Extract keywords"}
                </Button>
              }
            />
          )}
        </Section>
      </aside>

      {/* ---------- Left column: what the posting says ---------- */}
      <div className="order-2 min-w-0 space-y-4 lg:order-1">
        {/* Meta bar — the four facts that decide whether this job is worth an hour. */}
        <div className="flex flex-wrap items-center gap-y-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center divide-x divide-border">
            {job.location && (
              <Stat
                icon={MapPin}
                value={job.location}
                label="Location"
                tint="bg-info-surface text-info"
              />
            )}
            {job.is_unpaid ? (
              <Stat icon={Banknote} value="Unpaid" label="Compensation" tint="bg-warning-surface text-warning" />
            ) : job.salary_range ? (
              <Stat icon={Banknote} value={job.salary_range} label="Salary" tint="bg-success-surface text-success" />
            ) : null}
            {job.employment_type && (
              <Stat icon={Briefcase} value={job.employment_type} label="Job type" tint="bg-primary/10 text-primary" />
            )}
            {job.work_location && (
              <Stat
                icon={Building2}
                value={job.work_location}
                label="Work mode"
                tint="bg-warning-surface text-warning"
              />
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
            {(job.location || job.map_url) && (
              <Button variant="outline" size="sm" onClick={handleOpenMap} className="text-xs">
                <MapPin className="size-3.5" /> View map
                <ExternalLink className="size-3 opacity-60" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onEditJob} className="text-xs">
              <Pencil className="size-3.5" /> Edit job
            </Button>
          </div>
        </div>

        {skillsList.length > 0 && (
          <Section icon={Code2} title={`Required skills (${skillsList.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {skillsList.map((skill, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/90"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Section>
        )}

        {benefitsList.length > 0 && (
          <Section icon={Gift} title="Benefits">
            <ul className="grid gap-2 sm:grid-cols-2">
              {benefitsList.map((benefit, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground/90"
                >
                  <CircleCheck className="mt-px size-3.5 shrink-0 text-success" />
                  <span className="min-w-0">{benefit}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Education, schedule and leave read as one block rather than three boxes. */}
        {roleDetails.length > 0 && (
          <Section icon={Clock} title="Role details">
            <dl className="grid gap-3 sm:grid-cols-2">
              {roleDetails.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-2">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-foreground/90">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {applyRoutes.length > 0 && (
          <Section icon={Send} title="How to apply">
            <div className="grid gap-2 sm:grid-cols-2">
              {applyRoutes.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Icon className="size-3.5" />
                    {label}
                  </div>
                  {href ? (
                    <a
                      href={href}
                      className="mt-1 block truncate text-xs font-medium text-primary hover:underline"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="mt-1 text-xs leading-relaxed break-words text-foreground/90">{value}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section icon={FileText} title="Full description">
          {job.description ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 select-text">
              {job.description}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No job description saved yet</p>
          )}
        </Section>

        {company && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-tint text-sm font-semibold text-primary">
                {company.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                  >
                    {company.name}
                  </a>
                ) : (
                  <p className="text-sm font-semibold">{company.name}</p>
                )}
                {company.location && <p className="text-xs text-muted-foreground">{company.location}</p>}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Founded</dt>
                <dd className="mt-0.5 font-medium">{company.founded_year ?? "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="mt-0.5 font-medium">{company.company_type ?? "Not specified"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Country</dt>
                <dd className="mt-0.5 font-medium">{company.country ?? "Not specified"}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

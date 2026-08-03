import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/actions/smtp";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EditJobDialog } from "@/components/edit-job-dialog";
import { PracticeButton } from "@/components/practice-button";
import { MCQHistory } from "@/components/mcq-history";
import { EmailApplyButton } from "@/components/email-apply-button";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  DollarSign,
  Building2,
  Clock,
  Calendar,
  Briefcase,
  Globe,
  FileText,
  StickyNote,
  Mail,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusColors: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  interested: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  preparing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  applied: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  interview: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  withdrawn: "bg-muted text-muted-foreground",
};

export default async function JobDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, userId } = await getUser();

  const { data: application } = await supabase
    .from("applications")
    .select("*, job:jobs(*, company:companies(*))")
    .eq("job_id", id)
    .eq("user_id", userId)
    .single();

  if (!application) {
    redirect("/jobs");
  }

  const job = application.job as Record<string, unknown> | null;
  const company = job?.company as Record<string, unknown> | null;

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const daysAgo = (date: string | null) => {
    if (!date) return null;
    const diff = Math.floor(
      (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff}d ago`;
  };

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const addedLabel = daysAgo(str(job?.created_at));
  const jobTitle = str(job?.title);
  const jobLocation = str(job?.location);
  const jobWorkLocation = str(job?.work_location);
  const jobEmploymentType = str(job?.employment_type);
  const jobSalaryRange = str(job?.salary_range);
  const jobSource = str(job?.source);
  const jobDeadline = str(job?.deadline);
  const jobDescription = str(job?.description);
  const jobUrl = str(job?.application_url);
  const jobEmail = str(job?.application_email);
  const jobProcess = str(job?.application_process);
  const jobCreatedAt = str(job?.created_at);
  const jobStatus = str(job?.status) || "saved";
  const companyName = str(company?.name);
  const companyLocation = str(company?.location);
  const notes = Array.isArray(job?.notes) ? (job.notes as Array<{ title: string; bullets: string[] }>) : [];
  const matchScore = typeof job?.match_score === "number" ? job.match_score : null;
  const matchReasoning = str(job?.match_reasoning);

  // Fetch MCQ results for this job
  const { data: mcqResults } = await supabase
    .from("mcq_results")
    .select("score, total")
    .eq("job_id", id)
    .eq("user_id", userId);

  const totalTests = mcqResults?.length ?? 0;
  const avgScore = totalTests > 0
    ? Math.round(mcqResults!.reduce((sum, r) => sum + (r.score / r.total), 0) / totalTests * 100)
    : null;
  const bestScore = totalTests > 0
    ? Math.round(Math.max(...mcqResults!.map(r => r.score / r.total)) * 100)
    : null;

  const smtpReady = await isSmtpConfigured();

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/jobs"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit gap-2" })}
      >
        <ArrowLeft className="size-4" />
        Back to jobs
      </Link>

      {/* Header card */}
      <div className="rounded-4xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          {/* Company logo placeholder */}
          <div className="flex size-16 shrink-0 items-center justify-center rounded-4xl bg-muted">
            <Building2 className="size-8 text-muted-foreground/50" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {jobTitle || "Untitled"}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                  <Building2 className="size-4" />
                  {companyName || "Unknown company"}
                  {companyLocation && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{companyLocation}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {matchScore != null && (
                  <span
                    className={`rounded-4xl px-3 py-1.5 text-xs font-medium ${
                      matchScore >= 80
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : matchScore >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                    title={matchReasoning || undefined}
                  >
                    {matchScore}% match
                  </span>
                )}
                <span
                  className={`shrink-0 rounded-4xl px-3 py-1.5 text-xs font-medium ${statusColors[jobStatus] ?? "bg-muted text-muted-foreground"}`}
                >
                  {statusLabels[jobStatus] ?? jobStatus}
                </span>
              </div>
            </div>

            {/* Job meta */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {jobLocation && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {jobLocation}
                </span>
              )}
              {jobWorkLocation && (
                <span className="flex items-center gap-1.5">
                  <Globe className="size-4" />
                  {jobWorkLocation.charAt(0).toUpperCase() + jobWorkLocation.slice(1)}
                </span>
              )}
              {jobEmploymentType && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="size-4" />
                  {jobEmploymentType}
                </span>
              )}
              {jobSalaryRange && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="size-4" />
                  {jobSalaryRange}
                </span>
              )}
            </div>

            {/* Dates */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70">
              {application.applied_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Applied {formatDate(application.applied_at)}
                </span>
              )}
              {jobDeadline && (
                <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                  <Clock className="size-3.5" />
                  Deadline {formatDate(jobDeadline)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Added {addedLabel ?? "Unknown"}
              </span>
              {jobSource && (
                <span className="rounded-4xl bg-muted px-2 py-0.5">
                  {jobSource}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3">
              {jobUrl && (
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", className: "gap-2" })}
                >
                  Apply now
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              {jobEmail && (
                <EmailApplyButton jobId={id} isSmtpConfigured={smtpReady} />
              )}
              <EditJobDialog job={{
                id,
                title: jobTitle,
                description: str(job?.description) || null,
                application_url: jobUrl || null,
                application_email: jobEmail || null,
                application_process: jobProcess || null,
                location: jobLocation || null,
                salary_range: jobSalaryRange || null,
                employment_type: jobEmploymentType || null,
                work_location: jobWorkLocation || null,
                deadline: jobDeadline || null,
                source: jobSource || null,
                status: jobStatus,
                notes: Array.isArray(job?.notes) ? job.notes as Array<{ title: string; bullets: string[] }> : null,
                company: companyName ? { name: companyName } : null,
              }} />
              {jobStatus === "interview" && <PracticeButton jobId={id} />}
            </div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          {jobDescription && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">Job Description</h2>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {jobDescription}
              </div>
            </div>
          )}

          {/* Application process */}
          {(jobEmail || jobProcess) && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">How to apply</h2>
              <div className="mt-4 space-y-3">
                {jobEmail && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-4xl bg-muted">
                      <Mail className="size-5 text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Send application to</p>
                      <a href={`mailto:${jobEmail}`} className="text-sm font-medium hover:underline">
                        {jobEmail}
                      </a>
                    </div>
                  </div>
                )}
                {jobProcess && (
                  <div className="rounded-4xl bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Application process</p>
                    <p className="whitespace-pre-wrap text-sm">{jobProcess}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">Notes</h2>
              <div className="mt-4 space-y-4">
                {notes.map((note, i) => (
                  <div key={i} className="rounded-4xl bg-muted/50 p-4">
                    <h3 className="text-sm font-semibold">{note.title}</h3>
                    {note.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {note.bullets.map((bullet, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MCQ History */}
          <MCQHistory jobId={id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* About company */}
          <div className="rounded-4xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">About the company</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-4xl bg-muted">
                  <Building2 className="size-5 text-muted-foreground/50" />
                </div>
                <div>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(companyName)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {companyName || "Unknown"}
                  </a>
                  {companyLocation && (
                    <p className="text-xs text-muted-foreground">
                      {companyLocation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Match score */}
          {matchScore != null && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">Profile Match</h2>
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-12 items-center justify-center rounded-4xl text-lg font-bold ${
                      matchScore >= 80
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : matchScore >= 50
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {matchScore}%
                  </div>
                  <div>
                    <p className="text-sm font-medium">Match Score</p>
                    <p className="text-xs text-muted-foreground">
                      Based on your resume vs. this job
                    </p>
                  </div>
                </div>
                {matchReasoning && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {matchReasoning}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Job insights */}
          <div className="rounded-4xl border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">Job insights</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Employment</span>
                <span className="font-medium">
                  {jobEmploymentType || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Work model</span>
                <span className="font-medium capitalize">
                  {jobWorkLocation || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Salary</span>
                <span className="font-medium">
                  {jobSalaryRange || "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deadline</span>
                <span className="font-medium">
                  {formatDate(jobDeadline) ?? "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Practice Test Stats */}
          {totalTests > 0 && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <h2 className="font-heading text-lg font-semibold">Practice Stats</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tests taken</span>
                  <span className="text-sm font-medium">{totalTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average score</span>
                  <span className={`text-sm font-bold ${
                    avgScore! >= 70
                      ? "text-green-600 dark:text-green-400"
                      : avgScore! >= 50
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}>
                    {avgScore}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Best score</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {bestScore}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

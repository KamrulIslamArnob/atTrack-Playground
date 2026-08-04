import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/actions/smtp";
import { buttonVariants } from "@/components/ui/button";
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
  Plus,
  CheckCircle2,
  XCircle,
  Clock3,
  Send,
} from "lucide-react";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/lib/types/job";

export default async function JobDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { supabase, userId } = await getUser();

  // Fetch job directly from jobs table
  const { data: job } = await supabase
    .from("jobs")
    .select("*, company:companies(*)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!job) {
    redirect("/jobs");
  }

  const company = (Array.isArray(job.company) ? job.company[0] : job.company) as Record<string, unknown> | null;

  // Fetch applications for this job
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  // Fetch application emails for this job
  const { data: emailHistory } = await supabase
    .from("application_emails")
    .select("*")
    .eq("job_id", id)
    .eq("user_id", userId)
    .order("sent_at", { ascending: false });

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
  const addedLabel = daysAgo(str(job.created_at));
  const jobTitle = str(job.title);
  const jobLocation = str(job.location);
  const jobWorkLocation = str(job.work_location);
  const jobEmploymentType = str(job.employment_type);
  const jobSalaryRange = str(job.salary_range);
  const jobSource = str(job.source);
  const jobDeadline = str(job.deadline);
  const jobDescription = str(job.description);
  const jobUrl = str(job.application_url);
  const jobEmail = str(job.application_email);
  const jobProcess = str(job.application_process);
  const jobStatus = str(job.status) || "saved";
  const companyName = str(company?.name);
  const companyLocation = str(company?.location);
  const notes = Array.isArray(job.notes) ? (job.notes as Array<{ title: string; bullets: string[] }>) : [];
  const matchScore = typeof job.match_score === "number" ? job.match_score : null;
  const matchReasoning = str(job.match_reasoning);

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
      <div className="rounded-4xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
          {/* Company logo placeholder */}
          <div className="flex size-14 shrink-0 items-center justify-center rounded-4xl bg-muted sm:size-16">
            <Building2 className="size-7 text-muted-foreground/50 sm:size-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {jobTitle || "Untitled"}
                </h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground sm:text-base">
                  <Building2 className="size-4 shrink-0" />
                  <span className="truncate">{companyName || "Unknown company"}</span>
                  {companyLocation && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="truncate">{companyLocation}</span>
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
                  className={`shrink-0 rounded-4xl px-3 py-1.5 text-xs font-medium ${JOB_STATUS_COLORS[jobStatus as keyof typeof JOB_STATUS_COLORS] ?? "bg-muted text-muted-foreground"}`}
                >
                  {JOB_STATUS_LABELS[jobStatus as keyof typeof JOB_STATUS_LABELS] ?? jobStatus}
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
            <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              {jobUrl && (
                <a
                  href={jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ size: "sm", className: "col-span-2 justify-center gap-2 sm:col-span-1 sm:w-auto" })}
                >
                  Apply now
                  <ExternalLink className="size-3.5" />
                </a>
              )}
              {jobEmail && (
                <div className="col-span-2 sm:col-span-1 [&>button]:w-full">
                  <EmailApplyButton jobId={id} isSmtpConfigured={smtpReady} />
                </div>
              )}
              <div className="col-span-2 sm:col-span-1 [&>button]:w-full">
                <EditJobDialog job={{
                  id,
                  title: jobTitle,
                  description: str(job.description) || null,
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
                  notes: Array.isArray(job.notes) ? job.notes as Array<{ title: string; bullets: string[] }> : null,
                  company: companyName ? { name: companyName } : null,
                }} />
              </div>
              {jobStatus === "preparing" && (
                <div className="col-span-2 sm:col-span-1 [&>button]:w-full">
                  <PracticeButton jobId={id} />
                </div>
              )}
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
            <div className="rounded-4xl border border-border bg-card p-4 sm:p-6">
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

          {/* Applications section */}
          <div className="rounded-4xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold">Applications</h2>
              <span className="text-xs text-muted-foreground">{applications?.length ?? 0} total</span>
            </div>
            {applications && applications.length > 0 ? (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app.id} className="flex flex-col gap-3 rounded-4xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-4xl ${
                        app.status === "submitted" ? "bg-violet-500/10" :
                        app.status === "interview" ? "bg-emerald-500/10" :
                        app.status === "offer" ? "bg-emerald-500/10" :
                        app.status === "rejected" ? "bg-red-500/10" :
                        "bg-muted"
                      }`}>
                        {app.status === "submitted" ? <Send className="size-4 text-violet-500" /> :
                         app.status === "interview" ? <CheckCircle2 className="size-4 text-emerald-500" /> :
                         app.status === "offer" ? <CheckCircle2 className="size-4 text-emerald-500" /> :
                         app.status === "rejected" ? <XCircle className="size-4 text-red-500" /> :
                         <Clock3 className="size-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{APPLICATION_STATUS_LABELS[app.status as keyof typeof APPLICATION_STATUS_LABELS] ?? app.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {app.applied_at
                            ? `Applied ${formatDate(app.applied_at)}`
                            : `Created ${formatDate(app.created_at)}`}
                        </p>
                      </div>
                    </div>
                    {app.resume_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 pl-12 sm:pl-0">
                        <FileText className="size-3 shrink-0" />
                        <span className="truncate">{app.resume_name}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">No applications yet</p>
                <p className="text-xs text-muted-foreground/70">Apply to this job to track your application status</p>
              </div>
            )}
          </div>

          {/* Email history */}
          {emailHistory && emailHistory.length > 0 && (
            <div className="rounded-4xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-semibold">Email History</h2>
                <span className="text-xs text-muted-foreground">{emailHistory.length} sent</span>
              </div>
              <div className="space-y-3">
                {emailHistory.map((email) => (
                  <div key={email.id} className="rounded-4xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          To: {email.recipient_email}
                        </p>
                        {email.resume_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <FileText className="size-3 shrink-0" />
                            <span className="truncate">Attached: {email.resume_name}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-4xl px-2 py-0.5 text-[10px] font-medium ${
                          email.status === "sent" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {email.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(email.sent_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
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

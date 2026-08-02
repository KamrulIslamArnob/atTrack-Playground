import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
    .eq("id", id)
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
  const jobCreatedAt = str(job?.created_at);
  const companyName = str(company?.name);
  const companyLocation = str(company?.location);
  const notes = Array.isArray(job?.notes) ? (job.notes as Array<{ title: string; bullets: string[] }>) : [];

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
              <span
                className={`shrink-0 rounded-4xl px-3 py-1.5 text-xs font-medium ${statusColors[application.status] ?? "bg-muted text-muted-foreground"}`}
              >
                {statusLabels[application.status] ?? application.status}
              </span>
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
              <Link
                href={`/jobs/${id}`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2" })}
              >
                <FileText className="size-3.5" />
                Edit job
              </Link>
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
        </div>
      </div>
    </div>
  );
}

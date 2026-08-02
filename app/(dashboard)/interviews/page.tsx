"use client";

import { useState } from "react";
import { getInterviews, type Interview } from "@/lib/actions/interviews";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { InterviewForm } from "@/components/interview-form";
import { Calendar, Clock, MapPin, Video, Building2, User, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCalendarLinkFromInterview } from "@/lib/calendar";
import { useEffect } from "react";

const typeColors: Record<string, string> = {
  phone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  video: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  onsite: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  technical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  behavioral: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  panel: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rescheduled: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function InterviewsPage() {
  const [upcoming, setUpcoming] = useState<Interview[]>([]);
  const [past, setPast] = useState<Interview[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInterviews = async () => {
    setLoading(true);
    const data = await getInterviews();
    setUpcoming(data.upcoming);
    setPast(data.past);
    setLoading(false);
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const formatDate = (iso: string | null) => {
    if (!iso) return "Not scheduled";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
            <p className="text-sm text-muted-foreground">
              Your upcoming and past interviews.
            </p>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Upcoming</h2>
            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    formatDate={formatDate}
                    onClick={() => setSelectedInterview(interview)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-4xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No upcoming interviews.</p>
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Past</h2>
              <div className="space-y-3">
                {past.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    formatDate={formatDate}
                    onClick={() => setSelectedInterview(interview)}
                    dimmed
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selectedInterview && (
        <InterviewForm
          interview={selectedInterview}
          onClose={() => {
            setSelectedInterview(null);
            fetchInterviews();
          }}
        />
      )}
    </div>
  );
}

function InterviewCard({
  interview,
  formatDate,
  onClick,
  dimmed = false,
}: {
  interview: Interview;
  formatDate: (iso: string | null) => string;
  onClick: () => void;
  dimmed?: boolean;
}) {
  const calendarUrl = getCalendarLinkFromInterview(interview);

  return (
    <div className={`rounded-4xl border border-border p-4 transition-colors hover:bg-muted/50 ${dimmed ? "opacity-60" : ""}`}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-4xl bg-muted">
              <Building2 className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{interview.job?.title ?? "Interview"}</p>
              <p className="text-sm text-muted-foreground">
                {interview.job?.company?.name ?? "Unknown company"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {formatDate(interview.scheduled_at)}
                </span>
                {interview.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {interview.location}
                  </span>
                )}
                {interview.meeting_url && (
                  <span className="flex items-center gap-1">
                    <Video className="size-3" />
                    Video call
                  </span>
                )}
                {interview.interviewer_name && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {interview.interviewer_name}
                  </span>
                )}
                {interview.duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {interview.duration_minutes}min
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {interview.type && (
              <Badge
                variant="secondary"
                className={`text-xs ${typeColors[interview.type] ?? ""}`}
              >
                {interview.type}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={`text-xs ${statusColors[interview.status] ?? ""}`}
            >
              {interview.status}
            </Badge>
          </div>
        </div>
      </button>

      {calendarUrl && interview.status === "scheduled" && (
        <div className="mt-3 flex justify-end">
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-4xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Calendar className="size-3" />
            Add to Google Calendar
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </div>
  );
}

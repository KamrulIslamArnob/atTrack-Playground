interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
  location?: string;
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const start = formatGoogleDate(event.startDate);
  const end = event.endDate
    ? formatGoogleDate(event.endDate)
    : formatGoogleDate(new Date(event.startDate.getTime() + 60 * 60 * 1000));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) {
    params.set("details", event.description);
  }

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getCalendarLinkFromInterview(interview: {
  scheduled_at: string | null;
  type: string | null;
  location: string | null;
  meeting_url: string | null;
  interviewer_name: string | null;
  duration_minutes: number | null;
  job?: {
    title: string;
    company?: { name: string } | null;
  } | null;
}): string | null {
  if (!interview.scheduled_at) return null;

  const startDate = new Date(interview.scheduled_at);
  const durationMs = (interview.duration_minutes ?? 60) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const jobTitle = interview.job?.title ?? "Interview";
  const company = interview.job?.company?.name ?? "";
  const title = company ? `${jobTitle} — ${company}` : jobTitle;

  const parts: string[] = [];
  if (interview.type) parts.push(`Type: ${interview.type}`);
  if (interview.interviewer_name) parts.push(`Interviewer: ${interview.interviewer_name}`);
  if (interview.meeting_url) parts.push(`Meeting: ${interview.meeting_url}`);

  const location = interview.meeting_url || interview.location || undefined;

  return getGoogleCalendarUrl({
    title,
    startDate,
    endDate,
    description: parts.join("\n") || undefined,
    location,
  });
}

"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Mail,
  User,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Sparkles,
  MoreHorizontal,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { getCalendarLinkFromInterview } from "@/lib/calendar";
import { createInterview, updateInterview, deleteInterview } from "@/lib/actions/interviews";
import type { JobDetailData, JobDetailInterview } from "@/lib/types/job-detail";
import { cn, format, formatDistanceToNow, isPast, isToday, isTomorrow } from "@/lib/utils";

const INTERVIEW_TYPES = [
  { value: "phone", label: "Phone Screen", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  { value: "video", label: "Video Call", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
  { value: "technical", label: "Technical Round", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  { value: "behavioral", label: "Behavioral", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  { value: "panel", label: "Panel Interview", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" },
  { value: "onsite", label: "Onsite", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
];

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof CheckCircle2 }> = {
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    icon: Clock,
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
  rescheduled: {
    label: "Rescheduled",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
};

interface InterviewsTabProps {
  data: JobDetailData;
  onRefresh: () => void;
  onSwitchToAiStudio?: () => void;
}

export function InterviewsTab({ data, onRefresh, onSwitchToAiStudio }: InterviewsTabProps) {
  const { job, company, interviews = [] } = data;
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  // Modal states
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<JobDetailInterview | null>(null);

  // Form states (Add)
  const [newType, setNewType] = useState<string>("video");
  const [newStatus, setNewStatus] = useState<string>("scheduled");
  const [newScheduledAt, setNewScheduledAt] = useState<string>("");
  const [newDuration, setNewDuration] = useState<string>("45");
  const [newInterviewerName, setNewInterviewerName] = useState<string>("");
  const [newInterviewerEmail, setNewInterviewerEmail] = useState<string>("");
  const [newMeetingUrl, setNewMeetingUrl] = useState<string>("");
  const [newLocation, setNewLocation] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");
  const [newPrepNotes, setNewPrepNotes] = useState<string>("");

  // Form states (Edit)
  const [editType, setEditType] = useState<string>("video");
  const [editStatus, setEditStatus] = useState<string>("scheduled");
  const [editScheduledAt, setEditScheduledAt] = useState<string>("");
  const [editDuration, setEditDuration] = useState<string>("45");
  const [editInterviewerName, setEditInterviewerName] = useState<string>("");
  const [editInterviewerEmail, setEditInterviewerEmail] = useState<string>("");
  const [editMeetingUrl, setEditMeetingUrl] = useState<string>("");
  const [editLocation, setEditLocation] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editPrepNotes, setEditPrepNotes] = useState<string>("");

  const resetAddForm = () => {
    setNewType("video");
    setNewStatus("scheduled");
    setNewScheduledAt("");
    setNewDuration("45");
    setNewInterviewerName("");
    setNewInterviewerEmail("");
    setNewMeetingUrl("");
    setNewLocation("");
    setNewNotes("");
    setNewPrepNotes("");
  };

  const handleOpenAdd = () => {
    resetAddForm();
    setScheduleModalOpen(true);
  };

  const handleOpenEdit = (iv: JobDetailInterview) => {
    setEditingInterview(iv);
    setEditType(iv.type ?? "video");
    setEditStatus(iv.status ?? "scheduled");
    setEditScheduledAt(iv.scheduled_at ? formatDateTimeLocal(iv.scheduled_at) : "");
    setEditDuration(iv.duration_minutes ? String(iv.duration_minutes) : "45");
    setEditInterviewerName(iv.interviewer_name ?? "");
    setEditInterviewerEmail(iv.interviewer_email ?? "");
    setEditMeetingUrl(iv.meeting_url ?? "");
    setEditLocation(iv.location ?? "");
    setEditNotes(iv.notes ?? "");
    setEditPrepNotes(iv.prep_notes ?? "");
  };

  const formatDateTimeLocal = (iso: string) => {
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  };

  const handleCreateInterview = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createInterview({
          job_id: job.id,
          type: newType || null,
          status: newStatus || "scheduled",
          scheduled_at: newScheduledAt ? new Date(newScheduledAt).toISOString() : null,
          duration_minutes: newDuration ? Number(newDuration) : null,
          interviewer_name: newInterviewerName.trim() || null,
          interviewer_email: newInterviewerEmail.trim() || null,
          meeting_url: newMeetingUrl.trim() || null,
          location: newLocation.trim() || null,
          notes: newNotes.trim() || null,
          prep_notes: newPrepNotes.trim() || null,
        });

        toast.success("Interview scheduled");
        setScheduleModalOpen(false);
        resetAddForm();
        onRefresh();
      } catch (err) {
        console.error("Failed to schedule interview:", err);
        toast.error("Couldn't schedule interview");
      }
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInterview) return;
    startTransition(async () => {
      try {
        await updateInterview(editingInterview.id, {
          type: editType || null,
          status: editStatus || "scheduled",
          scheduled_at: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
          duration_minutes: editDuration ? Number(editDuration) : null,
          interviewer_name: editInterviewerName.trim() || null,
          interviewer_email: editInterviewerEmail.trim() || null,
          meeting_url: editMeetingUrl.trim() || null,
          location: editLocation.trim() || null,
          notes: editNotes.trim() || null,
          prep_notes: editPrepNotes.trim() || null,
        });

        toast.success("Interview updated");
        setEditingInterview(null);
        onRefresh();
      } catch (err) {
        console.error("Failed to update interview:", err);
        toast.error("Couldn't update interview");
      }
    });
  };

  const handleQuickStatusChange = (iv: JobDetailInterview, nextStatus: string) => {
    startTransition(async () => {
      try {
        await updateInterview(iv.id, { status: nextStatus });
        toast.success(`Marked as ${STATUS_CONFIG[nextStatus]?.label ?? nextStatus}`);
        onRefresh();
      } catch {
        toast.error("Couldn't update interview status");
      }
    });
  };

  const handleDelete = async (iv: JobDetailInterview) => {
    const confirmed = await confirm({
      title: "Delete this interview?",
      description: "This interview record and all attached prep notes will be permanently removed. This can't be undone.",
      confirmText: "Delete interview",
      variant: "destructive",
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteInterview(iv.id);
        toast.success("Interview deleted");
        onRefresh();
      } catch {
        toast.error("Couldn't delete interview");
      }
    });
  };

  // Sort interviews: upcoming first (chronological), then completed/past
  const sortedInterviews = [...interviews].sort((a, b) => {
    if (!a.scheduled_at && !b.scheduled_at) return 0;
    if (!a.scheduled_at) return 1;
    if (!b.scheduled_at) return -1;
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  });

  const upcomingInterviews = sortedInterviews.filter((iv) => iv.status === "scheduled" || iv.status === "rescheduled");
  const pastOrCompletedInterviews = sortedInterviews.filter((iv) => iv.status === "completed" || iv.status === "cancelled");

  const formatScheduleLabel = (scheduledAt: string | null) => {
    if (!scheduledAt) return { dateStr: "Unscheduled", tag: null, tagColor: "bg-muted text-muted-foreground" };
    try {
      const d = new Date(scheduledAt);
      const dateStr = format(d, "EEE, MMM d, yyyy · h:mm a");
      if (isToday(d)) {
        return { dateStr, tag: "Today", tagColor: "bg-lime-500/15 text-lime-900 dark:text-lime-300 font-bold" };
      }
      if (isTomorrow(d)) {
        return { dateStr, tag: "Tomorrow", tagColor: "bg-primary/10 text-primary font-semibold" };
      }
      if (isPast(d)) {
        return { dateStr, tag: formatDistanceToNow(d, { addSuffix: true }), tagColor: "bg-muted text-muted-foreground" };
      }
      return { dateStr, tag: formatDistanceToNow(d, { addSuffix: true }), tagColor: "bg-primary/10 text-primary" };
    } catch {
      return { dateStr: "Invalid date", tag: null, tagColor: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-sm sm:text-base font-semibold tracking-tight text-foreground">
                Interview Rounds & Prep
              </h2>
              {interviews.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                  {interviews.length}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Schedule meetings, take technical notes, and sync to Google Calendar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToAiStudio && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToAiStudio}
              className="h-8 gap-1.5 rounded-xl border-border/80 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>AI Prep Studio</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-8 gap-1.5 rounded-xl text-xs font-medium cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Schedule Interview</span>
          </Button>
        </div>
      </div>

      {/* Interviews List */}
      {interviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-10 sm:p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/60 mb-3">
            <Video className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No interviews scheduled yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Add screening calls, recruiter screens, technical coding rounds, or panel sessions for {company?.name ?? "this position"}.
          </p>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="mt-4 h-8 gap-1.5 rounded-xl text-xs font-medium cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Schedule First Interview</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Section */}
          {upcomingInterviews.length > 0 && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="size-3.5 text-primary" /> Upcoming ({upcomingInterviews.length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {upcomingInterviews.map((iv) => (
                  <InterviewCard
                    key={iv.id}
                    interview={iv}
                    companyName={company?.name}
                    jobTitle={job.title}
                    onEdit={() => handleOpenEdit(iv)}
                    onDelete={() => handleDelete(iv)}
                    onStatusChange={(st) => handleQuickStatusChange(iv, st)}
                    formatScheduleLabel={formatScheduleLabel}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past / Completed Section */}
          {pastOrCompletedInterviews.length > 0 && (
            <section className="space-y-3 border-t border-border/60 pt-6">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" /> Past & Completed ({pastOrCompletedInterviews.length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {pastOrCompletedInterviews.map((iv) => (
                  <InterviewCard
                    key={iv.id}
                    interview={iv}
                    companyName={company?.name}
                    jobTitle={job.title}
                    onEdit={() => handleOpenEdit(iv)}
                    onDelete={() => handleDelete(iv)}
                    onStatusChange={(st) => handleQuickStatusChange(iv, st)}
                    formatScheduleLabel={formatScheduleLabel}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Schedule Interview Modal */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="size-4 text-primary" />
              Schedule Interview for {job.title}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateInterview} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-type" className="text-xs font-medium">Interview Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v ?? "video")}>
                  <SelectTrigger id="new-type" className="h-9 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-status" className="text-xs font-medium">Status</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v ?? "scheduled")}>
                  <SelectTrigger id="new-status" className="h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-date" className="text-xs font-medium">Date & Time</Label>
                <Input
                  id="new-date"
                  type="datetime-local"
                  value={newScheduledAt}
                  onChange={(e) => setNewScheduledAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-duration" className="text-xs font-medium">Duration (minutes)</Label>
                <Input
                  id="new-duration"
                  type="number"
                  min="15"
                  step="15"
                  placeholder="45"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-interviewer" className="text-xs font-medium">Interviewer Name</Label>
                <Input
                  id="new-interviewer"
                  placeholder="e.g. Sarah Connor (Hiring Mgr)"
                  value={newInterviewerName}
                  onChange={(e) => setNewInterviewerName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-email" className="text-xs font-medium">Interviewer Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="sarah@company.com"
                  value={newInterviewerEmail}
                  onChange={(e) => setNewInterviewerEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-meeting-url" className="text-xs font-medium">Meeting URL (Google Meet, Zoom, Teams)</Label>
                <Input
                  id="new-meeting-url"
                  placeholder="https://meet.google.com/..."
                  value={newMeetingUrl}
                  onChange={(e) => setNewMeetingUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-location" className="text-xs font-medium">Physical Location / Room</Label>
                <Input
                  id="new-location"
                  placeholder="e.g. SF HQ 4th Floor or Remote"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-prep-notes" className="text-xs font-medium">Preparation Notes & Talking Points</Label>
              <Textarea
                id="new-prep-notes"
                placeholder="Key stories to share, questions for the interviewer, technical architecture review..."
                rows={2}
                value={newPrepNotes}
                onChange={(e) => setNewPrepNotes(e.target.value)}
                className="text-xs resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-notes" className="text-xs font-medium">General / Post-Interview Notes</Label>
              <Textarea
                id="new-notes"
                placeholder="Observations, follow-up timeline, salary indications discussed..."
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="text-xs resize-y"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScheduleModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isPending && <Spinner className="size-3.5" />}
                Save Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Interview Modal */}
      <Dialog open={!!editingInterview} onOpenChange={(open) => !open && setEditingInterview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Edit3 className="size-4 text-primary" />
              Edit Interview
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-type" className="text-xs font-medium">Interview Type</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v ?? "video")}>
                  <SelectTrigger id="edit-type" className="h-9 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status" className="text-xs font-medium">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v ?? "scheduled")}>
                  <SelectTrigger id="edit-status" className="h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-date" className="text-xs font-medium">Date & Time</Label>
                <Input
                  id="edit-date"
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-duration" className="text-xs font-medium">Duration (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min="15"
                  step="15"
                  placeholder="45"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-interviewer" className="text-xs font-medium">Interviewer Name</Label>
                <Input
                  id="edit-interviewer"
                  placeholder="e.g. Sarah Connor (Hiring Mgr)"
                  value={editInterviewerName}
                  onChange={(e) => setEditInterviewerName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs font-medium">Interviewer Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="sarah@company.com"
                  value={editInterviewerEmail}
                  onChange={(e) => setEditInterviewerEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-meeting-url" className="text-xs font-medium">Meeting URL</Label>
                <Input
                  id="edit-meeting-url"
                  placeholder="https://meet.google.com/..."
                  value={editMeetingUrl}
                  onChange={(e) => setEditMeetingUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-location" className="text-xs font-medium">Location / Room</Label>
                <Input
                  id="edit-location"
                  placeholder="SF HQ 4th Floor or Remote"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-prep-notes" className="text-xs font-medium">Preparation Notes</Label>
              <Textarea
                id="edit-prep-notes"
                placeholder="Key stories to share, questions for the interviewer..."
                rows={2}
                value={editPrepNotes}
                onChange={(e) => setEditPrepNotes(e.target.value)}
                className="text-xs resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-notes" className="text-xs font-medium">Notes & Feedback</Label>
              <Textarea
                id="edit-notes"
                placeholder="Observations, follow-up timeline..."
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="text-xs resize-y"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingInterview(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isPending && <Spinner className="size-3.5" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

interface InterviewCardProps {
  interview: JobDetailInterview;
  companyName?: string;
  jobTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  formatScheduleLabel: (scheduledAt: string | null) => { dateStr: string; tag: string | null; tagColor: string };
}

function InterviewCard({
  interview,
  companyName,
  jobTitle,
  onEdit,
  onDelete,
  onStatusChange,
  formatScheduleLabel,
}: InterviewCardProps) {
  const { dateStr, tag, tagColor } = formatScheduleLabel(interview.scheduled_at);
  const typeConfig = INTERVIEW_TYPES.find((t) => t.value === interview.type);
  const statusCfg = STATUS_CONFIG[interview.status] ?? STATUS_CONFIG.scheduled;

  const calendarUrl = getCalendarLinkFromInterview({
    scheduled_at: interview.scheduled_at,
    type: interview.type,
    location: interview.location,
    meeting_url: interview.meeting_url,
    interviewer_name: interview.interviewer_name,
    duration_minutes: interview.duration_minutes ?? 45,
    job: {
      title: jobTitle,
      company: companyName ? { name: companyName } : null,
    },
  });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs transition-all hover:border-border hover:shadow-xs space-y-3.5">
      {/* Top row: Type badge, status badge, date tag, and actions menu */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {typeConfig && (
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", typeConfig.color)}>
              {typeConfig.label}
            </span>
          )}

          {/* Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    statusCfg.badgeClass
                  )}
                >
                  <statusCfg.icon className="size-3" />
                  <span>{statusCfg.label}</span>
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Change Status</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onStatusChange("scheduled")}>Scheduled</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("completed")}>Completed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("rescheduled")}>Rescheduled</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("cancelled")} className="text-destructive">
                Cancelled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {tag && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px]", tagColor)}>
              {tag}
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {calendarUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg border-border/80 px-2 text-[11px] font-medium text-foreground hover:bg-accent cursor-pointer"
              nativeButton={false}
              render={<a href={calendarUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <CalendarPlus className="size-3 text-muted-foreground" />
              <span className="hidden sm:inline">Google Calendar</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Interview options"
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit3 className="mr-2 size-3.5 text-muted-foreground" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 size-3.5" />
                Delete interview
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Date, Time & Duration */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground font-medium">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="size-3.5 text-primary" />
          <span className="text-foreground font-semibold">{dateStr}</span>
        </div>
        {interview.duration_minutes && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            <span>{interview.duration_minutes} mins</span>
          </div>
        )}
      </div>

      {/* Meeting URL / Location / Interviewer Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {interview.meeting_url && (
          <div className="flex items-center gap-2 min-w-0 rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
            <Video className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <a
              href={interview.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-primary hover:underline font-medium flex items-center gap-1"
            >
              <span className="truncate">{interview.meeting_url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
        )}

        {interview.location && !interview.meeting_url && (
          <div className="flex items-center gap-2 min-w-0 rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
            <MapPin className="size-3.5 text-orange-500 shrink-0" />
            <span className="truncate text-foreground">{interview.location}</span>
          </div>
        )}

        {(interview.interviewer_name || interview.interviewer_email) && (
          <div className="flex items-center gap-2 min-w-0 rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
            <User className="size-3.5 text-indigo-500 shrink-0" />
            <div className="truncate flex items-center gap-1.5">
              {interview.interviewer_name && (
                <span className="font-semibold text-foreground truncate">{interview.interviewer_name}</span>
              )}
              {interview.interviewer_email && (
                <a
                  href={`mailto:${interview.interviewer_email}`}
                  className="text-muted-foreground hover:text-primary truncate flex items-center gap-0.5"
                >
                  <Mail className="size-3" />
                  <span className="truncate">{interview.interviewer_email}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notes & Prep notes if present */}
      {(interview.prep_notes || interview.notes) && (
        <div className="space-y-2 border-t border-border/50 pt-2.5 text-xs">
          {interview.prep_notes && (
            <div className="rounded-xl bg-primary/5 border border-primary/15 p-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                <Sparkles className="size-3" /> Prep Notes
              </p>
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">{interview.prep_notes}</p>
            </div>
          )}
          {interview.notes && (
            <div className="rounded-xl bg-muted/30 border border-border/50 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <FileText className="size-3" /> Notes & Takeaways
              </p>
              <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{interview.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

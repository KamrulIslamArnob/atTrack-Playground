"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { format, addDays, subDays, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Pin,
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Save,
  X,
  Hourglass,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ShortcutsPanel } from "@/components/job-detail/shortcuts-panel";
import {
  getJobDeadlines,
  createJobDeadline,
  updateJobDeadline,
  toggleDeadlineCompleted,
  toggleDeadlinePinned,
  deleteJobDeadline,
} from "@/lib/actions/deadlines";
import type { JobDeadline, ListKind } from "@/lib/types/board";
import type { JobDetailData } from "@/lib/types/job-detail";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface DeadlinesTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

interface PresetItem {
  title: string;
  type: "deadline" | "milestone";
  stage_kind: ListKind;
  daysOffset: number; // positive = future (for deadline), 0 or negative = past/today (for milestone)
}

const DEADLINE_PRESETS: PresetItem[] = [
  { title: "Application Deadline", type: "deadline", stage_kind: "applied", daysOffset: 3 },
  { title: "Screening / Assessment", type: "deadline", stage_kind: "preparing", daysOffset: 5 },
  { title: "Technical Interview Prep", type: "deadline", stage_kind: "interview", daysOffset: 7 },
  { title: "Offer Response", type: "deadline", stage_kind: "offer", daysOffset: 14 },
];

const MILESTONE_PRESETS: PresetItem[] = [
  { title: "Applied & Waiting", type: "milestone", stage_kind: "applied", daysOffset: 0 },
  { title: "Screening in Progress", type: "milestone", stage_kind: "preparing", daysOffset: 0 },
  { title: "Interview Scheduled", type: "milestone", stage_kind: "interview", daysOffset: 0 },
  { title: "Follow-up Sent", type: "milestone", stage_kind: "applied", daysOffset: 0 },
];

export function DeadlinesTab({ data, onRefresh }: DeadlinesTabProps) {
  const jobId = data.job.id;
  const [deadlines, setDeadlines] = useState<JobDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  // Add Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<"deadline" | "milestone">("deadline");
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [newDaysValue, setNewDaysValue] = useState("3");
  const [newStageKind, setNewStageKind] = useState<string>("custom");
  const [newNotes, setNewNotes] = useState("");

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<"deadline" | "milestone">("deadline");
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDaysValue, setEditDaysValue] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadDeadlines = useCallback(async () => {
    try {
      const items = await getJobDeadlines(jobId);
      setDeadlines(items);
    } catch {
      toast.error("Couldn't load deadlines & milestones");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadDeadlines();
  }, [loadDeadlines]);

  // Handle mode switch in Add Form
  const handleTypeChange = (type: "deadline" | "milestone") => {
    setNewType(type);
    if (type === "deadline") {
      setNewDueDate(format(addDays(new Date(), 3), "yyyy-MM-dd"));
      setNewDaysValue("3");
      if (newTitle === "Applied & Waiting" || newTitle === "Screening in Progress") {
        setNewTitle("");
      }
    } else {
      setNewDueDate(format(new Date(), "yyyy-MM-dd"));
      setNewDaysValue("0");
      if (!newTitle) {
        setNewTitle("Applied & Waiting");
      }
    }
  };

  // Sync date and days in Add form
  const handleNewDateChange = (val: string) => {
    setNewDueDate(val);
    if (val) {
      const targetDate = new Date(val);
      const today = new Date();
      if (newType === "deadline") {
        const diff = differenceInDays(targetDate, today);
        setNewDaysValue(diff >= 0 ? diff.toString() : "0");
      } else {
        const elapsed = Math.max(0, differenceInDays(today, targetDate));
        setNewDaysValue(elapsed.toString());
      }
    }
  };

  const handleNewDaysChange = (daysStr: string) => {
    setNewDaysValue(daysStr);
    const num = parseInt(daysStr, 10);
    if (!isNaN(num)) {
      if (newType === "deadline") {
        setNewDueDate(format(addDays(new Date(), num), "yyyy-MM-dd"));
      } else {
        setNewDueDate(format(subDays(new Date(), num), "yyyy-MM-dd"));
      }
    }
  };

  // Sync date and days in Edit form
  const handleEditDateChange = (val: string) => {
    setEditDueDate(val);
    if (val) {
      const targetDate = new Date(val);
      const today = new Date();
      if (editType === "deadline") {
        const diff = differenceInDays(targetDate, today);
        setEditDaysValue(diff >= 0 ? diff.toString() : "0");
      } else {
        const elapsed = Math.max(0, differenceInDays(today, targetDate));
        setEditDaysValue(elapsed.toString());
      }
    }
  };

  const handleEditDaysChange = (daysStr: string) => {
    setEditDaysValue(daysStr);
    const num = parseInt(daysStr, 10);
    if (!isNaN(num)) {
      if (editType === "deadline") {
        setEditDueDate(format(addDays(new Date(), num), "yyyy-MM-dd"));
      } else {
        setEditDueDate(format(subDays(new Date(), num), "yyyy-MM-dd"));
      }
    }
  };

  const applyPreset = (preset: PresetItem) => {
    setNewType(preset.type);
    setNewTitle(preset.title);
    setNewStageKind(preset.stage_kind);
    if (preset.type === "deadline") {
      setNewDaysValue(preset.daysOffset.toString());
      setNewDueDate(format(addDays(new Date(), preset.daysOffset), "yyyy-MM-dd"));
    } else {
      setNewDaysValue(Math.abs(preset.daysOffset).toString());
      setNewDueDate(format(subDays(new Date(), Math.abs(preset.daysOffset)), "yyyy-MM-dd"));
    }
    setIsAdding(true);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error(newType === "deadline" ? "Please enter a deadline title" : "Please enter a milestone title");
      return;
    }
    if (!newDueDate) {
      toast.error("Please select a date");
      return;
    }

    startTransition(async () => {
      try {
        await createJobDeadline(jobId, {
          title: newTitle,
          type: newType,
          due_date: newDueDate,
          stage_kind: newStageKind,
          notes: newNotes,
        });
        toast.success(newType === "deadline" ? "Deadline added" : "Stage milestone added");
        setIsAdding(false);
        setNewTitle("");
        setNewNotes("");
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create item");
      }
    });
  };

  const startEdit = (item: JobDeadline) => {
    const itemType = item.type ?? "deadline";
    setEditingId(item.id);
    setEditType(itemType);
    setEditTitle(item.title);
    setEditDueDate(item.due_date);
    const targetDate = new Date(item.due_date);
    const today = new Date();
    if (itemType === "deadline") {
      const diff = differenceInDays(targetDate, today);
      setEditDaysValue(diff >= 0 ? diff.toString() : "0");
    } else {
      const elapsed = Math.max(0, differenceInDays(today, targetDate));
      setEditDaysValue(elapsed.toString());
    }
    setEditNotes(item.notes ?? "");
  };

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      try {
        await updateJobDeadline(id, {
          title: editTitle,
          type: editType,
          due_date: editDueDate,
          notes: editNotes,
        });
        toast.success(editType === "deadline" ? "Deadline updated" : "Milestone updated");
        setEditingId(null);
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update item");
      }
    });
  };

  const handleToggleCompleted = (item: JobDeadline) => {
    startTransition(async () => {
      try {
        await toggleDeadlineCompleted(item.id, !item.is_completed);
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  };

  const handleTogglePinned = (item: JobDeadline) => {
    startTransition(async () => {
      try {
        const nextPinnedId = item.is_pinned ? "" : item.id;
        await toggleDeadlinePinned(jobId, nextPinnedId);
        toast.success(
          item.is_pinned
            ? `${item.type === "milestone" ? "Milestone" : "Deadline"} unpinned from card`
            : `${item.type === "milestone" ? "Milestone" : "Deadline"} pinned to card`
        );
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to pin item");
      }
    });
  };

  const handleDelete = async (item: JobDeadline) => {
    const isMilestone = item.type === "milestone";
    const confirmed = await confirm({
      title: isMilestone ? "Delete this milestone?" : "Delete this deadline?",
      description: "This item will be permanently removed. This can't be undone.",
      confirmText: isMilestone ? "Delete milestone" : "Delete deadline",
      variant: "destructive",
    });
    if (!confirmed) return;
    startTransition(async () => {
      try {
        await deleteJobDeadline(item.id);
        toast.success(isMilestone ? "Milestone deleted" : "Deadline deleted");
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete item");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Presets */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-lime-500/50 bg-lime-400/25 text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200 shadow-2xs">
              <CalendarClock className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Stage Deadlines & Milestones</h3>
              <p className="text-xs text-muted-foreground">
                Set target countdown deadlines or track elapsed time in stages and milestones.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="h-8 text-xs gap-1.5"
            variant={isAdding ? "outline" : "default"}
          >
            {isAdding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {isAdding ? "Cancel" : "Add Deadline / Milestone"}
          </Button>
        </div>

        {/* Quick Add Presets */}
        {!isAdding && (
          <div className="space-y-2 pt-4 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Target Deadlines:</span>
              {DEADLINE_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted transition-colors text-foreground"
                >
                  <Clock className="size-3 text-amber-500" />
                  {preset.title} (+{preset.daysOffset}d)
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Stage Milestones:</span>
              {MILESTONE_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors text-foreground"
                >
                  <Hourglass className="size-3 text-purple-500" />
                  {preset.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Form */}
        {isAdding && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 mt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                New {newType === "deadline" ? "Target Deadline" : "Stage Milestone"}
              </h4>

              {/* Type Switcher */}
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => handleTypeChange("deadline")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    newType === "deadline"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Clock className="size-3" />
                  Deadline (Countdown)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("milestone")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    newType === "milestone"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Hourglass className="size-3" />
                  Milestone (Elapsed Waiting)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-title" className="text-xs">
                  {newType === "deadline" ? "Deadline Title *" : "Milestone / Stage Title *"}
                </Label>
                <Input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={newType === "deadline" ? "e.g. Technical Assessment Due" : "e.g. Applied & Waiting"}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-date" className="text-xs">
                    {newType === "deadline" ? "Target Due Date *" : "Start / Milestone Date *"}
                  </Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => handleNewDateChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-days" className="text-xs">
                    {newType === "deadline" ? "Days Remaining" : "Days Elapsed (Waiting)"}
                  </Label>
                  <Input
                    id="new-days"
                    type="number"
                    min="0"
                    value={newDaysValue}
                    onChange={(e) => handleNewDaysChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-notes" className="text-xs">Notes / Details (Optional)</Label>
              <Input
                id="new-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder={
                  newType === "deadline"
                    ? "e.g. Complete 3 LeetCode problems & review system design"
                    : "e.g. Waiting for recruiter screening response"
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={isPending} className="h-8 text-xs gap-1.5">
                {isPending && <Spinner className="size-3" />}
                Save {newType === "deadline" ? "Deadline" : "Milestone"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* What already happened — renders nothing when there's no history yet. */}
      <ShortcutsPanel data={data} />

      {/* Deadlines & Milestones Checklist */}
      <div className="space-y-3">
        {deadlines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
            <CalendarClock className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No deadlines or stage milestones set</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add target deadlines or track elapsed time in stages like &quot;Applied &amp; Waiting&quot; for this job.
            </p>
          </div>
        ) : (
          deadlines.map((item) => {
            const isEditing = editingId === item.id;
            const itemType = item.type ?? "deadline";
            const isMilestone = itemType === "milestone";

            const now = new Date();
            const targetDate = new Date(item.due_date);
            const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const elapsedDays = Math.max(0, Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)));
            const isOverdue = !isMilestone && diffDays < 0 && !item.is_completed;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all space-y-3 bg-card shadow-2xs",
                  item.is_completed ? "opacity-60 border-border bg-muted/20" : "border-border",
                  item.is_pinned && "border-primary/40 ring-1 ring-primary/20",
                  isOverdue && "border-red-500/40 bg-red-500/5",
                  !item.is_completed && isMilestone && "border-purple-500/20 bg-purple-500/[0.02]"
                )}
              >
                {isEditing ? (
                  /* Inline Edit Form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="text-xs font-semibold text-foreground">Edit Item</span>
                      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditType("deadline");
                            const diff = differenceInDays(new Date(editDueDate || new Date()), new Date());
                            setEditDaysValue(diff >= 0 ? diff.toString() : "0");
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[11px] font-medium rounded transition-all",
                            editType === "deadline"
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Deadline
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditType("milestone");
                            const elapsed = Math.max(0, differenceInDays(new Date(), new Date(editDueDate || new Date())));
                            setEditDaysValue(elapsed.toString());
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[11px] font-medium rounded transition-all",
                            editType === "milestone"
                              ? "bg-purple-600 text-white"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Milestone
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {editType === "deadline" ? "Due Date" : "Start Date"}
                          </Label>
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => handleEditDateChange(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {editType === "deadline" ? "Days Left" : "Days Elapsed"}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={editDaysValue}
                            onChange={(e) => handleEditDaysChange(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSaveEdit(item.id)} disabled={isPending} className="h-7 text-xs gap-1">
                        <Save className="size-3" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Normal View */
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleCompleted(item)}
                        className="text-muted-foreground hover:text-green-800 dark:hover:text-lime-400 transition-colors shrink-0"
                        title={item.is_completed ? "Mark incomplete" : "Mark completed"}
                      >
                        {item.is_completed ? (
                          <CheckCircle2 className="size-5 text-emerald-500" />
                        ) : (
                          <Circle className="size-5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Type Indicator Icon */}
                          {isMilestone ? (
                            <span title="Stage Milestone" className="inline-flex items-center text-purple-500 shrink-0">
                              <Hourglass className="size-3.5" />
                            </span>
                          ) : (
                            <span title="Target Deadline" className="inline-flex items-center text-amber-500 shrink-0">
                              <Clock className="size-3.5" />
                            </span>
                          )}

                          <h4
                            className={cn(
                              "text-sm font-semibold leading-tight truncate",
                              item.is_completed && "line-through text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </h4>

                          {isMilestone && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 shrink-0">
                              Milestone
                            </span>
                          )}

                          {item.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-lime-500/50 bg-lime-400/25 text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200 shrink-0">
                              <Pin className="size-2.5" /> Pinned
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Date & Badge */}
                      <div className="text-right">
                        <div className="text-xs font-semibold tabular-nums text-foreground">
                          {format(new Date(item.due_date), "MMM d, yyyy")}
                        </div>
                        <div
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            item.is_completed
                              ? "text-muted-foreground"
                              : isMilestone
                              ? "text-purple-600 dark:text-purple-300 font-semibold"
                              : isOverdue
                              ? "text-red-500 font-extrabold"
                              : diffDays <= 3
                              ? "text-rose-500"
                              : diffDays <= 7
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.is_completed
                            ? "Done"
                            : isMilestone
                            ? elapsedDays === 0
                              ? "Started Today"
                              : elapsedDays === 1
                              ? "1 day waiting"
                              : `${elapsedDays} days waiting`
                            : isOverdue
                            ? `Overdue by ${Math.abs(diffDays)}d`
                            : diffDays === 0
                            ? "Due Today"
                            : `${diffDays} days left`}
                        </div>
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTogglePinned(item)}
                          className={cn(
                            "size-7",
                            item.is_pinned &&
                              "border border-lime-500/50 bg-lime-400/25 text-lime-950 dark:border-lime-400/40 dark:bg-lime-500/20 dark:text-lime-200"
                          )}
                          title={item.is_pinned ? "Unpin from card" : "Pin to card"}
                        >
                          <Pin className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(item)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title={isMilestone ? "Edit milestone" : "Edit deadline"}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          className="size-7 text-muted-foreground hover:text-red-500"
                          title={isMilestone ? "Delete milestone" : "Delete deadline"}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {dialog}
    </div>
  );
}

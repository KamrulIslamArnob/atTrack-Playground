"use client";

import { useState, useEffect, useTransition } from "react";
import { formatDistanceToNow, format, addDays, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Plus,
  Pin,
  CheckCircle2,
  Circle,
  Trash2,
  Edit2,
  Save,
  X,
  AlertCircle,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
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

interface DeadlinesTabProps {
  data: JobDetailData;
  onRefresh: () => void;
}

const STAGE_PRESETS: { title: string; stage_kind: ListKind; daysOffset: number }[] = [
  { title: "Application Deadline", stage_kind: "applied", daysOffset: 3 },
  { title: "Screening / Assessment", stage_kind: "preparing", daysOffset: 5 },
  { title: "Technical Interview Prep", stage_kind: "interview", daysOffset: 7 },
  { title: "Offer Response", stage_kind: "offer", daysOffset: 14 },
];

export function DeadlinesTab({ data, onRefresh }: DeadlinesTabProps) {
  const jobId = data.job.id;
  const [deadlines, setDeadlines] = useState<JobDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Add Form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [newDaysRemaining, setNewDaysRemaining] = useState("3");
  const [newStageKind, setNewStageKind] = useState<string>("custom");
  const [newNotes, setNewNotes] = useState("");

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editDaysRemaining, setEditDaysRemaining] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadDeadlines = async () => {
    try {
      const items = await getJobDeadlines(jobId);
      setDeadlines(items);
    } catch {
      toast.error("Failed to load deadlines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeadlines();
  }, [jobId]);

  // Sync date and days remaining in Add form
  const handleNewDateChange = (val: string) => {
    setNewDueDate(val);
    if (val) {
      const diff = differenceInDays(new Date(val), new Date());
      setNewDaysRemaining(diff >= 0 ? diff.toString() : "0");
    }
  };

  const handleNewDaysChange = (daysStr: string) => {
    setNewDaysRemaining(daysStr);
    const num = parseInt(daysStr, 10);
    if (!isNaN(num)) {
      setNewDueDate(format(addDays(new Date(), num), "yyyy-MM-dd"));
    }
  };

  // Sync date and days remaining in Edit form
  const handleEditDateChange = (val: string) => {
    setEditDueDate(val);
    if (val) {
      const diff = differenceInDays(new Date(val), new Date());
      setEditDaysRemaining(diff >= 0 ? diff.toString() : "0");
    }
  };

  const handleEditDaysChange = (daysStr: string) => {
    setEditDaysRemaining(daysStr);
    const num = parseInt(daysStr, 10);
    if (!isNaN(num)) {
      setEditDueDate(format(addDays(new Date(), num), "yyyy-MM-dd"));
    }
  };

  const applyPreset = (preset: typeof STAGE_PRESETS[0]) => {
    setNewTitle(preset.title);
    setNewStageKind(preset.stage_kind);
    setNewDaysRemaining(preset.daysOffset.toString());
    setNewDueDate(format(addDays(new Date(), preset.daysOffset), "yyyy-MM-dd"));
    setIsAdding(true);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title for the deadline");
      return;
    }
    if (!newDueDate) {
      toast.error("Please select a due date");
      return;
    }

    startTransition(async () => {
      try {
        await createJobDeadline(jobId, {
          title: newTitle,
          due_date: newDueDate,
          stage_kind: newStageKind,
          notes: newNotes,
        });
        toast.success("Deadline milestone added");
        setIsAdding(false);
        setNewTitle("");
        setNewNotes("");
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create deadline");
      }
    });
  };

  const startEdit = (item: JobDeadline) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDueDate(item.due_date);
    const diff = differenceInDays(new Date(item.due_date), new Date());
    setEditDaysRemaining(diff >= 0 ? diff.toString() : "0");
    setEditNotes(item.notes ?? "");
  };

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      try {
        await updateJobDeadline(id, {
          title: editTitle,
          due_date: editDueDate,
          notes: editNotes,
        });
        toast.success("Deadline updated");
        setEditingId(null);
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update deadline");
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
        toast.error(err instanceof Error ? err.message : "Failed to toggle deadline");
      }
    });
  };

  const handleTogglePinned = (item: JobDeadline) => {
    startTransition(async () => {
      try {
        const nextPinnedId = item.is_pinned ? "" : item.id;
        await toggleDeadlinePinned(jobId, nextPinnedId);
        toast.success(item.is_pinned ? "Deadline unpinned from board card" : "Deadline pinned to board card");
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to pin deadline");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this deadline milestone?")) return;
    startTransition(async () => {
      try {
        await deleteJobDeadline(id);
        toast.success("Deadline deleted");
        await loadDeadlines();
        onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete deadline");
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
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Stage Deadlines & Milestones</h3>
              <p className="text-xs text-muted-foreground">
                Set and track target deadlines for each phase of your application.
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
            {isAdding ? "Cancel" : "Add Milestone"}
          </Button>
        </div>

        {/* Quick Add Presets */}
        {!isAdding && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick Add:</span>
            {STAGE_PRESETS.map((preset) => (
              <button
                key={preset.title}
                onClick={() => applyPreset(preset)}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted transition-colors text-foreground"
              >
                <Plus className="size-3 text-muted-foreground" />
                {preset.title} ({preset.daysOffset}d)
              </button>
            ))}
          </div>
        )}

        {/* Add Milestone Form */}
        {isAdding && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 mt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              New Deadline Milestone
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-title" className="text-xs">Milestone Title *</Label>
                <Input
                  id="new-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Technical Assessment Due"
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-date" className="text-xs">Target Date *</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => handleNewDateChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-days" className="text-xs">Days Remaining</Label>
                  <Input
                    id="new-days"
                    type="number"
                    min="0"
                    value={newDaysRemaining}
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
                placeholder="e.g. Complete 3 LeetCode problems & review system design"
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={isPending} className="h-8 text-xs gap-1.5">
                {isPending && <Spinner className="size-3" />}
                Save Milestone
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Deadlines Checklist List */}
      <div className="space-y-3">
        {deadlines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
            <Clock className="size-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No deadlines or stage milestones set</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add milestone deadlines for your application, assessment tests, interview preparation, or offer decisions.
            </p>
          </div>
        ) : (
          deadlines.map((item) => {
            const isEditing = editingId === item.id;
            const diffDays = Math.ceil(
              (new Date(item.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            const isOverdue = diffDays < 0 && !item.is_completed;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all space-y-3 bg-card shadow-2xs",
                  item.is_completed ? "opacity-60 border-border bg-muted/20" : "border-border",
                  item.is_pinned && "border-primary/40 ring-1 ring-primary/20",
                  isOverdue && "border-red-500/40 bg-red-500/5"
                )}
              >
                {isEditing ? (
                  /* Inline Edit Form */
                  <div className="space-y-3">
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
                          <Label className="text-xs">Due Date</Label>
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => handleEditDateChange(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Days Remaining</Label>
                          <Input
                            type="number"
                            min="0"
                            value={editDaysRemaining}
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
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
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
                          <h4
                            className={cn(
                              "text-sm font-semibold leading-tight truncate",
                              item.is_completed && "line-through text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </h4>
                          {item.is_pinned && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                              <Pin className="size-2.5" /> Pinned to Board Card
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Date & Countdown Badge */}
                      <div className="text-right">
                        <div className="text-xs font-semibold tabular-nums text-foreground">
                          {format(new Date(item.due_date), "MMM d, yyyy")}
                        </div>
                        <div
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            item.is_completed
                              ? "text-muted-foreground"
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
                          className={cn("size-7", item.is_pinned && "text-primary bg-primary/10")}
                          title={item.is_pinned ? "Unpin from board card" : "Pin to board card"}
                        >
                          <Pin className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(item)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit deadline"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="size-7 text-muted-foreground hover:text-red-500"
                          title="Delete deadline"
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
    </div>
  );
}

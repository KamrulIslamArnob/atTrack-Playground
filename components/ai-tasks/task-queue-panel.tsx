"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAITaskQueue } from "@/lib/ai-tasks/task-queue-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  ArrowRight,
  Check,
  Layers,
} from "lucide-react";
import { TaskReviewModal } from "./task-review-modal";
import type { AITask } from "@/lib/types/ai-task";

export function TaskQueuePanel({
  onReviewTask,
}: {
  onReviewTask?: (task: AITask) => void;
}) {
  const {
    tasks,
    activeTasksCount,
    pendingConfirmationCount,
    isPanelOpen,
    setIsPanelOpen,
    applyTask,
    dismissTask,
    retryTask,
    clearCompletedTasks,
  } = useAITaskQueue();

  const [reviewingTask, setReviewingTask] = useState<AITask | null>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ left: number; bottom: number }>({
    left: 236,
    bottom: 16,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPanelOpen) return;
    const updatePosition = () => {
      try {
        const anchor = document.querySelector("[data-queue-anchor]") as HTMLElement | null;
        const collapsed = localStorage.getItem("attrack-sidebar-collapsed") === "true";
        const w = Number(localStorage.getItem("attrack-sidebar-width"));
        const sidebarWidth = w >= 200 && w <= 360 ? w : 224;

        let left = collapsed ? 72 : sidebarWidth + 12;
        let bottom = 16;

        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          if (rect.right > 0) {
            left = collapsed ? rect.right + 12 : Math.max(left, rect.right + 12);
            bottom = Math.max(12, window.innerHeight - rect.bottom - 4);
          }
        }

        setPosition({ left, bottom });
      } catch {
        setPosition({ left: 236, bottom: 16 });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("storage", updatePosition);
    const id = window.setInterval(updatePosition, 300);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("storage", updatePosition);
      window.clearInterval(id);
    };
  }, [isPanelOpen]);

  const handleReview = (task: AITask) => {
    if (onReviewTask) {
      onReviewTask(task);
    }
    setReviewingTask(task);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPanelOpen, setIsPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-queue-anchor]")) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setIsPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isPanelOpen, setIsPanelOpen]);

  const hasCompleted = tasks.some((t) => t.status === "applied" || t.status === "failed");

  const panelContent = () => {
    if (!isPanelOpen) {
      return (
        <TaskReviewModal
          task={reviewingTask}
          open={Boolean(reviewingTask)}
          onClose={() => setReviewingTask(null)}
          onApply={applyTask}
          onDismiss={dismissTask}
        />
      );
    }

    return (
      <>
        {/* Desktop / Tablet anchored popover — beside the queue button in bottom sidebar */}
        <div
          ref={panelRef}
          className="hidden md:flex fixed z-30 w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-e3 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150 origin-bottom-left"
          style={{
            bottom: `${position.bottom}px`,
            left: `${position.left}px`,
          }}
        >
          {/* Panel Header — queue-first, distilled */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 select-none">
            <div className="flex items-center gap-2.5">
              {/* stacked sheets mini — mirrors the queue button */}
              <span className="relative flex size-6 items-center justify-center rounded-lg border border-border bg-card shadow-sm shrink-0">
                <span className="relative block size-[14px]">
                  <span className="absolute inset-0 translate-x-[2.2px] translate-y-[1.6px] rounded-[3.5px] border border-border/60 bg-muted" aria-hidden />
                  <span className="absolute inset-0 translate-x-[1px] translate-y-[0.8px] rounded-[3.5px] border border-border bg-card" aria-hidden />
                  <span className="absolute inset-0 rounded-[3.5px] border border-border bg-card flex items-center justify-center">
                    <span className="flex flex-col gap-[1.5px]">
                      <span className="block h-[1.2px] w-[7px] rounded-full bg-foreground/70" />
                      <span className="block h-[1.2px] w-[7px] rounded-full bg-foreground/70" />
                      <span className="block h-[1.2px] w-[4px] rounded-full bg-muted-foreground/60" />
                    </span>
                  </span>
                </span>
              </span>
              <h3 className="text-xs font-semibold text-foreground">Queue</h3>
              {tasks.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tasks.length}
                </span>
              )}
              {activeTasksCount > 0 ? (
                <span className="text-xs text-muted-foreground">· {activeTasksCount} running</span>
              ) : pendingConfirmationCount > 0 ? (
                <span className="text-xs font-medium text-warning">· {pendingConfirmationCount} to review</span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close queue"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Task List */}
          <div className="max-h-[320px] space-y-2 overflow-y-auto p-3 scrollbar-minimal">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border/50">
                  <Layers className="size-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Queue empty</p>
                <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  Tasks you run in background will stack here
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onApply={() => applyTask(task.id)}
                  onDismiss={() => dismissTask(task.id)}
                  onRetry={() => retryTask(task.id)}
                  onReview={() => handleReview(task)}
                />
              ))
            )}
          </div>

          {/* Footer — only when there is something to clear */}
          {hasCompleted && (
            <div className="flex justify-end border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={clearCompletedTasks}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear completed
              </button>
            </div>
          )}
        </div>

        {/* Mobile — sidebar level, top-anchored to avoid covering generation form */}
        <div className="md:hidden fixed inset-x-0 top-[56px] z-30 flex max-h-[50vh] flex-col rounded-b-2xl border-b border-border bg-card shadow-e4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-6 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
                <span className="relative block size-[14px]">
                  <span className="absolute inset-0 translate-x-[2.2px] translate-y-[1.6px] rounded-[3.5px] border border-border/60 bg-muted" aria-hidden />
                  <span className="absolute inset-0 translate-x-[1px] translate-y-[0.8px] rounded-[3.5px] border border-border bg-card" aria-hidden />
                  <span className="absolute inset-0 rounded-[3.5px] border border-border bg-card flex items-center justify-center">
                    <span className="flex flex-col gap-[1px]">
                      <span className="block h-[1.2px] w-[7px] bg-foreground/70 rounded-full" />
                      <span className="block h-[1.2px] w-[7px] bg-foreground/70 rounded-full" />
                      <span className="block h-[1.2px] w-[4px] bg-muted-foreground/60 rounded-full" />
                    </span>
                  </span>
                </span>
              </span>
              <h3 className="text-xs font-semibold text-foreground">Queue</h3>
              {tasks.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tasks.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close queue"
              className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-minimal">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border/50">
                  <Layers className="size-5" />
                </span>
                <p className="text-sm font-medium">Queue empty</p>
                <p className="text-xs text-muted-foreground">Tasks will stack here when queued</p>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onApply={() => applyTask(task.id)}
                  onDismiss={() => dismissTask(task.id)}
                  onRetry={() => retryTask(task.id)}
                  onReview={() => handleReview(task)}
                />
              ))
            )}
          </div>
          {hasCompleted && (
            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={clearCompletedTasks}
                className="w-full rounded-xl bg-muted py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear completed
              </button>
            </div>
          )}
        </div>

        {/* Backdrop for mobile */}
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/20"
          onClick={() => setIsPanelOpen(false)}
          aria-hidden="true"
        />

        <TaskReviewModal
          task={reviewingTask}
          open={Boolean(reviewingTask)}
          onClose={() => setReviewingTask(null)}
          onApply={applyTask}
          onDismiss={dismissTask}
        />
      </>
    );
  };

  if (!mounted) {
    return (
      <TaskReviewModal
        task={reviewingTask}
        open={Boolean(reviewingTask)}
        onClose={() => setReviewingTask(null)}
        onApply={applyTask}
        onDismiss={dismissTask}
      />
    );
  }

  return createPortal(panelContent(), document.body);
}

function TaskItem({
  task,
  onApply,
  onDismiss,
  onRetry,
  onReview,
}: {
  task: AITask;
  onApply: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  onReview: () => void;
}) {
  const [applying, setApplying] = useState(false);

  const handleApplyClick = async () => {
    setApplying(true);
    await onApply();
    setApplying(false);
  };

  const isProcessing = task.status === "processing" || task.status === "queued";
  const isAwaiting = task.status === "awaiting_confirmation";
  const isApplied = task.status === "applied";
  const isFailed = task.status === "failed";
  const isAiTool = task.type === "ai_tool_generation";

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      {/* Title & Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isProcessing && <span className="size-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden />}
            {isAwaiting && <CheckCircle2 className="size-3.5 text-success shrink-0" />}
            {isApplied && <Check className="size-3.5 text-success shrink-0" />}
            {isFailed && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
            <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
          </div>
          {task.subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.subtitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss task"
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Processing — distilled: message + bar only, no percent */}
      {isProcessing && (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {task.statusMessage || "Working…"}
          </p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${task.progress ?? 30}%` }}
            />
          </div>
        </div>
      )}

      {/* Awaiting — clarified actions */}
      {isAwaiting && (
        <div className="mt-2.5 space-y-2">
          <p className="text-xs font-medium text-foreground leading-relaxed">
            {task.result?.summary || "Ready to review"}
          </p>

          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant={isAiTool ? "default" : "outline"}
              size="xs"
              onClick={onReview}
              className="h-6 rounded-lg text-xs px-2.5 font-medium"
            >
              {isAiTool ? "View result" : "Review changes"}
            </Button>
            {!isAiTool && (
              <Button
                type="button"
                size="xs"
                disabled={applying}
                onClick={handleApplyClick}
                className="h-6 rounded-lg text-xs px-2.5 gap-1 bg-primary text-primary-foreground font-medium"
              >
                {applying ? <Spinner className="size-3" /> : <ArrowRight className="size-3" />}
                {applying ? "Applying…" : "Apply changes"}
              </Button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Applied */}
      {isApplied && (
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" /> Applied to job
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Failed — Couldn't pattern per Design.md §9 */}
      {isFailed && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs leading-relaxed text-destructive">
            {task.error || "Couldn't complete task"}
          </p>
          <div className="flex items-center gap-1 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onRetry}
              className="h-6 rounded-lg text-xs px-2.5 gap-1"
            >
              <RotateCcw className="size-3" />
              Retry
            </Button>
            <button
              type="button"
              onClick={onDismiss}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

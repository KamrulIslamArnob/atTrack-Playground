"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useAITaskQueue } from "@/lib/ai-tasks/task-queue-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Minus,
  Maximize2,
  RotateCcw,
  ArrowRight,
  Check,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
    isMinimized,
    setIsPanelOpen,
    toggleMinimize,
    applyTask,
    dismissTask,
    retryTask,
    clearCompletedTasks,
  } = useAITaskQueue();

  const [reviewingTask, setReviewingTask] = useState<AITask | null>(null);

  const handleReview = (task: AITask) => {
    if (onReviewTask) {
      onReviewTask(task);
    }
    setReviewingTask(task);
  };

  // If no tasks exist or panel is closed by user, don't render
  if (tasks.length === 0 || !isPanelOpen) {
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

  // Minimized Floating Pill View
  if (isMinimized) {
    return (
      <>
        <motion.div
          drag
          dragMomentum={false}
          className="fixed bottom-4 left-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 cursor-grab active:cursor-grabbing"
        >
          <div
            onClick={toggleMinimize}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 shadow-xl backdrop-blur-md transition-all hover:scale-102 cursor-pointer select-none",
              pendingConfirmationCount > 0
                ? "border-success/40 bg-success-surface/90 text-success dark:bg-success/15"
                : "border-primary/30 bg-card/90 text-foreground"
            )}
          >
            <GripVertical className="size-3.5 text-muted-foreground/60 -ml-0.5" />
            {activeTasksCount > 0 ? (
              <div className="relative flex size-4 items-center justify-center">
                <Sparkles className="size-3.5 animate-spin text-primary" />
              </div>
            ) : pendingConfirmationCount > 0 ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <Sparkles className="size-3.5 text-primary" />
            )}

            <span className="text-xs font-semibold">
              {activeTasksCount > 0
                ? `${activeTasksCount} AI Task${activeTasksCount === 1 ? "" : "s"} running...`
                : `${pendingConfirmationCount} Update${pendingConfirmationCount === 1 ? "" : "s"} ready`}
            </span>

            <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {tasks.length}
            </span>
            <Maximize2 className="size-3 text-muted-foreground ml-0.5" />
          </div>
        </motion.div>
        <TaskReviewModal
          task={reviewingTask}
          open={Boolean(reviewingTask)}
          onClose={() => setReviewingTask(null)}
          onApply={applyTask}
          onDismiss={dismissTask}
        />
      </>
    );
  }

  // Full Expanded Panel View
  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        className="fixed bottom-4 left-4 z-50 w-88 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-md transition-shadow duration-200"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5 cursor-grab active:cursor-grabbing select-none">
          <div className="flex items-center gap-1.5">
            <GripVertical className="size-3.5 text-muted-foreground/60 -ml-1" />
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              AI Tasks
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
              {tasks.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleMinimize}
              aria-label="Minimize task panel"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close task panel"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onApply={() => applyTask(task.id)}
              onDismiss={() => dismissTask(task.id)}
              onRetry={() => retryTask(task.id)}
              onReview={() => handleReview(task)}
            />
          ))}
        </div>

        {/* Footer Actions */}
        {tasks.some((t) => t.status === "applied" || t.status === "failed") && (
          <div className="mt-3 border-t border-border/60 pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={clearCompletedTasks}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear finished tasks
            </button>
          </div>
        )}
      </motion.div>

      <TaskReviewModal
        task={reviewingTask}
        open={Boolean(reviewingTask)}
        onClose={() => setReviewingTask(null)}
        onApply={applyTask}
        onDismiss={dismissTask}
      />
    </>
  );
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
    <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs transition-colors">
      {/* Title & Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isProcessing && <Sparkles className="size-3 text-primary animate-pulse shrink-0" />}
            {isAwaiting && <CheckCircle2 className="size-3.5 text-success shrink-0" />}
            {isApplied && <Check className="size-3.5 text-success shrink-0" />}
            {isFailed && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
            <span className="font-semibold text-foreground truncate block">
              {task.title}
            </span>
          </div>
          {task.subtitle && (
            <p className="text-[10px] text-muted-foreground truncate">{task.subtitle}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss task"
          className="size-5 shrink-0 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Status Message & Progress */}
      {isProcessing && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{task.statusMessage || "Processing..."}</span>
            <span>{task.progress ?? 30}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${task.progress ?? 30}%` }}
            />
          </div>
        </div>
      )}

      {/* Awaiting Confirmation (Completed Extraction or Tool Generation) */}
      {isAwaiting && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] font-medium text-foreground">
            {task.result?.summary || "Updates found — ready to apply"}
          </p>

          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant={isAiTool ? "default" : "outline"}
              size="xs"
              onClick={onReview}
              className="h-6 rounded-lg text-[10px] px-2.5 cursor-pointer font-semibold"
            >
              Review
            </Button>
            {!isAiTool && (
              <Button
                type="button"
                size="xs"
                disabled={applying}
                onClick={handleApplyClick}
                className="h-6 rounded-lg text-[10px] px-2.5 gap-1 bg-primary text-primary-foreground font-semibold cursor-pointer"
              >
                {applying ? <Spinner className="size-2.5" /> : <ArrowRight className="size-2.5" />}
                {applying ? "Applying..." : "Apply"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onDismiss}
              className="h-6 rounded-lg text-[10px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Applied State */}
      {isApplied && (
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-success font-medium">
          <span>✓ Changes applied to job</span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] text-muted-foreground hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="mt-1.5 space-y-1 text-destructive">
          <p className="text-[10px] leading-tight">{task.error || "Task failed"}</p>
          <div className="flex items-center gap-1 pt-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onRetry}
              className="h-5 rounded-md text-[10px] px-2 gap-1 cursor-pointer"
            >
              <RotateCcw className="size-2.5" />
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

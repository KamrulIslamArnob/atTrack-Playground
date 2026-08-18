"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { extractJobImport, deleteScreenshots } from "@/lib/actions/job-imports";
import { enrichJobFromAi } from "@/lib/actions/jobs";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import type { AITask, AITaskPayload } from "@/lib/types/ai-task";
import type { ExtractionResult } from "@/lib/ai/schema";

interface AITaskQueueContextType {
  tasks: AITask[];
  activeTasksCount: number;
  pendingConfirmationCount: number;
  isPanelOpen: boolean;
  isMinimized: boolean;
  setIsPanelOpen: (open: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  toggleMinimize: () => void;
  enqueueJobUpdateTask: (params: {
    jobId: string;
    jobTitle: string;
    companyName?: string;
    url?: string;
    text?: string;
    imageIds?: string[];
  }) => string;
  applyTask: (taskId: string) => Promise<boolean>;
  dismissTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

const AITaskQueueContext = createContext<AITaskQueueContextType | null>(null);

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ai_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeExtraction(extraction: ExtractionResult): { summary: string; changesCount: number } {
  const fields: string[] = [];
  if (extraction.salary_range) fields.push("Salary");
  if (extraction.location) fields.push("Location");
  if (extraction.employment_type) fields.push("Employment type");
  if (extraction.work_location) fields.push("Work mode");
  if (Array.isArray(extraction.skills) && extraction.skills.length > 0) {
    fields.push(`Skills (${extraction.skills.length})`);
  }
  if (Array.isArray(extraction.benefits) && extraction.benefits.length > 0) {
    fields.push(`Benefits (${extraction.benefits.length})`);
  }
  if (extraction.educational_requirements) fields.push("Education");
  if (extraction.work_schedule) fields.push("Schedule");
  if (extraction.holiday_policy) fields.push("Holiday policy");
  if (extraction.description) fields.push("Description");
  if (extraction.contact?.name || extraction.contact?.email) fields.push("Contact info");

  const count = fields.length;
  const summary = count > 0 ? `${count} change${count === 1 ? "" : "s"} suggested (${fields.slice(0, 3).join(", ")}${fields.length > 3 ? "..." : ""})` : "No new changes detected";
  return { summary, changesCount: count };
}

export function AITaskQueueProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const router = useRouter();

  const tasksRef = useRef<AITask[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const updateTask = useCallback((id: string, patch: Partial<AITask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const runTask = useCallback(
    async (task: AITask) => {
      const { id, payload } = task;
      const { imageIds = [], text = "", url = "" } = payload;

      updateTask(id, {
        status: "processing",
        progress: 30,
        statusMessage: "AI is analyzing posting & extracting details...",
      });

      // Simulated step animation while async call runs
      const progressTimer = setInterval(() => {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === id && t.status === "processing" && (t.progress ?? 0) < 85) {
              return {
                ...t,
                progress: (t.progress ?? 30) + 15,
                statusMessage:
                  (t.progress ?? 0) > 50
                    ? "Structuring skills, benefits & requirements..."
                    : "AI is analyzing posting & extracting details...",
              };
            }
            return t;
          })
        );
      }, 1200);

      try {
        const result = await extractJobImport(imageIds, text, url);
        clearInterval(progressTimer);

        const { summary, changesCount } = summarizeExtraction(result);

        updateTask(id, {
          status: "awaiting_confirmation",
          progress: 100,
          statusMessage: "Update completed — changes suggested",
          result: {
            extraction: result,
            summary,
            changesCount,
          },
          completedAt: Date.now(),
        });

        toast.success(
          `AI update ready for "${task.title}" (${changesCount} change${changesCount === 1 ? "" : "s"} found)`,
          {
            description: "Click Apply or Review in the Task Queue panel at the bottom.",
          }
        );
      } catch (err) {
        clearInterval(progressTimer);
        const errMsg = cleanAiErrorMessage(
          err instanceof Error ? err.message : "AI extraction failed."
        );
        updateTask(id, {
          status: "failed",
          progress: 0,
          statusMessage: "Extraction failed",
          error: errMsg,
          completedAt: Date.now(),
        });
        toast.error(`AI Task failed for "${task.title}": ${errMsg}`);
      }
    },
    [updateTask]
  );

  const enqueueJobUpdateTask = useCallback(
    (params: {
      jobId: string;
      jobTitle: string;
      companyName?: string;
      url?: string;
      text?: string;
      imageIds?: string[];
    }): string => {
      const taskId = uid();
      const newTask: AITask = {
        id: taskId,
        type: "job_update",
        title: `Updating "${params.jobTitle}"`,
        subtitle: params.companyName ?? undefined,
        status: "queued",
        progress: 0,
        statusMessage: "Task queued...",
        payload: params as AITaskPayload,
        createdAt: Date.now(),
      };

      setTasks((prev) => [newTask, ...prev]);
      setIsPanelOpen(true);
      setIsMinimized(false);

      // Start task asynchronously
      setTimeout(() => {
        runTask(newTask);
      }, 50);

      return taskId;
    },
    [runTask]
  );

  const applyTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task || !task.result?.extraction || !task.payload.jobId) return false;

      updateTask(taskId, {
        status: "processing",
        statusMessage: "Saving enhanced details to job...",
      });

      try {
        const res = await enrichJobFromAi(
          task.payload.jobId as string,
          task.result.extraction
        );
        if (res.success) {
          updateTask(taskId, {
            status: "applied",
            statusMessage: "Applied successfully",
            completedAt: Date.now(),
          });

          toast.success(
            `"${task.title}" updated with AI! (${res.updatedFields.length} field${res.updatedFields.length === 1 ? "" : "s"} enhanced)`
          );

          // Cleanup screenshot temp files
          const imageIds = task.payload.imageIds as string[] | undefined;
          if (Array.isArray(imageIds) && imageIds.length > 0) {
            deleteScreenshots(imageIds).catch(() => {});
          }

          router.refresh();
          return true;
        }
        return false;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to apply updates.";
        updateTask(taskId, {
          status: "awaiting_confirmation",
          error: errMsg,
        });
        toast.error(errMsg);
        return false;
      }
    },
    [updateTask, router]
  );

  const dismissTask = useCallback(
    (taskId: string) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (task?.payload?.imageIds && Array.isArray(task.payload.imageIds)) {
        deleteScreenshots(task.payload.imageIds).catch(() => {});
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    []
  );

  const retryTask = useCallback(
    (taskId: string) => {
      const task = tasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      runTask(task);
    },
    [runTask]
  );

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) =>
      prev.filter(
        (t) =>
          t.status !== "applied" &&
          t.status !== "dismissed" &&
          t.status !== "failed"
      )
    );
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const activeTasksCount = tasks.filter(
    (t) => t.status === "queued" || t.status === "processing"
  ).length;

  const pendingConfirmationCount = tasks.filter(
    (t) => t.status === "awaiting_confirmation"
  ).length;

  return (
    <AITaskQueueContext.Provider
      value={{
        tasks,
        activeTasksCount,
        pendingConfirmationCount,
        isPanelOpen,
        isMinimized,
        setIsPanelOpen,
        setIsMinimized,
        toggleMinimize,
        enqueueJobUpdateTask,
        applyTask,
        dismissTask,
        retryTask,
        clearCompletedTasks,
      }}
    >
      {children}
    </AITaskQueueContext.Provider>
  );
}

export function useAITaskQueue() {
  const context = useContext(AITaskQueueContext);
  if (!context) {
    throw new Error("useAITaskQueue must be used within an AITaskQueueProvider");
  }
  return context;
}

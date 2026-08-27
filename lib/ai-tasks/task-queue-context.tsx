"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { extractJobImport, deleteScreenshots } from "@/lib/actions/job-imports";
import { enrichJobFromAi } from "@/lib/actions/jobs";
import { streamGenerateAiTool, parseEmailFromStream } from "@/lib/ai/ai-tools";
import { useAiToolsStore } from "@/lib/stores/ai-tools-store";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import type { AITask, AITaskPayload } from "@/lib/types/ai-task";
import type { ExtractionResult } from "@/lib/ai/schema";
import { aiToolLabel, type AiToolKind } from "@/lib/types/ai-tools";
import { generateUUID } from "@/lib/utils";

interface AITaskQueueContextType {
  tasks: AITask[];
  activeTasksCount: number;
  pendingConfirmationCount: number;
  isPanelOpen: boolean;
  isMinimized: boolean;
  setIsPanelOpen: (open: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  toggleMinimize: () => void;
  activeViewingJobId: string | null;
  activeViewingTab: string | null;
  setActiveViewing: (jobId: string | null, tab: string | null) => void;
  enqueueJobUpdateTask: (params: {
    jobId: string;
    jobTitle: string;
    companyName?: string;
    url?: string;
    text?: string;
    imageIds?: string[];
  }) => string;
  enqueueAiToolTask: (params: {
    jobId: string;
    jobTitle: string;
    companyName?: string;
    kind: AiToolKind;
    applicantName?: string;
    applicantHeadline?: string | null;
    resumeContent?: string | null;
    jobDescription?: string | null;
    context?: string | null;
  }) => string;
  applyTask: (taskId: string) => Promise<boolean>;
  dismissTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

const AITaskQueueContext = createContext<AITaskQueueContextType | null>(null);

function uid(): string {
  return generateUUID();
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

const STORAGE_KEY_TASKS = "attrack-queue-tasks";
const STORAGE_KEY_OPEN = "attrack-queue-open";

export function AITaskQueueProvider({ children }: { children: React.ReactNode }) {
  // Hydration-safe: start with server-matching empty state, hydrate from localStorage in effect
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeViewingJobId, setActiveViewingJobId] = useState<string | null>(null);
  const [activeViewingTab, setActiveViewingTab] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const router = useRouter();

  const setActiveViewing = useCallback((jobId: string | null, tab: string | null) => {
    setActiveViewingJobId(jobId);
    setActiveViewingTab(tab);
  }, []);

  // Hydrate from localStorage once on client (avoids server/client mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TASKS);
      if (raw) {
        const parsed = JSON.parse(raw) as AITask[];
        const hydrated = parsed.map((t) =>
          t.status === "processing" || t.status === "queued"
            ? { ...t, status: "failed" as const, error: "Task interrupted — click Retry to restart", completedAt: Date.now() }
            : t
        );
        if (hydrated.length > 0) setTasks(hydrated);
      }
    } catch {}
    try {
      const open = localStorage.getItem(STORAGE_KEY_OPEN);
      if (open === "true") setIsPanelOpen(true);
    } catch {}
    setHasHydrated(true);
  }, []);

  const tasksRef = useRef<AITask[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Persist open state — only after hydration to avoid overwriting persisted value with initial false
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, String(isPanelOpen));
    } catch {}
  }, [isPanelOpen, hasHydrated]);

  // Persist tasks (cap 20, prune applied/dismissed >24h) — only after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      const now = Date.now();
      const pruned = tasks
        .filter((t) => {
          if ((t.status === "applied" || t.status === "dismissed") && t.completedAt && now - t.completedAt > 24 * 60 * 60 * 1000) return false;
          return true;
        })
        .slice(0, 20);
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(pruned));
    } catch {}
  }, [tasks, hasHydrated]);

  const updateTask = useCallback((id: string, patch: Partial<AITask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  const runTask = useCallback(
    async (task: AITask) => {
      const { id, payload, type } = task;

      if (type === "ai_tool_generation") {
        const {
          kind,
          jobId,
          jobTitle = "Job",
          companyName = "the company",
          jobDescription = null,
          applicantName = "Applicant",
          applicantHeadline = null,
          resumeContent = null,
          context = null,
        } = payload;

        if (!kind || !jobId) return;

        const label = aiToolLabel(kind);

        updateTask(id, {
          status: "processing",
          progress: 25,
          statusMessage: `AI is generating ${label}...`,
        });

        useAiToolsStore.getState().setGenerating(jobId, kind, true);

        let streamBuffer = "";
        try {
          for await (const chunk of streamGenerateAiTool({
            kind,
            jobTitle,
            companyName,
            jobDescription,
            applicantName,
            applicantHeadline,
            resumeContent,
            context: context?.trim() || null,
          })) {
            streamBuffer += chunk;
            const partial = parseEmailFromStream(streamBuffer);
            if (partial) {
              useAiToolsStore.getState().setResult(jobId, partial);
            }
          }

          const finalResult = parseEmailFromStream(streamBuffer);
          if (finalResult) {
            useAiToolsStore.getState().setResult(jobId, finalResult);
            useAiToolsStore.getState().setGenerating(jobId, kind, false);

            updateTask(id, {
              status: "awaiting_confirmation",
              progress: 100,
              statusMessage: `${label} generated successfully`,
              result: {
                generatedEmail: finalResult,
                toolKind: kind,
                summary: `${label} for ${jobTitle} ready`,
              },
              completedAt: Date.now(),
            });
          } else {
            throw new Error("Could not parse generated output");
          }
        } catch (err) {
          const errMsg = cleanAiErrorMessage(
            err instanceof Error ? err.message : "AI generation failed."
          );
          useAiToolsStore.getState().setGenerating(jobId, kind, false, errMsg);
          updateTask(id, {
            status: "failed",
            progress: 0,
            statusMessage: "Generation failed",
            error: errMsg,
            completedAt: Date.now(),
          });
          toast.error(`AI Task failed for "${label}": ${errMsg}`);
        }
        return;
      }

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

      const wasEmpty = tasksRef.current.length === 0;
      setTasks((prev) => [newTask, ...prev]);
      // Auto-open on first task or when no prior tasks; otherwise just badge
      if (wasEmpty) {
        setIsPanelOpen(true);
      }
      setIsMinimized(false);

      // Start task asynchronously
      setTimeout(() => {
        runTask(newTask);
      }, 50);

      return taskId;
    },
    [runTask]
  );

  const enqueueAiToolTask = useCallback(
    (params: {
      jobId: string;
      jobTitle: string;
      companyName?: string;
      kind: AiToolKind;
      applicantName?: string;
      applicantHeadline?: string | null;
      resumeContent?: string | null;
      jobDescription?: string | null;
      context?: string | null;
    }): string => {
      const taskId = uid();
      const label = aiToolLabel(params.kind);
      const newTask: AITask = {
        id: taskId,
        type: "ai_tool_generation",
        title: `Generating ${label}`,
        subtitle: `${params.jobTitle}${params.companyName ? ` · ${params.companyName}` : ""}`,
        status: "queued",
        progress: 0,
        statusMessage: `Queued ${label}...`,
        payload: params as AITaskPayload,
        createdAt: Date.now(),
      };

      const wasEmptyAi = tasksRef.current.length === 0;
      setTasks((prev) => [newTask, ...prev]);
      if (wasEmptyAi) {
        setIsPanelOpen(true);
      }
      setIsMinimized(false);

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

  const { activeTasksCount, pendingConfirmationCount } = useMemo(() => {
    let active = 0;
    let pending = 0;
    for (const t of tasks) {
      if (t.status === "queued" || t.status === "processing") active++;
      else if (t.status === "awaiting_confirmation") pending++;
    }
    return { activeTasksCount: active, pendingConfirmationCount: pending };
  }, [tasks]);

  const contextValue = useMemo(
    () => ({
      tasks,
      activeTasksCount,
      pendingConfirmationCount,
      isPanelOpen,
      isMinimized,
      setIsPanelOpen,
      setIsMinimized,
      toggleMinimize,
      activeViewingJobId,
      activeViewingTab,
      setActiveViewing,
      enqueueJobUpdateTask,
      enqueueAiToolTask,
      applyTask,
      dismissTask,
      retryTask,
      clearCompletedTasks,
    }),
    [
      tasks,
      activeTasksCount,
      pendingConfirmationCount,
      isPanelOpen,
      isMinimized,
      activeViewingJobId,
      activeViewingTab,
      setActiveViewing,
      toggleMinimize,
      enqueueJobUpdateTask,
      enqueueAiToolTask,
      applyTask,
      dismissTask,
      retryTask,
      clearCompletedTasks,
    ]
  );

  return (
    <AITaskQueueContext.Provider value={contextValue}>
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

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { streamGenerateAiTool, parseEmailFromStream, type GeneratedEmail } from "@/lib/ai/ai-tools";
import type { AiToolKind } from "@/lib/types/ai-tools";
import { toast } from "sonner";

export interface JobAiToolState {
  kind: AiToolKind | null;
  context: string;
  generating: boolean;
  result: GeneratedEmail | null;
  to: string;
  error: string | null;
}

const defaultJobState: JobAiToolState = {
  kind: null,
  context: "",
  generating: false,
  result: null,
  to: "",
  error: null,
};

const activeAbortControllers = new Map<string, AbortController>();

interface AiToolsStore {
  jobs: Record<string, JobAiToolState>;
  getJobState: (jobId: string, defaultToEmail?: string | null) => JobAiToolState;
  setKind: (jobId: string, kind: AiToolKind | null) => void;
  setContext: (jobId: string, context: string) => void;
  setResult: (jobId: string, result: GeneratedEmail | null) => void;
  setTo: (jobId: string, to: string) => void;
  setGenerating: (jobId: string, kind: AiToolKind, generating: boolean, error?: string | null) => void;
  resetJob: (jobId: string) => void;
  generate: (params: {
    jobId: string;
    kind: AiToolKind;
    jobTitle: string;
    companyName: string;
    jobDescription: string | null;
    applicantName: string;
    applicantHeadline: string | null;
    resumeContent: string | null;
    context: string | null;
  }) => Promise<void>;
}

export const useAiToolsStore = create<AiToolsStore>()(
  persist(
    (set, get) => ({
      jobs: {},

      getJobState: (jobId: string, defaultToEmail?: string | null) => {
        const state = get().jobs[jobId];
        if (state) return state;
        return {
          ...defaultJobState,
          to: defaultToEmail ?? "",
        };
      },

      setKind: (jobId: string, kind: AiToolKind | null) => {
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...current, kind },
            },
          };
        });
      },

      setContext: (jobId: string, context: string) => {
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...current, context },
            },
          };
        });
      },

      setResult: (jobId: string, result: GeneratedEmail | null) => {
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...current, result },
            },
          };
        });
      },

      setTo: (jobId: string, to: string) => {
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: { ...current, to },
            },
          };
        });
      },

      setGenerating: (jobId: string, kind: AiToolKind, generating: boolean, error: string | null = null) => {
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...current,
                kind,
                generating,
                error,
              },
            },
          };
        });
      },

      resetJob: (jobId: string) => {
        const controller = activeAbortControllers.get(jobId);
        if (controller) {
          controller.abort();
          activeAbortControllers.delete(jobId);
        }
        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...current,
                kind: null,
                result: null,
                generating: false,
                error: null,
              },
            },
          };
        });
      },

      generate: async ({
        jobId,
        kind,
        jobTitle,
        companyName,
        jobDescription,
        applicantName,
        applicantHeadline,
        resumeContent,
        context,
      }) => {
        const existingController = activeAbortControllers.get(jobId);
        if (existingController) {
          existingController.abort();
        }

        const controller = new AbortController();
        activeAbortControllers.set(jobId, controller);

        set((state) => {
          const current = state.jobs[jobId] ?? { ...defaultJobState };
          return {
            jobs: {
              ...state.jobs,
              [jobId]: {
                ...current,
                kind,
                generating: true,
                result: null,
                error: null,
              },
            },
          };
        });

        let streamBuffer = "";

        try {
          for await (const chunk of streamGenerateAiTool(
            {
              kind,
              jobTitle,
              companyName,
              jobDescription,
              applicantName,
              applicantHeadline,
              resumeContent,
              context: context?.trim() || null,
            },
            controller.signal
          )) {
            streamBuffer += chunk;
            const partial = parseEmailFromStream(streamBuffer);
            if (partial) {
              set((state) => {
                const current = state.jobs[jobId] ?? { ...defaultJobState };
                return {
                  jobs: {
                    ...state.jobs,
                    [jobId]: {
                      ...current,
                      result: partial,
                    },
                  },
                };
              });
            }
          }

          const finalResult = parseEmailFromStream(streamBuffer);
          if (finalResult) {
            set((state) => {
              const current = state.jobs[jobId] ?? { ...defaultJobState };
              return {
                jobs: {
                  ...state.jobs,
                  [jobId]: {
                    ...current,
                    generating: false,
                    result: finalResult,
                  },
                },
              };
            });
          } else {
            throw new Error("Couldn't parse the generated output");
          }
        } catch (err: unknown) {
          if (controller.signal.aborted) {
            return;
          }
          const message = err instanceof Error ? err.message : "Generation failed";
          set((state) => {
            const current = state.jobs[jobId] ?? { ...defaultJobState };
            return {
              jobs: {
                ...state.jobs,
                [jobId]: {
                  ...current,
                  generating: false,
                  error: message,
                },
              },
            };
          });
          toast.error(message);
        } finally {
          if (activeAbortControllers.get(jobId) === controller) {
            activeAbortControllers.delete(jobId);
          }
        }
      },
    }),
    {
      name: "attrack-ai-tools-store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        jobs: Object.fromEntries(
          Object.entries(state.jobs).map(([id, j]) => [
            id,
            { ...j, generating: false },
          ])
        ),
      }),
    }
  )
);

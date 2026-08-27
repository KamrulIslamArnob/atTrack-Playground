"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  type ChatMessage,
  type DbApproval,
  type ToolExecutionStep,
  extractThinkingAndContent,
} from "./use-chat";
import {
  persistSession,
  readCache,
  writeCache,
  generateSessionTitle,
  type ChatSession,
  type Message,
} from "./sessions";
import { ApprovalModal } from "@/components/ai-chatbot/approval-modal";
import { toast } from "sonner";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";

export interface ChatQueueTask {
  id: string;
  sessionId: string;
  userPrompt: string;
  query?: string;
  attachments?: { url: string; contentType?: string }[];
  createdAt: number;
  status: "queued" | "streaming" | "paused_approval" | "completed" | "failed" | "cancelled";
  error?: string;
  bodyPayload: Record<string, unknown>;
}

export interface SessionStreamState {
  sessionId: string;
  status: "idle" | "streaming" | "paused_approval" | "completed" | "error";
  streamText: string;
  thinking?: string;
  sources: string[];
  toolSteps: ToolExecutionStep[];
  approval: DbApproval | null;
  error?: string;
}

export interface ChatQueueContextType {
  tasks: ChatQueueTask[];
  activeStreams: Record<string, SessionStreamState>;
  enqueueChat: (
    sessionId: string,
    userPrompt: string,
    attachments?: { url: string; contentType?: string }[],
    bodyPayload?: Record<string, unknown>
  ) => Promise<void>;
  cancelChat: (sessionId: string) => void;
  resolveApproval: (approvalId: string, decision: "allow" | "deny", sessionId?: string) => Promise<void>;
  handleApprovalTimeout: (approvalId: string, sessionId?: string) => void;
  activeApproval: DbApproval | null;
  setActiveApproval: (approval: DbApproval | null) => void;
  isSessionStreaming: (sessionId: string) => boolean;
  getSessionStream: (sessionId: string) => SessionStreamState | undefined;
}

const ChatQueueContext = createContext<ChatQueueContextType | null>(null);

import { generateUUID } from "@/lib/utils";

function uid(): string {
  return generateUUID();
}

export function ChatQueueProvider({ children }: { children: React.ReactNode }) {
  const [activeApproval, setActiveApproval] = useState<DbApproval | null>(null);
  const [activeStreams, setActiveStreams] = useState<Record<string, SessionStreamState>>({});
  const [tasks, setTasks] = useState<ChatQueueTask[]>([]);
  const queueRef = useRef<ChatQueueTask[]>([]);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const syncTasks = useCallback(() => {
    setTasks([...queueRef.current]);
  }, []);

  const updateStreamState = useCallback(
    (sessionId: string, updater: (prev: SessionStreamState) => SessionStreamState) => {
      setActiveStreams((prev) => {
        const current = prev[sessionId] || {
          sessionId,
          status: "idle",
          streamText: "",
          thinking: "",
          sources: [],
          toolSteps: [],
          approval: null,
        };
        const updated = updater(current);
        return { ...prev, [sessionId]: updated };
      });
    },
    []
  );

  const resolveApproval = useCallback(
    async (approvalId: string, decision: "allow" | "deny", sessionId?: string) => {
      const currentApproval = activeApproval;
      const targetSessionId = sessionId || currentApproval?.sessionId;
      setActiveApproval(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbApproval: {
              approvalId,
              decision,
            },
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Approval decision failed: ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
              if (delta) responseText += delta;
            } catch {}
          }
        }

        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
                if (delta) responseText += delta;
              } catch {}
            }
          }
        }

        if (targetSessionId) {
          const msgId = uid();
          const approvalMsg: ChatMessage = {
            id: msgId,
            role: "assistant",
            content:
              responseText ||
              (decision === "allow"
                ? "Deletion completed successfully."
                : "Deletion cancelled."),
            createdAt: new Date().toISOString(),
            status: "delivered",
          };

          // Sync with localStorage mirror and SQLite authority
          const cached = readCache();
          const session = cached.find((s) => s.id === targetSessionId);
          if (session) {
            const updatedMessages = [...(session.messages || []), approvalMsg as Message];
            const updatedSession: ChatSession = {
              ...session,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
            };
            const updatedSessions = cached.map((s) =>
              s.id === targetSessionId ? updatedSession : s
            );
            writeCache(updatedSessions);
            void persistSession(updatedSession).catch((e) =>
              console.error("Failed to persist session:", e)
            );
          }

          updateStreamState(targetSessionId, (s) => ({
            ...s,
            status: "completed",
            streamText: responseText,
            approval: null,
          }));
        }

        toast.success(
          decision === "allow" ? "Delete executed successfully" : "Delete cancelled"
        );
      } catch (err) {
        console.error("Error executing approval:", err);
        toast.error(err instanceof Error ? err.message : "Failed to process decision");
      }
    },
    [activeApproval, updateStreamState]
  );

  const handleApprovalTimeout = useCallback(
    (approvalId: string, sessionId?: string) => {
      void resolveApproval(approvalId, "deny", sessionId);
    },
    [resolveApproval]
  );

  // Multi-session worker that streams turns for a single session
  const runSessionWorker = useCallback(
    async (task: ChatQueueTask) => {
      const { id: taskId, sessionId, userPrompt, attachments, bodyPayload } = task;
      task.status = "streaming";
      syncTasks();

      const controller = new AbortController();
      abortControllersRef.current.set(sessionId, controller);

      updateStreamState(sessionId, () => ({
        sessionId,
        status: "streaming",
        streamText: "",
        thinking: "",
        sources: [],
        toolSteps: [],
        approval: null,
      }));

      try {
        // Read latest session state from localStorage mirror
        const cached = readCache();
        const session = cached.find((s) => s.id === sessionId);
        const history = session?.messages || [];

        const userMsg: Message = {
          id: uid(),
          role: "user",
          content: userPrompt,
          createdAt: new Date().toISOString(),
          experimental_attachments: attachments,
        };

        const assistantId = uid();
        const updatedHistory = [...history, userMsg];
        const isFirstMessage = history.length === 0;
        const newTitle = isFirstMessage ? generateSessionTitle(userPrompt) : session?.title || "New Chat";

        // Optimistically write user prompt to cache & SQLite
        if (session) {
          const updatedSession: ChatSession = {
            ...session,
            title: newTitle,
            messages: updatedHistory,
            updatedAt: new Date().toISOString(),
          };
          const updatedSessions = cached.map((s) =>
            s.id === sessionId ? updatedSession : s
          );
          writeCache(updatedSessions);
          void persistSession(updatedSession).catch((e) =>
            console.error("Failed to persist session:", e)
          );
        } else {
          const newSession: ChatSession = {
            id: sessionId,
            title: newTitle,
            messages: updatedHistory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            model: (bodyPayload?.model as string) || "auto",
          };
          const updatedSessions = [newSession, ...cached.filter((s) => s.id !== sessionId)];
          writeCache(updatedSessions);
          void persistSession(newSession).catch((e) =>
            console.error("Failed to persist session:", e)
          );
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedHistory.map((m) => ({
              role: m.role,
              content: m.content,
              experimental_attachments: m.experimental_attachments,
            })),
            ...bodyPayload,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat API error (${res.status}): ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let structuredThinkingAcc = "";
        let rawContentAcc = "";
        let sourcesAcc: string[] = [];
        let toolStepsAcc: ToolExecutionStep[] = [];
        let streamError: string | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              // Quota/rate-limit or any provider failure arrives as 200 SSE with {error: "..."} — surface it instead of silent empty bubble
              if (typeof parsed?.error === "string" && parsed.error.trim()) {
                streamError = cleanAiErrorMessage(parsed.error);
                continue;
              }

              const reasoningDelta: string | undefined =
                parsed?.choices?.[0]?.delta?.reasoning_content ??
                parsed?.choices?.[0]?.delta?.reasoning ??
                parsed?.delta?.reasoning_content ??
                parsed?.thinking;

              if (reasoningDelta) structuredThinkingAcc += reasoningDelta;

              const contentDelta: string | undefined =
                parsed?.choices?.[0]?.delta?.content ?? parsed?.content;

              if (contentDelta) rawContentAcc += contentDelta;

              if (Array.isArray(parsed?.sources) && parsed.sources.length > 0) {
                sourcesAcc = parsed.sources;
              }

              if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
                toolStepsAcc = parsed.tool_calls.map((s: unknown, i: number) => {
                  const rec = s as {
                    name?: string;
                    status?: string;
                    args?: Record<string, unknown>;
                    error?: string;
                    result?: { content?: string; artifact?: unknown; artifacts?: unknown };
                  };
                  return {
                    id: `tool-${i}`,
                    label: rec.name ?? "tool",
                    status: (rec.status === "error"
                      ? "failed"
                      : rec.status === "called"
                      ? "running"
                      : "completed") as "pending" | "running" | "completed" | "failed",
                    detail: rec.args ? JSON.stringify(rec.args) : undefined,
                    result: rec.result?.content,
                    error: rec.error,
                    artifact: rec.result?.artifact as import("@/lib/types/chat-artifact").ChatArtifact | undefined,
                    artifacts: rec.result?.artifacts as import("@/lib/types/chat-artifact").ChatArtifact[] | undefined,
                  };
                });
              }

              // Gated interactive approval popup event
              if (parsed?.approval && typeof parsed.approval === "object") {
                const approvalObj: DbApproval = {
                  ...parsed.approval,
                  sessionId,
                  expiresAt: parsed.approval.expiresAt || Date.now() + 60_000,
                };
                setActiveApproval(approvalObj);
                updateStreamState(sessionId, (s) => ({
                  ...s,
                  status: "paused_approval",
                  approval: approvalObj,
                }));
              }

              const { thinking, content } = extractThinkingAndContent(
                rawContentAcc,
                structuredThinkingAcc
              );

              updateStreamState(sessionId, (s) => ({
                ...s,
                streamText: content,
                thinking: thinking || "",
                sources: sourcesAcc,
                toolSteps: toolStepsAcc,
              }));
            } catch {}
          }
        }

        // Flush trailing partial frame if stream ended without newline
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim();
            if (data !== "[DONE]") {
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed?.error === "string" && parsed.error.trim()) {
                  streamError = cleanAiErrorMessage(parsed.error);
                } else {
                  const reasoningDelta: string | undefined =
                    parsed?.choices?.[0]?.delta?.reasoning_content ??
                    parsed?.choices?.[0]?.delta?.reasoning ??
                    parsed?.delta?.reasoning_content ??
                    parsed?.thinking;
                  if (reasoningDelta) structuredThinkingAcc += reasoningDelta;

                  const contentDelta: string | undefined =
                    parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
                  if (contentDelta) rawContentAcc += contentDelta;

                  if (Array.isArray(parsed?.sources) && parsed.sources.length > 0) {
                    sourcesAcc = parsed.sources;
                  }
                  if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
                    toolStepsAcc = parsed.tool_calls.map((s: unknown, i: number) => {
                      const rec = s as {
                        name?: string;
                        status?: string;
                        args?: Record<string, unknown>;
                        error?: string;
                        result?: { content?: string; artifact?: unknown; artifacts?: unknown };
                      };
                      return {
                        id: `tool-${i}`,
                        label: rec.name ?? "tool",
                        status: (rec.status === "error"
                          ? "failed"
                          : rec.status === "called"
                          ? "running"
                          : "completed") as "pending" | "running" | "completed" | "failed",
                        detail: rec.args ? JSON.stringify(rec.args) : undefined,
                        result: rec.result?.content,
                        error: rec.error,
                        artifact: rec.result?.artifact as import("@/lib/types/chat-artifact").ChatArtifact | undefined,
                        artifacts: rec.result?.artifacts as import("@/lib/types/chat-artifact").ChatArtifact[] | undefined,
                      };
                    });
                  }
                  if (parsed?.approval && typeof parsed.approval === "object") {
                    const approvalObj: DbApproval = {
                      ...parsed.approval,
                      sessionId,
                      expiresAt: parsed.approval.expiresAt || Date.now() + 60_000,
                    };
                    setActiveApproval(approvalObj);
                    updateStreamState(sessionId, (s) => ({
                      ...s,
                      status: "paused_approval",
                      approval: approvalObj,
                    }));
                  }
                }
              } catch {}
            }
          }
        }

        // Provider signalled failure inside 200 SSE (quota/rate-limit) — persist as error message, not silent empty bubble
        if (streamError) {
          const { content: partialContent, thinking: partialThinking } = extractThinkingAndContent(
            rawContentAcc,
            structuredThinkingAcc
          );
          const errorContent = partialContent.trim()
            ? `${partialContent}\n\n⚠️ ${streamError}`
            : `⚠️ ${streamError}`;
          const errorMsg: Message = {
            id: assistantId,
            role: "assistant",
            content: errorContent,
            thinking: partialThinking || structuredThinkingAcc || undefined,
            sources: sourcesAcc,
            toolSteps: toolStepsAcc,
            createdAt: new Date().toISOString(),
          };
          const errorHistory = [...updatedHistory, errorMsg];
          const sessionToSaveErr = readCache().find((s) => s.id === sessionId);
          if (sessionToSaveErr) {
            const errSession: ChatSession = {
              ...sessionToSaveErr,
              messages: errorHistory,
              updatedAt: new Date().toISOString(),
            };
            const finalSessionsErr = readCache().map((s) => (s.id === sessionId ? errSession : s));
            writeCache(finalSessionsErr);
            void persistSession(errSession).catch((e) => console.error("Failed to persist session:", e));
          }
          task.status = "failed";
          task.error = streamError;
          updateStreamState(sessionId, (s) => ({
            ...s,
            status: "error",
            error: streamError,
            streamText: errorContent,
            thinking: structuredThinkingAcc || "",
          }));
          toast.error(streamError);
        } else {
          // Stream completed cleanly
          const { thinking, content } = extractThinkingAndContent(
            rawContentAcc,
            structuredThinkingAcc
          );

          // Dedupe artifacts already handled in renderer, keep message as is
          const finalAssistantMsg: Message = {
            id: assistantId,
            role: "assistant",
            content,
            thinking,
            sources: sourcesAcc,
            toolSteps: toolStepsAcc,
            createdAt: new Date().toISOString(),
          };

          const finalHistory = [...updatedHistory, finalAssistantMsg];
          const sessionToSave = readCache().find((s) => s.id === sessionId);
          if (sessionToSave) {
            const finalSession: ChatSession = {
              ...sessionToSave,
              messages: finalHistory,
              updatedAt: new Date().toISOString(),
            };
            const finalSessions = readCache().map((s) =>
              s.id === sessionId ? finalSession : s
            );
            writeCache(finalSessions);
            void persistSession(finalSession).catch((e) =>
              console.error("Failed to persist session:", e)
            );
          }

          task.status = "completed";
          updateStreamState(sessionId, (s) => ({
            ...s,
            status: s.status === "paused_approval" ? "paused_approval" : "completed",
            streamText: content,
            thinking: thinking || "",
          }));
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          task.status = "cancelled";
          updateStreamState(sessionId, (s) => ({ ...s, status: "idle" }));
        } else {
          const errorMsg = err instanceof Error ? err.message : String(err);
          task.status = "failed";
          task.error = errorMsg;
          updateStreamState(sessionId, (s) => ({
            ...s,
            status: "error",
            error: errorMsg,
          }));
          toast.error(`Chat error in session: ${errorMsg}`);
        }
      } finally {
        // Clean up ONLY this task, release controller, and drain remaining tasks
        abortControllersRef.current.delete(sessionId);
        queueRef.current = queueRef.current.filter((t) => t.id !== taskId);
        syncTasks();
        drainQueue();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateStreamState, syncTasks]
  );

  // Multi-session parallel scheduler: starts concurrent workers for distinct idle sessions
  const drainQueue = useCallback(() => {
    const activeSessionIds = new Set(abortControllersRef.current.keys());
    const tasksToStart: ChatQueueTask[] = [];
    const candidateSessions = new Set<string>();

    for (const task of queueRef.current) {
      if (
        task.status === "queued" &&
        !activeSessionIds.has(task.sessionId) &&
        !candidateSessions.has(task.sessionId)
      ) {
        tasksToStart.push(task);
        candidateSessions.add(task.sessionId);
        activeSessionIds.add(task.sessionId); // Mark session busy in this pass
      }
    }

    for (const task of tasksToStart) {
      void runSessionWorker(task);
    }
  }, [runSessionWorker]);

  const enqueueChat = useCallback(
    async (
      sessionId: string,
      userPrompt: string,
      attachments?: { url: string; contentType?: string }[],
      bodyPayload: Record<string, unknown> = {}
    ) => {
      const task: ChatQueueTask = {
        id: uid(),
        sessionId,
        userPrompt,
        query: userPrompt,
        attachments,
        createdAt: Date.now(),
        status: "queued",
        bodyPayload,
      };

      queueRef.current.push(task);
      syncTasks();
      drainQueue();
    },
    [drainQueue, syncTasks]
  );

  const cancelChat = useCallback(
    (sessionId: string) => {
      const controller = abortControllersRef.current.get(sessionId);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(sessionId);
      }
      queueRef.current = queueRef.current.filter((t) => t.sessionId !== sessionId);
      syncTasks();
      updateStreamState(sessionId, (s) => ({ ...s, status: "idle" }));
      drainQueue();
    },
    [drainQueue, syncTasks, updateStreamState]
  );

  const isSessionStreaming = useCallback(
    (sessionId: string) => {
      return (
        activeStreams[sessionId]?.status === "streaming" ||
        activeStreams[sessionId]?.status === "paused_approval"
      );
    },
    [activeStreams]
  );

  const getSessionStream = useCallback(
    (sessionId: string) => {
      return activeStreams[sessionId];
    },
    [activeStreams]
  );

  return (
    <ChatQueueContext.Provider
      value={{
        tasks,
        activeStreams,
        enqueueChat,
        cancelChat,
        resolveApproval,
        handleApprovalTimeout,
        activeApproval,
        setActiveApproval,
        isSessionStreaming,
        getSessionStream,
      }}
    >
      {children}
      {/* Global Interactive Approval Modal with 60s Countdown Timer */}
      <ApprovalModal
        approval={activeApproval}
        onAllow={(id) => resolveApproval(id, "allow")}
        onDeny={(id) => resolveApproval(id, "deny")}
        onTimeout={(id) => handleApprovalTimeout(id)}
      />
    </ChatQueueContext.Provider>
  );
}

export function useChatQueue() {
  const context = useContext(ChatQueueContext);
  if (!context) {
    throw new Error("useChatQueue must be used within a ChatQueueProvider");
  }
  return context;
}

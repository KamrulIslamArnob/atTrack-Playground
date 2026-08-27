"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateSessionTitle } from "./sessions";
import { cleanAiErrorMessage } from "@/lib/ai/error-formatter";
import type { ChatArtifact } from "@/lib/types/chat-artifact";

export interface ToolExecutionStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail?: string;
  result?: string;
  error?: string;
  approvalRequired?: boolean;
  /** Inline card snapshot created by this tool call (e.g. job board card) */
  artifact?: ChatArtifact;
  artifacts?: ChatArtifact[];
}

export interface DbApproval {
  approvalId: string;
  label: string;
  preview: string;
  sql: string;
  expiresAt?: number;
  sessionId?: string;
  kind?: "delete" | "write" | "tool";
  table?: string;
  action?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  experimental_attachments?: { url: string; contentType?: string }[];
  /** Delivery status: sending → sent → delivered | error */
  status?: "sending" | "sent" | "delivered" | "error";
  /** Quoted reply context (visual-only, prepended to content on send) */
  replyTo?: { id: string; preview: string; role: string };
  /** Feedback rating: up (liked) | down (disliked) | null */
  feedback?: "up" | "down" | null;
  /** Chain of thought / model reasoning stream */
  thinking?: string;
  /** Retrieved workspace sources used */
  sources?: string[];
  /** Tool execution steps invoked by model */
  toolSteps?: ToolExecutionStep[];
  /** A pending operation (e.g. DELETE) awaiting the user's Allow/Deny. */
  approval?: DbApproval;
}

export interface UseAtTrackChatOptions {
  api: string;
  activeSessionId: string | null;
  /** Builds the extra request body (model, persona, workspaceContext, ...). */
  buildBody: () => Record<string, unknown>;
  onSessionUpdated?: (sessionId: string, messages: ChatMessage[], newTitle?: string) => void;
  onSessionComplete?: (sessionId: string, messages: ChatMessage[]) => void;
  onError?: (error: Error, sessionId?: string) => void;
  /** Receives real "Sources used" labels from the server (retrieval workflow). */
  onSources?: (sources: string[], sessionId?: string) => void;
  /** Receives real tool-call records from the server (tool-calling workflow). */
  onToolSteps?: (steps: unknown[], sessionId?: string) => void;
  /** Receives a pending operation that needs the user's interactive sign-off. */
  onApproval?: (approval: DbApproval, sessionId?: string) => void;
}

import { generateUUID } from "@/lib/utils";

function uid(): string {
  return generateUUID();
}

export function extractThinkingAndContent(
  rawText: string,
  structuredThinking: string
): { thinking?: string; content: string } {
  let thinking = structuredThinking;
  let content = rawText;

  if (/<think>/i.test(rawText)) {
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
    let match: RegExpExecArray | null;
    let extractedThinking = "";

    while ((match = thinkRegex.exec(rawText)) !== null) {
      extractedThinking += (extractedThinking ? "\n" : "") + match[1];
    }

    if (extractedThinking) {
      thinking = (thinking ? thinking + "\n" : "") + extractedThinking;
    }

    content = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trimStart();
  }

  return {
    thinking: thinking.trim().length > 0 ? thinking : undefined,
    content,
  };
}

/**
 * Multi-session safe chat hook that maintains isolated message streams
 * and state per session ID. Switching chats or creating new chats does NOT
 * corrupt or abort active background streams.
 */
export function useAtTrackChat({
  api,
  activeSessionId,
  buildBody,
  onSessionUpdated,
  onSessionComplete,
  onError,
  onSources,
  onToolSteps,
  onApproval,
}: UseAtTrackChatOptions) {
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [loadingBySession, setLoadingBySession] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");

  const messagesBySessionRef = useRef<Record<string, ChatMessage[]>>({});
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeSessionIdRef = useRef<string | null>(activeSessionId);

  useEffect(() => {
    messagesBySessionRef.current = messagesBySession;
  }, [messagesBySession]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const activeMessages = (activeSessionId && messagesBySession[activeSessionId]) || [];
  const isLoading = Boolean(activeSessionId && loadingBySession[activeSessionId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const setSessionMessages = useCallback((sessionId: string, msgs: ChatMessage[]) => {
    setMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: msgs,
    }));
  }, []);

  const setMessagesForActive = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const currentId = activeSessionIdRef.current;
      if (!currentId) return;

      setMessagesBySession((prev) => {
        const currentList = prev[currentId] || [];
        const nextList = typeof updater === "function" ? updater(currentList) : updater;
        return {
          ...prev,
          [currentId]: nextList,
        };
      });
    },
    []
  );

  const runStream = useCallback(
    async (
      targetSessionId: string,
      history: ChatMessage[],
      userContent: string,
      attachments?: { url: string; contentType?: string }[]
    ) => {
      const now = Date.now();
      const assistantId = uid();
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user" as const,
        content: userContent,
        createdAt: new Date(now).toISOString(),
        experimental_attachments: attachments,
        status: "sending",
      };
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "sending",
        createdAt: new Date(now + 1).toISOString(),
      };

      const baseHistory = [...history, userMsg];
      const initialWithAssistant = [...baseHistory, assistantMsg];

      // Update state for this specific session
      setMessagesBySession((prev) => ({
        ...prev,
        [targetSessionId]: initialWithAssistant,
      }));
      setLoadingBySession((prev) => ({
        ...prev,
        [targetSessionId]: true,
      }));

      const isFirstMessage = history.length === 0;
      const initialTitle = isFirstMessage ? generateSessionTitle(userContent) : undefined;
      onSessionUpdated?.(targetSessionId, initialWithAssistant, initialTitle);

      const controller = new AbortController();
      abortControllersRef.current.set(targetSessionId, controller);

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: baseHistory.map((m) => ({
              role: m.role,
              content: m.content,
              experimental_attachments: m.experimental_attachments,
            })),
            ...buildBody(),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let detail = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) detail = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
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
                onSources?.(sourcesAcc, targetSessionId);
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
                    status: (rec.status === "error" ? "failed" : rec.status === "called" ? "running" : "completed") as
                      | "pending"
                      | "running"
                      | "completed"
                      | "failed",
                    detail: rec.args ? JSON.stringify(rec.args) : undefined,
                    result: rec.result?.content,
                    error: rec.error,
                    artifact: rec.result?.artifact as import("@/lib/types/chat-artifact").ChatArtifact | undefined,
                    artifacts: rec.result?.artifacts as import("@/lib/types/chat-artifact").ChatArtifact[] | undefined,
                  };
                });
                onToolSteps?.(toolStepsAcc, targetSessionId);
              }

              if (parsed?.approval && typeof parsed.approval === "object") {
                const approvalObj: DbApproval = {
                  ...parsed.approval,
                  sessionId: targetSessionId,
                  expiresAt: parsed.approval.expiresAt || Date.now() + 60_000,
                };
                onApproval?.(approvalObj, targetSessionId);
              }

              const { thinking, content } = extractThinkingAndContent(
                rawContentAcc,
                structuredThinkingAcc
              );

              setMessagesBySession((prev) => {
                const currentMsgs = prev[targetSessionId] || initialWithAssistant;
                const nextMsgs = currentMsgs.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content,
                        thinking,
                        sources: sourcesAcc.length > 0 ? sourcesAcc : m.sources,
                        toolSteps: toolStepsAcc.length > 0 ? toolStepsAcc : m.toolSteps,
                        status: "sending" as const,
                      }
                    : m
                );
                return { ...prev, [targetSessionId]: nextMsgs };
              });
            } catch {
              /* partial frame */
            }
          }
        }

        // Flush trailing partial frame if stream ended without trailing newline
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
                    onSources?.(sourcesAcc, targetSessionId);
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
                        status: (rec.status === "error" ? "failed" : rec.status === "called" ? "running" : "completed") as
                          | "pending"
                          | "running"
                          | "completed"
                          | "failed",
                        detail: rec.args ? JSON.stringify(rec.args) : undefined,
                        result: rec.result?.content,
                        error: rec.error,
                        artifact: rec.result?.artifact as import("@/lib/types/chat-artifact").ChatArtifact | undefined,
                        artifacts: rec.result?.artifacts as import("@/lib/types/chat-artifact").ChatArtifact[] | undefined,
                      };
                    });
                    onToolSteps?.(toolStepsAcc, targetSessionId);
                  }
                  if (parsed?.approval && typeof parsed.approval === "object") {
                    const approvalObj: DbApproval = {
                      ...parsed.approval,
                      sessionId: targetSessionId,
                      expiresAt: parsed.approval.expiresAt || Date.now() + 60_000,
                    };
                    onApproval?.(approvalObj, targetSessionId);
                  }
                }
              } catch {
                /* ignore partial unparseable chunk */
              }
            }
          }
        }

        // Handle provider error surfaced inside 200 SSE (quota 429) — show as error, not silent empty
        if (streamError) {
          const { thinking: partialThinking, content: partialContent } = extractThinkingAndContent(
            rawContentAcc,
            structuredThinkingAcc
          );
          const errorContent = partialContent.trim()
            ? `${partialContent}\n\n⚠️ ${streamError}`
            : `⚠️ ${streamError}`;
          const errorMsgsInner: ChatMessage[] = [
            ...baseHistory,
            {
              id: assistantId,
              role: "assistant",
              content: errorContent,
              thinking: partialThinking || structuredThinkingAcc || undefined,
              sources: sourcesAcc,
              toolSteps: toolStepsAcc,
              status: "error",
              createdAt: new Date().toISOString(),
            },
          ];
          setMessagesBySession((prev) => ({ ...prev, [targetSessionId]: errorMsgsInner }));
          onSessionUpdated?.(targetSessionId, errorMsgsInner);
          onError?.(new Error(streamError), targetSessionId);
        } else {
          // Stream completed cleanly
          const { thinking, content } = extractThinkingAndContent(
            rawContentAcc,
            structuredThinkingAcc
          );

          let finalSessionMessages: ChatMessage[] = [];
          setMessagesBySession((prev) => {
            const currentMsgs = prev[targetSessionId] || initialWithAssistant;
            const hasAssistant = currentMsgs.some((m) => m.id === assistantId);
            const nextMsgs: ChatMessage[] = hasAssistant
              ? currentMsgs.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content,
                        thinking,
                        sources: sourcesAcc.length > 0 ? sourcesAcc : m.sources,
                        toolSteps: toolStepsAcc.length > 0 ? toolStepsAcc : m.toolSteps,
                        status: "delivered" as const,
                        createdAt: m.createdAt || new Date().toISOString(),
                      }
                    : {
                        ...m,
                        status: "delivered" as const,
                      }
                )
              : [
                  ...baseHistory.map((m) => ({ ...m, status: "delivered" as const })),
                  {
                    id: assistantId,
                    role: "assistant" as const,
                    content,
                    thinking,
                    sources: sourcesAcc,
                    toolSteps: toolStepsAcc,
                    status: "delivered" as const,
                    createdAt: new Date().toISOString(),
                  },
                ];
            finalSessionMessages = nextMsgs;
            return { ...prev, [targetSessionId]: nextMsgs };
          });

          onSessionUpdated?.(targetSessionId, finalSessionMessages);
          onSessionComplete?.(targetSessionId, finalSessionMessages);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setMessagesBySession((prev) => {
            const currentMsgs = prev[targetSessionId] || initialWithAssistant;
            return {
              ...prev,
              [targetSessionId]: currentMsgs.map((m) => ({ ...m, status: "delivered" as const })),
            };
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          const errorMsgs: ChatMessage[] = [
            ...baseHistory,
            {
              id: assistantId,
              role: "assistant",
              content: `⚠️ ${message}`,
              status: "error",
              createdAt: new Date().toISOString(),
            },
          ];
          setMessagesBySession((prev) => ({ ...prev, [targetSessionId]: errorMsgs }));
          onSessionUpdated?.(targetSessionId, errorMsgs);
          onError?.(err instanceof Error ? err : new Error(message), targetSessionId);
        }
      } finally {
        setLoadingBySession((prev) => ({ ...prev, [targetSessionId]: false }));
        abortControllersRef.current.delete(targetSessionId);
      }
    },
    [api, buildBody, onSessionUpdated, onSessionComplete, onError, onSources, onToolSteps, onApproval]
  );

  const sendMessage = useCallback(
    (text: string, attachments?: { url: string; contentType?: string }[], targetSessionId?: string) => {
      const currentId = targetSessionId || activeSessionIdRef.current;
      const value = text.trim();
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if (!currentId || (!value && !hasAttachments)) return;

      const history = messagesBySessionRef.current[currentId] || [];
      void runStream(currentId, history, value, attachments);
    },
    [runStream]
  );

  const sendBackgroundQuery = useCallback(
    async (backgroundPrompt: string, targetSessionId?: string) => {
      const currentId = targetSessionId || activeSessionIdRef.current;
      if (!currentId) return;

      const history = messagesBySessionRef.current[currentId] || [];
      void runStream(currentId, history, backgroundPrompt);
    },
    [runStream]
  );

  const handleSubmit = useCallback(() => {
    const value = input.trim();
    if (!value) return;
    sendMessage(value);
    setInput("");
  }, [input, sendMessage]);

  const sendApproval = useCallback(
    (approvalId: string, decision: "allow" | "deny", targetSessionId?: string) => {
      const currentId = targetSessionId || activeSessionIdRef.current;
      if (!currentId) return;

      const assistantId = uid();
      const userContent = decision === "allow" ? "✅ Approved delete" : "⛔ Denied delete";
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: userContent,
        createdAt: new Date(now).toISOString(),
        status: "sent",
      };
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "sending",
        createdAt: new Date(now + 1).toISOString(),
      };

      const history = [...(messagesBySessionRef.current[currentId] || []), userMsg];
      const initialWithAssistant = [...history, assistantMsg];

      setMessagesBySession((prev) => ({ ...prev, [currentId]: initialWithAssistant }));
      setLoadingBySession((prev) => ({ ...prev, [currentId]: true }));

      const controller = new AbortController();
      abortControllersRef.current.set(currentId, controller);

      (async () => {
        try {
          const res = await fetch(api, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history.map((m) => ({
                role: m.role,
                content: m.content,
                experimental_attachments: m.experimental_attachments,
              })),
              ...buildBody(),
              dbApproval: { approvalId, decision },
            }),
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            let detail = `Request failed (${res.status})`;
            try {
              const j = await res.json();
              if (j?.error) detail = j.error;
            } catch {}
            throw new Error(detail);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let rawContentAcc = "";
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
                if (delta) {
                  rawContentAcc += delta;
                  setMessagesBySession((prev) => {
                    const currentList = prev[currentId] || initialWithAssistant;
                    return {
                      ...prev,
                      [currentId]: currentList.map((m) =>
                        m.id === assistantId ? { ...m, content: rawContentAcc, status: "sending" as const } : m
                      ),
                    };
                  });
                }
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
                  if (delta) {
                    rawContentAcc += delta;
                  }
                } catch {}
              }
            }
          }

          let finalMsgs: ChatMessage[] = [];
          setMessagesBySession((prev) => {
            const currentList = prev[currentId] || initialWithAssistant;
            const hasAssistant = currentList.some((m) => m.id === assistantId);
            const nextList: ChatMessage[] = hasAssistant
              ? currentList.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: rawContentAcc || (decision === "allow" ? "Delete executed." : "Delete cancelled."),
                        status: "delivered" as const,
                      }
                    : {
                        ...m,
                        status: "delivered" as const,
                      }
                )
              : [
                  ...history.map((m) => ({ ...m, status: "delivered" as const })),
                  {
                    id: assistantId,
                    role: "assistant" as const,
                    content: rawContentAcc || (decision === "allow" ? "Delete executed." : "Delete cancelled."),
                    status: "delivered" as const,
                    createdAt: new Date().toISOString(),
                  },
                ];
            finalMsgs = nextList;
            return { ...prev, [currentId]: nextList };
          });

          onSessionUpdated?.(currentId, finalMsgs);
          onSessionComplete?.(currentId, finalMsgs);
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            const message = err instanceof Error ? err.message : String(err);
            onError?.(err instanceof Error ? err : new Error(message), currentId);
          }
        } finally {
          setLoadingBySession((prev) => ({ ...prev, [currentId]: false }));
          abortControllersRef.current.delete(currentId);
        }
      })();
    },
    [api, buildBody, onSessionUpdated, onSessionComplete, onError]
  );

  const stop = useCallback((sessionId?: string) => {
    const currentId = sessionId || activeSessionIdRef.current;
    if (currentId) {
      abortControllersRef.current.get(currentId)?.abort();
      abortControllersRef.current.delete(currentId);
      setLoadingBySession((prev) => ({ ...prev, [currentId]: false }));
    }
  }, []);

  const reload = useCallback((sessionId?: string) => {
    const currentId = sessionId || activeSessionIdRef.current;
    if (!currentId) return;

    const history = messagesBySessionRef.current[currentId] || [];
    if (history.length < 2) return;
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const trimmed = history.slice(0, history.lastIndexOf(lastUser));
    void runStream(currentId, trimmed, lastUser.content);
  }, [runStream]);

  const resubmitMessage = useCallback(
    (targetId: string, newContent: string, sessionId?: string) => {
      const currentId = sessionId || activeSessionIdRef.current;
      if (!currentId) return;

      const history = messagesBySessionRef.current[currentId] || [];
      let targetIdx = history.findIndex((m) => m.id === targetId);
      if (targetIdx === -1) targetIdx = history.length - 1;
      if (targetIdx >= 0) {
        const targetMsg = history[targetIdx];
        const trimmed = history.slice(0, targetIdx);
        void runStream(currentId, trimmed, newContent, targetMsg?.experimental_attachments);
      }
    },
    [runStream]
  );

  return {
    messages: activeMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    sendBackgroundQuery,
    sendApproval,
    stop,
    isLoading,
    setMessages: setMessagesForActive,
    setSessionMessages,
    reload,
    resubmitMessage,
  };
}

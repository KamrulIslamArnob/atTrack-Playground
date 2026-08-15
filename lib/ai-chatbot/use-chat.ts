"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}

interface UseAtTrackChatOptions {
  api: string;
  /** Builds the extra request body (model, persona, workspaceContext, ...). */
  buildBody: () => Record<string, unknown>;
  onError?: (error: Error) => void;
  /** Receives real "Sources used" labels from the server (retrieval workflow). */
  onSources?: (sources: string[]) => void;
  /** Receives real tool-call records from the server (tool-calling workflow). */
  onToolSteps?: (steps: unknown[]) => void;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Minimal chat hook that streams Server-Sent-Events from the atTrack
 * `/api/chat` endpoint. The route emits the same SSE shape as the rest of
 * the app's AI streams: `data: {choices:[{delta:{content}}]}` frames
 * terminated by `data: [DONE]`. We re-use the project's own provider layer
 * on the server, so this client stays transport-agnostic.
 */
export function useAtTrackChat({ api, buildBody, onError, onSources, onToolSteps }: UseAtTrackChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const runStream = useCallback(
    async (
      history: ChatMessage[],
      userContent: string,
      attachments?: { url: string; contentType?: string }[]
    ) => {
      const assistantId = uid();
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user" as const,
        content: userContent,
        createdAt: new Date().toISOString(),
        experimental_attachments: attachments,
        status: "sending",
        replyTo: undefined, // Caller can set this before calling runStream
      };
      const baseHistory = [...history, userMsg];

      setMessages(baseHistory);
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

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

        // Mark user message as "sent" — the server accepted the request.
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsg.id ? { ...m, status: "sent" as const } : m))
        );

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let buffer = "";

        // Removes <think>…</think> blocks. An unterminated trailing block
        // (still streaming) is hidden until its closing tag arrives.
        const stripThink = (s: string): string =>
          s.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");

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
              const content: string | undefined =
                parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
              if (content) {
                acc += content;
                const visible = stripThink(acc);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m))
                );
              }
              // Real "Sources used" from the retrieval workflow.
              if (Array.isArray(parsed?.sources) && parsed.sources.length > 0) {
                onSources?.(parsed.sources as string[]);
              }
              // Real tool calls from the tool-calling workflow.
              if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
                onToolSteps?.(parsed.tool_calls as unknown[]);
              }
            } catch {
              /* partial frame; ignore until complete */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User stopped — mark as delivered with whatever we accumulated.
          setMessages((prev) =>
            prev.map((m) => (m.id === userMsg.id ? { ...m, status: "delivered" as const } : m))
          );
        } else {
          const message = err instanceof Error ? err.message : String(err);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === assistantId) return { ...m, content: m.content || `⚠️ ${message}` };
              if (m.id === userMsg.id) return { ...m, status: "error" as const };
              return m;
            })
          );
          onError?.(err instanceof Error ? err : new Error(message));
        }
      } finally {
        // Mark user message as delivered on successful completion.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id && m.status !== "error" ? { ...m, status: "delivered" as const } : m
          )
        );
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, buildBody, onError]
  );

  const sendBackgroundQuery = useCallback(
    async (backgroundPrompt: string) => {
      if (isLoading) return;
      const assistantId = uid();
      const history = messagesRef.current;
      const apiMessages = [
        ...history.map((m) => ({
          role: m.role,
          content: m.content,
          experimental_attachments: m.experimental_attachments,
        })),
        {
          role: "user",
          content: backgroundPrompt,
        },
      ];

      // Add only the streaming assistant message container to UI state (no user bubble with raw JSON)
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
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
        let acc = "";
        let buffer = "";

        const stripThink = (s: string): string =>
          s.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "");

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
              const content: string | undefined =
                parsed?.choices?.[0]?.delta?.content ?? parsed?.content;
              if (content) {
                acc += content;
                const visible = stripThink(acc);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m))
                );
              }
              if (Array.isArray(parsed?.sources) && parsed.sources.length > 0) {
                onSources?.(parsed.sources as string[]);
              }
              if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
                onToolSteps?.(parsed.tool_calls as unknown[]);
              }
            } catch {
              /* ignore partial chunks */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const message = err instanceof Error ? err.message : String(err);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === assistantId) return { ...m, content: m.content || `⚠️ ${message}` };
              return m;
            })
          );
          onError?.(err instanceof Error ? err : new Error(message));
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, buildBody, isLoading, onError, onSources, onToolSteps]
  );

  const sendMessage = useCallback(
    (text: string, attachments?: { url: string; contentType?: string }[]) => {
      const value = text.trim();
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if ((!value && !hasAttachments) || isLoading) return;
      void runStream(messagesRef.current, value, attachments);
    },
    [isLoading, runStream]
  );

  const handleSubmit = useCallback(() => {
    const value = input.trim();
    if (!value || isLoading) return;
    sendMessage(value);
    // The draft has become a message — the composer must not still hold it.
    setInput("");
  }, [input, isLoading, sendMessage]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const setMessagesExternal = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages(updater as (prev: ChatMessage[]) => ChatMessage[]);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  const reload = useCallback(() => {
    const history = messagesRef.current;
    if (history.length < 2) return;
    // Drop the last assistant message and re-run the last user turn.
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const trimmed = history.slice(0, history.lastIndexOf(lastUser));
    setMessages(trimmed);
    void runStream(trimmed, lastUser.content);
  }, [runStream]);

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    sendBackgroundQuery,
    stop,
    isLoading,
    setMessages: setMessagesExternal,
    clear,
    reload,
  };
}

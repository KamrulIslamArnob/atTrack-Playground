"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AI_MODELS,
  CHAT_PERSONAS,
  type AIModel,
  type ChatSession,
  readCache,
  writeCache,
  normalizeSessionMessages,
  fetchSessions,
  persistSession,
  deleteSessionRemote,
  clearAllSessionsRemote,
  loadActiveSessionId,
  saveActiveSessionId,
  loadLastSelectedModel,
  saveSelectedModel,
  createNewSession,
  generateSessionTitle,
  exportSessionToMarkdown,
  exportSessionToJSON,
} from "@/lib/ai-chatbot/sessions";
import {
  fetchWorkspace,
  deriveContext,
  deriveWorkspaceSources,
  buildWorkspaceContextBlock,
  workspaceAwarePrompt,
  type WorkspaceContext,
  type WorkspaceSnapshot,
} from "@/lib/ai-chatbot/workspace";
import type { ContextSource } from "@/lib/ai-chatbot/types";
import { getCustomSources, setSourceConfig, buildSourcePayload } from "@/lib/ai-chatbot/source-permissions";
import type { ChatMessage, DbApproval } from "@/lib/ai-chatbot/use-chat";
import DbDeleteApprovalCard from "@/components/ai-chatbot/db-delete-approval-card";
import { useChatQueue } from "@/lib/ai-chatbot/chat-queue-context";
import { listProviders, hasAnyProviderConfigured } from "@/lib/actions/ai-providers";
import { modelSupportsImages, isReasoningModel } from "@/lib/ai/model-capabilities";
import { executeLocalSqlQuery, type SqlQueryResult } from "@/lib/actions/database-query";
import { TopNavigation } from "@/components/ai-chatbot/top-navigation";
import { WorkspaceConnectionDrawer } from "@/components/ai-chatbot/workspace-connection-drawer";
import { ChatSessionSidebar } from "@/components/ai-chatbot/chat-session-sidebar";
import { ChatCanvas } from "@/components/ai-chatbot/chat-canvas";
import { NoApiKeyOverlay } from "@/components/ai-chatbot/no-api-key-overlay";
import { ChatCanvasContext } from "@/components/ai-chatbot/chat-canvas-context";
import { Thread } from "@/components/assistant-ui/thread";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { toast } from "sonner";

export default function AIChatbotPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(AI_MODELS);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [sources, setSources] = useState<ContextSource[]>(() =>
    deriveWorkspaceSources(null, getCustomSources())
  );
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(true);
  // Per-chat connected source ids, kept as its own state (seeded from the
  // active session) so `sessions` isn't read during render for the request body
  // — that avoids a React Compiler manual-memoization skip on this component.
  const [activeConnectedIds, setActiveConnectedIds] = useState<string[]>([]);

  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceCtx, setWorkspaceCtx] = useState<WorkspaceContext>(() => deriveContext(null));
  const [canvasContent, setCanvasContent] = useState<{ content: string; title: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string; role: string } | null>(null);

  // Default general persona for automated backend routing
  const defaultPersona = CHAT_PERSONAS[0];
  const systemPersonaPrompt = workspaceAwarePrompt(defaultPersona.systemPrompt, defaultPersona, workspaceCtx);
  const workspaceContextBlock = buildWorkspaceContextBlock(workspace, sources);

  const [input, setInput] = useState("");
  const {
    enqueueChat,
    cancelChat,
    activeStreams,
    isSessionStreaming,
    resolveApproval,
  } = useChatQueue();

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const isStreamingNow = Boolean(
    activeSessionId &&
      (activeStreams[activeSessionId]?.status === "streaming" ||
        activeStreams[activeSessionId]?.status === "paused_approval")
  );
  const isLoading = isStreamingNow;
  const currentStream = activeSessionId ? activeStreams[activeSessionId] : undefined;

  // Derive messages from active session + live stream overlay
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const rawMessages = normalizeSessionMessages(activeSession?.messages ?? []);

  const messages: ChatMessage[] = useMemo(() => {
    const list: ChatMessage[] = rawMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content || "",
      createdAt: m.createdAt,
      experimental_attachments: m.experimental_attachments,
      feedback: m.feedback ?? null,
      thinking: m.thinking,
      sources: m.sources,
      toolSteps: m.toolSteps,
      status: "delivered",
    }));

    if (isStreamingNow && currentStream) {
      const lastMsg = list[list.length - 1];
      const needsStreamingBubble = !lastMsg || lastMsg.role === "user";

      if (needsStreamingBubble) {
        list.push({
          id: `live-${activeSessionId}`,
          role: "assistant",
          content: currentStream.streamText || "",
          thinking: currentStream.thinking,
          sources: currentStream.sources,
          toolSteps: currentStream.toolSteps,
          status: "sending",
          createdAt: new Date().toISOString(),
        });
      } else if (lastMsg && lastMsg.role === "assistant") {
        list[list.length - 1] = {
          ...lastMsg,
          content: currentStream.streamText || lastMsg.content,
          thinking: currentStream.thinking || lastMsg.thinking,
          sources: currentStream.sources.length > 0 ? currentStream.sources : lastMsg.sources,
          toolSteps: currentStream.toolSteps.length > 0 ? currentStream.toolSteps : lastMsg.toolSteps,
          status: "sending",
        };
      }
    }

    return list;
  }, [rawMessages, isStreamingNow, currentStream, activeSessionId]);

  const sendMessage = useCallback(
    async (text: string, attachments?: { url: string; contentType?: string }[]) => {
      const currentId = activeSessionId;
      const value = text.trim();
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if (!currentId || (!value && !hasAttachments)) return;

      const { sourceConfig } = buildSourcePayload(sources);
      const enabled =
        activeConnectedIds.length > 0
          ? activeConnectedIds
          : sources.filter((s) => s.enabled).map((s) => s.id);

      const bodyPayload = {
        model: selectedModel.id,
        persona: defaultPersona.id,
        personaPrompt: systemPersonaPrompt,
        workspaceContext: workspaceContextBlock,
        webSearchActive: isWebSearchActive,
        enabledSources: enabled,
        sourceConfig,
      };

      await enqueueChat(currentId, value, attachments, bodyPayload);
    },
    [
      activeSessionId,
      sources,
      activeConnectedIds,
      selectedModel.id,
      defaultPersona.id,
      systemPersonaPrompt,
      workspaceContextBlock,
      isWebSearchActive,
      enqueueChat,
    ]
  );

  const stop = useCallback(() => {
    if (activeSessionId) {
      cancelChat(activeSessionId);
    }
  }, [activeSessionId, cancelChat]);

  const reload = useCallback(async () => {
    if (!activeSessionId) return;
    const active = sessions.find((s) => s.id === activeSessionId);
    const history = active?.messages ?? [];
    if (history.length < 2) return;
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const trimmed = history.slice(0, history.lastIndexOf(lastUser));

    const updated = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, messages: trimmed, updatedAt: new Date().toISOString() } : s
    );
    setSessions(updated);
    writeCache(updated);

    await sendMessage(lastUser.content, lastUser.experimental_attachments);
  }, [activeSessionId, sessions, sendMessage]);

  const resubmitMessage = useCallback(
    async (targetId: string, newContent: string) => {
      if (!activeSessionId) return;
      const active = sessions.find((s) => s.id === activeSessionId);
      const history = active?.messages ?? [];
      let targetIdx = history.findIndex((m) => m.id === targetId);
      if (targetIdx === -1) targetIdx = history.length - 1;
      if (targetIdx >= 0) {
        const targetMsg = history[targetIdx];
        const trimmed = history.slice(0, targetIdx);
        const updated = sessions.map((s) =>
          s.id === activeSessionId ? { ...s, messages: trimmed, updatedAt: new Date().toISOString() } : s
        );
        setSessions(updated);
        writeCache(updated);
        await sendMessage(newContent, targetMsg?.experimental_attachments);
      }
    },
    [activeSessionId, sessions, sendMessage]
  );

  // Sync cache changes reactively across components
  useEffect(() => {
    const handleCacheUpdated = (e: CustomEvent<ChatSession[]>) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSessions(e.detail);
      }
    };
    window.addEventListener("attrack-chat-sessions-updated", handleCacheUpdated as EventListener);
    return () => {
      window.removeEventListener("attrack-chat-sessions-updated", handleCacheUpdated as EventListener);
    };
  }, []);

  /** Rebuild the model list from Settings > AI Providers. One option per
   *  configured row plus "auto" — a provider that is not a row cannot be
   *  offered, and a row that is deleted disappears along with any selection
   *  pointing at it. Returns the list so the caller can seed the selection. */
  const loadProviderModels = useCallback(async (): Promise<AIModel[]> => {
    const [configuredProviders, providerAvailable] = await Promise.all([
      listProviders(),
      hasAnyProviderConfigured(),
    ]);
    setProviderConfigured(providerAvailable);

    const models: AIModel[] = [
      AI_MODELS[0],
      ...(configuredProviders ?? []).map((p) => ({
        id: p.model,
        name: p.name || p.model,
        provider: p.provider_type === "gemini" ? "gemini" : p.provider_type === "anthropic" ? "anthropic" : "openai",
        description: `Configured in Settings (${p.provider_type})`,
        // Same heuristics the server-side auto-router uses, so the badge
        // the picker shows and the provider "auto" chooses can't drift.
        supportsImages: modelSupportsImages(p.provider_type, p.model),
        isReasoning: isReasoningModel(p.model),
        badge: p.name || p.provider_type,
      })),
    ];
    setAvailableModels(models);
    // A selection whose provider row is gone must stop being sent to the
    // server; the id would no longer match any provider and the turn would be
    // served by whatever heads the fallback chain, under the deleted name.
    setSelectedModel((prev) => models.find((m) => m.id === prev.id) ?? models[0]);
    return models;
  }, []);

  // Settings is the authority for the model list, so re-read it whenever the
  // window regains focus. It used to be fetched once at mount and then went
  // stale for the whole session: a provider added, removed, renamed, or
  // repointed at another model in Settings was invisible to an open chat tab
  // until a full reload.
  useEffect(() => {
    const onFocus = () => {
      loadProviderModels().catch((err) => console.error("Couldn't refresh AI providers:", err));
      fetchWorkspace(true)
        .then((snap) => {
          if (snap) {
            setWorkspace(snap);
            setWorkspaceCtx(deriveContext(snap));
            setSources(deriveWorkspaceSources(snap));
          }
        })
        .catch((err) => console.error("Couldn't refresh workspace snapshot:", err));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProviderModels]);

  // Initialize from LocalStorage & Load User Configured Models + workspace
  useEffect(() => {
    async function init() {
      try {
        const models = await loadProviderModels();
        const lastModelId = loadLastSelectedModel();
        setSelectedModel(models.find((m) => m.id === lastModelId) ?? models[0]);
      } catch (err) {
        console.error("Failed to load configured AI providers:", err);
      }

      // Load workspace snapshot (jobs, resumes, contacts) for grounding.
      const snap = await fetchWorkspace(true);
      setWorkspace(snap);
      setWorkspaceCtx(deriveContext(snap));
      const defaultDerivedSources = deriveWorkspaceSources(snap);
      setSources(defaultDerivedSources);
      const defaultEnabledIds = defaultDerivedSources.filter((s) => s.enabled).map((s) => s.id);

      // Paint from the mirror first so the sidebar is not blank for a round trip.
      const cached = readCache();
      if (cached.length > 0) setSessions(cached);

      // SQLite is the authority; whatever it returns replaces the mirror.
      let known: ChatSession[];
      try {
        known = await fetchSessions();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't load chat history");
        known = cached;
      }

      if (known.length > 0) {
        setSessions(known);
        writeCache(known);

        const storedActive = loadActiveSessionId();
        const active = known.find((s) => s.id === storedActive) ?? known[0];
        setActiveSessionId(active.id);
        saveActiveSessionId(active.id);

        setActiveConnectedIds(
          active.connectedSourceIds && active.connectedSourceIds.length > 0
            ? active.connectedSourceIds
            : defaultEnabledIds
        );
      } else {
        const first: ChatSession = {
          ...createNewSession(selectedModel.id),
          connectedSourceIds: defaultEnabledIds,
        };
        setSessions([first]);
        setActiveSessionId(first.id);
        setActiveConnectedIds(defaultEnabledIds);
        writeCache([first]);
        saveActiveSessionId(first.id);
      }

      setMounted(true);
    }

    init();
    // loadProviderModels is stable; the rest of init is a one-shot mount load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      setIsMobileSidebarOpen(false);
      setReplyTo(null);
      if (id === activeSessionId) return;
      setActiveSessionId(id);
      saveActiveSessionId(id);

      const targetSession = sessions.find((s) => s.id === id);
      if (targetSession) {
        const modelObj = availableModels.find((m) => m.id === targetSession.model) || availableModels[0];
        setSelectedModel(modelObj);
        const defaultSources = sources.filter((s) => s.enabled).map((s) => s.id);
        const sessionSources =
          targetSession.connectedSourceIds && targetSession.connectedSourceIds.length > 0
            ? targetSession.connectedSourceIds
            : defaultSources;
        setActiveConnectedIds(sessionSources);
      }
    },
    [activeSessionId, sessions, availableModels, sources]
  );

  const handleNewChat = useCallback(() => {
    setIsMobileSidebarOpen(false);
    setReplyTo(null);
    const seedConnected = sources.filter((s) => s.enabled).map((s) => s.id);
    const newSession: ChatSession = {
      ...createNewSession(selectedModel.id),
      connectedSourceIds: seedConnected,
    };
    const next = [newSession, ...sessions];
    setSessions(next);
    writeCache(next);
    setActiveSessionId(newSession.id);
    setActiveConnectedIds(seedConnected);
    saveActiveSessionId(newSession.id);
  }, [selectedModel.id, sessions, sources]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await deleteSessionRemote(id);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't delete chat session");
        return;
      }

      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const newSession = createNewSession(selectedModel.id);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        writeCache([newSession]);
        saveActiveSessionId(newSession.id);
      } else {
        setSessions(remaining);
        writeCache(remaining);
        if (activeSessionId === id) {
          const nextActive = remaining[0].id;
          setActiveSessionId(nextActive);
          saveActiveSessionId(nextActive);
        }
      }
      toast.success("Chat session deleted");
    },
    [activeSessionId, selectedModel.id, sessions]
  );

  const handleRenameSession = useCallback(
    async (id: string, newTitle: string) => {
      const updated = sessions.map((s) =>
        s.id === id ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s
      );
      setSessions(updated);
      writeCache(updated);
      const target = updated.find((s) => s.id === id);
      if (!target) return;
      try {
        await persistSession(target);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't rename chat session");
      }
    },
    [sessions]
  );

  const handleTogglePinSession = useCallback(
    async (id: string) => {
      let nextPinned = false;
      const updated = sessions.map((s) => {
        if (s.id !== id) return s;
        nextPinned = !s.isPinned;
        return { ...s, isPinned: nextPinned, updatedAt: new Date().toISOString() };
      });
      setSessions(updated);
      writeCache(updated);
      toast.info(nextPinned ? `Pinned "${updated.find((s) => s.id === id)?.title}"` : "Unpinned");
      const target = updated.find((s) => s.id === id);
      if (!target) return;
      try {
        await persistSession(target);
      } catch (err) {
        console.error(err);
        toast.error("Couldn't pin chat session");
      }
    },
    [sessions]
  );

  const handleSelectModel = useCallback(
    (model: AIModel) => {
      setSelectedModel(model);
      saveSelectedModel(model.id);

      if (activeSessionId) {
        const updated = sessions.map((s) =>
          s.id === activeSessionId
            ? { ...s, model: model.id, updatedAt: new Date().toISOString() }
            : s
        );
        setSessions(updated);
        writeCache(updated);
        const target = updated.find((s) => s.id === activeSessionId);
        if (target && target.messages.length > 0) {
          void persistSession(target).catch((err) => {
            console.error("Couldn't save chat session:", err);
          });
        }
      }
    },
    [activeSessionId, sessions]
  );

  const handleStarterPrompt = useCallback(
    (promptText: string) => {
      sendMessage(promptText);
    },
    [sendMessage]
  );

  const handleToggleSource = useCallback(
    (id: string) => {
      const defaultSet = sources.filter((s) => s.enabled).map((s) => s.id);
      const currentSet = activeConnectedIds.length > 0 ? activeConnectedIds : defaultSet;
      const nextSet = currentSet.includes(id) ? currentSet.filter((x) => x !== id) : [...currentSet, id];

      setActiveConnectedIds(nextSet);

      if (activeSessionId) {
        setSessions((prevSessions) => {
          const nextSessions = prevSessions.map((s) =>
            s.id === activeSessionId
              ? { ...s, connectedSourceIds: nextSet, updatedAt: new Date().toISOString() }
              : s
          );
          writeCache(nextSessions);
          const target = nextSessions.find((s) => s.id === activeSessionId);
          if (target && target.messages.length > 0) {
            void persistSession(target).catch((err) => {
              console.error("Couldn't save chat session:", err);
            });
          }
          return nextSessions;
        });
      }
    },
    [activeSessionId, activeConnectedIds, sources]
  );

  const handleSaveSourceConfig = useCallback(
    (id: string, config: Record<string, unknown>, secretKeys: string[] = []) => {
      setSourceConfig(id, config, secretKeys);
      setSources((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                auth: s.auth ? { ...s.auth, status: "connected" as const } : s.auth,
                lastSync: s.lastSync ?? new Date().toISOString(),
              }
            : s
        )
      );
    },
    []
  );

  const handleReplyMessage = useCallback((msg: { id: string; content: string; role: string }) => {
    setReplyTo({
      id: msg.id,
      preview: msg.content.slice(0, 120),
      role: msg.role,
    });
  }, []);

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent, attachmentsPayload?: { url: string; contentType: string }[]) => {
      e.preventDefault();
      const hasContent = Boolean((input || "").trim() || (attachmentsPayload && attachmentsPayload.length > 0));
      if (!hasContent) return;

      let userText = input || "";
      if (replyTo) {
        userText = `> Replying to ${replyTo.role === "assistant" ? "Assistant" : "You"}: "${replyTo.preview}"\n\n${userText}`;
        setReplyTo(null);
      }

      sendMessage(userText, attachmentsPayload);
      setInput("");
    },
    [input, replyTo, sendMessage, setInput]
  );

  const handleExportSession = useCallback(
    (id: string, format: "md" | "json") => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;
      const content = format === "md" ? exportSessionToMarkdown(session) : exportSessionToJSON(session);
      const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${session.title}" as .${format}`);
    },
    [sessions]
  );

  const handleClearAllSessions = useCallback(async () => {
    try {
      await clearAllSessionsRemote();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't clear chat sessions");
      return;
    }
    const newSession = createNewSession(selectedModel.id);
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
    writeCache([newSession]);
    saveActiveSessionId(newSession.id);
    toast.success("Cleared all chat sessions");
  }, [selectedModel.id]);

  const handleOpenCanvas = useCallback((content: string, title?: string) => {
    setCanvasContent({ content, title: title || "Artifact" });
  }, []);

  const handleCloseCanvas = useCallback(() => setCanvasContent(null), []);

  const handleEditMessage = useCallback(
    (id: string, newContent: string) => {
      resubmitMessage(id, newContent);
    },
    [resubmitMessage]
  );

  const handleApproveQuery = useCallback(
    async (queryText: string, result?: SqlQueryResult) => {
      let res = result;
      if (!res) {
        res = await executeLocalSqlQuery(queryText);
      }

      if (res.success && res.rows) {
        const count = res.rowCount ?? res.rows.length;
        const payload = `Query approved and executed on local SQLite database.\n\`\`\`sql\n${queryText.trim()}\n\`\`\`\n\n**Database Results (${count} rows):**\n\`\`\`json\n${JSON.stringify(res.rows, null, 2)}\n\`\`\`\n\nPlease synthesize these real database results to provide a comprehensive, finalized response answering my previous question.`;
        void sendMessage(payload);
      } else {
        const errorMsg = res.error || "Query failed";
        const errorPayload = `Query execution failed on local database:\n\`\`\`sql\n${queryText.trim()}\n\`\`\`\n\n**Error:** ${errorMsg}\n\n*Available tables:* ${(res.availableTables || []).join(", ")}. Please adjust your query or answer using available context.`;
        void sendMessage(errorPayload);
      }
    },
    [sendMessage]
  );

  const handleAskAiSummary = useCallback(
    (promptText: string) => {
      sendMessage(promptText);
    },
    [sendMessage]
  );

  const handleFeedback = useCallback(
    (messageId: string, rating: "up" | "down" | null) => {
      if (activeSessionId) {
        setSessions((prev) => {
          const updated = prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            const updatedMessages = s.messages.map((m) =>
              m.id === messageId ? { ...m, feedback: rating } : m
            );
            const nextSession = { ...s, messages: updatedMessages, updatedAt: new Date().toISOString() };
            return nextSession;
          });
          writeCache(updated);
          const active = updated.find((s) => s.id === activeSessionId);
          if (active) {
            void persistSession(active).catch((err) => {
              console.error("Couldn't save chat session:", err);
            });
          }
          return updated;
        });

        // Fire-and-forget save to SQLite ai_feedback table
        const msg = messages.find((m) => m.id === messageId);
        fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            messageId,
            rating,
            model: selectedModel.id,
            personaId: defaultPersona.id,
            messageContent: msg?.content,
          }),
        }).catch((err) => {
          console.error("[chat/feedback] error posting feedback:", err);
        });
      }
    },
    [activeSessionId, defaultPersona.id, messages, selectedModel.id]
  );

  const convertMessage = useCallback((m: ChatMessage): ThreadMessageLike => {
    const createdAt = m.createdAt ? new Date(m.createdAt) : undefined;
    if (m.role === "assistant") {
      const isSending = m.status === "sending";
      type AssistantMessagePart = Extract<ThreadMessageLike["content"], readonly unknown[]>[number];

      const parts: AssistantMessagePart[] = [];

      // 1. Thinking / Reasoning part
      if (m.thinking && m.thinking.trim().length > 0) {
        parts.push({
          type: "reasoning",
          text: m.thinking,
          status: isSending && (!m.content || m.content.trim().length === 0)
            ? { type: "running" }
            : { type: "complete" },
        });
      }

      // 2. Tool steps (including gated database approvals)
      if (m.toolSteps && m.toolSteps.length > 0) {
        for (const step of m.toolSteps) {
          let argsObj: Record<string, unknown> = {};
          if (step.detail) {
            try {
              argsObj = JSON.parse(step.detail);
            } catch {
              argsObj = { query: step.detail };
            }
          }

          const isGatedDatabaseOp =
            step.approvalRequired ||
            step.label === "query_database" ||
            step.label === "write_database" ||
            step.label === "delete_database";

          parts.push({
            type: "tool-call",
            toolCallId: step.id,
            toolName: step.label,
            argsText: step.detail || (Object.keys(argsObj).length > 0 ? JSON.stringify(argsObj, null, 2) : ""),
            result: step.result,
            isError: step.status === "failed",
            ...(isGatedDatabaseOp && {
              approval: {
                id: `approval-${step.id}`,
                options: [
                  { id: "allow-once", kind: "allow-once", label: "Approve & Run" },
                  { id: "reject-once", kind: "reject-once", label: "Deny" },
                ],
              },
              interrupt: {
                type: "human",
                payload: {
                  toolName: step.label,
                  args: argsObj,
                },
              },
            }),
          });
        }
      }

      // 3. Grounded workspace source citations
      if (m.sources && m.sources.length > 0) {
        for (const [idx, src] of m.sources.entries()) {
          parts.push({
            type: "source",
            sourceType: "document",
            id: `source-${m.id}-${idx}`,
            title: src,
            mediaType: "text/plain",
          });
        }
      }

      // 4. Main content text part
      if (m.content && m.content.length > 0) {
        parts.push({
          type: "text",
          text: m.content,
          status: isSending ? { type: "running" } : { type: "complete" },
        });
      }

      return {
        id: m.id,
        role: "assistant",
        content: parts.length > 0 ? parts : [{ type: "text", text: m.content || "" }],
        createdAt,
        status: isSending ? { type: "running" } : { type: "complete", reason: "stop" },
      };
    }

    if (m.role === "system") {
      return {
        id: m.id,
        role: "system",
        content: m.content,
        createdAt,
      };
    }

    return {
      id: m.id,
      role: "user",
      content: m.content,
      createdAt,
      attachments: m.experimental_attachments?.map((att, idx) => ({
        id: `att-${idx}`,
        type: "image",
        name: `Attachment ${idx + 1}`,
        content: [{ type: "image", image: att.url }],
        status: { type: "complete" },
      })),
    };
  }, []);

  const attachmentAdapter = useMemo(
    () =>
      new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    []
  );

  const auiRuntime = useExternalStoreRuntime({
    messages,
    isRunning: isLoading,
    convertMessage,
    adapters: {
      attachments: attachmentAdapter,
    },
    onNew: async (msg) => {
      let text = "";
      for (const part of msg.content) {
        if (part.type === "text") text += part.text;
      }
      const attachmentsPayload: { url: string; contentType?: string }[] = [];
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.type === "image") {
            const src = att.content?.find((c) => c.type === "image")?.image;
            if (src) {
              attachmentsPayload.push({ url: src, contentType: "image/*" });
            }
          } else if (att.type === "document" || att.type === "file") {
            const textContent = att.content?.find((c) => c.type === "text")?.text;
            if (textContent) {
              text += `${text ? "\n\n" : ""}[Attached File: ${att.name || "document"}]\n\`\`\`\n${textContent}\n\`\`\``;
            }
          }
        }
      }
      if (text.trim() || attachmentsPayload.length > 0) {
        await sendMessage(text, attachmentsPayload);
      }
    },
    onReload: async () => {
      await reload();
    },
    onCancel: async () => {
      stop();
    },
    onEdit: async (msg) => {
      let text = "";
      for (const part of msg.content) {
        if (part.type === "text") text += part.text;
      }
      const targetId = (msg as { id?: string; parentId?: string }).id ?? msg.parentId;
      if (text.trim() && targetId) {
        handleEditMessage(targetId, text);
      }
    },
  });

  const canvasContextValue = useMemo(
    () => ({
      openCanvas: handleOpenCanvas,
      closeCanvas: handleCloseCanvas,
      isOpen: Boolean(canvasContent),
    }),
    [handleOpenCanvas, handleCloseCanvas, canvasContent]
  );

  if (!mounted) return null;

  return (
    <AssistantRuntimeProvider runtime={auiRuntime}>
      <ChatCanvasContext.Provider value={canvasContextValue}>
        <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground">
          {isMobileSidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}

          <ChatSessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onTogglePinSession={handleTogglePinSession}
            isCollapsed={sessionSidebarCollapsed}
            onToggleCollapse={() => setSessionSidebarCollapsed((prev) => !prev)}
            onExportSession={handleExportSession}
            isMobileOpen={isMobileSidebarOpen}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
          />

          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <TopNavigation
              onNewChat={handleNewChat}
              onToggleSidebar={() => setSessionSidebarCollapsed((prev) => !prev)}
              sources={sources}
              connectedSourceIds={activeConnectedIds}
              onOpenDrawer={() => setIsWorkspaceDrawerOpen((prev) => !prev)}
            />

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {!providerConfigured && <NoApiKeyOverlay />}
              <Thread
                modelSelector={{
                  selectedModel,
                  onSelectModel: handleSelectModel,
                  availableModels,
                }}
              />
            </div>
          </div>

          <WorkspaceConnectionDrawer
            isOpen={isWorkspaceDrawerOpen}
            onClose={() => setIsWorkspaceDrawerOpen(false)}
            sources={sources}
            connectedSourceIds={activeConnectedIds}
            mode="chat"
            onToggleSource={handleToggleSource}
            onSaveConfig={handleSaveSourceConfig}
          />

          {canvasContent && (
            <ChatCanvas content={canvasContent.content} title={canvasContent.title} isOpen={true} onClose={handleCloseCanvas} />
          )}
        </div>
      </ChatCanvasContext.Provider>
    </AssistantRuntimeProvider>
  );
}

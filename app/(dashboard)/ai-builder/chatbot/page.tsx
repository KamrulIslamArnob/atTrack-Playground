"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AI_MODELS,
  CHAT_PERSONAS,
  type AIModel,
  type ChatPersona,
  type ChatSession,
  readCache,
  writeCache,
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
import type { ContextSource, MiniScenario } from "@/lib/ai-chatbot/types";
import { getCustomSources, setSourceEnabled, setSourceConfig, buildSourcePayload, addCustomSource, removeCustomSource } from "@/lib/ai-chatbot/source-permissions";
import { useAtTrackChat } from "@/lib/ai-chatbot/use-chat";
import { listProviders } from "@/lib/actions/ai-providers";
import { executeLocalSqlQuery, type SqlQueryResult } from "@/lib/actions/database-query";
import { TopNavigation } from "@/components/ai-chatbot/top-navigation";
import { WorkspaceConnectionDrawer } from "@/components/ai-chatbot/workspace-connection-drawer";
import { ChatSessionSidebar } from "@/components/ai-chatbot/chat-session-sidebar";
import { ChatMessages } from "@/components/ai-chatbot/chat-messages";
import { MemoizedChatInput as ChatInput } from "@/components/ai-chatbot/chat-input";
import { ChatCanvas } from "@/components/ai-chatbot/chat-canvas";
import { EmptyChatState } from "@/components/ai-chatbot/empty-chat-state";
import { toast } from "sonner";

export default function AIChatbotPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(AI_MODELS);
  const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[0]);
  const [selectedPersona, setSelectedPersona] = useState<ChatPersona>(CHAT_PERSONAS[0]);
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [sources, setSources] = useState<ContextSource[]>(() =>
    deriveWorkspaceSources(null, getCustomSources())
  );
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Per-chat connected source ids, kept as its own state (seeded from the
  // active session) so `sessions` isn't read during render for the request body
  // — that avoids a React Compiler manual-memoization skip on this component.
  const [activeConnectedIds, setActiveConnectedIds] = useState<string[]>([]);

  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceCtx, setWorkspaceCtx] = useState<WorkspaceContext>(() => deriveContext(null));
  const [canvasContent, setCanvasContent] = useState<{ content: string; title: string } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string; role: string } | null>(null);

  // Persona-aware system prompt fed to the API on every request.
  const systemPersonaPrompt = workspaceAwarePrompt(selectedPersona.systemPrompt, selectedPersona, workspaceCtx);
  const workspaceContextBlock = buildWorkspaceContextBlock(workspace, sources);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    sendBackgroundQuery,
    isLoading,
    stop,
    setMessages,
    reload,
  } = useAtTrackChat({
    api: "/api/chat",
    buildBody: () => {
      const { sourceConfig } = buildSourcePayload(sources);
      // If the active chat has an explicit connected-set, use it. Legacy chats
      // (created before per-chat workspaces existed) have none — fall back to
      // the global enabled sources so they don't silently lose retrieval/tools.
      const enabled =
        activeConnectedIds.length > 0
          ? activeConnectedIds
          : sources.filter((s) => s.enabled).map((s) => s.id);
      return {
        model: selectedModel.id,
        persona: selectedPersona.id,
        personaPrompt: systemPersonaPrompt,
        workspaceContext: workspaceContextBlock,
        webSearchActive: isWebSearchActive,
        enabledSources: enabled,
        sourceConfig,
      };
    },
    onError: (error) => {
      console.error("Chat error:", error);
      toast.error(error.message || "Failed to generate AI response.");
    },
    onSources: (srcs) => {
      // Feed real retrieved sources into the latest assistant message so the
      // SourcesUsedChip renders actual workspace data, not the fallback list.
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        return prev.map((m, i) => (i === realIdx ? { ...m, sources: srcs } : m));
      });
    },
    onToolSteps: (steps) => {
      // Feed REAL tool-call records into the latest assistant message so the
      // ToolExecutionStatus UI shows actual tools the model invoked.
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const toolSteps = steps.map((s, i) => {
          const rec = s as {
            name?: string;
            status?: string;
            args?: Record<string, unknown>;
            error?: string;
            result?: { content?: string; citations?: string[] };
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
            // What the tool actually returned, so the trace can be expanded to
            // show the evidence rather than just the call.
            result: rec.result?.content,
            error: rec.error,
          };
        });
        return prev.map((m, i) => (i === realIdx ? { ...m, toolSteps } : m));
      });
    },
  });

  // Initialize from LocalStorage & Load User Configured Models + workspace
  useEffect(() => {
    async function init() {
      try {
        const configuredProviders = await listProviders();
        const autoModelObj: AIModel = {
          id: "auto",
          name: "Auto Hybrid Agent",
          provider: "auto",
          description: "Smart Hybrid: Automatically routes turn to Vision, Code, or Reasoning models per context",
          supportsImages: true,
          isReasoning: true,
          isFast: true,
          isPopular: true,
          badge: "Smart Hybrid",
        };

        if (configuredProviders && configuredProviders.length > 0) {
          const dynamicModels: AIModel[] = [
            autoModelObj,
            ...configuredProviders.map((p) => {
              const isGemini = p.provider_type === "gemini";
              const isAnthropic = p.provider_type === "anthropic";
              const isReasoning = p.model.includes("r1") || p.model.includes("reasoner") || p.model.includes("o1");
              const supportsImages = isGemini || p.model.includes("vision") || p.model.includes("4o") || p.model.includes("flash");

              return {
                id: p.model,
                name: p.name || p.model,
                provider: isGemini ? "gemini" : isAnthropic ? "anthropic" : "openai",
                description: `Configured in Settings (${p.provider_type})`,
                supportsImages,
                isReasoning,
                badge: p.name || p.provider_type,
              };
            }),
          ];
          setAvailableModels(dynamicModels);

          const lastModelId = loadLastSelectedModel();
          const matched = dynamicModels.find((m) => m.id === lastModelId) || autoModelObj;
          setSelectedModel(matched);
        } else {
          setAvailableModels(AI_MODELS);
          const lastModelId = loadLastSelectedModel();
          const matched = AI_MODELS.find((m) => m.id === lastModelId) || AI_MODELS[0];
          setSelectedModel(matched);
        }
      } catch (err) {
        console.error("Failed to load configured AI providers:", err);
        setAvailableModels(AI_MODELS);
      }

      // Load workspace snapshot (jobs, resumes, contacts) for grounding.
      const snap = await fetchWorkspace();
      setWorkspace(snap);
      setWorkspaceCtx(deriveContext(snap));
      const defaultDerivedSources = deriveWorkspaceSources(snap);
      setSources(defaultDerivedSources);
      const defaultEnabledIds = defaultDerivedSources.filter((s) => s.enabled).map((s) => s.id);

      // Paint from the mirror first so the sidebar is not blank for a round trip.
      const cached = readCache();
      if (cached.length > 0) setSessions(cached);

      // SQLite is the authority; whatever it returns replaces the mirror. The
      // merge this replaces built its map from a `sessions` captured at mount —
      // always `[]` — so it could never see local state, and every load handed
      // the database an unopposed win that was then written back over the
      // mirror. One authority removes the question entirely.
      let known: ChatSession[];
      try {
        known = await fetchSessions();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't load chat history");
        // Stay on the mirror rather than blanking the sidebar. Nothing is
        // written back to the database from here, so this cannot resurrect.
        known = cached;
      }

      if (known.length > 0) {
        setSessions(known);
        writeCache(known);

        const storedActive = loadActiveSessionId();
        const active = known.find((s) => s.id === storedActive) ?? known[0];
        setActiveSessionId(active.id);
        saveActiveSessionId(active.id);

        // Carry every field the message model has. The previous load rebuilt
        // messages as {id, role, content} only, so `createdAt` was lost and the
        // save path then stamped every message with the current time — which
        // re-ordered history on each reload, because messages are read back
        // sorted by created_at.
        setMessages(
          (active.messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content || "",
            createdAt: m.createdAt,
            experimental_attachments: m.experimental_attachments,
            feedback: m.feedback ?? null,
          }))
        );

        setActiveConnectedIds(
          active.connectedSourceIds && active.connectedSourceIds.length > 0
            ? active.connectedSourceIds
            : defaultEnabledIds
        );
      } else {
        // First run. This session lives in memory and in the mirror only; it
        // earns a database row when it gets its first message. Persisting an
        // empty chat here is what filled SQLite with "New Chat" shells that
        // reappeared in the sidebar on every open.
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
  }, []);

  const prevMessagesRef = useRef(messages);
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    if (!mounted || !activeSessionId) return;

    if (messages !== prevMessagesRef.current) {
      prevMessagesRef.current = messages;

      // While an answer streams, `messages` gets a new identity on every token —
      // hundreds per turn. Persisting there rewrote the whole session list and
      // re-serialized localStorage each time, and because the write happens
      // inside a passive effect React counts it as a nested update and aborts
      // the render at 50 ("Maximum update depth exceeded"). Only the message
      // count matters mid-stream (it carries the new turn, so the sidebar title
      // still appears at once); the growing text is persisted when the stream
      // settles and `isLoading` flips false.
      const countChanged = messages.length !== prevCountRef.current;
      prevCountRef.current = messages.length;
      if (isLoading && !countChanged) return;

      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id === activeSessionId) {
            const isFirstUserMsg = s.messages.length === 0 && messages.length > 0;
            const newTitle =
              isFirstUserMsg && messages[0]?.content ? generateSessionTitle(messages[0].content) : s.title;

            return {
              ...s,
              title: newTitle,
              messages: messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content || "",
                createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
                experimental_attachments: m.experimental_attachments,
                // Carried deliberately. This rebuild runs on every turn, so
                // dropping the rating here let the next turn's save write NULL
                // over a thumbs-up the user had already given. It was harmless
                // while chat_messages was never written; now that SQLite is the
                // authority it would silently erase feedback.
                feedback: m.feedback ?? null,
              })),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });

        writeCache(updated);

        // A chat earns its database row on its first message, which is what
        // keeps empty "New Chat" clicks out of SQLite.
        const active = updated.find((s) => s.id === activeSessionId);
        if (active && active.messages.length > 0) {
          void persistSession(active).catch((err) => {
            console.error("Couldn't save chat session:", err);
          });
        }
        return updated;
      });
    }
  }, [messages, isLoading, activeSessionId, mounted]);
  // ponytail: side effect inside a state updater matches the file's existing shape; React StrictMode double-invokes it in dev, which costs one redundant idempotent PUT. Lift to a ref-driven effect only if that ever shows up in a profile.

  const handleSelectSession = useCallback(
    (id: string) => {
      setIsMobileSidebarOpen(false);
      setReplyTo(null);
      if (id === activeSessionId) return;
      setActiveSessionId(id);
      saveActiveSessionId(id);

      const targetSession = sessions.find((s) => s.id === id);
      if (targetSession) {
        setMessages(targetSession.messages || []);
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
    [activeSessionId, sessions, availableModels, setMessages, sources]
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
    setMessages([]);
    saveActiveSessionId(newSession.id);
    // Deliberately not persisted. An empty chat is not history yet; it reaches
    // SQLite when its first message lands. Persisting here left a "New Chat"
    // row behind for every click, and those rows came back on every load.
  }, [selectedModel.id, setMessages, sessions, sources]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      // The database goes first. If it refuses, nothing is removed anywhere —
      // the previous fire-and-forget delete let the UI drop a chat the database
      // still held, and the next load brought it back for good.
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
        setMessages([]);
        writeCache([newSession]);
        saveActiveSessionId(newSession.id);
      } else {
        setSessions(remaining);
        writeCache(remaining);
        if (activeSessionId === id) {
          const nextActive = remaining[0].id;
          setActiveSessionId(nextActive);
          saveActiveSessionId(nextActive);
          setMessages(remaining[0].messages || []);
        }
      }
      toast.success("Chat session deleted");
    },
    [activeSessionId, selectedModel.id, sessions, setMessages]
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
      // No toast: the model selector already shows the active model.
    },
    [activeSessionId, sessions]
  );

  const handleStarterPrompt = useCallback(
    (promptText: string) => {
      sendMessage(promptText);
    },
    [sendMessage]
  );

  // Toggle a source for the ACTIVE chat (per-chat workspace selection).
  // Updates the session's connectedSourceIds, persists to localStorage (instant)
  // + schedules a background SQLite flush.
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

  // Per-chat connected set that drives the request + drawer (seeded state).
  // const activeConnectedIds = ... // now a useState, see above.

  // Persist a source's config (e.g. Obsidian vault path, GitHub PAT) and update UI.
  const handleSaveSourceConfig = useCallback(
    (id: string, config: Record<string, unknown>, secretKeys: string[] = []) => {
      setSourceConfig(id, config, secretKeys);
      setSources((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                auth: s.auth ? { ...s.auth, status: "connected" as const } : s.auth,
                // reflect a non-zero recordCount hint once configured
                lastSync: s.lastSync ?? new Date().toISOString(),
              }
            : s
        )
      );
    },
    []
  );

  // Add a user-defined connection from the Connect modal.
  const handleAddCustomSource = useCallback(
    (src: ContextSource) => {
      addCustomSource(src);
      setSources((prev) => deriveWorkspaceSources(null, getCustomSources()));
    },
    []
  );

  const handleRemoveCustomSource = useCallback((id: string) => {
    removeCustomSource(id);
    setSources((prev) => deriveWorkspaceSources(null, getCustomSources()));
  }, []);

  const handleSelectScenario = useCallback(
    (scenario: MiniScenario) => {
      const matchingPersona = CHAT_PERSONAS.find((p) => p.id === scenario.agentId);
      if (matchingPersona) {
        setSelectedPersona(matchingPersona);
      }

      if (scenario.requiredSources && scenario.requiredSources.length > 0) {
        setSources((prev) =>
          prev.map((s) =>
            scenario.requiredSources.includes(s.id) || scenario.requiredSources.includes(s.type)
              ? { ...s, enabled: true }
              : s
          )
        );
      }

      sendMessage(scenario.starterPrompt);
    },
    [sendMessage]
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
      // Clear the draft here rather than inside sendMessage: sendMessage is
      // also the entry point for follow-up chips and starter prompts, which
      // must not wipe whatever the user has typed but not yet sent.
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
    setMessages([]);
    writeCache([newSession]);
    saveActiveSessionId(newSession.id);
    toast.success("Cleared all chat sessions");
  }, [selectedModel.id, setMessages]);

  const handleOpenCanvas = useCallback((content: string, title?: string) => {
    setCanvasContent({ content, title: title || "Artifact" });
  }, []);

  const handleCloseCanvas = useCallback(() => setCanvasContent(null), []);

  const handleEditMessage = useCallback(
    (id: string, newContent: string) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: newContent } : m)));
    },
    [setMessages]
  );

  const handleApproveQuery = useCallback(
    async (queryText: string, result?: SqlQueryResult) => {
      let res = result;
      if (!res) {
        // No toast: the query card shows its own "Executing in SQLite" state.
        res = await executeLocalSqlQuery(queryText);
      }

      if (res.success && res.rows) {
        const count = res.rowCount ?? res.rows.length;
        const payload = `Query approved and executed on local SQLite database.\n\`\`\`sql\n${queryText.trim()}\n\`\`\`\n\n**Database Results (${count} rows):**\n\`\`\`json\n${JSON.stringify(res.rows, null, 2)}\n\`\`\`\n\nPlease synthesize these real database results to provide a comprehensive, finalized response answering my previous question.`;
        sendBackgroundQuery(payload);
      } else {
        const errorMsg = res.error || "Query failed";
        const errorPayload = `Query execution failed on local database:\n\`\`\`sql\n${queryText.trim()}\n\`\`\`\n\n**Error:** ${errorMsg}\n\n*Available tables:* ${(res.availableTables || []).join(", ")}. Please adjust your query or answer using available context.`;
        sendBackgroundQuery(errorPayload);
      }
    },
    [sendBackgroundQuery]
  );

  const handleAskAiSummary = useCallback(
    (promptText: string) => {
      sendMessage(promptText);
    },
    [sendMessage]
  );

  const handleFeedback = useCallback(
    (messageId: string, rating: "up" | "down" | null) => {
      // 1. Optimistic state update
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m))
      );

      // 2. Persist to session and schedule SQLite durable flush
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

        // 3. Fire-and-forget save to SQLite ai_feedback table and chat_messages
        const msg = messages.find((m) => m.id === messageId);
        fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            messageId,
            rating,
            model: selectedModel.id,
            personaId: selectedPersona.id,
            messageContent: msg?.content,
          }),
        }).catch((err) => {
          console.error("[chat/feedback] error posting feedback:", err);
        });
      }
    },
    [activeSessionId, messages, selectedModel.id, selectedPersona.id, setMessages]
  );

  if (!mounted) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white dark:bg-[#09090b] text-foreground">
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

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[#09090b]">
        <TopNavigation
          title={activeSession?.title || "New Chat"}
          onRenameTitle={(newTitle) => {
            if (activeSessionId) {
              handleRenameSession(activeSessionId, newTitle);
            }
          }}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSessionSidebarCollapsed((prev) => !prev)}
          sources={sources}
          connectedSourceIds={activeConnectedIds}
          onOpenDrawer={() => setIsWorkspaceDrawerOpen(true)}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          availableModels={availableModels}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
        />

        {messages.length === 0 ? (
          <EmptyChatState
            onSelectPrompt={handleStarterPrompt}
            selectedPersona={selectedPersona}
            selectedPersonaId={selectedPersona.id}
            onSelectPersona={setSelectedPersona}
            workspace={workspaceCtx}
            onOpenWorkspaceDrawer={() => setIsWorkspaceDrawerOpen(true)}
            onSelectScenario={handleSelectScenario}
          />
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            onRetry={reload}
            onOpenCanvas={handleOpenCanvas}
            onEditMessage={handleEditMessage}
            onReply={handleReplyMessage}
            onApproveQuery={handleApproveQuery}
            onFeedback={handleFeedback}
            onAskAiSummary={handleAskAiSummary}
            onSelectFollowUp={sendMessage}
          />
        )}

        <ChatInput
          input={input || ""}
          onInputChange={handleInputChange}
          onSubmit={handleCustomSubmit}
          isLoading={isLoading}
          onStop={stop}
          model={selectedModel}
          onSelectModel={handleSelectModel}
          availableModels={availableModels}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
          onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          webSearchActive={isWebSearchActive}
          onToggleWebSearch={() => setIsWebSearchActive((v) => !v)}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      </div>

      <WorkspaceConnectionDrawer
        isOpen={isWorkspaceDrawerOpen}
        onClose={() => setIsWorkspaceDrawerOpen(false)}
        sources={sources}
        connectedSourceIds={activeConnectedIds}
        mode="chat"
        onToggleSource={handleToggleSource}
        onSaveConfig={handleSaveSourceConfig}
        onAddCustomSource={handleAddCustomSource}
        onRemoveCustomSource={handleRemoveCustomSource}
      />

      {canvasContent && (
        <ChatCanvas content={canvasContent.content} title={canvasContent.title} isOpen={true} onClose={handleCloseCanvas} />
      )}
    </div>
  );
}

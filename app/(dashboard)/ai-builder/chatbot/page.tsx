"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AI_MODELS,
  CHAT_PERSONAS,
  type AIModel,
  type ChatPersona,
  type ChatSession,
  loadSessions,
  saveSessions,
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

  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceCtx, setWorkspaceCtx] = useState<WorkspaceContext>(() => deriveContext(null));
  const [canvasContent, setCanvasContent] = useState<{ content: string; title: string } | null>(null);

  // Persona-aware system prompt fed to the API on every request.
  const systemPersonaPrompt = workspaceAwarePrompt(selectedPersona.systemPrompt, selectedPersona, workspaceCtx);
  const workspaceContextBlock = buildWorkspaceContextBlock(workspace, sources);

  const { messages, input, handleInputChange, handleSubmit, sendMessage, isLoading, stop, setMessages, reload } = useAtTrackChat({
    api: "/api/chat",
    buildBody: () => {
      const { enabledSourceIds, sourceConfig } = buildSourcePayload(sources);
      return {
        model: selectedModel.id,
        persona: selectedPersona.id,
        personaPrompt: systemPersonaPrompt,
        workspaceContext: workspaceContextBlock,
        webSearchActive: isWebSearchActive,
        enabledSources: enabledSourceIds,
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
          const rec = s as { name?: string; status?: string; args?: Record<string, unknown> };
          return {
            id: `tool-${i}`,
            label: rec.name ?? "tool",
            status: (rec.status === "error" ? "failed" : rec.status === "called" ? "running" : "completed") as
              | "pending"
              | "running"
              | "completed"
              | "failed",
            detail: rec.args ? JSON.stringify(rec.args) : undefined,
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

      const loadedSessions = loadSessions();
      if (loadedSessions.length > 0) {
        setSessions(loadedSessions);
        const activeId = loadActiveSessionId();
        const validActive = loadedSessions.find((s) => s.id === activeId) ? activeId : loadedSessions[0].id;
        setActiveSessionId(validActive);
        const sessionObj = loadedSessions.find((s) => s.id === validActive);
        if (sessionObj) {
          setMessages(
            sessionObj.messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant" | "system",
              content: m.content || "",
            }))
          );
        }
      } else {
        const firstSession = createNewSession(selectedModel.id);
        setSessions([firstSession]);
        setActiveSessionId(firstSession.id);
        saveSessions([firstSession]);
        saveActiveSessionId(firstSession.id);
      }

      // Load workspace snapshot (jobs, resumes, contacts) for grounding.
      const snap = await fetchWorkspace();
      setWorkspace(snap);
      setWorkspaceCtx(deriveContext(snap));
      setSources(deriveWorkspaceSources(snap));

      setMounted(true);
    }

    init();
  }, []);

  const prevMessagesRef = useRef(messages);
  useEffect(() => {
    if (!mounted || !activeSessionId) return;

    if (messages !== prevMessagesRef.current) {
      prevMessagesRef.current = messages;

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
              })),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });

        saveSessions(updated);
        return updated;
      });
    }
  }, [messages, activeSessionId, mounted]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) return;
      setActiveSessionId(id);
      saveActiveSessionId(id);

      const targetSession = sessions.find((s) => s.id === id);
      if (targetSession) {
        setMessages(targetSession.messages || []);
        const modelObj = availableModels.find((m) => m.id === targetSession.model) || availableModels[0];
        setSelectedModel(modelObj);
      }
    },
    [activeSessionId, sessions, availableModels, setMessages]
  );

  const handleNewChat = useCallback(() => {
    const newSession = createNewSession(selectedModel.id);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    saveSessions([newSession, ...sessions]);
    saveActiveSessionId(newSession.id);
  }, [selectedModel.id, sessions, setMessages]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const newSession = createNewSession(selectedModel.id);
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        saveSessions([newSession]);
        saveActiveSessionId(newSession.id);
      } else {
        setSessions(remaining);
        saveSessions(remaining);
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

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
      saveSessions(updated);
      return updated;
    });
  }, []);

  const handleTogglePinSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === id) {
          const nextPinned = !s.isPinned;
          toast.info(nextPinned ? `Pinned "${s.title}"` : `Unpinned "${s.title}"`);
          return { ...s, isPinned: nextPinned };
        }
        return s;
      });
      saveSessions(updated);
      return updated;
    });
  }, []);

  const handleSelectModel = useCallback(
    (model: AIModel) => {
      setSelectedModel(model);
      saveSelectedModel(model.id);

      if (activeSessionId) {
        setSessions((prev) => {
          const updated = prev.map((s) => (s.id === activeSessionId ? { ...s, model: model.id } : s));
          saveSessions(updated);
          return updated;
        });
      }
      toast.info(`Switched to ${model.name}`);
    },
    [activeSessionId]
  );

  const handleStarterPrompt = useCallback(
    (promptText: string) => {
      sendMessage(promptText);
    },
    [sendMessage]
  );

  const handleToggleSource = useCallback((id: string) => {
    setSources((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      const toggled = next.find((s) => s.id === id);
      if (toggled) setSourceEnabled(id, toggled.enabled);
      return next;
    });
  }, []);

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

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent, attachmentsPayload?: { url: string; contentType: string }[]) => {
      e.preventDefault();
      const hasContent = Boolean((input || "").trim() || (attachmentsPayload && attachmentsPayload.length > 0));
      if (!hasContent) return;

      sendMessage(input || "", attachmentsPayload);
    },
    [input, sendMessage]
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

  const handleClearAllSessions = useCallback(() => {
    const newSession = createNewSession(selectedModel.id);
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    saveSessions([newSession]);
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

  if (!mounted) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
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

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background/50 backdrop-blur-sm">
        <TopNavigation
          title={activeSession?.title || "AtTrack AI"}
          onNewChat={handleNewChat}
          onToggleSidebar={() => setSessionSidebarCollapsed((prev) => !prev)}
          sources={sources}
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
        />
      </div>

      <WorkspaceConnectionDrawer
        isOpen={isWorkspaceDrawerOpen}
        onClose={() => setIsWorkspaceDrawerOpen(false)}
        sources={sources}
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

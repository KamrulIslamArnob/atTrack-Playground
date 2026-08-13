"use client";

import { useMemo } from "react";
import { Plus, PanelLeft, ChevronRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/ai-chatbot/model-selector";
import { PersonaSelector } from "@/components/ai-chatbot/persona-selector";
import type { ContextSource, AIModel, ChatPersona } from "@/lib/ai-chatbot/types";

interface TopNavigationProps {
  title?: string;
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  sources?: ContextSource[];
  onOpenDrawer?: () => void;
  selectedModel: AIModel;
  onSelectModel: (model: AIModel) => void;
  availableModels?: AIModel[];
  selectedPersona: ChatPersona;
  onSelectPersona: (persona: ChatPersona) => void;
  className?: string;
}

export function TopNavigation({
  title = "AI Assistant",
  onNewChat,
  onToggleSidebar,
  sources = [],
  onOpenDrawer,
  selectedModel,
  onSelectModel,
  availableModels,
  selectedPersona,
  onSelectPersona,
  className,
}: TopNavigationProps) {
  const summaryText = useMemo(() => {
    if (!sources || sources.length === 0) {
      return "Connected to workspace";
    }

    const jobsSource = sources.find((s) => s.id === "jobs" || s.type === "jobs");
    const resumesSource = sources.find((s) => s.id === "resume" || s.type === "resume");
    const activeCount = sources.filter((s) => s.enabled).length;

    const parts: string[] = ["Connected to workspace"];

    if (jobsSource && jobsSource.enabled) {
      parts.push(`${jobsSource.recordCount} jobs`);
    }
    if (resumesSource && resumesSource.enabled) {
      parts.push(`${resumesSource.recordCount} resumes`);
    }

    if (parts.length === 1) {
      parts.push(`${activeCount} active sources`);
    }

    return parts.join(" · ");
  }, [sources]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/40 bg-background/85 px-3 backdrop-blur-md md:px-4",
        className
      )}
    >
      {/* Left side: Sidebar toggle, Title, + New Chat */}
      <div className="flex min-w-0 items-center gap-2">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleSidebar}
            className="text-muted-foreground hover:text-foreground"
            title="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border/50">
            <Bot className="size-4" />
          </div>
          <h1 className="truncate text-sm font-semibold text-foreground max-w-[120px] sm:max-w-[180px]">
            {title}
          </h1>
        </div>

        {onNewChat && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onNewChat}
            className="ml-1 hidden items-center gap-1 rounded-lg border-border/60 text-xs hover:bg-accent hover:text-foreground sm:flex"
          >
            <Plus className="size-3.5" />
            <span>New Chat</span>
          </Button>
        )}
      </div>

      {/* Center: Connected workspace badge */}
      <div className="flex items-center justify-center px-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-border hover:bg-accent/60 hover:text-foreground active:scale-[0.98]"
          title="Manage workspace connections"
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-online opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-status-online" />
          </span>
          <span className="hidden truncate md:inline">{summaryText}</span>
          <span className="inline truncate md:hidden">Workspace</span>
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </button>
      </div>

      {/* Right side: Persona & Model Selectors */}
      <div className="flex items-center gap-1 sm:gap-2">
        <PersonaSelector
          selectedPersonaId={selectedPersona.id}
          onSelectPersona={onSelectPersona}
          direction="down"
        />

        <ModelSelector
          selectedModelId={selectedModel.id}
          onSelectModel={onSelectModel}
          availableModels={availableModels}
          direction="down"
        />
      </div>
    </header>
  );
}

"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { PanelLeft, ChevronRight, MessageSquare, ChevronLeft, Edit2, Check, X, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ContextSource } from "@/lib/ai-chatbot/types";

interface TopNavigationProps {
  title?: string;
  onRenameTitle?: (newTitle: string) => void;
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  sources?: ContextSource[];
  connectedSourceIds?: string[];
  onOpenDrawer?: () => void;
  className?: string;
}

export function TopNavigation({
  title = "New Chat",
  onRenameTitle,
  onToggleSidebar,
  onBack,
  showBackButton = false,
  sources = [],
  connectedSourceIds,
  onOpenDrawer,
  className,
}: TopNavigationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(title);
    }
  }, [title, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title && onRenameTitle) {
      onRenameTitle(trimmed);
    } else {
      setEditTitle(title);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(title);
    setIsEditing(false);
  };

  const summaryText = useMemo(() => {
    if (!sources || sources.length === 0) {
      return "Connected to workspace: 11 jobs, 5 resumes";
    }

    const isConnected = (id: string) =>
      connectedSourceIds !== undefined
        ? connectedSourceIds.includes(id)
        : (sources.find((s) => s.id === id)?.enabled ?? false);

    const jobsSource = sources.find((s) => s.id === "jobs" || s.type === "jobs");
    const resumesSource = sources.find((s) => s.id === "resume" || s.type === "resume");
    const contactsSource = sources.find((s) => s.id === "contacts" || s.type === "contacts");

    const parts: string[] = [];

    if (jobsSource && isConnected("jobs")) {
      parts.push(`${jobsSource.recordCount || 11} jobs`);
    }

    if (resumesSource && isConnected("resume")) {
      parts.push(`${resumesSource.recordCount || 5} resumes`);
    }

    if (contactsSource && isConnected("contacts") && parts.length < 2) {
      parts.push(`${contactsSource.recordCount || 4} CRM`);
    }

    if (parts.length > 0) {
      return `Connected to workspace: ${parts.join(", ")}`;
    }

    const totalActive =
      connectedSourceIds !== undefined
        ? connectedSourceIds.length
        : sources.filter((s) => s.enabled).length;

    if (totalActive === 0) {
      return "No sources connected";
    }

    return `Connected to workspace: ${totalActive} sources`;
  }, [sources, connectedSourceIds]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[64px] w-full items-center justify-between border-b border-border/70 bg-background/85 px-3 backdrop-blur-xl md:px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {showBackButton && onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer md:hidden"
            title="Back to chats"
          >
            <ChevronLeft className="size-4" />
            <span className="sr-only">Back to chats</span>
          </Button>
        ) : onToggleSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer"
            title="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        ) : null}

        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-muted/[0.35] px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-e1">
            <MessageSquare className="size-3.5" />
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                onBlur={handleSave}
                className="h-7 w-[160px] sm:w-[220px] md:w-[280px] rounded-md border border-border bg-background px-2 py-0.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                placeholder="Chat title..."
              />
              <button
                type="button"
                onClick={handleSave}
                className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                title="Save (Enter)"
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Cancel (Esc)"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => {
                setEditTitle(title);
                setIsEditing(true);
              }}
              className="group/title flex min-w-0 items-center gap-1.5 max-w-[180px] sm:max-w-[260px] md:max-w-[340px] cursor-pointer rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/70"
              title="Double click to rename"
            >
              <h1 className="truncate text-sm font-semibold text-foreground tracking-tight select-none">
                {title}
              </h1>
              <Edit2 className="size-3 text-muted-foreground/0 group-hover/title:text-muted-foreground/60 transition-opacity shrink-0" />
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-center px-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex min-w-0 items-center gap-2 rounded-full border border-border/80 bg-gradient-brand-tint px-3 py-1.5 text-xs font-medium text-foreground shadow-e1 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] cursor-pointer"
          title="Manage workspace connections"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-success-border bg-success-surface text-success">
            <Database className="size-3" />
          </span>
          <span className="hidden min-w-0 max-w-[170px] truncate sm:inline md:max-w-[260px]">{summaryText}</span>
          <span className="min-w-0 max-w-[120px] truncate sm:hidden">11 jobs, 5 resumes</span>
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Right side: Clean minimal spacer */}
      <div className="hidden w-8 shrink-0 sm:block" />
    </header>
  );
}

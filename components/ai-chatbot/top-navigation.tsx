"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { PanelLeft } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ContextSource } from "@/lib/ai-chatbot/types";
import { DatabaseBackupIcon } from "@/components/ai-chatbot/database-backup-icon";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { CheckIcon } from "@/components/ui/check";
import { XIcon } from "@/components/ui/x";

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
      return "Connected to workspace";
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
      const count = typeof jobsSource.recordCount === "number" ? jobsSource.recordCount : 0;
      parts.push(`${count} ${count === 1 ? "job" : "jobs"}`);
    }

    if (resumesSource && isConnected("resume")) {
      const count = typeof resumesSource.recordCount === "number" ? resumesSource.recordCount : 0;
      parts.push(`${count} ${count === 1 ? "resume" : "resumes"}`);
    }

    if (contactsSource && isConnected("contacts") && parts.length < 2) {
      const count = typeof contactsSource.recordCount === "number" ? contactsSource.recordCount : 0;
      parts.push(`${count} CRM`);
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

    return "Connected to workspace";
  }, [sources, connectedSourceIds]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-3 backdrop-blur-xl md:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && onBack ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer md:hidden"
            title="Back to chats"
          >
            <ChevronLeftIcon size={16} className="size-4" />
            <span className="sr-only">Back to chats</span>
          </motion.button>
        ) : onToggleSidebar ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebar}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
            title="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </motion.button>
        ) : null}

        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
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
                className="h-7 w-[160px] sm:w-[220px] md:w-[280px] rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                placeholder="Chat title..."
              />
              <button
                type="button"
                onClick={handleSave}
                className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer"
                title="Save (Enter)"
              >
                <CheckIcon size={14} className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer"
                title="Cancel (Esc)"
              >
                <XIcon size={14} className="size-3.5" />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => {
                setEditTitle(title);
                setIsEditing(true);
              }}
              className="group/title flex min-w-0 items-center gap-1 max-w-[180px] sm:max-w-[260px] md:max-w-[340px] cursor-pointer rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60"
              title="Double click to rename"
            >
              <h1 className="truncate text-sm font-medium text-foreground select-none">
                {title}
              </h1>
              <span className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/0 group-hover/title:text-muted-foreground/50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path></svg>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onOpenDrawer}
          className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-95 cursor-pointer"
          title="Manage workspace connections"
        >
          <DatabaseBackupIcon size={14} className="size-3.5 shrink-0 text-primary inline-flex" />
          <span className="hidden min-w-0 max-w-[170px] truncate sm:inline md:max-w-[260px] text-xs">{summaryText}</span>
          <span className="min-w-0 max-w-[120px] truncate sm:hidden text-xs">11 jobs, 5 resumes</span>
          <ChevronRightIcon size={14} className="size-3.5 shrink-0 text-muted-foreground" />
        </motion.button>
      </div>

      <div className="hidden w-8 shrink-0 sm:block" />
    </header>
  );
}

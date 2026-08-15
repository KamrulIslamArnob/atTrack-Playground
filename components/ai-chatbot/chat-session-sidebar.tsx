"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  type ChatSession,
  exportSessionToMarkdown,
} from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Settings,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.7c0 .63.52 1.15 1.15 1.15h13.7c.63 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.5 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onTogglePinSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onExportSession?: (id: string, format: "md" | "json") => void;
  onClearAllSessions?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

function getSessionTime(session: ChatSession): number {
  const dateStr = session.updatedAt || session.createdAt;
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
}

function groupSessionsByDate(sessionsList: ChatSession[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7DaysAgo = startOfToday - 6 * 86400000;

  const groups: { title: string; sessions: ChatSession[] }[] = [
    { title: "Today", sessions: [] },
    { title: "Yesterday", sessions: [] },
    { title: "Previous 7 Days", sessions: [] },
    { title: "Older", sessions: [] },
  ];

  const sorted = [...sessionsList].sort((a, b) => getSessionTime(b) - getSessionTime(a));

  sorted.forEach((session) => {
    const time = getSessionTime(session);
    if (time >= startOfToday) {
      groups[0].sessions.push(session);
    } else if (time >= startOfYesterday) {
      groups[1].sessions.push(session);
    } else if (time >= startOf7DaysAgo) {
      groups[2].sessions.push(session);
    } else {
      groups[3].sessions.push(session);
    }
  });

  return groups.filter((g) => g.sessions.length > 0);
}

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  isCollapsed,
  onToggleCollapse,
  onExportSession,
  onClearAllSessions,
  isMobileOpen,
  onMobileClose,
}: ChatSessionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
  const recentSessions = filteredSessions.filter((s) => !s.isPinned);
  const dateGroups = groupSessionsByDate(recentSessions);

  function startEditing(session: ChatSession, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  }

  function saveEditing(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  }

  function cancelEditing(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditingId(null);
  }

  function handleExport(session: ChatSession) {
    if (onExportSession) {
      onExportSession(session.id, "md");
    } else {
      const content = exportSessionToMarkdown(session);
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${session.title}"`);
    }
  }

  // Desktop closed view: completely closed so full window is free for chatting
  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      className={cn(
        "relative fixed inset-y-0 left-0 z-40 flex h-full w-[260px] shrink-0 flex-col border-r border-border/60 bg-card/95 backdrop-blur-xl transition-transform duration-300 ease-in-out md:relative md:transition-none md:w-[260px]",
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <MessageSquare className="size-3.5" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">Chats</span>
        </div>

        <div className="flex items-center gap-1">
          {onMobileClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="md:hidden size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
              title="Close sidebar"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Primary Action & Search */}
      <div className="space-y-2 p-3 shrink-0">
        <Button
          onClick={() => {
            onNewChat();
            if (isMobileOpen && onMobileClose) onMobileClose();
          }}
          className="w-full"
        >
          <Plus className="size-4" />
          New chat
        </Button>

        {/* Full-width search bar matching 8px (rounded-lg) border-radius */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-lg border border-border/60 bg-muted/40 py-2 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Date-grouped session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3.5 scrollbar-thin scrollbar-thumb-muted/20 scrollbar-track-transparent">
        {pinnedSessions.length > 0 && (
          <div>
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              PINNED
            </div>
            <div className="space-y-0.5 mt-0.5">
              <AnimatePresence initial={false}>
                {pinnedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    isEditing={editingId === session.id}
                    editTitle={editTitle}
                    onSelect={() => {
                      onSelectSession(session.id);
                      if (isMobileOpen && onMobileClose) onMobileClose();
                    }}
                    onEdit={() => startEditing(session)}
                    onSaveEdit={(e) => saveEditing(session.id, e)}
                    onCancelEdit={cancelEditing}
                    onRename={setEditTitle}
                    onDelete={() => onDeleteSession(session.id)}
                    onTogglePin={() => onTogglePinSession(session.id)}
                    onExport={() => handleExport(session)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {recentSessions.length === 0 && pinnedSessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground/60 flex flex-col items-center gap-2">
            <MessageSquare className="size-6 text-muted-foreground/40" />
            <span>{searchQuery ? "No matching conversations" : "No chat history yet"}</span>
          </div>
        ) : (
          dateGroups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              <div className="space-y-0.5 mt-0.5">
                <AnimatePresence initial={false}>
                  {group.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      isEditing={editingId === session.id}
                      editTitle={editTitle}
                      onSelect={() => {
                        onSelectSession(session.id);
                        if (isMobileOpen && onMobileClose) onMobileClose();
                      }}
                      onEdit={() => startEditing(session)}
                      onSaveEdit={(e) => saveEditing(session.id, e)}
                      onCancelEdit={cancelEditing}
                      onRename={setEditTitle}
                      onDelete={() => onDeleteSession(session.id)}
                      onTogglePin={() => onTogglePinSession(session.id)}
                      onExport={() => handleExport(session)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

interface SessionRowProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onEdit: () => void;
  onSaveEdit: (e: React.MouseEvent) => void;
  onCancelEdit: (e?: React.MouseEvent) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onExport: () => void;
}

function SessionRow({
  session,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onRename,
  onDelete,
  onTogglePin,
  onExport,
}: SessionRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      transition={{ duration: 0.15 }}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex w-full items-center gap-2 px-2.5 py-2 text-left transition-all duration-150 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500/30 rounded-lg",
        isActive
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
      title="Double click to rename"
    >
      <MessageSquare
        className={cn(
          "size-3.5 shrink-0 transition-colors",
          isActive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground"
        )}
      />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onRename(e.target.value)}
              className="w-full rounded-md border border-blue-500/50 bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(e as unknown as React.MouseEvent);
                if (e.key === "Escape") onCancelEdit();
              }}
              onBlur={(e) => onSaveEdit(e as unknown as React.MouseEvent)}
            />
            <button
              type="button"
              onClick={onSaveEdit}
              className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              title="Save"
            >
              <Check className="size-3" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="p-1 rounded text-muted-foreground hover:bg-muted cursor-pointer"
              title="Cancel"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <p
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={cn(
              "truncate text-xs transition-colors select-none",
              isActive ? "font-medium text-foreground" : "font-normal text-muted-foreground group-hover:text-foreground"
            )}
          >
            {session.title}
          </p>
        )}
      </div>

      {/* Hover action menu for session item */}
      {!isEditing && (isHovered || isActive) && (
        <div
          className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "flex size-6 items-center justify-center rounded-md border transition-all duration-150 shadow-2xs cursor-pointer",
              session.isPinned
                ? "border-blue-300 bg-blue-100 text-blue-600 dark:border-blue-800 dark:bg-blue-950/80 dark:text-blue-400"
                : "border-slate-200/80 bg-slate-100/90 text-slate-600 hover:bg-slate-200/90 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
            title={session.isPinned ? "Unpin session" : "Pin session"}
          >
            {session.isPinned ? <PinOff className="size-3 text-blue-600 dark:text-blue-400" /> : <Pin className="size-3" />}
          </button>

          <button
            type="button"
            onClick={onExport}
            className="flex size-6 items-center justify-center rounded-md border border-zinc-200/80 bg-zinc-100/90 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-200/90 hover:text-zinc-900 dark:border-zinc-700/60 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all duration-150 shadow-2xs cursor-pointer"
            title="Export markdown (.md)"
          >
            <MarkdownIcon className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="flex size-6 items-center justify-center rounded-md border border-rose-200/70 bg-rose-50/80 text-rose-600 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition-all duration-150 shadow-2xs cursor-pointer"
            title="Delete session"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}


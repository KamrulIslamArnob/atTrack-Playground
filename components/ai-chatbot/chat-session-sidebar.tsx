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
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Download,
  Settings,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
        "relative fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl transition-transform duration-300 ease-in-out md:relative md:transition-none md:w-64",
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Edge toggle pill to close chat sidebar */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden md:flex absolute -right-2.5 top-8 z-30 h-7 w-4.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-all duration-200 hover:scale-110 hover:bg-accent hover:text-foreground hover:shadow-md focus:outline-none cursor-pointer"
        title="Close chats sidebar"
      >
        <ChevronLeft className="size-3" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-muted text-muted-foreground border border-border/50 flex items-center justify-center">
            <Sparkles className="size-3.5" />
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
      <div className="space-y-2.5 p-3 shrink-0">
        {/* Prominent New Chat button with single Plus icon */}
        <button
          type="button"
          onClick={() => {
            onNewChat();
            if (isMobileOpen && onMobileClose) onMobileClose();
          }}
          className="w-full bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90 rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
        >
          <Plus className="size-4" />
          <span>New chat</span>
        </button>

        {/* Real-time Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl border border-border/50 bg-muted/40 py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Date-grouped session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4 scrollbar-thin scrollbar-thumb-muted/20 scrollbar-track-transparent">
        {pinnedSessions.length > 0 && (
          <div>
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              PINNED
            </div>
            <div className="space-y-1 mt-1">
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
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              <div className="space-y-1 mt-1">
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

      {/* Bottom Workspace / Account section */}
      <div className="border-t border-border/50 p-3 mt-auto bg-card/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border/60">
              aT
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">atTrack Workspace</p>
              <p className="text-[10px] text-muted-foreground truncate">Local Workspace</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 transition-colors"
            title="Workspace Settings"
            onClick={() => toast.info("atTrack Workspace settings active")}
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative flex w-full items-center gap-2 px-2.5 py-2 text-left transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20",
        isActive
          ? "bg-primary/10 border border-primary/30 text-foreground font-medium rounded-xl shadow-xs"
          : "border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground rounded-xl"
      )}
    >
      <MessageSquare
        className={cn(
          "size-3.5 shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onRename(e.target.value)}
              className="w-full rounded-md border border-primary/50 bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(e as unknown as React.MouseEvent);
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <button
              type="button"
              onClick={onSaveEdit}
              className="p-1 rounded text-primary hover:bg-primary/10"
              title="Save"
            >
              <Check className="size-3" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="p-1 rounded text-muted-foreground hover:bg-muted"
              title="Cancel"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <p
            className={cn(
              "truncate text-xs transition-colors",
              isActive ? "font-semibold text-foreground" : "font-normal text-muted-foreground group-hover:text-foreground"
            )}
          >
            {session.title}
          </p>
        )}
      </div>

      {/* Hover action menu for session item */}
      {!isEditing && (isHovered || isActive) && (
        <div
          className="flex items-center gap-0.5 shrink-0 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onTogglePin}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={session.isPinned ? "Unpin session" : "Pin session"}
          >
            {session.isPinned ? <PinOff className="size-3 text-primary" /> : <Pin className="size-3" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Rename session"
          >
            <Edit2 className="size-3" />
          </button>
          <button
            type="button"
            onClick={onExport}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Export markdown"
          >
            <Download className="size-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete session"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}


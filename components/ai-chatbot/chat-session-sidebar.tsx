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
  MoreHorizontal,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        "relative fixed inset-y-0 left-0 z-40 flex h-full w-[280px] shrink-0 flex-col border-r border-border/70 bg-card/80 backdrop-blur-xl transition-transform duration-300 ease-in-out md:relative md:transition-none md:w-[280px]",
        isMobileOpen ? "translate-x-0 shadow-e3" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex items-center justify-end px-3.5 pb-2 pt-2.5 shrink-0 md:hidden">
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Close sidebar"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-2.5 p-3.5 pb-3 pt-3 shrink-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl border border-border/80 bg-background py-2.5 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Button
          onClick={() => {
            onNewChat();
            if (isMobileOpen && onMobileClose) onMobileClose();
          }}
          className="w-full h-10 rounded-xl bg-gradient-brand text-primary-foreground shadow-e1 hover:opacity-95"
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-3.5 scrollbar-thin scrollbar-thumb-muted/20 scrollbar-track-transparent">
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
        "group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-3.5 text-left transition-none cursor-pointer focus:outline-none focus:ring-0",
        isActive
          ? "border-primary/20 bg-gradient-brand-tint text-foreground shadow-e1"
          : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
      )}
      title="Double click to rename"
    >
      <div className="min-w-0 w-full overflow-hidden">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onRename(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
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
              className="p-1 rounded text-foreground hover:bg-muted cursor-pointer"
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
              "block w-full truncate text-xs transition-colors select-none",
              isActive ? "font-medium text-foreground" : "font-normal text-muted-foreground group-hover:text-foreground"
            )}
          >
            {session.title}
          </p>
        )}
      </div>

      {!isEditing && isHovered && (
        <div className="flex w-[54px] shrink-0 items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "flex size-5 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors duration-150 cursor-pointer hover:text-foreground",
              session.isPinned && "text-foreground"
            )}
            title={session.isPinned ? "Unpin session" : "Pin session"}
          >
            {session.isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-5 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-none cursor-pointer"
              title="Session actions"
              aria-label="Session actions"
            >
              <MoreHorizontal className="size-3" />
            </DropdownMenuTrigger>

            <DropdownMenuContent side="bottom" align="end" className="w-44 p-1.5">
              <DropdownMenuItem
                onClick={onTogglePin}
                className="gap-2.5"
              >
                {session.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                {session.isPinned ? "Unpin chat" : "Pin chat"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onExport} className="gap-2.5">
                <FileText className="size-3.5" />
                Export markdown
              </DropdownMenuItem>

              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
                className="gap-2.5"
              >
                <Trash2 className="size-3.5" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </motion.div>
  );
}


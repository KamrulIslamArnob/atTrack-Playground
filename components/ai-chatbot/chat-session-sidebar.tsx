"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  type ChatSession, exportSessionToMarkdown, } from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Trash2, Pin, PinOff, MoreHorizontal, Loader2, AlertTriangle } from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { SearchIcon } from "@/components/ui/search";
import { CheckIcon } from "@/components/ui/check";
import { XIcon } from "@/components/ui/x";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useChatQueue } from "@/lib/ai-chatbot/chat-queue-context";

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
  const { isSessionStreaming, activeStreams } = useChatQueue();

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

  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-full w-[280px] shrink-0 flex-col bg-card/80 backdrop-blur-xl transition-transform duration-300 ease-in-out md:relative md:z-10 md:transition-none md:w-[280px]",
        isMobileOpen ? "translate-x-0 shadow-lg" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex items-center justify-end px-3 py-2 shrink-0 md:hidden">
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all cursor-pointer"
            title="Close sidebar"
          >
            <XIcon size={14} className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-2 p-3 pb-2 pt-2 shrink-0">
        <div className="relative">
          <SearchIcon size={14} className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-8.5 pr-8.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
              title="Clear search"
            >
              <XIcon size={12} className="size-3" />
            </button>
          )}
        </div>

        <Button
          onClick={() => {
            onNewChat();
            if (isMobileOpen && onMobileClose) onMobileClose();
          }}
          className="w-full h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all text-xs font-medium cursor-pointer"
        >
          <PlusIcon size={14} className="size-3.5 mr-1" />
          New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
        {pinnedSessions.length > 0 && (
          <div>
            <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              Pinned
            </div>
            <div className="space-y-0.5 mt-0.5">
              <AnimatePresence initial={false}>
                {pinnedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    isStreaming={isSessionStreaming(session.id)}
                    isPausedApproval={
                      activeStreams[session.id]?.status === "paused_approval" ||
                      Boolean(activeStreams[session.id]?.approval)
                    }
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
            <MessageSquare className="size-5 text-muted-foreground/40" />
            <span>{searchQuery ? "No matching conversations" : "No chat history yet"}</span>
          </div>
        ) : (
          dateGroups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                {group.title}
              </div>
              <div className="space-y-0.5 mt-0.5">
                <AnimatePresence initial={false}>
                  {group.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      isStreaming={isSessionStreaming(session.id)}
                      isPausedApproval={
                        activeStreams[session.id]?.status === "paused_approval" ||
                        Boolean(activeStreams[session.id]?.approval)
                      }
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
  isStreaming?: boolean;
  isPausedApproval?: boolean;
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
  isStreaming,
  isPausedApproval,
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      whileTap={{ scale: 0.98 }}
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
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-left cursor-pointer focus:outline-none focus:ring-0",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
      title="Double click to rename"
    >
      {isActive && (
        <motion.div
          layoutId="active-session-indicator"
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-foreground"
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {isStreaming && (
          <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
        )}
        {isPausedApproval && (
          <AlertTriangle className="size-3 shrink-0 animate-bounce text-amber-500" />
        )}
        {isEditing ? (
          <div className="flex w-full items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
              className="p-1 rounded-md text-foreground hover:bg-muted active:scale-95 cursor-pointer"
              title="Save"
            >
              <CheckIcon size={12} className="size-3" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted active:scale-95 cursor-pointer"
              title="Cancel"
            >
              <XIcon size={12} className="size-3" />
            </button>
          </div>
        ) : (
          <p
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={cn(
              "block w-full truncate text-xs select-none",
              isActive ? "font-medium text-foreground" : "font-normal text-muted-foreground group-hover:text-foreground"
            )}
          >
            {session.title}
          </p>
        )}
      </div>

      {!isEditing && (
        <motion.div
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 4 }}
          transition={{ duration: 0.15 }}
          className="flex w-[54px] shrink-0 items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "flex size-5 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors duration-150 cursor-pointer hover:text-foreground active:scale-95",
              session.isPinned && "text-foreground"
            )}
            title={session.isPinned ? "Unpin session" : "Pin session"}
          >
            {session.isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-5 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-none cursor-pointer active:scale-95"
              title="Session actions"
              aria-label="Session actions"
            >
              <MoreHorizontal className="size-3" />
            </DropdownMenuTrigger>

            <DropdownMenuContent side="bottom" align="end" className="w-44 p-1.5 rounded-xl border border-border">
              <DropdownMenuItem
                onClick={onTogglePin}
                className="gap-2.5 text-xs rounded-lg cursor-pointer"
              >
                {session.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                {session.isPinned ? "Unpin chat" : "Pin chat"}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={onExport} className="gap-2.5 text-xs rounded-lg cursor-pointer">
                <FileTextIcon className="size-3.5" />
                Export markdown
              </DropdownMenuItem>

              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
                className="gap-2.5 text-xs rounded-lg cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      )}
    </motion.div>
  );
}

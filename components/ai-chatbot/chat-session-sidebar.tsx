"use client";

import { useState } from "react";
import {
  type ChatSession,
  exportSessionToMarkdown,
} from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Trash2,
  Pin,
  PinOff,
  MoreHorizontal,
  Search,
  Plus,
  Loader2,
  Pencil,
} from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { XIcon } from "@/components/ui/x";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

export function ChatSessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  isCollapsed,
  onToggleCollapse: _onToggleCollapse,
  onExportSession,
  onClearAllSessions: _onClearAllSessions,
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

  const pinnedSessions = filteredSessions
    .filter((s) => s.isPinned)
    .sort((a, b) => getSessionTime(b) - getSessionTime(a));
  const recentSessions = filteredSessions
    .filter((s) => !s.isPinned)
    .sort((a, b) => getSessionTime(b) - getSessionTime(a));

  const hasResults = pinnedSessions.length > 0 || recentSessions.length > 0;

  function startEditing(session: ChatSession) {
    setEditingId(session.id);
    setEditTitle(session.title);
  }

  function saveEditing(id: string) {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  }

  function cancelEditing() {
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
        "flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-card",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:z-auto md:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Mobile close */}
      <div className="flex h-10 items-center justify-end px-2 md:hidden">
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="text-muted-foreground"
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Actions — single clear hierarchy: search, then primary create */}
      <div className="space-y-2 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            className="h-8 w-full rounded-lg border border-border bg-background py-0 pl-8 pr-7 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>

        <Button
          onClick={() => {
            onNewChat();
            if (isMobileOpen && onMobileClose) onMobileClose();
          }}
          className="h-8 w-full rounded-lg text-sm font-medium"
        >
          <Plus className="size-3.5" />
          New chat
        </Button>
      </div>

      {/* List — linear flow, one pinned group, one flat recent list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!hasResults ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessageSquare className="size-3.5" />
            </span>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No matches" : "No chats yet"}
            </p>
            {!searchQuery && (
              <p className="max-w-[20ch] text-xs leading-relaxed text-muted-foreground">
                Start a new chat to keep track of this job search.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pinnedSessions.length > 0 && (
              <div>
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Pinned
                </p>
                <div className="space-y-0.5">
                  {pinnedSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      isStreaming={isSessionStreaming(session.id)}
                      needsAttention={
                        activeStreams[session.id]?.status === "paused_approval" ||
                        Boolean(activeStreams[session.id]?.approval)
                      }
                      isEditing={editingId === session.id}
                      editTitle={editTitle}
                      onSelect={() => {
                        onSelectSession(session.id);
                        if (isMobileOpen && onMobileClose) onMobileClose();
                      }}
                      onStartEdit={() => startEditing(session)}
                      onSaveEdit={() => saveEditing(session.id)}
                      onCancelEdit={cancelEditing}
                      onChangeEdit={setEditTitle}
                      onDelete={() => onDeleteSession(session.id)}
                      onTogglePin={() => onTogglePinSession(session.id)}
                      onExport={() => handleExport(session)}
                    />
                  ))}
                </div>
              </div>
            )}

            {recentSessions.length > 0 && (
              <div>
                {pinnedSessions.length > 0 && (
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Recent
                  </p>
                )}
                <div className="space-y-0.5">
                  {recentSessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      isStreaming={isSessionStreaming(session.id)}
                      needsAttention={
                        activeStreams[session.id]?.status === "paused_approval" ||
                        Boolean(activeStreams[session.id]?.approval)
                      }
                      isEditing={editingId === session.id}
                      editTitle={editTitle}
                      onSelect={() => {
                        onSelectSession(session.id);
                        if (isMobileOpen && onMobileClose) onMobileClose();
                      }}
                      onStartEdit={() => startEditing(session)}
                      onSaveEdit={() => saveEditing(session.id)}
                      onCancelEdit={cancelEditing}
                      onChangeEdit={setEditTitle}
                      onDelete={() => onDeleteSession(session.id)}
                      onTogglePin={() => onTogglePinSession(session.id)}
                      onExport={() => handleExport(session)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
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
  needsAttention?: boolean;
  editTitle: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEdit: (title: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onExport: () => void;
}

function SessionRow({
  session,
  isActive,
  isEditing,
  isStreaming,
  needsAttention,
  editTitle,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEdit,
  onDelete,
  onTogglePin,
  onExport,
}: SessionRowProps) {
  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={editTitle}
          onChange={(e) => onChangeEdit(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onSaveEdit}
          className="h-6 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          placeholder="Chat title"
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {isStreaming ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : needsAttention ? (
          <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
        ) : session.isPinned ? (
          <Pin className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <span
          className={cn(
            "block truncate text-sm",
            isActive ? "font-medium text-foreground" : "font-normal"
          )}
        >
          {session.title}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          aria-label="Chat actions"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
            "opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
            isActive && "md:opacity-60"
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="w-44 rounded-xl p-1">
          <DropdownMenuItem onClick={onTogglePin} className="gap-2.5 text-sm">
            {session.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {session.isPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="gap-2.5 text-sm"
          >
            <Pencil className="size-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport} className="gap-2.5 text-sm">
            <FileTextIcon className="size-3.5" />
            Export markdown
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={onDelete}
            className="gap-2.5 text-sm"
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

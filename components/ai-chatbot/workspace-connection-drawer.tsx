"use client";

import { useState } from "react";
import {
  FileText,
  Briefcase,
  Users,
  Code2,
  BookOpen,
  Database,
  Plus,
  FolderKanban,
  Trash2,
  KeyRound,
  FolderOpen,
  Sparkles,
  ChevronDown,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ContextSource, SourceKind } from "@/lib/ai-chatbot/types";

interface WorkspaceConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: ContextSource[];
  /** Currently-connected source ids. In "chat" mode this is the active chat's set. */
  connectedSourceIds: string[];
  /** "chat" scopes toggles to the active conversation; "global" edits defaults. */
  mode: "chat" | "global";
  onToggleSource: (id: string) => void;
  onSaveConfig: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void;
  onAddCustomSource: (src: ContextSource) => void;
  onRemoveCustomSource: (id: string) => void;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  resume: FileText,
  jobs: Briefcase,
  contacts: Users,
  memories: Brain,
  github: Code2,
  obsidian: BookOpen,
  db_query: Database,
  links: FolderKanban,
  ai_prompts: Sparkles,
  custom: Plus,
};

function formatSourceUnit(type: string, count: number): string {
  switch (type) {
    case "resume":
      return count > 0 ? `${count} ${count === 1 ? "resume" : "resumes"}` : "0 resumes";
    case "jobs":
      return count > 0 ? `${count} ${count === 1 ? "job" : "jobs"}` : "0 jobs";
    case "contacts":
      return count > 0 ? `${count} ${count === 1 ? "record" : "contacts & links"}` : "0 records";
    case "memories":
      return count > 0 ? `${count} ${count === 1 ? "memory" : "memories"}` : "0 memories";
    case "links":
      return count > 0 ? `${count} ${count === 1 ? "link" : "links"}` : "0 links";
    case "ai_prompts":
      return count > 0 ? `${count} templates` : "Inbuilt library";
    case "github":
      return count > 0 ? `${count} ${count === 1 ? "repo" : "repos"}` : "PAT auth";
    case "obsidian":
      return count > 0 ? `${count} ${count === 1 ? "note" : "notes"}` : "Local vault";
    case "db_query":
      return "SQLite database";
    default:
      return count > 0 ? `${count} items` : "Ready";
  }
}

// --- per-source config sub-panel (real auth, not theater) ---
function ObsidianConfig({ source, onSave }: { source: ContextSource; onSave: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void }) {
  const [pathValue, setPathValue] = useState("");
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <FolderOpen className="size-3.5 text-muted-foreground" /> Vault folder path
      </label>
      <input
        value={pathValue}
        onChange={(e) => setPathValue(e.target.value)}
        placeholder="C:/Users/you/vault  (local filesystem)"
        className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
      />
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={!pathValue.trim()}
        onClick={() => onSave(source.id, { vaultPath: pathValue.trim() })}
      >
        Save vault path
      </Button>
    </div>
  );
}

function GithubConfig({ source, onSave }: { source: ContextSource; onSave: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void }) {
  const [token, setToken] = useState("");
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground">
        <KeyRound className="size-3.5 text-muted-foreground" /> GitHub Personal Access Token
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ghp_… (read-only 'repo' scope)"
        className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
      />
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        Stored obfuscated in your browser only. Sent to your local server to read repos. Never logged.
      </p>
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={!token.trim()}
        onClick={() => onSave(source.id, { token: token.trim() }, ["token"])}
      >
        Connect GitHub
      </Button>
    </div>
  );
}

function DbQueryInfo() {
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
        <Database className="size-3.5 text-primary" />
        Local SQLite Database Connection
      </div>
      Direct read-only connection to your local database tables (jobs, contacts, links, prompts).
      <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
        🔒 <strong>Human-in-the-loop approval:</strong> The agent cannot execute database queries without your permission. It will always present the query proposal and wait for your explicit approval before running it in SQLite.
      </div>
    </div>
  );
}

function SourceConfigPanel({
  source,
  onSave,
}: {
  source: ContextSource;
  onSave: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void;
}) {
  if (source.kind === "fs" && source.type === "obsidian") return <ObsidianConfig source={source} onSave={onSave} />;
  if (source.kind === "pat" && source.type === "github") return <GithubConfig source={source} onSave={onSave} />;
  if (source.type === "db_query") return <DbQueryInfo />;
  return null;
}

// --- Connect custom source modal ---
function ConnectSourceModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (src: ContextSource) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SourceKind>("api");
  const [scope, setScope] = useState("");

  const reset = () => {
    setName("");
    setKind("api");
    setScope("");
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name your connection");
      return;
    }
    const id = `custom:${Date.now().toString(36)}`;
    onAdd({
      id,
      type: "custom",
      name: name.trim(),
      kind,
      enabled: true,
      recordCount: 0,
      lastSync: new Date().toISOString(),
      isCustom: true,
      auth: kind === "native" || kind === "custom" ? { status: "none" } : { status: "needed", method: "api-key" },
      config: scope.trim() ? { scope: scope.trim() } : {},
    });
    toast.success(`Added "${name.trim()}" connection.`);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a new source</DialogTitle>
          <DialogDescription>
            Define a custom connection scope. It becomes a permission toggle here and (if you wire a tool) an
            available tool for the assistant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Notion Export"
              className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SourceKind)}
              className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
            >
              <option value="native">Native table</option>
              <option value="api">API / external</option>
              <option value="fs">Local folder</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Scope description</label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="What data this connection exposes to the assistant."
              rows={3}
              className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add connection</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceConnectionDrawer({
  isOpen,
  onClose,
  sources,
  connectedSourceIds,
  mode,
  onToggleSource,
  onSaveConfig,
  onAddCustomSource,
  onRemoveCustomSource,
}: WorkspaceConnectionDrawerProps) {
  const activeCount = connectedSourceIds.length;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const toggleExpand = (id: string) => setExpanded((cur) => (cur === id ? null : id));

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col border-l border-border/50 bg-background/95 p-0 backdrop-blur-xl sm:max-w-[480px] md:max-w-[500px] shadow-2xl"
        >
          <SheetHeader className="shrink-0 border-b border-border/40 bg-muted/10 px-6 py-5 pr-14 text-left">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="size-4" />
                </div>
                <SheetTitle className="text-base font-semibold text-foreground tracking-tight">
                  Workspace Sources
                </SheetTitle>
              </div>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 text-[11px] font-medium text-primary px-2.5 py-0.5"
              >
                <Sparkles className="mr-1 size-3" />
                {activeCount} / {sources.length} Active
              </Badge>
            </div>
            <SheetDescription className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {mode === "chat"
                ? "Sources connected to this chat. Toggle any source on or off — changes are saved specifically for this conversation."
                : "Default sources the AI may use. Each switch is a real permission — disabled sources are never queried."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
            {sources.map((source) => {
              const Icon = SOURCE_ICONS[source.type] || SOURCE_ICONS.custom || Database;
              const unitText = formatSourceUnit(source.type, source.recordCount);
              const needsSetup = source.auth?.status === "needed";
              const isExpanded = expanded === source.id;
              // In chat mode the toggle reflects THIS chat's connected set.
              const enabled = connectedSourceIds.includes(source.id);

              return (
                <div
                  key={source.id}
                  className={cn(
                    "rounded-xl border p-3.5 transition-all duration-200 ease-out",
                    enabled
                      ? "border-border/60 bg-card shadow-sm hover:border-border"
                      : "border-border/30 bg-muted/20 opacity-75 hover:border-border/50 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">{source.name}</span>
                          {enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-online/20 bg-status-online/10 px-2 py-0.5 text-[10px] font-medium text-status-online">
                              <span className="size-1.5 animate-pulse rounded-full bg-status-online" />
                              {needsSetup ? "Set up required" : `Connected · ${unitText}`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Disconnected
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          {source.lastSync ? <span>Synced {source.lastSync}</span> : <span>Not yet synced</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`Toggle ${source.name}`}
                      onClick={() => onToggleSource(source.id)}
                      className={cn(
                        "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
                        enabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                          enabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Expand for auth/config/info when source has settings or information */}
                  {enabled && (needsSetup || source.type === "obsidian" || source.type === "github" || source.type === "db_query") && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(source.id)}
                      className="mt-2 flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5 cursor-pointer"
                    >
                      {isExpanded ? "Hide details" : needsSetup ? "Set up connection" : "Configure / details"}
                      <ChevronDown className={cn("size-3.5 transition-transform duration-200 ease-out", isExpanded && "rotate-180")} />
                    </button>
                  )}
                  {isExpanded && enabled && (
                    <SourceConfigPanel source={source} onSave={onSaveConfig} />
                  )}

                  {source.isCustom && (
                    <button
                      type="button"
                      onClick={() => onRemoveCustomSource(source.id)}
                      className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <SheetFooter className="shrink-0 border-t border-border/40 bg-muted/10 p-4 sm:p-6">
            <Button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl active:scale-[0.98]"
              onClick={() => setConnectOpen(true)}
            >
              <Plus className="size-4" />
              Connect source
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConnectSourceModal open={connectOpen} onClose={() => setConnectOpen(false)} onAdd={onAddCustomSource} />
    </>
  );
}

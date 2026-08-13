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
  onToggleSource: (id: string) => void;
  onSaveConfig: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void;
  onAddCustomSource: (src: ContextSource) => void;
  onRemoveCustomSource: (id: string) => void;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  resume: FileText,
  jobs: Briefcase,
  contacts: Users,
  github: Code2,
  obsidian: BookOpen,
  db_query: Database,
  links: FolderKanban,
  ai_prompts: Sparkles,
  custom: Plus,
};

function formatSourceUnit(type: string, count: number): string {
  if (!count) return "not connected";
  switch (type) {
    case "resume":
      return `${count} ${count === 1 ? "resume" : "resumes"}`;
    case "jobs":
      return `${count} ${count === 1 ? "job" : "jobs"}`;
    case "contacts":
      return `${count} ${count === 1 ? "contact" : "contacts"}`;
    case "links":
      return `${count} ${count === 1 ? "link" : "links"}`;
    case "ai_prompts":
      return `${count} ${count === 1 ? "prompt" : "prompts"}`;
    case "github":
      return `${count} ${count === 1 ? "repo" : "repos"}`;
    case "obsidian":
      return `${count} ${count === 1 ? "note" : "notes"}`;
    default:
      return `${count} items`;
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
    <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-[11px] leading-snug text-muted-foreground">
      Read-only access to your own workspace tables (jobs, contacts, links, prompts). All queries are
      auto-scoped to your user and limited to an allowlist — no writes, no cross-user access. Toggle on to
      let the assistant run scoped database questions.
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
      toast.error("Name your connection.");
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
  onToggleSource,
  onSaveConfig,
  onAddCustomSource,
  onRemoveCustomSource,
}: WorkspaceConnectionDrawerProps) {
  const activeCount = sources.filter((s) => s.enabled).length;
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
          className="flex h-full w-full flex-col border-l border-border/50 bg-background/95 p-0 backdrop-blur-xl sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border/40 bg-muted/10 px-6 py-5">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="size-4" />
                </div>
                Workspace Sources
              </SheetTitle>
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 text-[11px] font-normal text-primary"
              >
                <Sparkles className="mr-1 size-3" />
                {activeCount} / {sources.length} Active
              </Badge>
            </div>
            <SheetDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Toggle which data sources the AI may use. Each switch is a real permission — disabled sources
              are never queried.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
            {sources.map((source) => {
              const Icon = SOURCE_ICONS[source.type] || SOURCE_ICONS.custom || Database;
              const unitText = formatSourceUnit(source.type, source.recordCount);
              const needsSetup = source.auth?.status === "needed";
              const isExpanded = expanded === source.id;

              return (
                <div
                  key={source.id}
                  className={cn(
                    "rounded-xl border p-3.5 transition-all duration-200 ease-out",
                    source.enabled
                      ? "border-border/60 bg-card shadow-sm hover:border-border"
                      : "border-border/30 bg-muted/20 opacity-75 hover:border-border/50 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                          source.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-xs font-semibold text-foreground">{source.name}</span>
                          {source.enabled ? (
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
                      aria-checked={source.enabled}
                      aria-label={`Toggle ${source.name}`}
                      onClick={() => onToggleSource(source.id)}
                      className={cn(
                        "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
                        source.enabled ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                          source.enabled ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Expand for auth/config when the source needs setup and is on */}
                  {source.enabled && needsSetup && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(source.id)}
                      className="mt-2 flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5"
                    >
                      {isExpanded ? "Hide setup" : "Set up connection"}
                      <ChevronDown className={cn("size-3.5 transition-transform duration-200 ease-out", isExpanded && "rotate-180")} />
                    </button>
                  )}
                  {isExpanded && source.enabled && needsSetup && (
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

"use client";

import { useState } from "react";
import {
  FileText, Briefcase, Code2, BookOpen, Database, FolderKanban, KeyRound, Brain } from "lucide-react";
import { UsersIcon } from "@/components/ui/users";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { FolderOpenIcon } from "@/components/ui/folder-open";
import { SparklesIcon } from "@/components/ui/sparkles";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ContextSource } from "@/lib/ai-chatbot/types";

interface WorkspaceConnectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: ContextSource[];
  connectedSourceIds: string[];
  mode: "chat" | "global";
  onToggleSource: (id: string) => void;
  onSaveConfig: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void;
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  resume: FileText,
  jobs: Briefcase,
  contacts: UsersIcon,
  memories: Brain,
  github: Code2,
  obsidian: BookOpen,
  db_query: Database,
  links: FolderKanban,
  ai_prompts: SparklesIcon,
  custom: PlusIcon,
};

const NATIVE_SOURCE_TYPES = new Set(["jobs", "resume", "contacts", "memories", "ai_prompts"]);

const CATEGORY_LABELS: Record<string, string> = {
  native: "Native",
  external: "Integrations",
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

function ObsidianConfig({ source, onSave }: { source: ContextSource; onSave: (id: string, config: Record<string, unknown>, secretKeys?: string[]) => void }) {
  const [pathValue, setPathValue] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <FolderOpenIcon className="size-3.5 text-muted-foreground" /> Vault folder path
      </label>
      <input
        value={pathValue}
        onChange={(e) => setPathValue(e.target.value)}
        placeholder="C:/Users/you/vault  (local filesystem)"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
      />
      <Button
        size="sm"
        className="mt-2 w-full rounded-lg text-xs active:scale-95 cursor-pointer"
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
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <KeyRound className="size-3.5 text-muted-foreground" /> GitHub Personal Access Token
      </label>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="ghp_… (read-only 'repo' scope)"
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
      />
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        Stored obfuscated in your browser only. Sent to your local server to read repos. Never logged.
      </p>
      <Button
        size="sm"
        className="mt-2 w-full rounded-lg text-xs active:scale-95 cursor-pointer"
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
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
        <Database className="size-3.5 text-primary" />
        Local SQLite Database Connection
      </div>
      Direct read, create, and update access to your local database tables (jobs, companies, contacts, links, prompts, memories). Reads and writes run immediately.
      <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-foreground font-medium">
        🔒 <strong>Deletes need your OK:</strong> the agent always shows the exact rows and SQL it wants to delete first. Nothing is removed until you confirm in your next message.
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

export function WorkspaceConnectionDrawer({
  isOpen,
  onClose,
  sources,
  connectedSourceIds,
  onToggleSource,
  onSaveConfig,
}: WorkspaceConnectionDrawerProps) {
  const activeCount = connectedSourceIds.length;
  const [expanded, setExpanded] = useState<string | null>(null);

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
          className="flex h-full w-full flex-col border-l border-border bg-background p-0 backdrop-blur-xl sm:max-w-[480px] md:max-w-[500px]"
        >
          <SheetHeader className="shrink-0 border-b border-border bg-muted/20 px-6 py-4 pr-14 text-left">
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
                <SparklesIcon className="mr-1 size-3" />
                {activeCount} / {sources.length} Active
              </Badge>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {(["native", "external"] as const).map((category) => {
              const categorySources = sources.filter((s) =>
                category === "native" ? NATIVE_SOURCE_TYPES.has(s.type) : !NATIVE_SOURCE_TYPES.has(s.type)
              );
              if (categorySources.length === 0) return null;

              return (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    {CATEGORY_LABELS[category]}
                  </div>
                  <div className="space-y-2">
                    {categorySources.map((source) => {
                      const Icon = SOURCE_ICONS[source.type] || SOURCE_ICONS.custom || Database;
                      const unitText = formatSourceUnit(source.type, source.recordCount);
                      const needsSetup = source.auth?.status === "needed";
                      const isExpanded = expanded === source.id;
                      const enabled = connectedSourceIds.includes(source.id);

                      return (
                        <div
                          key={source.id}
                          className={cn(
                            "rounded-xl border p-3.5 transition-colors",
                            enabled
                              ? "border-border bg-card"
                              : "border-border/60 bg-muted/20 opacity-75 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className={cn(
                                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}
                              >
                                <Icon className="size-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-xs font-semibold text-foreground">{source.name}</span>
                                  {enabled ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                      <span className="size-1.5 rounded-full bg-primary" />
                                      {needsSetup ? "Set up required" : `Connected · ${unitText}`}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      Disconnected
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
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
                                "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95",
                                enabled ? "bg-primary" : "bg-muted-foreground/30"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block size-4 transform rounded-full bg-background transition duration-200",
                                  enabled ? "translate-x-4" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          {enabled && (needsSetup || source.type === "obsidian" || source.type === "github" || source.type === "db_query") && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(source.id)}
                              className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5 active:scale-95 cursor-pointer"
                            >
                              {isExpanded ? "Hide details" : needsSetup ? "Set up connection" : "Configure / details"}
                              <ChevronDownIcon className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          )}
                          {isExpanded && enabled && (
                            <SourceConfigPanel source={source} onSave={onSaveConfig} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

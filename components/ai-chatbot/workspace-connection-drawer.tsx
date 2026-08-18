"use client";

import { useState } from "react";
import {
  FileText,
  Briefcase,
  Code2,
  BookOpen,
  Database,
  FolderKanban,
  KeyRound,
  Brain,
  X,
} from "lucide-react";
import { UsersIcon } from "@/components/ui/users";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { FolderOpenIcon } from "@/components/ui/folder-open";
import { SparklesIcon } from "@/components/ui/sparkles";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  native: "Native Workspace",
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
        <Database className="size-3.5 text-muted-foreground" />
        Local SQLite Database Connection
      </div>
      Direct read, create, and update access to your local database tables (jobs, companies, contacts, links, prompts, memories). Reads and writes run immediately.
      <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2 text-xs text-foreground font-medium">
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
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-20 flex h-full w-[340px] max-w-[85vw] shrink-0 flex-col overflow-hidden bg-card/90 backdrop-blur-xl md:w-[350px] lg:w-[370px]"
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Database className="size-3.5" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">
                Workspace Sources
              </span>
              <Badge
                variant="outline"
                className="border-border/60 bg-muted/50 text-[10px] font-medium text-muted-foreground px-2 py-0.5"
              >
                {activeCount} / {sources.length} Active
              </Badge>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Sources list */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {(["native", "external"] as const).map((category) => {
              const categorySources = sources.filter((s) =>
                category === "native" ? NATIVE_SOURCE_TYPES.has(s.type) : !NATIVE_SOURCE_TYPES.has(s.type)
              );
              if (categorySources.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  <div className="px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
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
                            "rounded-xl border p-3 transition-colors",
                            enabled
                              ? "border-border bg-card"
                              : "border-border/50 bg-muted/20 opacity-75 hover:opacity-100"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <div
                                className={cn(
                                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  enabled ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
                                )}
                              >
                                <Icon className="size-3.5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-xs font-semibold text-foreground">{source.name}</span>
                                  {enabled ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-1.5 py-0.2 text-[9px] font-medium text-foreground">
                                      <span className="size-1.5 rounded-full bg-emerald-500" />
                                      {needsSetup ? "Setup needed" : unitText}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/30 px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                                      Off
                                    </span>
                                  )}
                                </div>

                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                  {source.lastSync ? <span>Synced {source.lastSync}</span> : <span>Not synced</span>}
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
                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                                enabled ? "bg-foreground" : "bg-muted-foreground/30"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-out",
                                  enabled ? "translate-x-4" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          {enabled && (needsSetup || source.type === "obsidian" || source.type === "github" || source.type === "db_query") && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(source.id)}
                              className="mt-1.5 flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-95 cursor-pointer"
                            >
                              {isExpanded ? "Hide details" : needsSetup ? "Set up connection" : "Configure / details"}
                              <ChevronDownIcon className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
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
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

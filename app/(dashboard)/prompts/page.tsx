"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/page-header";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AI_TOOL_KINDS,
  type AiToolKind,
} from "@/lib/types/ai-tools";
import type { AiMemory } from "@/lib/types/memories";
import type { Skill } from "@/lib/types/skills";
import {
  getCustomPrompts,
  saveCustomPrompt,
  resetCustomPrompt,
} from "@/lib/actions/ai-prompts";
import { getMemories } from "@/lib/actions/memories";
import { getSkills } from "@/lib/actions/skills";
import {
  getDefaultPrompt,
  DEFAULT_PURPOSES,
} from "@/lib/ai/prompts-defaults";
import {
  Sparkles,
  Save,
  Brain,
  Zap,
  FileText,
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Hourglass,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  Briefcase,
  Layers,
  Wand2,
} from "lucide-react";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MemoriesTab } from "@/components/preferences/memories-tab";
import { SkillsTab } from "@/components/preferences/skills-tab";
import { cn } from "@/lib/utils";

const PROMPT_TOOL_ICONS: Record<string, typeof Mail> = {
  cover_letter: FileText,
  follow_up_application: Clock,
  reschedule_interview: Calendar,
  follow_up_interview: Clock,
  offer_negotiation: TrendingUp,
  offer_acceptance: CheckCircle2,
  offer_decline: XCircle,
  offer_time_extension: Hourglass,
};

const PROMPT_STAGE_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  Application: {
    label: "Application",
    badgeClass: "bg-stage-applied/10 text-stage-applied border-stage-applied/25",
    dotClass: "bg-stage-applied",
  },
  Interview: {
    label: "Interview",
    badgeClass: "bg-stage-interview/10 text-stage-interview border-stage-interview/25",
    dotClass: "bg-stage-interview",
  },
  Offer: {
    label: "Offer",
    badgeClass: "bg-stage-offer/10 text-stage-offer border-stage-offer/25",
    dotClass: "bg-stage-offer",
  },
};

const DYNAMIC_VARIABLES = [
  { key: "{{job_title}}", label: "Job Title", hint: "Role name" },
  { key: "{{company_name}}", label: "Company", hint: "Company name" },
  { key: "{{applicant_name}}", label: "Applicant", hint: "Your name" },
  { key: "{{resume_skills}}", label: "Resume Skills", hint: "Matched skills" },
  { key: "{{target_tone}}", label: "Tone", hint: "Tone setting" },
  { key: "{{hiring_manager}}", label: "Contact", hint: "Interviewer / Recruiter" },
];

export default function PromptsPage() {
  const [activeTab, setActiveTab] = useState<"prompts" | "skills" | "memories">("prompts");
  const [selectedKind, setSelectedKind] = useState<AiToolKind>("cover_letter");
  const [stageFilter, setStageFilter] = useState<"all" | "Application" | "Interview" | "Offer">("all");
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [currentPromptText, setCurrentPromptText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    async function load() {
      try {
        const [loadedPrompts, loadedMemories, loadedSkills] = await Promise.all([
          getCustomPrompts().catch(() => ({})),
          getMemories().catch(() => []),
          getSkills().catch(() => []),
        ]);
        setCustomPrompts(loadedPrompts);
        setMemories(loadedMemories);
        setSkills(loadedSkills);
      } catch {
        toast.error("Couldn't load prompts, skills, and memories");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (customPrompts[selectedKind] !== undefined) {
      setCurrentPromptText(customPrompts[selectedKind]);
    } else {
      setCurrentPromptText(getDefaultPrompt(selectedKind));
    }
  }, [selectedKind, customPrompts]);

  const activeTool = AI_TOOL_KINDS.find((k) => k.kind === selectedKind) || AI_TOOL_KINDS[0];
  const isCustomized = customPrompts[selectedKind] !== undefined && customPrompts[selectedKind].trim() !== "";
  const ActiveToolIcon = PROMPT_TOOL_ICONS[selectedKind] || Mail;
  const stageInfo = PROMPT_STAGE_CONFIG[activeTool.stage] || PROMPT_STAGE_CONFIG.Application;

  const estimatedTokens = Math.max(1, Math.ceil(currentPromptText.length / 3.8));

  const filteredToolKinds = AI_TOOL_KINDS.filter((tool) => {
    if (stageFilter === "all") return true;
    return tool.stage === stageFilter;
  });

  const handleSave = () => {
    startSaveTransition(async () => {
      try {
        await saveCustomPrompt(selectedKind, currentPromptText);
        setCustomPrompts((prev) => ({ ...prev, [selectedKind]: currentPromptText }));
        toast.success(`Custom prompt saved for ${activeTool.label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save prompt");
      }
    });
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: "Reset prompt?",
      description: `Reset the prompt for "${activeTool.label}" back to the default template. Your custom changes will be lost.`,
      confirmText: "Reset prompt",
      variant: "default",
    });
    if (!confirmed) return;
    startResetTransition(async () => {
      try {
        await resetCustomPrompt(selectedKind);
        setCustomPrompts((prev) => {
          const next = { ...prev };
          delete next[selectedKind];
          return next;
        });
        const def = getDefaultPrompt(selectedKind);
        setCurrentPromptText(def);
        toast.success(`Prompt for ${activeTool.label} reset to default`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't reset prompt");
      }
    });
  };

  const handleCopyPrompt = () => {
    if (!currentPromptText) return;
    navigator.clipboard.writeText(currentPromptText);
    setIsCopied(true);
    toast.success("Prompt copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleInsertVariable = (variableKey: string) => {
    const el = textareaRef.current;
    if (!el) {
      setCurrentPromptText((prev) => `${prev} ${variableKey}`);
      toast.success(`Inserted ${variableKey}`);
      return;
    }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const nextText = `${before}${variableKey}${after}`;
    setCurrentPromptText(nextText);

    setTimeout(() => {
      el.focus();
      const nextPos = start + variableKey.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 0);

    toast.success(`Inserted ${variableKey}`);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  const TABS_CONFIG = [
    { id: "prompts" as const, label: "AI tool prompts", icon: Sparkles, count: undefined },
    { id: "skills" as const, label: "Skills (Slash commands /)", icon: Zap, count: skills.length },
    { id: "memories" as const, label: "Tracky memory (@)", icon: Brain, count: memories.length },
  ];

  return (
    <div className="space-y-6 pb-20 w-full min-w-0">
      {dialog}

      {/* Hero Header */}
      <PageHeader
        title="AI Prompts, Skills & Memory"
        titleExtra={
          <InfoTooltip
            content="Configure custom AI tool generation prompts, slash command skills, and workspace memories."
            side="right"
            iconClassName="size-4"
          />
        }
      />

      {/* Main Segmented Pill Tabs Navigation */}
      <div className="rounded-xl bg-muted/60 dark:bg-muted/30 p-1 sm:p-1.5 w-full">
        <div
          role="tablist"
          aria-label="Prompt management categories"
          className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]"
        >
          {TABS_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`prompts-tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative h-8 flex shrink-0 items-center gap-2 rounded-lg px-3.5 text-xs font-medium tracking-tight transition-colors duration-150 cursor-pointer select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
                  isSelected
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="active-prompts-tab"
                    className="absolute inset-0 rounded-lg bg-card shadow-2xs border border-border/70"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}

                <span className="relative z-10 flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-3.5 transition-colors duration-150",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors duration-150",
                        isSelected
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "bg-muted-foreground/15 text-muted-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: AI Prompts View */}
      {activeTab === "prompts" && (
        <div
          id="prompts-tabpanel-prompts"
          role="tabpanel"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in-50 duration-150 w-full"
        >
          {/* Left Column: AI Tool Templates List (Bento Sidebar) */}
          <div className="lg:col-span-4 xl:col-span-3 rounded-2xl bg-muted/50 dark:bg-muted/25 p-3.5 sm:p-4 space-y-3.5">
            {/* Header & Stage Filter */}
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tool Templates
                </h2>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums border border-border/60 shadow-2xs">
                {AI_TOOL_KINDS.length} active
              </span>
            </div>

            {/* Stage Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 dark:bg-muted/30 text-xs overflow-x-auto [scrollbar-width:none]">
              {(["all", "Application", "Interview", "Offer"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStageFilter(st)}
                  className={cn(
                    "h-7.5 flex-1 px-2.5 rounded-lg text-center text-xs font-medium transition-all whitespace-nowrap cursor-pointer active:scale-95",
                    stageFilter === st
                      ? "bg-card text-foreground shadow-2xs font-semibold border border-border/70"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  )}
                >
                  {st === "all" ? "All" : st}
                </button>
              ))}
            </div>

            {/* Template Items */}
            <div className="space-y-1.5 pt-0.5">
              {filteredToolKinds.map((tool) => {
                const hasCustom = customPrompts[tool.kind] !== undefined && customPrompts[tool.kind].trim() !== "";
                const isSelected = tool.kind === selectedKind;
                const ToolIcon = PROMPT_TOOL_ICONS[tool.kind] || Mail;
                const stage = PROMPT_STAGE_CONFIG[tool.stage] || PROMPT_STAGE_CONFIG.Application;

                return (
                  <button
                    key={tool.kind}
                    type="button"
                    onClick={() => setSelectedKind(tool.kind)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-start text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] group",
                      isSelected
                        ? "bg-card text-primary font-semibold border border-primary/30 shadow-2xs"
                        : "bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "flex size-7.5 items-center justify-center rounded-lg border transition-colors shrink-0",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background border-border/70 text-muted-foreground group-hover:text-foreground group-hover:border-border"
                        )}
                      >
                        <ToolIcon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn("truncate text-xs", isSelected ? "font-semibold text-foreground" : "font-medium")}>
                          {tool.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground/80 font-normal">
                          {tool.stage} stage
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {hasCustom ? (
                        <span className="rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shadow-2xs">
                          Custom
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-medium border opacity-80",
                            stage.badgeClass
                          )}
                        >
                          {tool.stage}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Prompt Editor Workspace Deck */}
          <div className="lg:col-span-8 xl:col-span-9 rounded-2xl bg-muted/50 dark:bg-muted/25 p-3.5 sm:p-5 space-y-4.5">
            {/* Tool Header with Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3.5 border-b border-border/50">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shrink-0 shadow-2xs">
                  <ActiveToolIcon className="size-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-base sm:text-lg font-bold tracking-tight text-foreground">
                      {activeTool.label}
                    </h3>
                    {isCustomized ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        Customized
                      </span>
                    ) : (
                      <span className="rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Default template
                      </span>
                    )}
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", stageInfo.badgeClass)}>
                      {activeTool.stage}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug max-w-xl">
                    {DEFAULT_PURPOSES[selectedKind] || "Controls AI generation behavior"}
                  </p>
                </div>
              </div>

              {/* Header Action Cluster */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyPrompt}
                  aria-label="Copy prompt text"
                  className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/70 bg-card hover:bg-muted rounded-lg shadow-2xs"
                >
                  {isCopied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {isCopied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isResetting || !isCustomized}
                  className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/70 bg-card hover:bg-muted rounded-lg shadow-2xs"
                >
                  <RotateCCWIcon className={cn("size-3.5", isResetting && "animate-spin")} />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 px-3.5 gap-1.5 text-xs font-semibold rounded-lg shadow-xs"
                >
                  {isSaving ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                  Save changes
                </Button>
              </div>
            </div>

            {/* Dynamic Variables Insertion Strip */}
            <div className="space-y-2 rounded-xl bg-muted/60 dark:bg-muted/30 p-2.5 sm:p-3">
              <div className="flex items-center justify-between px-0.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Wand2 className="size-3 text-primary" />
                  Insert Context Variables
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DYNAMIC_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsertVariable(v.key)}
                    title={v.hint}
                    className="h-7.5 group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 font-mono text-[11px] font-medium text-foreground transition-all duration-140 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <span className="text-muted-foreground group-hover:text-primary">+</span>
                    <span>{v.key}</span>
                    <span className="text-[9px] font-sans text-muted-foreground group-hover:text-primary/70">
                      ({v.label})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Editor Pane */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <Label
                  htmlFor="prompt-text"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  System prompt instructions
                </Label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono tabular-nums">
                  <span>{currentPromptText.length} characters</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span>~{estimatedTokens} tokens</span>
                </div>
              </div>
              <Textarea
                id="prompt-text"
                ref={textareaRef}
                value={currentPromptText}
                onChange={(e) => setCurrentPromptText(e.target.value)}
                rows={14}
                className="font-mono text-xs leading-relaxed resize-y p-4 rounded-xl bg-card border border-border/80 focus-visible:ring-2 focus-visible:ring-primary/40 shadow-2xs"
                placeholder="Enter system instructions..."
              />
            </div>

            {/* Context Grounding Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="rounded-xl bg-muted/60 dark:bg-muted/30 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Briefcase className="size-3.5 text-primary" />
                  <span>Job Grounding</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Auto-injects role title, requirements, description & company details.
                </p>
              </div>

              <div className="rounded-xl bg-muted/60 dark:bg-muted/30 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <FileText className="size-3.5 text-info" />
                  <span>Resume Matching</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Grounds outputs with your selected resume, experience bullets & skills.
                </p>
              </div>

              <div className="rounded-xl bg-muted/60 dark:bg-muted/30 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-success" />
                  <span>Format & Safeguards</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Enforces strict spam avoidance rules and pure JSON responses.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Skills View */}
      {activeTab === "skills" && (
        <div
          id="prompts-tabpanel-skills"
          role="tabpanel"
          className="animate-in fade-in-50 duration-150"
        >
          <SkillsTab initialSkills={skills} />
        </div>
      )}

      {/* Tab 3: Tracky Memories View */}
      {activeTab === "memories" && (
        <div
          id="prompts-tabpanel-memories"
          role="tabpanel"
          className="animate-in fade-in-50 duration-150"
        >
          <MemoriesTab initialMemories={memories} />
        </div>
      )}
    </div>
  );
}

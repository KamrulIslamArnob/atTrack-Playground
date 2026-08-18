"use client";

import { useState, useEffect, useTransition } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
import { Sparkles, Save, Mail, Info, Brain, Zap } from "lucide-react";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MemoriesTab } from "@/components/preferences/memories-tab";
import { SkillsTab } from "@/components/preferences/skills-tab";
import { cn } from "@/lib/utils";

export default function PromptsPage() {
  const [activeTab, setActiveTab] = useState<"prompts" | "skills" | "memories">("prompts");
  const [selectedKind, setSelectedKind] = useState<AiToolKind>("cover_letter");
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [currentPromptText, setCurrentPromptText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
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

  const handleSave = () => {
    startSaveTransition(async () => {
      try {
        await saveCustomPrompt(selectedKind, currentPromptText);
        setCustomPrompts((prev) => ({ ...prev, [selectedKind]: currentPromptText }));
        toast.success(`Custom prompt saved for ${activeTool.label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save prompt");
      }
    });
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: "Reset prompt?",
      description: `Reset the prompt for "${activeTool.label}" back to the default template. Your custom changes will be lost.`,
      confirmText: "Reset",
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
        toast.error(err instanceof Error ? err.message : "Failed to reset prompt");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dialog}

      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-sky-400/50 bg-gradient-to-br from-sky-400/20 via-sky-300/15 to-sky-500/25 text-sky-700 dark:border-sky-400/40 dark:from-sky-500/20 dark:via-sky-400/10 dark:to-sky-600/25 dark:text-sky-300 shadow-2xs">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">AI Prompts, Skills & Memory</h1>
                <p className="text-sm text-muted-foreground">
                  Customize generator prompts, configure slash command skills, and manage Tracky AI context memory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("prompts")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "prompts"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Sparkles className="size-3.5" />
          <span>AI Tool Prompts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("skills")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "skills"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Zap className="size-3.5" />
          <span>Skills (Slash Commands /)</span>
          {skills.length > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none",
                activeTab === "skills" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {skills.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("memories")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "memories"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Brain className="size-3.5" />
          <span>Tracky Memory (@)</span>
          {memories.length > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none",
                activeTab === "memories" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {memories.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: AI Prompts View */}
      {activeTab === "prompts" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Sidebar: Tool Selector List */}
          <div className="md:col-span-4 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-3">
              AI Tool Templates
            </h2>
            <div className="space-y-1">
              {AI_TOOL_KINDS.map((tool) => {
                const hasCustom = customPrompts[tool.kind] !== undefined && customPrompts[tool.kind].trim() !== "";
                const isSelected = tool.kind === selectedKind;

                return (
                  <button
                    key={tool.kind}
                    onClick={() => setSelectedKind(tool.kind)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail className={`size-4 shrink-0 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      <span className="truncate">{tool.label}</span>
                    </div>
                    {hasCustom && (
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        Custom
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Area: Prompt Editor */}
          <div className="md:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{activeTool.label}</h3>
                  {isCustomized ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
                      Customized
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      Default Template
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {DEFAULT_PURPOSES[selectedKind] || "Controls AI generation behavior"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isResetting || !isCustomized}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCCWIcon className={`size-3.5 ${isResetting ? "animate-spin" : ""}`} />
                  Reset to Default
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                >
                  {isSaving ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt-text" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  System Prompt Definition
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {currentPromptText.length} characters
                </span>
              </div>
              <Textarea
                id="prompt-text"
                value={currentPromptText}
                onChange={(e) => setCurrentPromptText(e.target.value)}
                rows={14}
                className="font-mono text-xs leading-relaxed resize-y p-3.5 bg-background border-border/80 focus-visible:ring-primary"
                placeholder="Enter system instructions..."
              />
            </div>

            {/* Help / Variables Callout */}
            <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 text-sky-900 dark:text-sky-200 text-xs flex items-start gap-2.5">
              <Info className="size-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sky-950 dark:text-sky-100">Template Dynamic Variables</p>
                <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">
                  During generation, atTrack automatically grounds the prompt with the target job description, company details, your matching resume, and your tone preferences.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Skills View */}
      {activeTab === "skills" && (
        <SkillsTab initialSkills={skills} />
      )}

      {/* Tab 3: Tracky Memories View */}
      {activeTab === "memories" && (
        <MemoriesTab initialMemories={memories} />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  AI_TOOL_KINDS, type AiToolKind, } from "@/lib/types/ai-tools";
import type { AiMemory } from "@/lib/types/memories";
import {
  getCustomPrompts, saveCustomPrompt, resetCustomPrompt, } from "@/lib/actions/ai-prompts";
import { getMemories } from "@/lib/actions/memories";
import {
  getDefaultPrompt, DEFAULT_PURPOSES, } from "@/lib/ai/prompts-defaults";
import { Sparkles, Save, Mail, Info, Brain } from "lucide-react";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { MemoriesTab } from "@/components/preferences/memories-tab";
import { cn } from "@/lib/utils";

export default function PromptsPage() {
  const [activeTab, setActiveTab] = useState<"prompts" | "memories">("prompts");
  const [selectedKind, setSelectedKind] = useState<AiToolKind>("cover_letter");
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [currentPromptText, setCurrentPromptText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    async function load() {
      try {
        const [loadedPrompts, loadedMemories] = await Promise.all([
          getCustomPrompts().catch(() => ({})),
          getMemories().catch(() => []),
        ]);
        setCustomPrompts(loadedPrompts);
        setMemories(loadedMemories);
      } catch {
        toast.error("Couldn't load prompts and memories");
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
      {/* Header */}
      <div className="-mx-6 border-b border-border pb-6">
        <div className="flex items-center justify-between px-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex size-10 items-center justify-center rounded-2xl border border-sky-400/50 bg-gradient-to-br from-sky-400/20 via-sky-300/15 to-sky-500/25 text-sky-700 dark:border-sky-400/40 dark:from-sky-500/20 dark:via-sky-400/10 dark:to-sky-600/25 dark:text-sky-300 shadow-2xs">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Custom AI Prompts & Memory</h1>
                <p className="text-sm text-muted-foreground">
                  Customize system prompt instructions and manage Markdown memories for grounded AI chatbot context.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Breadcrumbs />

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
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
          onClick={() => setActiveTab("memories")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
            activeTab === "memories"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Brain className="size-3.5" />
          <span>AI Memories</span>
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
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/15 text-primary dark:bg-primary/30"
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

          {/* Right Editor Area */}
          <div className="md:col-span-8 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{activeTool.label}</h3>
                    <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                      Stage: {activeTool.stage}
                    </span>
                    {isCustomized ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Customized
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {DEFAULT_PURPOSES[activeTool.kind]}
                  </p>
                </div>
              </div>

              {/* Prompt Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt-editor" className="font-semibold text-sm">
                    System Prompt Instructions
                  </Label>
                  <div className="flex items-center gap-2">
                    {isCustomized && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={isResetting || isSaving}
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        {isResetting ? <Spinner className="size-3" /> : <RotateCCWIcon className="size-3.5" />}
                        Reset to Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || isResetting}
                      className="h-8 text-xs gap-1.5"
                    >
                      {isSaving ? <Spinner className="size-3" /> : <Save className="size-3.5" />}
                      Save Prompt
                    </Button>
                  </div>
                </div>

                <Textarea
                  id="prompt-editor"
                  value={currentPromptText}
                  onChange={(e) => setCurrentPromptText(e.target.value)}
                  rows={14}
                  className="font-mono text-xs leading-relaxed p-4 rounded-xl border-border bg-background/50 focus:bg-background"
                  placeholder="Enter custom system prompt instructions..."
                />
              </div>

              {/* Variable Info Guide */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Info className="size-3.5 text-primary" />
                  Available Context Variables
                </div>
                <p className="text-xs text-muted-foreground">
                  When generating, atTrack automatically injects the job details and candidate profile into the user prompt:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["jobTitle", "companyName", "jobDescription", "applicantName", "applicantHeadline", "resumeContent", "context"].map((v) => (
                    <code key={v} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border text-foreground">
                      {`{${v}}`}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: AI Memories View */}
      {activeTab === "memories" && (
        <MemoriesTab initialMemories={memories} />
      )}

      {dialog}
    </div>
  );
}

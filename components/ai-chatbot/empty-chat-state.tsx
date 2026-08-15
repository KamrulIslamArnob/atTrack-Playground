"use client";

import {
  Sparkles,
  FileText,
  UserCheck,
  Send,
  Code2,
  Bot,
  Database,
} from "lucide-react";
import { motion } from "motion/react";
import { CHAT_PERSONAS, type ChatPersona } from "@/lib/ai-chatbot/sessions";
import { MINI_SCENARIOS } from "@/lib/ai-chatbot/scenarios";
import type { MiniScenario } from "@/lib/ai-chatbot/types";
import type { WorkspaceContext } from "@/lib/ai-chatbot/workspace";
import { cn } from "@/lib/utils";

export interface EmptyChatStateProps {
  onSelectPrompt: (prompt: string) => void;
  selectedPersonaId?: string;
  selectedPersona?: ChatPersona;
  onSelectPersona: (persona: ChatPersona) => void;
  workspace?: WorkspaceContext | null;
  onOpenWorkspaceDrawer?: () => void;
  onSelectScenario?: (scenario: MiniScenario) => void;
}

const PERSONA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Bot,
  ats_coach: FileText,
  interviewer: UserCheck,
  outreach: Send,
  code_architect: Code2,
};

const SCENARIO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  UserCheck,
  Send,
  Code2,
};

export function EmptyChatState({
  onSelectPrompt,
  selectedPersonaId,
  selectedPersona,
  onSelectPersona,
  workspace,
  onOpenWorkspaceDrawer,
  onSelectScenario,
}: EmptyChatStateProps) {
  const activePersona =
    selectedPersona ||
    CHAT_PERSONAS.find((p) => p.id === selectedPersonaId) ||
    CHAT_PERSONAS[0];

  const heading = activePersona?.heading || "What can I help you with?";
  const subheading =
    activePersona?.subheading ||
    "Choose a persona and ask anything about your career development, coding, or job applications.";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background p-4 text-center sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="flex w-full max-w-2xl flex-col items-center"
      >
        {/* Icon */}
        <div className="relative">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm">
            <Sparkles className="size-7" />
          </div>
        </div>

        {/* Title & Subheading */}
        <h2 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {heading}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          {subheading}
        </p>

        {/* Workspace-aware context chip */}
        {workspace?.hasData && (
          <button
            type="button"
            onClick={onOpenWorkspaceDrawer}
            className={cn(
              "mt-4 flex items-center gap-2.5 rounded-full border border-border/80 bg-gradient-brand-tint px-3.5 py-1.75 text-xs font-medium text-foreground shadow-e1 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]",
              onOpenWorkspaceDrawer && "cursor-pointer"
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-success-border bg-success-surface text-success">
              <Database className="size-3" />
            </span>
            <span className="min-w-0 max-w-[380px] truncate">
              Connected to workspace: {workspace.jobCount ?? 11} jobs, {workspace.resumeCount ?? 5} resumes
            </span>
          </button>
        )}

        {/* Persona Selector pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {CHAT_PERSONAS.map((persona, index) => {
            const isSelected = activePersona.id === persona.id;
            const Icon = PERSONA_ICONS[persona.id] || Sparkles;

            return (
              <motion.button
                key={persona.id}
                type="button"
                onClick={() => onSelectPersona(persona)}
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.08 + index * 0.05,
                  duration: 0.2,
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium shadow-2xs"
                    : "border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{persona.name}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Mini-scenario Cards */}
        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {MINI_SCENARIOS.map((scenario, index) => {
            const Icon = SCENARIO_ICONS[scenario.iconName] || Sparkles;

            return (
              <motion.button
                key={scenario.id}
                type="button"
                onClick={() => {
                  if (onSelectScenario) {
                    onSelectScenario(scenario);
                  } else {
                    onSelectPrompt(scenario.starterPrompt);
                  }
                }}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.15 + index * 0.06,
                  duration: 0.25,
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border/70 bg-card p-4 text-left transition-all duration-150 hover:border-blue-500/40 hover:shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-2.5 w-full">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-all duration-150 group-hover:scale-105">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {scenario.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {scenario.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

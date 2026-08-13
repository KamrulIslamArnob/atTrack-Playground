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
    "Choose a persona and ask anything about your career development, coding, or productivity.";

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="flex w-full max-w-2xl flex-col items-center"
      >
        {/* Icon */}
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 text-foreground shadow-lg shadow-primary/20">
            <Sparkles className="size-8 text-primary" />
          </div>
          <div className="absolute inset-0 bg-primary/20 blur-xl" />
        </div>

        {/* Title & Subheading */}
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          {subheading}
        </p>

        {/* Workspace-aware context chip */}
        {workspace?.hasData && (
          <button
            type="button"
            onClick={onOpenWorkspaceDrawer}
            className={cn(
              "mt-4 flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3.5 py-1.5 text-[11px] text-muted-foreground shadow-xs transition-all duration-200 hover:border-border hover:bg-accent/50 hover:text-foreground active:scale-[0.98]",
              onOpenWorkspaceDrawer && "cursor-pointer"
            )}
          >
            <Database className="size-3.5 text-status-online" />
            <span>
              Connected to your workspace · {workspace.jobCount ?? 0} jobs,{" "}
              {workspace.resumeCount ?? 0} resumes,{" "}
              {workspace.contactCount ?? 0} contacts
            </span>
          </button>
        )}

        {/* Persona Selector pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {CHAT_PERSONAS.map((persona, index) => {
            const isSelected = activePersona.id === persona.id;
            const Icon = PERSONA_ICONS[persona.id] || Sparkles;

            return (
              <motion.button
                key={persona.id}
                type="button"
                onClick={() => onSelectPersona(persona)}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.1 + index * 0.06,
                  duration: 0.25,
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs transition-all duration-200 cursor-pointer",
                  isSelected
                    ? "border-border bg-accent/60 text-foreground font-semibold shadow-xs"
                    : "border-border/50 bg-card/50 text-muted-foreground hover:border-border hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{persona.name}</span>
              </motion.button>
            );
          })}
        </div>

        {/* 4 Mini-scenario Cards */}
        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
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
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.2 + index * 0.08,
                  duration: 0.3,
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group flex flex-col items-start gap-2 rounded-xl border border-border/50 bg-gradient-to-br from-card/50 to-card/30 p-4 text-left transition-all duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-2.5 w-full">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:scale-110 group-hover:bg-primary/20">
                    <Icon className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
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


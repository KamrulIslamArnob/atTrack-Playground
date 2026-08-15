"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatPersona } from "@/lib/ai-chatbot/types";
import { CHAT_PERSONAS } from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import {
  Bot,
  FileText,
  UserCheck,
  Send,
  Code2,
  ChevronDown,
  Check,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PersonaSelectorProps {
  selectedPersonaId: string;
  onSelectPersona: (persona: ChatPersona) => void;
  className?: string;
  direction?: "up" | "down";
}

const PERSONA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Bot,
  ats_coach: FileText,
  interviewer: UserCheck,
  outreach: Send,
  code_architect: Code2,
};

export function PersonaSelector({
  selectedPersonaId,
  onSelectPersona,
  className,
  direction = "up",
}: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = CHAT_PERSONAS.find((p) => p.id === selectedPersonaId) || CHAT_PERSONAS[0];
  const isDown = direction === "down";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "group flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted hover:text-foreground active:scale-[0.98]",
          isOpen && "border-primary/30 bg-primary/5"
        )}
        title="Switch assistant persona"
      >
        <Sparkles className="size-3 text-primary" />
        <span className="max-w-[120px] truncate">{selected.name}</span>
        <ChevronDown
          className={cn("size-3 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: isDown ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: isDown ? -4 : 4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: isDown ? "top left" : "bottom left" }}
            className={cn(
              "absolute z-50 w-80 rounded-xl border border-border/50 bg-popover/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md",
              isDown ? "top-full left-0 mt-2 origin-top-left" : "bottom-full left-0 mb-2 origin-bottom-left"
            )}
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Assistant Persona
            </div>
            {CHAT_PERSONAS.map((persona) => {
              const isSelected = persona.id === selected.id;
              const Icon = PERSONA_ICONS[persona.id] || Bot;

              return (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    onSelectPersona(persona);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all duration-200 active:scale-[0.98]",
                    isSelected
                      ? "bg-accent/60 text-foreground font-semibold shadow-xs"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all",
                      isSelected
                        ? "bg-muted text-foreground font-medium"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{persona.name}</span>
                      {isSelected && <Check className="size-3 shrink-0 text-primary" />}
                    </div>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/80">
                      {persona.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

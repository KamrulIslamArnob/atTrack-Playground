"use client";

import { useState, useRef, useEffect } from "react";
import type { AIModel } from "@/lib/ai-chatbot/types";
import { AI_MODELS } from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { BrainIcon } from "@/components/ai-chatbot/brain-icon";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { CheckIcon } from "@/components/ui/check";
import { SparklesIcon } from "@/components/ui/sparkles";
import { EyeIcon } from "@/components/ui/eye";
import { ZapIcon } from "@/components/ui/zap";

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (model: AIModel) => void;
  availableModels?: AIModel[];
  className?: string;
  direction?: "up" | "down";
}

export function ModelSelector({
  selectedModelId,
  onSelectModel,
  availableModels,
  className,
  direction = "up",
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const modelsList = availableModels && availableModels.length > 0 ? availableModels : AI_MODELS;
  const selectedModel = modelsList.find((m) => m.id === selectedModelId) || modelsList[0];
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
          "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95 cursor-pointer",
          isOpen && "bg-muted text-foreground"
        )}
      >
        <BrainIcon size={14} className="size-3.5 text-primary shrink-0" />
        <span className="max-w-[140px] truncate text-xs">{selectedModel.name}</span>
        <ChevronDownIcon size={12} className={cn("size-3 text-muted-foreground/70 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: isDown ? -4 : 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: isDown ? -4 : 4 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: isDown ? "top left" : "bottom left" }}
            className={cn(
              "absolute z-50 w-64 max-w-[280px] rounded-xl border border-border bg-popover/95 p-1 shadow-md backdrop-blur-md",
              isDown ? "top-full left-0 mt-1.5 origin-top-left" : "bottom-full left-0 mb-1.5 origin-bottom-left"
            )}
          >
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {modelsList.map((model) => {
                const isSelected = model.id === selectedModel.id;
                const hasUniqueBadge =
                  model.badge &&
                  model.badge.toLowerCase() !== model.name.toLowerCase() &&
                  model.badge.toLowerCase() !== model.id.toLowerCase();

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors active:scale-95 cursor-pointer",
                      isSelected
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <div className="shrink-0">
                      {model.id === "auto" || model.provider === "auto" ? (
                        <SparklesIcon size={14} className="size-3.5 text-primary" />
                      ) : model.supportsImages ? (
                        <EyeIcon size={14} className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                      ) : model.isReasoning ? (
                        <BrainIcon size={14} className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                      ) : (
                        <ZapIcon size={14} className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">{model.name}</span>
                        {hasUniqueBadge && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[9.5px] font-medium text-primary">
                            {model.badge}
                          </span>
                        )}
                      </div>
                      {model.description && (
                        <p className="truncate text-[10.5px] text-muted-foreground">
                          {model.description}
                        </p>
                      )}
                    </div>

                    {isSelected && <CheckIcon size={14} className="size-3.5 shrink-0 text-primary ml-1" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

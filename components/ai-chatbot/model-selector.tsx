"use client";

import { useState, useRef, useEffect } from "react";
import type { AIModel } from "@/lib/ai-chatbot/types";
import { AI_MODELS } from "@/lib/ai-chatbot/sessions";
import { cn } from "@/lib/utils";
import { ChevronDown, Sparkles, Zap, Eye, Brain, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/50 hover:text-foreground active:scale-[0.97]",
          isOpen && "bg-accent/50 text-foreground shadow-sm"
        )}
      >
        <Sparkles className="size-3" />
        <span className="max-w-[100px] truncate">{selectedModel.name}</span>
        <ChevronDown className={cn("size-3 transition-transform duration-200", isOpen && "rotate-180")} />
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
              "absolute z-50 w-72 rounded-xl border border-border/50 bg-popover/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md",
              isDown ? "top-full left-0 mt-2 origin-top-left" : "bottom-full left-0 mb-2 origin-bottom-left"
            )}
          >
            {modelsList.map((model) => {
              const isSelected = model.id === selectedModel.id;

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    onSelectModel(model);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left transition-all duration-200",
                    isSelected
                      ? "bg-accent/60 text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md transition-all",
                      model.id === "auto" || model.provider === "auto"
                        ? "bg-primary/15 text-primary shadow-xs"
                        : model.supportsImages
                        ? "bg-sky-500/15 text-sky-500 shadow-xs"
                        : model.isReasoning
                        ? "bg-purple-500/15 text-purple-500 shadow-xs"
                        : "bg-muted text-muted-foreground shadow-xs"
                    )}
                  >
                    {model.id === "auto" || model.provider === "auto" ? (
                      <Sparkles className="size-3 text-primary" />
                    ) : model.supportsImages ? (
                      <Eye className="size-3" />
                    ) : model.isReasoning ? (
                      <Brain className="size-3" />
                    ) : (
                      <Zap className="size-3" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground">{model.name}</span>
                      {model.badge && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                          {model.badge}
                        </span>
                      )}
                      {isSelected && <Check className="size-3 shrink-0 text-primary ml-auto" />}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground/80">{model.description}</p>
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

"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import {
  getComposerSettings,
  setComposerSettings,
  REASONING_EFFORT_CONFIG,
  type ReasoningEffortLevel,
} from "@/lib/ai-chatbot/composer-settings";

interface ReasoningEffortPopoverProps {
  className?: string;
  onChange?: (effort: ReasoningEffortLevel) => void;
}

const EFFORT_LEVELS: ReasoningEffortLevel[] = ["off", "low", "medium", "high", "max"];

export function ReasoningEffortPopover({
  className,
  onChange,
}: ReasoningEffortPopoverProps) {
  const [effort, setEffort] = useState<ReasoningEffortLevel>("max");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const s = getComposerSettings();
    setEffort(s.reasoningEffort);
    onChange?.(s.reasoningEffort);

    const handleUpdate = () => {
      const updated = getComposerSettings();
      setEffort(updated.reasoningEffort);
      onChange?.(updated.reasoningEffort);
    };

    window.addEventListener("attrack-composer-settings-updated", handleUpdate);
    return () => window.removeEventListener("attrack-composer-settings-updated", handleUpdate);
  }, [onChange]);

  const handleSelectStep = (index: number) => {
    const nextLevel = EFFORT_LEVELS[index] || "medium";
    setEffort(nextLevel);
    setComposerSettings({ reasoningEffort: nextLevel });
    onChange?.(nextLevel);
  };

  const currentCfg = REASONING_EFFORT_CONFIG[effort] || REASONING_EFFORT_CONFIG.max;
  const currentStep = EFFORT_LEVELS.indexOf(effort);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60 cursor-pointer select-none",
          className
        )}
        title={`Reasoning Effort: ${currentCfg.label}`}
      >
        <span>{currentCfg.label}</span>
      </PopoverTrigger>

      <PopoverContent side="top" align="end" className="w-64 p-3 bg-popover/98 border border-border shadow-e4">
        {/* Header row */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Effort</span>
            <span className="text-xs font-semibold text-foreground">{currentCfg.label}</span>
          </div>

          <TooltipProvider delay={150}>
            <Tooltip>
              <TooltipTrigger
                type="button"
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
                aria-label="Effort explanation"
              >
                <HelpCircle className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-[11px] p-2">
                Controls the depth of internal reasoning and thinking token budget allocated before generating the final response.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Labels row: Faster <---> Smarter */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pb-2">
          <span>Faster</span>
          <span>Smarter</span>
        </div>

        {/* Discrete 5-step track with dots and sliding thumb matching Image 3 */}
        <div className="relative flex items-center justify-between px-2 py-1.5 bg-muted/60 rounded-xl border border-border/40 select-none">
          {EFFORT_LEVELS.map((level, idx) => {
            const isSelected = idx === currentStep;
            return (
              <button
                key={level}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className="relative z-10 flex size-5 items-center justify-center rounded-full cursor-pointer group"
                title={`${REASONING_EFFORT_CONFIG[level].label}: ${REASONING_EFFORT_CONFIG[level].description}`}
              >
                {/* Discrete dot */}
                <div
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-150",
                    isSelected
                      ? "bg-transparent opacity-0"
                      : "bg-muted-foreground/40 group-hover:bg-foreground/70 group-hover:scale-125"
                  )}
                />

                {/* Active thumb pill */}
                {isSelected && (
                  <div className="absolute inset-0 size-5 rounded-full bg-foreground/85 text-background shadow-xs flex items-center justify-center transition-all animate-in zoom-in-75 duration-150">
                    <div className="size-1.5 rounded-full bg-background" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Description caption */}
        <p className="text-[10px] text-muted-foreground/80 mt-2 px-0.5 leading-snug">
          {currentCfg.description}
          {currentCfg.budgetTokens > 0 && (
            <span className="block mt-0.5 font-mono text-[9px] text-muted-foreground/60">
              Budget: ~{currentCfg.budgetTokens.toLocaleString()} thinking tokens
            </span>
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { AuiIf, useAuiState, ThreadPrimitive } from "@assistant-ui/react";
import { CornerDownLeft, Sparkles } from "lucide-react";
import type { FC } from "react";
import { cn } from "@/lib/utils";

const FollowupSuggestionsList: FC = () => {
  const suggestions = useAuiState((s) => s.thread.suggestions);

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-1.5 pt-1 pb-1">
      <div className="flex items-center gap-1.5 px-1 text-[11.5px] font-medium text-muted-foreground">
        <Sparkles className="size-3 text-blue-500" />
        <span>Suggested follow-ups</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {suggestions.map((suggestion, idx) => (
          <ThreadPrimitive.Suggestion
            key={idx}
            className={cn(
              "group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs text-foreground shadow-2xs transition-all duration-150 hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-600 dark:hover:text-blue-400 active:scale-[0.98] cursor-pointer"
            )}
            prompt={suggestion.prompt}
            method="replace"
            autoSend
          >
            <CornerDownLeft className="size-3 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-blue-500" />
            <span className="truncate max-w-[360px] sm:max-w-[480px] text-left">
              {suggestion.prompt}
            </span>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
};

export const ThreadFollowupSuggestions: FC = () => (
  <AuiIf
    condition={(s) =>
      !s.thread.isEmpty &&
      !s.thread.isRunning &&
      s.thread.suggestions.length > 0
    }
  >
    <FollowupSuggestionsList />
  </AuiIf>
);

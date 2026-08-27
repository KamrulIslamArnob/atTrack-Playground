"use client";

import { useState, useMemo } from "react";
import { useAuiState, unstable_useComposerInput } from "@assistant-ui/react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getModelContextLimit,
  formatTokenCount,
  modelSupportsImages,
  isReasoningModel,
} from "@/lib/ai/model-capabilities";
import type { AIModel } from "@/lib/ai-chatbot/types";
import { Eye, Brain, Wrench, Zap, CheckCircle2 } from "lucide-react";

function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function extractMessageText(msg: unknown): string {
  if (!msg || typeof msg !== "object") return "";
  const m = msg as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object") {
          const part = c as Record<string, unknown>;
          if (typeof part.text === "string") return part.text as string;
          if (typeof part.content === "string") return part.content as string;
        }
        return "";
      })
      .join(" ");
  }
  if (Array.isArray(m.parts)) {
    return (m.parts as unknown[])
      .map((p) => {
        if (p && typeof p === "object" && typeof (p as Record<string, unknown>).text === "string")
          return (p as Record<string, unknown>).text as string;
        return "";
      })
      .join(" ");
  }
  if (typeof m.text === "string") return m.text as string;
  return "";
}

interface ContextUsagePopoverProps {
  className?: string;
  contextTokens?: number;
  model?: AIModel | null;
}

export function ContextUsagePopover({
  className,
  contextTokens = 0,
  model,
}: ContextUsagePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-estimate from assistant-ui thread + composer when no explicit tokens passed.
  const threadMessages = useAuiState((s) => s.thread?.messages as unknown[] | undefined) ?? null;
  const composer = unstable_useComposerInput?.();
  const composerText = composer?.value ?? "";

  const autoTokens = useMemo(() => {
    if (contextTokens > 0) return contextTokens;
    if (!threadMessages || threadMessages.length === 0) {
      return estimateTokensFromText(composerText);
    }
    let chars = 0;
    for (const msg of threadMessages) {
      chars += extractMessageText(msg).length;
    }
    chars += composerText.length;
    const overheadTokens = threadMessages.length * 12;
    return Math.ceil(chars / 4) + overheadTokens;
  }, [threadMessages, composerText, contextTokens]);

  const effectiveTokens = contextTokens > 0 ? contextTokens : autoTokens;

  const modelId = model?.id || "auto";
  const modelName = model?.name || "Auto Hybrid Agent";
  const rawProv = model?.provider || "gemini";
  const providerType: "gemini" | "anthropic" | "openai_compatible" =
    rawProv === "openai" || rawProv === "openai_compatible" || rawProv === "deepseek"
      ? "openai_compatible"
      : rawProv === "anthropic"
        ? "anthropic"
        : "gemini";

  const maxTokens = getModelContextLimit(modelId);
  const tokenPercent = Math.min(Math.round((effectiveTokens / maxTokens) * 100), 100);

  const hasVision = model ? model.supportsImages : modelSupportsImages(providerType, modelId);
  const hasReasoning = model ? model.isReasoning : isReasoningModel(modelId);

  // Rate limit details per provider
  const getRateLimitSummary = (id: string, prov: string) => {
    const lower = (id + " " + prov).toLowerCase();
    if (lower.includes("gemini")) {
      return "15 RPM (Free) / 1,000–4,000 RPM (PayG) · 1M TPM";
    }
    if (lower.includes("claude") || lower.includes("anthropic")) {
      return "Tier 1–4 (50–4,000 RPM) · 100k–800k TPM";
    }
    if (lower.includes("gpt") || lower.includes("openai") || lower.includes("o1") || lower.includes("o3")) {
      return "Tier 1–5 (500–10,000 RPM) · 2M TPM";
    }
    if (lower.includes("deepseek")) {
      return "DeepSeek API: Direct Concurrency Limits";
    }
    return "BYOK Direct API · Standard Concurrency";
  };

  const rateLimitInfo = getRateLimitSummary(modelId, providerType);

  const gaugePercent = tokenPercent > 0 ? Math.max(tokenPercent, 3) : 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          "relative inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer select-none",
          className
        )}
        title={
          effectiveTokens > 0
            ? `${formatTokenCount(effectiveTokens)} / ${formatTokenCount(maxTokens)} tokens · ${tokenPercent}% used`
            : `Context window: ${formatTokenCount(maxTokens)} tokens · empty`
        }
      >
        {/* Subtle SVG gauge circle */}
        <svg className="size-4 -rotate-90" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r="7"
            className="stroke-muted-foreground/20 fill-none"
            strokeWidth="2"
          />
          <circle
            cx="10"
            cy="10"
            r="7"
            className="stroke-foreground/70 fill-none transition-all duration-300"
            strokeWidth="2"
            strokeDasharray="44"
            strokeDashoffset={44 - (44 * gaugePercent) / 100}
            strokeLinecap="round"
          />
        </svg>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        className="w-76 p-3.5 bg-popover/98 border border-border shadow-e4"
      >
        {/* Context Window Capacity */}
        <div className="space-y-2 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Context Window</span>
            <span className="font-mono text-foreground font-semibold">
              {effectiveTokens > 0 ? `${formatTokenCount(effectiveTokens)} / ` : ""}
              {formatTokenCount(maxTokens)} tokens
            </span>
          </div>

          {/* Context Meter Bar */}
          <div
            className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
            title={`${formatTokenCount(effectiveTokens)} used · ${formatTokenCount(Math.max(maxTokens - effectiveTokens, 0))} remaining`}
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${gaugePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {effectiveTokens > 0 ? `${tokenPercent}% utilized · ${formatTokenCount(effectiveTokens)} used` : "0% utilized"}
            </span>
            <span className="font-mono">{formatTokenCount(Math.max(maxTokens - effectiveTokens, 0))} headroom</span>
          </div>
          {effectiveTokens > 0 && tokenPercent >= 75 && (
            <p className="text-[10px] leading-tight text-amber-600 dark:text-amber-400">
              {tokenPercent >= 90 ? "Context nearly full — new messages may truncate history." : "Context filling up — consider starting a new thread for best quality."}
            </p>
          )}
        </div>

        {/* Active Model Capabilities */}
        <div className="py-2.5 space-y-2 border-b border-border/40">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Model Capabilities</span>
            <span className="font-mono text-[10px] font-normal text-foreground truncate max-w-[120px]">
              {modelName}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <div className={cn(
              "flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-colors",
              hasVision
                ? "bg-primary/5 border-primary/20 text-foreground"
                : "bg-muted/40 border-border/40 text-muted-foreground/60"
            )}>
              <Eye className="size-3.5 mb-0.5" />
              <span className="text-[10px] font-medium">Vision</span>
              <span className="text-[9px] text-muted-foreground">
                {hasVision ? "Active" : "None"}
              </span>
            </div>

            <div className={cn(
              "flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-colors",
              hasReasoning
                ? "bg-primary/5 border-primary/20 text-foreground"
                : "bg-muted/40 border-border/40 text-muted-foreground/60"
            )}>
              <Brain className="size-3.5 mb-0.5" />
              <span className="text-[10px] font-medium">Reasoning</span>
              <span className="text-[9px] text-muted-foreground">
                {hasReasoning ? "Deep CoT" : "Standard"}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border bg-primary/5 border-primary/20 text-foreground text-center">
              <Wrench className="size-3.5 mb-0.5 text-primary" />
              <span className="text-[10px] font-medium">Tools</span>
              <span className="text-[9px] text-primary font-medium">Enabled</span>
            </div>
          </div>
        </div>

        {/* Real Provider API Specs & Rate Limits */}
        <div className="pt-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>API Rate Limits &amp; Tier</span>
            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
              <CheckCircle2 className="size-3" />
              <span>Direct BYOK</span>
            </div>
          </div>

          <p className="text-[11px] font-mono text-foreground/90 bg-muted/50 p-2 rounded-lg border border-border/40 leading-relaxed">
            {rateLimitInfo}
          </p>

          <p className="text-[10px] text-muted-foreground leading-normal pt-0.5">
            Your requests run directly against your configured provider keys without intermediary artificial caps.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

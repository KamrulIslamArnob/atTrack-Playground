"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  User,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  ChevronDown,
  FileText,
  ArrowDown,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  Database,
  ExternalLink,
  Briefcase,
  Code2,
  X,
  Send,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Markdown } from "./markdown";
import { ToolExecutionStatus, type ToolExecutionStep } from "./tool-execution-status";

// Strong custom ease-out (emi-design-eng): starts fast, settles gracefully.
const EASE = [0.23, 1, 0.32, 1] as const;

type Role = "user" | "assistant" | "system";

export interface ChatMessageItem {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
  thinking?: string;
  sources?: string[];
  toolSteps?: ToolExecutionStep[];
}

interface ChatMessagesProps {
  messages: ChatMessageItem[];
  isLoading: boolean;
  onRetry?: () => void;
  onOpenCanvas?: (content: string, title?: string) => void;
  onEditMessage?: (id: string, newContent: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  onRetry,
  onOpenCanvas,
  onEditMessage,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const reduceMotion = useReducedMotion();

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  }, []);

  // Auto-scroll to the latest message only when the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, atBottom]);

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted/20 scrollbar-track-transparent px-4 py-6 sm:px-6 md:px-8 md:py-8"
      >
        <div className="mx-auto max-w-3xl space-y-6 md:space-y-8 lg:max-w-4xl pb-6">
          {messages.map((message, idx) => {
            const role = message.role as Role;
            const isLast = idx === messages.length - 1;
            return (
              <MessageBubble
                key={message.id}
                id={message.id}
                role={role}
                content={message.content}
                createdAt={message.createdAt}
                thinking={message.thinking}
                sources={message.sources}
                toolSteps={message.toolSteps}
                isLast={isLast}
                isLoading={isLoading}
                canRetry={isLast && !isLoading}
                onRetry={onRetry}
                onOpenCanvas={onOpenCanvas}
                onEditMessage={onEditMessage}
                reduceMotion={!!reduceMotion}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button
            type="button"
            onClick={jumpToBottom}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute bottom-4 left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border/50 bg-popover/90 text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            title="Scroll to latest"
          >
            <ArrowDown className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MessageBubbleProps {
  id: string;
  role: Role;
  content: string;
  createdAt?: string;
  thinking?: string;
  sources?: string[];
  toolSteps?: ToolExecutionStep[];
  isLast: boolean;
  isLoading: boolean;
  canRetry: boolean;
  onRetry?: () => void;
  onOpenCanvas?: (content: string, title?: string) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  reduceMotion: boolean;
}

const MessageBubble = React.memo(function MessageBubble({
  id,
  role,
  content,
  createdAt,
  thinking,
  sources,
  toolSteps,
  isLast,
  isLoading,
  canRetry,
  onRetry,
  onOpenCanvas,
  onEditMessage,
  reduceMotion,
}: MessageBubbleProps) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isEmptyStreaming = isAssistant && isLoading && isLast && !content.trim();
  const isStreaming = isAssistant && isLoading && isLast && content.trim().length > 0;
  const hasReasoning = isAssistant && thinking && thinking.trim().length > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Sources are supplied by the server (real retrieval/tool citations). No
  // hardcoded fallback — if the server sent none, render none.
  const activeSources = useMemo(() => {
    if (sources && sources.length > 0) return sources;
    return [];
  }, [sources]);

  const variants = useMemo(
    () =>
      reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
        : {
            initial: { opacity: 0, y: 10, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            transition: { duration: 0.22, ease: EASE },
          },
    [reduceMotion]
  );

  const handleFeedback = (type: "up" | "down") => {
    if (feedback === type) {
      setFeedback(null);
    } else {
      setFeedback(type);
      toast.success(type === "up" ? "Feedback saved: Helpful" : "Feedback saved: Needs improvement");
    }
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    setIsEditing(false);
    if (onEditMessage) {
      onEditMessage(id, editText.trim());
      toast.success("Message updated");
    }
  };

  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
      className={cn("flex gap-3.5 sm:gap-4.5 items-start", isUser ? "flex-row-reverse justify-start" : "justify-start")}
    >
      {/* Author Avatar: User vs AI Icon */}
      <div
        className={cn(
          "mt-1 flex size-8.5 shrink-0 items-center justify-center rounded-xl shadow-xs ring-1 transition-all",
          isUser
            ? "bg-muted/70 text-muted-foreground ring-border/40"
            : "bg-primary/10 text-primary border border-primary/20 ring-1 ring-primary/20 shadow-xs"
        )}
      >
        {isUser ? <User className="size-4" /> : <Sparkles className="size-4 text-primary" />}
      </div>

      <div className={cn("flex min-w-0 max-w-[88%] flex-col", isUser && "items-end")}>
        {/* Inline tool execution steps during streaming / assistant generation */}
        {isAssistant && (isStreaming || isEmptyStreaming || toolSteps) && (
          <ToolExecutionStatus
            steps={toolSteps}
            sources={activeSources}
            isStreaming={isLoading && isLast}
          />
        )}

        <div
          className={cn(
            "rounded-2xl px-5 py-4 sm:px-6 sm:py-5 shadow-xs transition-colors select-text cursor-text",
            isUser
              ? "bg-user-bubble text-user-bubble-foreground border border-border/40 ring-1 ring-border/20"
              : "border border-border/50 bg-card text-foreground ring-border/30"
          )}
        >
          {isUser ? (
            isEditing ? (
              <div className="flex flex-col gap-2 min-w-[280px]">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                />
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditText(content);
                      setIsEditing(false);
                    }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                  >
                    <Send className="size-3" />
                    Save & Submit
                  </button>
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                {content}
              </div>
            )
          ) : isEmptyStreaming ? (
            <TypingIndicator reduceMotion={reduceMotion} />
          ) : (
            <div className="text-[15px] leading-[1.65]">
              <Markdown content={content} onOpenCanvas={onOpenCanvas} />
              {isStreaming && <StreamCaret reduceMotion={reduceMotion} />}
            </div>
          )}
        </div>

        {/* Reasoning Accordion if assistant has thinking */}
        {hasReasoning && <ReasoningAccordion text={thinking as string} />}

        {/* Collapsible Sources Used Chip at the bottom of assistant responses */}
        {isAssistant && !isEmptyStreaming && activeSources.length > 0 && (
          <SourcesUsedChip sources={activeSources} />
        )}

        {/* Message Actions */}
        <div className="mt-2.5 flex items-center gap-0.5 px-1 py-0.5 opacity-70 transition-opacity hover:opacity-100">
          <CopyButton text={content} />

          {isUser && !isEditing && (
            <MessageAction title="Edit message" onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" />
            </MessageAction>
          )}

          {isAssistant && (
            <>
              <MessageAction
                title="Read aloud"
                onClick={() => {
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(content);
                    window.speechSynthesis.speak(u);
                  }
                }}
              >
                <Volume2 className="size-3.5" />
              </MessageAction>

              <MessageAction
                title="Regenerate response"
                onClick={onRetry || (() => toast.info("Regenerating response..."))}
              >
                <RotateCcw className="size-3.5" />
              </MessageAction>

              {/* Thumbs Up / Down Feedback Controls */}
              <button
                type="button"
                onClick={() => handleFeedback("up")}
                title="Good response"
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-90",
                  feedback === "up" && "bg-primary/15 text-primary font-bold"
                )}
              >
                <ThumbsUp className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleFeedback("down")}
                title="Poor response"
                className={cn(
                  "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-90",
                  feedback === "down" && "bg-destructive/15 text-destructive font-bold"
                )}
              >
                <ThumbsDown className="size-3.5" />
              </button>
            </>
          )}

          {createdAt && (
            <span className="ml-auto pl-2 text-[10px] tabular-nums text-muted-foreground/60">
              {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

function SourcesUsedChip({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const formattedSourcesText = sources.join(" • ");

  return (
    <div className="mt-2 max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground active:scale-[0.98]"
      >
        <Database className="size-3 text-primary" />
        <span className="truncate">Sources used: <strong className="font-medium text-foreground">{formattedSourcesText}</strong></span>
        <ChevronDown
          className={cn("size-3 transition-transform duration-200 opacity-60 group-hover:opacity-100", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
              {sources.map((src, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs"
                >
                  <SourceIcon name={src} />
                  <span>{src}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SourceIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("resume") || lower.includes("doc")) return <FileText className="size-3 text-primary" />;
  if (lower.includes("job") || lower.includes("app")) return <Briefcase className="size-3 text-primary" />;
  if (lower.includes("github") || lower.includes("code")) return <Code2 className="size-3 text-primary" />;
  return <Database className="size-3 text-primary" />;
}

function TypingIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return <span className="text-sm italic text-muted-foreground">Thinking…</span>;
  }
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-primary/80"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function StreamCaret({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary align-middle" />;
  }
  return (
    <motion.span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-primary align-middle"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-90"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="size-3.5 text-primary" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <Copy className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function MessageAction({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground active:scale-90"
    >
      {children}
    </button>
  );
}

function ReasoningAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-1.5 max-w-full overflow-hidden rounded-xl border border-border/40 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-[0.99]"
      >
        <FileText className="size-3" />
        <span>Reasoning</span>
        <ChevronDown
          className={cn("size-3 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="whitespace-pre-wrap px-3 pb-3 text-[12px] leading-relaxed text-muted-foreground/90">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

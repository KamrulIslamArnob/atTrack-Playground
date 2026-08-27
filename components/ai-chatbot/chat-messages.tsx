"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Sparkles, Volume2, VolumeX, Pencil, ThumbsUp, ThumbsDown, MessageSquareReply } from "lucide-react";
import { UserIcon } from "@/components/ui/user";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { FileTextIcon } from "@/components/ui/file-text";
import { ArrowDownIcon } from "@/components/ui/arrow-down";
import { XIcon } from "@/components/ui/x";
import { SendIcon } from "@/components/ui/send";
import { ClockIcon } from "@/components/ui/clock";
import { CheckCheckIcon } from "@/components/ui/check-check";
import { SettingsIcon } from "@/components/ui/settings";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Markdown } from "./markdown";
import { ToolExecutionStatus, type ToolExecutionStep } from "./tool-execution-status";
import { ArtifactRenderer } from "./artifacts/artifact-renderer";
import type { SqlQueryResult } from "@/lib/actions/database-query";

// Strong custom ease-out: starts fast, settles gracefully.
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
  /** Delivery status for user messages: sending → sent → delivered */
  status?: "sending" | "sent" | "delivered" | "error";
  /** Quoted reply context */
  replyTo?: { id: string; preview: string; role: string };
  /** AI response rating feedback: 'up' (helpful) | 'down' (needs improvement) | null */
  feedback?: "up" | "down" | null;
}

interface ChatMessagesProps {
  messages: ChatMessageItem[];
  isLoading: boolean;
  /** True during initial session load before any messages render */
  isInitialLoading?: boolean;
  onRetry?: () => void;
  onOpenCanvas?: (content: string, title?: string) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  /** Trigger quoted reply — sets reply context in the input bar */
  onReply?: (message: ChatMessageItem) => void;
  /** Approve and execute a proposed SQLite database query */
  onApproveQuery?: (queryText: string, result?: SqlQueryResult) => void;
  /** Save feedback (thumbs up / thumbs down) in database and session */
  onFeedback?: (messageId: string, rating: "up" | "down" | null) => void;
  /** Ask AI to analyze or summarize query results */
  onAskAiSummary?: (prompt: string) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  isInitialLoading,
  onRetry,
  onOpenCanvas,
  onEditMessage,
  onReply,
  onApproveQuery,
  onFeedback,
  onAskAiSummary,
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
    <div className="relative flex min-h-0 flex-1 bg-background">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-slot="aui_thread-viewport"
        className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted/20 scrollbar-track-transparent px-3 py-6 sm:px-6 md:px-8 md:py-9"
      >
        {/* Central Chat Canvas: Max-width 768px, centered, 16px spacing between messages */}
        <div className="mx-auto w-full max-w-[800px] space-y-5 pb-12">
          {/* Skeleton loading state for initial session load */}
          {isInitialLoading && messages.length === 0 ? (
            <MessageSkeleton />
          ) : (
          messages.map((message, idx) => {
            const role = message.role as Role;
            const isLast = idx === messages.length - 1;
            return (
              <MessageItem
                key={message.id}
                id={message.id}
                role={role}
                content={message.content}
                createdAt={message.createdAt}
                thinking={message.thinking}
                sources={message.sources}
                toolSteps={message.toolSteps}
                status={message.status}
                replyTo={message.replyTo}
                isLast={isLast}
                isLoading={isLoading}
                canRetry={isLast && !isLoading}
                onRetry={onRetry}
                onOpenCanvas={onOpenCanvas}
                onEditMessage={onEditMessage}
                onReply={onReply ? () => onReply(message) : undefined}
                onApproveQuery={onApproveQuery}
                onAskAiSummary={onAskAiSummary}
                feedback={message.feedback}
                onFeedback={onFeedback}
                reduceMotion={!!reduceMotion}
              />
            );
          })
          )}
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
            className="absolute bottom-4 left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground active:scale-95 cursor-pointer"
            title="Scroll to latest"
          >
            <ArrowDownIcon className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MessageItemProps {
  id: string;
  role: Role;
  content: string;
  createdAt?: string;
  thinking?: string;
  sources?: string[];
  toolSteps?: ToolExecutionStep[];
  status?: "sending" | "sent" | "delivered" | "error";
  replyTo?: { id: string; preview: string; role: string };
  isLast: boolean;
  isLoading: boolean;
  canRetry: boolean;
  onRetry?: () => void;
  onOpenCanvas?: (content: string, title?: string) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onReply?: () => void;
  onApproveQuery?: (queryText: string, result?: SqlQueryResult) => void;
  onAskAiSummary?: (prompt: string) => void;
  feedback?: "up" | "down" | null;
  onFeedback?: (messageId: string, rating: "up" | "down" | null) => void;
  reduceMotion: boolean;
}

const MessageItem = React.memo(function MessageItem({
  id,
  role,
  content,
  createdAt,
  thinking,
  sources,
  toolSteps,
  status,
  replyTo,
  isLast,
  isLoading,
  canRetry,
  onRetry,
  onOpenCanvas,
  onEditMessage,
  onReply,
  onApproveQuery,
  onAskAiSummary,
  feedback,
  onFeedback,
  reduceMotion,
}: MessageItemProps) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isEmptyStreaming = isAssistant && isLoading && isLast && !content.trim();
  const isStreaming = isAssistant && isLoading && isLast && content.trim().length > 0;
  const hasReasoning = isAssistant && thinking && thinking.trim().length > 0;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeech = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech synthesis is not supported in this browser");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content.replace(/[#*`_\[\]()]/g, " ").replace(/\s+/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [content, isSpeaking]);

  const activeSources = useMemo(() => {
    if (sources && sources.length > 0) return sources;
    return [];
  }, [sources]);

  const variants = useMemo(
    () =>
      reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
        : {
            initial: { opacity: 0, y: 8, scale: 0.99 },
            animate: { opacity: 1, y: 0, scale: 1 },
            transition: { duration: 0.2, ease: EASE },
          },
    [reduceMotion]
  );

  const handleFeedback = (type: "up" | "down") => {
    const nextRating = feedback === type ? null : type;
    if (onFeedback) {
      onFeedback(id, nextRating);
    }
    if (nextRating === "up") {
      toast.success("Feedback saved: Helpful response");
    } else if (nextRating === "down") {
      toast.success("Feedback saved: Needs improvement");
    } else {
      toast.info("Feedback rating removed");
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

  /* USER MESSAGE BUBBLE */
  if (isUser) {
    return (
      <motion.div
        initial={variants.initial}
        animate={variants.animate}
        transition={variants.transition}
        className="group/msg flex w-full justify-end items-start gap-2.5"
      >
        {/* Hover action toolbar — appears on hover (desktop), always on mobile */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 self-center opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100 md:opacity-0 max-md:opacity-100">
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer"
                title="Reply"
              >
                <MessageSquareReply className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(content);
                toast.success("Copied to clipboard");
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer"
              title="Copy"
            >
              <CopyIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer"
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex max-w-[85%] sm:max-w-[75%] flex-col items-end">
          {/* Quoted reply banner */}
          {replyTo && (
            <div className="mb-1 flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-muted/35 px-3 py-1 text-[11px] text-muted-foreground">
              <MessageSquareReply className="size-3 shrink-0" />
              <span className="truncate">
                {replyTo.role === "assistant" ? "AI: " : ""}{replyTo.preview}
              </span>
            </div>
          )}

          <div className="rounded-2xl border-0 bg-[#e3f0fe] dark:bg-[#1a2d42] px-4 py-3 sm:px-5 sm:py-3.5 text-sm text-[#0d1e3a] dark:text-[#f0f4fc]">
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[260px]">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
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
                    <XIcon className="size-3" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background hover:opacity-90"
                  >
                    <SendIcon className="size-3" />
                    Save & Submit
                  </button>
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </div>
            )}
          </div>

          {/* Timestamp + delivery status */}
          <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground/70">
            {createdAt && (
              <span className="tabular-nums">
                {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <DeliveryStatus status={status} />
          </div>
        </div>
      </motion.div>
    );
  }

  /* ASSISTANT RESPONSE CARD */
  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
      className="group/msg flex w-full items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Assistant response. No card chrome — the answer sits directly on the
            page background so it reads as the page's own content, with the user
            bubble carrying the only surface in the thread. */}
        <div className="w-full px-1 py-1">
          {/* Inline tool execution steps during streaming */}
          {(isStreaming || isEmptyStreaming || toolSteps) && (
            <ToolExecutionStatus
              steps={toolSteps}
              sources={activeSources}
              isStreaming={isLoading && isLast}
            />
          )}

          {/* Main Card Content. While empty, StreamProgress below already
              says "thinking…" with the elapsed timer — no separate typing
              dots needed. */}
          {isEmptyStreaming ? null : (
            <div
              className={cn(
                "text-[14px] leading-relaxed text-foreground",
                // Blur-resolves the block currently being written. Only while
                // streaming, so a settled answer is not animated on re-render.
                isStreaming && !reduceMotion && "agent-stream-tail"
              )}
            >
              <Markdown
                content={content}
                onOpenCanvas={onOpenCanvas}
                onApproveQuery={onApproveQuery}
                onAskAiSummary={onAskAiSummary}
              />
              {content.includes("No AI provider configured") && (
                <div className="mt-3.5 pt-1">
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3.5 py-2 text-xs font-semibold text-background hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <SettingsIcon className="size-3.5" />
                    Connect AI Provider in SettingsIcon
                  </Link>
                </div>
              )}
              {isStreaming && <StreamCaret reduceMotion={reduceMotion} />}
            </div>
          )}

          {/* Inline artifact cards (job, contact, memory, link, interview) — rendered from write_database tool snapshots */}
          {toolSteps && toolSteps.some((s) => s.artifact || (s.artifacts && s.artifacts.length > 0)) && (
            <ArtifactRenderer steps={toolSteps} />
          )}

          {/* Live elapsed/token progress. Sits below the content and outside the
              empty/streaming branch, so it tracks the growing answer instead of
              scrolling out of view, and its timer survives the transition
              between the two branches rather than remounting at zero. */}
          {isAssistant && isLoading && isLast && (
            <StreamProgress content={content} reduceMotion={reduceMotion} />
          )}

          {/* Reasoning Accordion if assistant has thinking */}
          {hasReasoning && <ReasoningAccordion text={thinking as string} />}

          {/* Grounded Action Bar — fades in on hover (desktop), always visible on mobile */}
          {!isEmptyStreaming && (
            <div className="mt-4 flex items-center justify-between border-t border-border/40 dark:border-slate-800/60 pt-3 text-xs text-muted-foreground opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity duration-200">
              <div className="flex items-center gap-1">
                <CopyButton text={content} />

                {onReply && (
                  <MessageAction
                    title="Reply"
                    onClick={onReply}
                  >
                    <MessageSquareReply className="size-3.5" />
                  </MessageAction>
                )}

                <MessageAction
                  title={isSpeaking ? "Stop reading" : "Read aloud"}
                  onClick={handleToggleSpeech}
                  className={cn(isSpeaking && "bg-muted text-foreground")}
                >
                  {isSpeaking ? (
                    <VolumeX className="size-3.5 animate-pulse" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </MessageAction>

                <MessageAction
                  title="Regenerate response"
                  onClick={onRetry || (() => toast.info("Regenerating response.."))}
                >
                  <RotateCCWIcon className="size-3.5" />
                </MessageAction>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Thumbs Up / Down Feedback */}
                <button
                  type="button"
                  onClick={() => handleFeedback("up")}
                  title={feedback === "up" ? "Remove helpful rating" : "Good response"}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer",
                    feedback === "up" && "bg-muted text-foreground font-bold ring-1 ring-border"
                  )}
                >
                  <ThumbsUp className="size-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleFeedback("down")}
                  title={feedback === "down" ? "Remove rating" : "Poor response"}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer",
                    feedback === "down" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold ring-1 ring-rose-500/30"
                  )}
                >
                  <ThumbsDown className="size-3.5" />
                </button>

                {createdAt && (
                  <span className="pl-1 text-[10px] tabular-nums text-muted-foreground/60">
                    {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});


/** Formats a duration the way a progress line reads best: "47s", "3m 7s". */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** 1200 -> "1.2k". Keeps the line short once answers get long. */
function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * Live progress while an answer streams: elapsed wall time, approximate tokens
 * received, and the current phase.
 *
 * The token figure is a client-side estimate (~4 chars/token). The provider's
 * real usage numbers only arrive when generation finishes, which is far too
 * late to show as progress — and a long tool-grounded answer can run for
 * minutes, which is exactly when the user needs to see that work is happening.
 */
function StreamProgress({ content, reduceMotion }: { content: string; reduceMotion: boolean }) {
  const startedAt = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 500);
    return () => clearInterval(id);
  }, []);

  const hasText = content.trim().length > 0;
  const tokens = hasText ? Math.round(content.length / 4) : 0;

  return (
    <div
      className="flex items-center gap-1.5 py-1 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Sparkles
        className={cn("size-3 shrink-0 text-muted-foreground/70", !reduceMotion && "animate-pulse")}
      />
      <span className="tabular-nums">{formatElapsed(elapsedMs)}</span>
      {tokens > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatTokenCount(tokens)} tokens</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <span className="italic">{hasText ? "writing" : "thinking"}…</span>
    </div>
  );
}

function StreamCaret({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) {
    return <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-foreground align-middle" />;
  }
  return (
    <motion.span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-foreground align-middle"
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
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer"
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
            <CheckIcon className="size-3.5 text-foreground" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <CopyIcon className="size-3.5" />
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
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 cursor-pointer",
        className
      )}
    >
      {children}
    </button>
  );
}

function ReasoningAccordion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <div className="mt-2 max-w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-[0.99] cursor-pointer"
      >
        <FileTextIcon className="size-3" />
        <span>Reasoning</span>
        <ChevronDownIcon
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
            <div className="whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Delivery status micro-indicator below user messages */
function DeliveryStatus({ status }: { status?: "sending" | "sent" | "delivered" | "error" }) {
  if (!status || status === "delivered") {
    // Default state: delivered (double check) or no status
    return (
      <span className="flex items-center text-muted-foreground/70" title="Delivered">
        <CheckCheckIcon className="size-3" />
      </span>
    );
  }
  if (status === "sending") {
    return (
      <span className="flex items-center text-muted-foreground/50 animate-pulse" title="Sending...">
        <ClockIcon className="size-3" />
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="flex items-center text-muted-foreground/60" title="Sent">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center text-destructive/70" title="Failed to send">
        <XIcon className="size-3" />
      </span>
    );
  }
  return null;
}

/** Skeleton loading state — structured shimmer placeholders that mimic message bubbles */
function MessageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* UserIcon message skeleton (right-aligned) */}
      <div className="flex justify-end items-start">
        <div className="flex max-w-[65%] flex-col items-end gap-1.5">
          <div className="h-10 w-52 rounded-2xl bg-blue-100/60 dark:bg-blue-950/30" />
          <div className="h-2.5 w-16 rounded bg-muted/40" />
        </div>
      </div>

      {/* Assistant message skeleton (left-aligned) */}
      <div className="flex items-start">
        <div className="flex-1 space-y-2.5 max-w-[80%]">
          <div className="rounded-2xl border border-border/30 bg-card/60 p-4 space-y-2.5">
            <div className="h-3 w-[90%] rounded bg-muted/50" />
            <div className="h-3 w-[75%] rounded bg-muted/40" />
            <div className="h-3 w-[60%] rounded bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Another user message skeleton */}
      <div className="flex justify-end items-start">
        <div className="flex max-w-[65%] flex-col items-end gap-1.5">
          <div className="h-8 w-36 rounded-2xl bg-blue-100/60 dark:bg-blue-950/30" />
          <div className="h-2.5 w-12 rounded bg-muted/40" />
        </div>
      </div>

      {/* Another assistant skeleton */}
      <div className="flex items-start">
        <div className="flex-1 space-y-2.5 max-w-[80%]">
          <div className="rounded-2xl border border-border/30 bg-card/60 p-4 space-y-2.5">
            <div className="h-3 w-[85%] rounded bg-muted/50" />
            <div className="h-3 w-[70%] rounded bg-muted/40" />
            <div className="h-3 w-[50%] rounded bg-muted/30" />
            <div className="h-3 w-[80%] rounded bg-muted/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

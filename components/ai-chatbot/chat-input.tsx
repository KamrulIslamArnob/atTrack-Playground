"use client";

import {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type ComponentType,
  type DragEvent,
} from "react";
import type { AIModel, ChatPersona } from "@/lib/ai-chatbot/types";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/ai-chatbot/model-selector";
import { PersonaSelector } from "@/components/ai-chatbot/persona-selector";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  Plus,
  X,
  Square,
  Menu,
  Slash,
  FileText,
  Mail,
  UserCheck,
  Send,
  Code2,
  Briefcase,
  Users,
  Image as ImageIcon,
  Globe,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

// Strong custom ease-out (emi-design-eng): starts fast, settles gracefully.
const EASE = [0.23, 1, 0.32, 1] as const;

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent, attachmentsPayload?: { url: string; contentType: string }[]) => void;
  isLoading: boolean;
  onStop: () => void;
  model: AIModel;
  onSelectModel: (model: AIModel) => void;
  availableModels: AIModel[];
  selectedPersona: ChatPersona;
  onSelectPersona: (persona: ChatPersona) => void;
  onMobileMenuToggle?: () => void;
  webSearchActive?: boolean;
  onToggleWebSearch?: (active: boolean) => void;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  template: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/resume",
    label: "Resume Review",
    description: "Analyze my resume for ATS & impact",
    icon: FileText,
    template: "Review my resume and suggest ATS optimizations and stronger bullet points.",
  },
  {
    command: "/cover",
    label: "Cover Letter",
    description: "Draft a tailored cover letter",
    icon: Mail,
    template: "Draft a cover letter for my application, tailored to the role and company.",
  },
  {
    command: "/interview",
    label: "Interview Prep",
    description: "Run a STAR-method mock interview",
    icon: UserCheck,
    template: "Run a mock interview question using the STAR method and give me feedback.",
  },
  {
    command: "/outreach",
    label: "Cold Outreach",
    description: "Draft a recruiter outreach message",
    icon: Send,
    template: "Draft a concise cold outreach message to a hiring manager or recruiter.",
  },
  {
    command: "/code",
    label: "Code Review",
    description: "Review a code snippet",
    icon: Code2,
    template: "Review this code for performance, readability, and edge cases:\n",
  },
  {
    command: "/job",
    label: "Job Strategy",
    description: "Analyze my tracked applications",
    icon: Briefcase,
    template: "Help me prioritize my tracked job applications and plan my next steps.",
  },
  {
    command: "/contact",
    label: "Networking",
    description: "Plan my CRM outreach",
    icon: Users,
    template: "Help me plan outreach to my CRM contacts for referrals and networking.",
  },
];

function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  model,
  onSelectModel,
  availableModels,
  selectedPersona,
  onSelectPersona,
  onMobileMenuToggle,
  webSearchActive: webSearchActiveProp,
  onToggleWebSearch,
}: ChatInputProps) {
  const [attachments, setAttachments] = useState<{ file: File; url: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState(webSearchActiveProp ?? false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (webSearchActiveProp !== undefined) {
      setIsWebSearchActive(webSearchActiveProp);
    }
  }, [webSearchActiveProp]);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });

  useEffect(() => {
    if (!input) {
      adjustHeight(true);
    }
  }, [input, adjustHeight]);

  const toggleWebSearch = useCallback(() => {
    const next = !isWebSearchActive;
    setIsWebSearchActive(next);
    onToggleWebSearch?.(next);
    if (next) {
      toast.info("Web & tools search enabled");
    }
  }, [isWebSearchActive, onToggleWebSearch]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (!model.supportsImages) {
        toast.warning(`${model.name} does not support image attachments. Switch to a vision model.`);
        return;
      }

      files.forEach((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files are allowed.");
          return;
        }
        const url = URL.createObjectURL(file);
        setAttachments((prev) => [...prev, { file, url }]);
      });
    },
    [model.supportsImages, model.name]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0) return;

      if (!model.supportsImages) {
        toast.warning(`${model.name} does not support image attachments.`);
        return;
      }

      files.forEach((file) => {
        if (!file.type.startsWith("image/")) {
          toast.error("Only image files are allowed as attachments.");
          return;
        }
        const url = URL.createObjectURL(file);
        setAttachments((prev) => [...prev, { file, url }]);
      });
    },
    [model.supportsImages, model.name]
  );

  const applySlashCommand = useCallback(
    (cmd: SlashCommand) => {
      setSlashQuery(null);
      onInputChange({
        target: { value: cmd.template },
      } as React.ChangeEvent<HTMLTextAreaElement>);
      adjustHeight();
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [onInputChange, adjustHeight]
  );

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (((!input || !input.trim()) && attachments.length === 0) || isLoading) return;

      const payloads = await Promise.all(
        attachments.map(
          (att) =>
            new Promise<{ url: string; contentType: string }>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  url: reader.result as string,
                  contentType: att.file.type || "image/png",
                });
              };
              reader.readAsDataURL(att.file);
            })
        )
      );

      onSubmit(e, payloads.length > 0 ? payloads : undefined);

      attachments.forEach((a) => URL.revokeObjectURL(a.url));
      setAttachments([]);
      setSlashQuery(null);
      adjustHeight(true);
    },
    [input, attachments, isLoading, onSubmit, adjustHeight]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashQuery !== null) {
        const filtered = SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(slashQuery));
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && filtered.length > 0)) {
          e.preventDefault();
          applySlashCommand(filtered[Math.min(slashIndex, filtered.length - 1)]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashQuery(null);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleFormSubmit(e);
      }
    },
    [slashQuery, slashIndex, applySlashCommand, handleFormSubmit]
  );

  // Slash command detection (memoized on input).
  useEffect(() => {
    const trimmed = (input || "").trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      setSlashQuery(trimmed.slice(1).toLowerCase());
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }
  }, [input]);

  const filteredCommands = useMemo(
    () => (slashQuery !== null ? SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(slashQuery)) : []),
    [slashQuery]
  );

  const hasValue = Boolean((input || "").trim() || attachments.length > 0);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e);
      adjustHeight();
    },
    [onInputChange, adjustHeight]
  );

  const triggerFilePicker = useCallback(() => {
    if (!model.supportsImages) {
      toast.warning(`${model.name} does not support images`);
      return;
    }
    fileInputRef.current?.click();
  }, [model.supportsImages, model.name]);

  return (
    <div className="sticky bottom-0 z-30 border-t border-border/50 bg-gradient-to-t from-background via-background/95 to-background/40 px-3 py-3 backdrop-blur-md md:px-4 md:py-4">
      <div className="mx-auto w-full max-w-3xl">
        <form onSubmit={handleFormSubmit} className="group">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/60 shadow-lg shadow-black/5 backdrop-blur-xl transition-all duration-200 ease-out focus-within:border-primary/50 focus-within:shadow-xl focus-within:shadow-primary/5 focus-within:ring-2 focus-within:ring-primary/25"
          >
            {/* Drag and Drop Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background/90 backdrop-blur-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">Drop images or files here to attach</p>
                  <p className="text-[10px] text-muted-foreground">Release to upload to chat</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slash command menu — origin-aware, scales from bottom edge */}
            <AnimatePresence>
              {slashQuery !== null && filteredCommands.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{ transformOrigin: "bottom center" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/50 bg-popover/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md"
                >
                  {filteredCommands.map((cmd, idx) => (
                    <button
                      key={cmd.command}
                      type="button"
                      onMouseEnter={() => setSlashIndex(idx)}
                      onClick={() => applySlashCommand(cmd)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-all duration-150 ease-out",
                        idx === slashIndex ? "bg-primary/10" : "hover:bg-accent/50"
                      )}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary">
                        <cmd.icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-medium text-foreground">{cmd.command}</span>
                          <span className="text-[11px] text-muted-foreground">{cmd.label}</span>
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground/80">{cmd.description}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attachments */}
            <AnimatePresence initial={false}>
              {attachments.length > 0 && (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden border-b border-border/50 bg-muted/20"
                >
                  <div className="flex flex-wrap gap-2 p-3">
                    {attachments.map((att, i) => (
                      <div
                        key={i}
                        className="group/att relative size-12 overflow-hidden rounded-lg border border-border/50 bg-muted/50 shadow-sm transition-transform active:scale-95"
                      >
                        <Image src={att.url} alt="Attachment" fill className="object-cover" unoptimized />
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 text-foreground opacity-0 shadow-sm transition-opacity group-hover/att:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={input || ""}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${model.name}...`}
              className={cn(
                "w-full resize-none border-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                "min-h-[56px]"
              )}
              style={{ overflow: "hidden" }}
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-1">
                {onMobileMenuToggle && (
                  <button
                    type="button"
                    onClick={onMobileMenuToggle}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 ease-out hover:bg-accent/50 hover:text-foreground active:scale-[0.96] md:hidden"
                    title="Open menu"
                  >
                    <Menu className="size-4" />
                  </button>
                )}

                <PersonaSelector
                  selectedPersonaId={selectedPersona.id}
                  onSelectPersona={onSelectPersona}
                  direction="up"
                />

                <ModelSelector
                  selectedModelId={model.id}
                  onSelectModel={onSelectModel}
                  availableModels={availableModels}
                  direction="up"
                />

                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 ease-out hover:bg-accent/50 hover:text-foreground active:scale-[0.96]",
                    !model.supportsImages && "opacity-40"
                  )}
                  title={model.supportsImages ? "Attach image" : "Model doesn't support images"}
                >
                  <Plus className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleWebSearch}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all duration-150 ease-out active:scale-[0.96]",
                    isWebSearchActive
                      ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  title={isWebSearchActive ? "Web & tools search active" : "Enable Web & tools search"}
                >
                  <Globe className="size-3.5" />
                  <span className="hidden sm:inline">Search</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <span className="ml-1 hidden items-center gap-1 text-[10px] text-muted-foreground/60 lg:flex">
                  <Slash className="size-3" />
                  for commands
                </span>
              </div>

              {/* Send / Stop — polished morph */}
              {isLoading ? (
                <motion.button
                  type="button"
                  onClick={onStop}
                  initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  whileTap={{ scale: 0.94 }}
                  className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-destructive to-destructive/90 text-destructive-foreground shadow-md shadow-destructive/20 transition-colors hover:from-destructive/90 hover:to-destructive/80"
                  title="Stop"
                >
                  <Square className="size-3.5 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={!hasValue}
                  initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  whileTap={{ scale: hasValue ? 0.94 : 1 }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-xl shadow-md transition-colors",
                    hasValue
                      ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-primary/20 hover:from-primary/90 hover:to-primary/80"
                      : "cursor-not-allowed bg-muted text-muted-foreground/40"
                  )}
                  title="Send"
                >
                  <ArrowUpIcon className="size-4" />
                </motion.button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}

export const MemoizedChatInput = memo(ChatInput);

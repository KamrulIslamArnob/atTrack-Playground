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
import { GlidingHighlight } from "@/components/ai-chatbot/gliding-highlight";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
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
  Globe,
  Upload,
  MessageSquareReply,
  Brain,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getMemories } from "@/lib/actions/memories";
import type { AiMemory } from "@/lib/types/memories";

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
  replyTo?: { id: string; preview: string; role: string } | null;
  onClearReply?: () => void;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  template: string;
}

/** Minimal shape of the Web Speech API we rely on. TypeScript's DOM lib does
 *  not ship these because the API is not on a standards track. */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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
  replyTo,
  onClearReply,
}: ChatInputProps) {
  const [attachments, setAttachments] = useState<{ file: File; url: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isWebSearchActive, setIsWebSearchActive] = useState(webSearchActiveProp ?? false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  // "Engaged" gates the gliding highlight: a freshly-opened menu shows no
  // selection until the pointer or arrow keys actually pick a row.
  const [atEngaged, setAtEngaged] = useState(false);
  const [slashEngaged, setSlashEngaged] = useState(false);
  const atRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const slashRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [dictationSupported, setDictationSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [atIndex, setAtIndex] = useState(0);
  const [availableMemories, setAvailableMemories] = useState<AiMemory[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getMemories()
      .then((mems) => setAvailableMemories(mems))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (webSearchActiveProp !== undefined) {
      setIsWebSearchActive(webSearchActiveProp);
    }
  }, [webSearchActiveProp]);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 180,
  });

  useEffect(() => {
    if (!input) {
      adjustHeight(true);
    }
  }, [input, adjustHeight]);

  // Arrow-key navigation must light the highlight too, not just the pointer.
  useEffect(() => {
    if (atQuery === null) setAtEngaged(false);
  }, [atQuery]);
  useEffect(() => {
    if (slashQuery === null) setSlashEngaged(false);
  }, [slashQuery]);

  // Dictation rides the browser's own speech recognition — no dependency, but
  // it is Chromium-only, so the button is hidden rather than shown broken.
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    setDictationSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleDictation = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript)
        .join(" ")
        .trim();
      if (!transcript) return;
      // Append to the draft rather than replacing it — the user may have typed
      // part of the message before reaching for the microphone.
      const next = input ? `${input.trimEnd()} ${transcript}` : transcript;
      onInputChange({ target: { value: next } } as React.ChangeEvent<HTMLTextAreaElement>);
      adjustHeight();
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, input, onInputChange, adjustHeight]);

  const toggleWebSearch = useCallback(() => {
    const next = !isWebSearchActive;
    setIsWebSearchActive(next);
    onToggleWebSearch?.(next);
    // No toast: the button's own active state already reports this.
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
          toast.error("Only image files are allowed");
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
          toast.error("Only image files are allowed as attachments");
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

  const filteredMemories = useMemo(() => {
    if (atQuery === null) return [];
    const q = atQuery.trim();
    return availableMemories
      .filter((m) => {
        if (!q) return true;
        const matchTitle = m.title ? m.title.toLowerCase().includes(q) : false;
        const matchDesc = m.description.toLowerCase().includes(q);
        return matchTitle || matchDesc;
      })
      .slice(0, 6);
  }, [atQuery, availableMemories]);

  const applyMemoryMention = useCallback(
    (mem: AiMemory) => {
      const cursor = textareaRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = (input || "").slice(0, cursor);
      const textAfterCursor = (input || "").slice(cursor);
      const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\s]*)$/);
      if (match) {
        const memTag = mem.title ? `@${mem.title.replace(/\s+/g, "_")}` : `@memory`;
        const replaced = textBeforeCursor.slice(0, match.index) + `${memTag} ` + textAfterCursor;
        onInputChange({
          target: { value: replaced },
        } as React.ChangeEvent<HTMLTextAreaElement>);
        setAtQuery(null);
        // No toast: the mention tag is now visible in the input itself.
        adjustHeight();
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    },
    [input, onInputChange, adjustHeight]
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
      setAtQuery(null);
      adjustHeight(true);
    },
    [input, attachments, isLoading, onSubmit, adjustHeight]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (atQuery !== null && filteredMemories.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setAtEngaged(true);
          setAtIndex((i) => Math.min(i + 1, filteredMemories.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setAtEngaged(true);
          setAtIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          applyMemoryMention(filteredMemories[Math.min(atIndex, filteredMemories.length - 1)]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAtQuery(null);
          return;
        }
      }

      if (slashQuery !== null) {
        const filtered = SLASH_COMMANDS.filter((c) => c.command.slice(1).startsWith(slashQuery));
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashEngaged(true);
          setSlashIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashEngaged(true);
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
    [atQuery, atIndex, filteredMemories, applyMemoryMention, slashQuery, slashIndex, applySlashCommand, handleFormSubmit]
  );

  useEffect(() => {
    const trimmed = (input || "").trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      setSlashQuery(trimmed.slice(1).toLowerCase());
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }

    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = (input || "").slice(0, cursor);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\s]*)$/);
    if (match && !match[1].includes("\n") && match[1].length <= 25) {
      setAtQuery(match[1].toLowerCase());
      setAtIndex(0);
    } else {
      setAtQuery(null);
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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return; // let normal text paste through

      e.preventDefault();

      if (!model.supportsImages) {
        toast.warning(`${model.name} does not support image attachments.`);
        return;
      }

      imageItems.forEach((item) => {
        const file = item.getAsFile();
        if (!file) return;
        const url = URL.createObjectURL(file);
        setAttachments((prev) => [...prev, { file, url }]);
      });
    },
    [model.supportsImages, model.name]
  );

  return (
    <div className="sticky bottom-0 z-30 px-3 py-3 md:px-4 md:py-4">
      {/* Centered max-width 768px container */}
      <div className="mx-auto w-full max-w-[768px]">
        <form onSubmit={handleFormSubmit} className="group">
          {/* Single unified input box with transparent glass feel */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="relative rounded-[22px] border border-border/80 bg-transparent transition-all duration-200 ease-out focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 dark:border-border/60"
          >
            {/* Drag and Drop Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-600 bg-background/95 backdrop-blur-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">Drop images or files here to attach</p>
                  <p className="text-[10px] text-muted-foreground">Release to upload to chat</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* @ Memory mention menu */}
            <AnimatePresence>
              {atQuery !== null && filteredMemories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{ transformOrigin: "bottom center" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/70 bg-popover/98 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md"
                >
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
                    <Brain className="size-3.5 text-blue-500" />
                    <span>Connect AI Memory (@)</span>
                  </div>
                  <GlidingHighlight
                    rowRefs={atRowRefs}
                    activeIndex={atIndex}
                    visible={atEngaged}
                    deps={[filteredMemories.length, atQuery]}
                  />
                  {filteredMemories.map((mem, idx) => (
                    <button
                      key={mem.id}
                      type="button"
                      ref={(el) => {
                        atRowRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => {
                        setAtIndex(idx);
                        setAtEngaged(true);
                      }}
                      onClick={() => applyMemoryMention(mem)}
                      className={cn(
                        "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 ease-out cursor-pointer",
                        idx === atIndex && atEngaged && "text-blue-600 dark:text-blue-400"
                      )}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <Brain className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-medium text-xs text-foreground truncate">
                            {mem.title || <span className="italic text-muted-foreground">Untitled Memory</span>}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.2 rounded shrink-0">
                            @{mem.title ? mem.title.replace(/\s+/g, "_") : "memory"}
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                          {mem.description.slice(0, 80).replace(/\n+/g, " ")}
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slash command menu */}
            <AnimatePresence>
              {slashQuery !== null && filteredCommands.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{ transformOrigin: "bottom center" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/60 bg-popover/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md"
                >
                  <GlidingHighlight
                    rowRefs={slashRowRefs}
                    activeIndex={slashIndex}
                    visible={slashEngaged}
                    deps={[filteredCommands.length, slashQuery]}
                  />
                  {filteredCommands.map((cmd, idx) => (
                    <button
                      key={cmd.command}
                      type="button"
                      ref={(el) => {
                        slashRowRefs.current[idx] = el;
                      }}
                      onMouseEnter={() => {
                        setSlashIndex(idx);
                        setSlashEngaged(true);
                      }}
                      onClick={() => applySlashCommand(cmd)}
                      className={cn(
                        "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 ease-out cursor-pointer",
                        idx === slashIndex && slashEngaged && "text-blue-600 dark:text-blue-400"
                      )}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-blue-600">
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

            {/* Attachments list */}
            <AnimatePresence initial={false}>
              {attachments.length > 0 && (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden bg-transparent"
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

            {/* Quoted Reply Banner */}
            <AnimatePresence initial={false}>
              {replyTo && (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden bg-transparent px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <MessageSquareReply className="size-3" />
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="font-semibold text-foreground/90">
                          Replying to {replyTo.role === "assistant" ? "Assistant" : "You"}:
                        </span>{" "}
                        <span className="text-muted-foreground truncate inline-block max-w-[320px] sm:max-w-[450px] align-bottom">
                          {replyTo.preview}
                        </span>
                      </div>
                    </div>
                    {onClearReply && (
                      <button
                        type="button"
                        onClick={onClearReply}
                        className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="Cancel reply"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top row: Textarea */}
            <Textarea
              ref={textareaRef}
              value={input || ""}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message..."
              className={cn(
                "w-full resize-none border-none bg-transparent px-4 py-3 pr-32 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                "min-h-[52px]"
              )}
              style={{ overflow: "hidden" }}
            />

            {/* Bottom controls row */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                {onMobileMenuToggle && (
                  <button
                    type="button"
                    onClick={onMobileMenuToggle}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] md:hidden"
                    title="Open menu"
                  >
                    <Menu className="size-4" />
                  </button>
                )}

                {/* Model Selector Dropdown */}
                <ModelSelector
                  selectedModelId={model.id}
                  onSelectModel={onSelectModel}
                  availableModels={availableModels}
                  direction="up"
                />

                {/* Persona Selector Pill */}
                <PersonaSelector
                  selectedPersonaId={selectedPersona.id}
                  onSelectPersona={onSelectPersona}
                  direction="up"
                />

                {/* Search Toggle */}
                <button
                  type="button"
                  onClick={toggleWebSearch}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/60 text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted hover:text-foreground active:scale-[0.96] cursor-pointer",
                    isWebSearchActive && "border-primary/30 bg-primary/5 text-primary"
                  )}
                  title={isWebSearchActive ? "Web & tools search active" : "Enable Web & tools search"}
                >
                  <Globe className="size-3.5" />
                </button>

                {/* Attach File Button */}
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] cursor-pointer",
                    !model.supportsImages && "opacity-40"
                  )}
                  title={model.supportsImages ? "Attach image" : "Model doesn't support images"}
                >
                  <Plus className="size-4" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Dictation — hidden where the browser has no speech API. */}
                {dictationSupported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    aria-pressed={isListening}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.96] cursor-pointer",
                      isListening
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={isListening ? "Stop dictation" : "Dictate message"}
                  >
                    {isListening ? (
                      <span className="flex h-3.5 items-center gap-[2.5px]">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="agent-eq-bar w-[2.5px] rounded-full bg-current"
                            style={{ height: "100%", animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </button>
                )}

              </div>

              {/* Send / Stop button aligned to the right */}
              {isLoading ? (
                <motion.button
                  type="button"
                  onClick={onStop}
                  initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  whileTap={{ scale: 0.94 }}
                  className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-xs shadow-blue-500/20 transition-colors cursor-pointer shrink-0"
                  title="Stop generation"
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
                    "flex size-8 items-center justify-center rounded-lg shadow-xs transition-all shrink-0",
                    hasValue
                      ? "bg-[#2563EB] hover:bg-[#1d4ed8] text-white cursor-pointer shadow-blue-500/20"
                      : "cursor-not-allowed bg-muted text-muted-foreground/40"
                  )}
                  title="Send message"
                >
                  <ArrowUp className="size-4" />
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

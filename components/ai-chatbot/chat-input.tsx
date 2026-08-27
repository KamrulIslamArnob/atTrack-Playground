"use client";

import { memo, useState, useRef, useEffect, useCallback, useMemo, type DragEvent } from "react";
import type { AIModel, ChatPersona } from "@/lib/ai-chatbot/types";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelector } from "@/components/ai-chatbot/model-selector";
import { PersonaSelector } from "@/components/ai-chatbot/persona-selector";
import { GlidingHighlight } from "@/components/ai-chatbot/gliding-highlight";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Square,
  Mail,
  Code2,
  Briefcase,
  Globe,
  MessageSquareReply,
  Brain,
  Sparkles,
  DollarSign,
  Terminal,
  Zap,
  CornerDownLeft,
  FileText,
} from "lucide-react";
import { PermissionModeSelector } from "@/components/ai-chatbot/composer/permission-mode-selector";
import { ReasoningEffortPopover } from "@/components/ai-chatbot/composer/reasoning-effort-popover";
import { ContextUsagePopover } from "@/components/ai-chatbot/composer/context-usage-popover";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { XIcon } from "@/components/ui/x";
import { MenuIcon } from "@/components/ui/menu";
import { FileTextIcon } from "@/components/ui/file-text";
import { UserCheckIcon } from "@/components/ui/user-check";
import { SendIcon } from "@/components/ui/send";
import { UsersIcon } from "@/components/ui/users";
import { UploadIcon } from "@/components/ui/upload";
import { MicIcon } from "@/components/ui/mic";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getMemories } from "@/lib/actions/memories";
import { getSkills } from "@/lib/actions/skills";
import type { AiMemory } from "@/lib/types/memories";
import { BUILTIN_SKILLS, type Skill } from "@/lib/types/skills";

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

const SKILL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText: FileTextIcon,
  Mail: Mail,
  UserCheck: UserCheckIcon,
  Send: SendIcon,
  DollarSign: DollarSign,
  Code2: Code2,
  Briefcase: Briefcase,
  Users: UsersIcon,
  Sparkles: Sparkles,
  Terminal: Terminal,
};

/** Minimal shape of the Web Speech API we rely on. */
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [availableSkills, setAvailableSkills] = useState<Skill[]>(BUILTIN_SKILLS);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getMemories()
      .then((mems) => {
        if (Array.isArray(mems)) setAvailableMemories(mems);
      })
      .catch(() => {});
    getSkills()
      .then((sks) => {
        if (Array.isArray(sks) && sks.length > 0) setAvailableSkills(sks);
      })
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

  useEffect(() => {
    if (atQuery === null) setAtEngaged(false);
  }, [atQuery]);
  useEffect(() => {
    if (slashQuery === null) setSlashEngaged(false);
  }, [slashQuery]);

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
  }, [isWebSearchActive, onToggleWebSearch]);

  const validateAndAddFile = useCallback(
    (file: File) => {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isText =
        file.type.startsWith("text/") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".json") ||
        file.name.endsWith(".csv");

      if (isImage) {
        if (!model.supportsImages) {
          toast.warning(
            `${model.name} does not support image attachments. Please switch to a vision model (e.g. Gemini, Claude, GPT-4o).`
          );
          return false;
        }
      } else if (isPdf) {
        const canPdf =
          model.supportsPdfs ??
          (model.provider === "gemini" ||
            model.provider === "anthropic" ||
            model.id.toLowerCase().includes("gemini") ||
            model.id.toLowerCase().includes("claude"));
        if (!canPdf) {
          toast.warning(
            `${model.name} does not support PDF documents. Please switch to Gemini or Claude.`
          );
          return false;
        }
      } else if (!isText) {
        toast.error(`Unsupported file type (${file.name}). Allowed: images, PDFs, text files.`);
        return false;
      }

      const url = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { file, url }]);
      return true;
    },
    [model]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      files.forEach(validateAndAddFile);
      if (e.target) e.target.value = "";
    },
    [validateAndAddFile]
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
      files.forEach(validateAndAddFile);
    },
    [validateAndAddFile]
  );

  const filteredSkills = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase().trim();
    return availableSkills.filter(
      (s) => s.command.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [slashQuery, availableSkills]);

  const applySkill = useCallback(
    (skill: Skill) => {
      const cursor = textareaRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = (input || "").slice(0, cursor);
      const textAfterCursor = (input || "").slice(cursor);
      const lastSlash = textBeforeCursor.lastIndexOf("/");

      if (textBeforeCursor.trim().startsWith("/") && !textAfterCursor.trim()) {
        onInputChange({
          target: { value: skill.instructions },
        } as React.ChangeEvent<HTMLTextAreaElement>);
      } else if (lastSlash >= 0) {
        const replaced = textBeforeCursor.slice(0, lastSlash) + skill.instructions + " " + textAfterCursor;
        onInputChange({
          target: { value: replaced },
        } as React.ChangeEvent<HTMLTextAreaElement>);
      } else {
        onInputChange({
          target: { value: skill.instructions },
        } as React.ChangeEvent<HTMLTextAreaElement>);
      }

      setSlashQuery(null);
      adjustHeight();
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [input, onInputChange, adjustHeight]
  );

  const filteredMemories = useMemo(() => {
    if (atQuery === null) return [];
    const q = atQuery.trim().toLowerCase();
    return availableMemories
      .filter((m) => {
        if (!q) return true;
        const matchTitle = m.title ? m.title.toLowerCase().includes(q) : false;
        const matchDesc = m.description.toLowerCase().includes(q);
        return matchTitle || matchDesc;
      })
      .slice(0, 8);
  }, [atQuery, availableMemories]);

  const applyMemoryMention = useCallback(
    (mem: AiMemory) => {
      const cursor = textareaRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = (input || "").slice(0, cursor);
      const textAfterCursor = (input || "").slice(cursor);
      const atSymbolIndex = textBeforeCursor.lastIndexOf("@");
      
      const memTag = mem.title ? `@${mem.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}` : `@memory`;
      const prefix = atSymbolIndex >= 0 ? textBeforeCursor.slice(0, atSymbolIndex) : textBeforeCursor;
      const replaced = prefix + `${memTag} ` + textAfterCursor;

      onInputChange({
        target: { value: replaced },
      } as React.ChangeEvent<HTMLTextAreaElement>);
      setAtQuery(null);
      adjustHeight();
      window.setTimeout(() => textareaRef.current?.focus(), 0);
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
      if (atQuery !== null) {
        if (filteredMemories.length > 0) {
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
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setAtQuery(null);
          return;
        }
      }

      if (slashQuery !== null) {
        if (filteredSkills.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSlashEngaged(true);
            setSlashIndex((i) => Math.min(i + 1, Math.max(filteredSkills.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setSlashEngaged(true);
            setSlashIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            applySkill(filteredSkills[Math.min(slashIndex, filteredSkills.length - 1)]);
            return;
          }
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
    [atQuery, atIndex, filteredMemories, applyMemoryMention, slashQuery, slashIndex, filteredSkills, applySkill, handleFormSubmit]
  );

  const checkTriggers = useCallback((val: string, cursor: number) => {
    const textBeforeCursor = val.slice(0, cursor);

    // Check slash command trigger: /(command) at start or after whitespace
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }

    // Check at mention trigger: @(tag) at start or after whitespace
    const atMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (atMatch) {
      setAtQuery(atMatch[1].toLowerCase());
      setAtIndex(0);
    } else {
      setAtQuery(null);
    }
  }, []);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const cursor = e.target.selectionStart ?? val.length;
      onInputChange(e);
      adjustHeight();
      checkTriggers(val, cursor);
    },
    [onInputChange, adjustHeight, checkTriggers]
  );

  const handleTextareaKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const cursor = target.selectionStart ?? target.value.length;
      checkTriggers(target.value, cursor);
    },
    [checkTriggers]
  );

  const handleTextareaClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const target = e.currentTarget;
      const cursor = target.selectionStart ?? target.value.length;
      checkTriggers(target.value, cursor);
    },
    [checkTriggers]
  );

  const hasValue = Boolean((input || "").trim() || attachments.length > 0);

  // Estimate tokens from current draft so context popover shows live usage even in legacy composer
  const draftTokens = useMemo(() => {
    const textLen = (input || "").length;
    const base = Math.ceil(textLen / 4);
    const attachOverhead = attachments.length * 256; // rough image/text attach cost
    return base + attachOverhead;
  }, [input, attachments.length]);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items || []);
      const fileItems = items.filter((item) => item.kind === "file");
      if (fileItems.length === 0) return;

      e.preventDefault();
      fileItems.forEach((item) => {
        const file = item.getAsFile();
        if (file) validateAndAddFile(file);
      });
    },
    [validateAndAddFile]
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
            className="relative rounded-[22px] border-0 bg-muted/40 transition-all duration-200 ease-out focus-within:ring-2 focus-within:ring-foreground/10"
          >
            {/* Drag and Drop Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: EASE }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary bg-background/95 backdrop-blur-md"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UploadIcon className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-foreground">Drop images or files here to attach</p>
                  <p className="text-[10px] text-muted-foreground">Release to upload to chat</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* @ Memory mention menu */}
            <AnimatePresence>
              {atQuery !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{ transformOrigin: "bottom center" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/70 bg-popover/98 p-1.5 shadow-e3 backdrop-blur-md max-h-72 overflow-y-auto"
                >
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Brain className="size-3.5 text-primary" />
                      <span>Tracky AI Memory (@)</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">{availableMemories.length} saved</span>
                  </div>

                  {filteredMemories.length > 0 ? (
                    <>
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
                            "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 ease-out cursor-pointer hover:bg-muted/50",
                            idx === atIndex && atEngaged && "text-primary bg-primary/10"
                          )}
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <Brain className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-medium text-xs text-foreground truncate">
                                {mem.title || <span className="italic text-muted-foreground">Personal Fact</span>}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.2 rounded shrink-0">
                                @{mem.title ? mem.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_") : "memory"}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-muted-foreground/80 mt-0.5">
                              {mem.description.slice(0, 80).replace(/\n+/g, " ")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {availableMemories.length === 0 ? "No memories saved yet" : `No memories matching "@${atQuery}"`}
                      </p>
                      <p className="text-[11px] mt-1 text-muted-foreground/80">
                        Add career facts in <span className="font-medium text-foreground">Prompts &gt; Tracky Memory</span> or tell Tracky about yourself.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* / Slash command / Skills menu */}
            <AnimatePresence>
              {slashQuery !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: EASE }}
                  style={{ transformOrigin: "bottom center" }}
                  className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/70 bg-popover/98 p-1.5 shadow-e3 backdrop-blur-md max-h-72 overflow-y-auto"
                >
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Zap className="size-3.5 text-amber-500" />
                      <span>Chat Skills (/)</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">{availableSkills.length} available</span>
                  </div>

                  {filteredSkills.length > 0 ? (
                    <>
                      <GlidingHighlight
                        rowRefs={slashRowRefs}
                        activeIndex={slashIndex}
                        visible={slashEngaged}
                        deps={[filteredSkills.length, slashQuery]}
                      />
                      {filteredSkills.map((skill, idx) => {
                        const IconComp = (skill.icon && SKILL_ICON_MAP[skill.icon]) || Sparkles;
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            ref={(el) => {
                              slashRowRefs.current[idx] = el;
                            }}
                            onMouseEnter={() => {
                              setSlashIndex(idx);
                              setSlashEngaged(true);
                            }}
                            onClick={() => applySkill(skill)}
                            className={cn(
                              "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 ease-out cursor-pointer hover:bg-muted/50",
                              idx === slashIndex && slashEngaged && "text-primary bg-primary/10"
                            )}
                          >
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                              <IconComp className="size-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold text-foreground">/{skill.command}</span>
                                <span className="text-[11px] text-muted-foreground truncate">{skill.name}</span>
                              </div>
                              {skill.description && (
                                <p className="truncate text-[10px] text-muted-foreground/80">{skill.description}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">No skills matching &quot;/{slashQuery}&quot;</p>
                      <p className="text-[11px] mt-1 text-muted-foreground/80">
                        Create custom skills in <span className="font-medium text-foreground">Prompts &gt; Skills</span>.
                      </p>
                    </div>
                  )}
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
                    {attachments.map((att, i) => {
                      const isImage = att.file.type.startsWith("image/");
                      return (
                        <div
                          key={i}
                          className={cn(
                            "group/att relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-2xs transition-transform active:scale-95",
                            isImage ? "size-12" : "h-12 px-3 py-1.5 flex items-center gap-2 max-w-[220px]"
                          )}
                        >
                          {isImage ? (
                            <Image src={att.url} alt={att.file.name} fill className="object-cover" unoptimized />
                          ) : (
                            <>
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <FileText className="size-4" />
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="truncate text-xs font-semibold text-foreground leading-tight">
                                  {att.file.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {formatFileSize(att.file.size)}
                                </p>
                              </div>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 text-foreground opacity-0 transition-opacity group-hover/att:opacity-100 hover:bg-destructive hover:text-destructive-foreground shadow-xs cursor-pointer"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      );
                    })}
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
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <MessageSquareReply className="size-3" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground truncate">
                        Replying to <span className="text-foreground capitalize">{replyTo.role}</span>: &quot;{replyTo.preview}&quot;
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onClearReply}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Textarea */}
            <div className="relative flex items-center w-full">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyUp={handleTextareaKeyUp}
                onClick={handleTextareaClick}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  selectedPersona.id === "general"
                    ? "Describe a task or ask a question, type @ for memory, / for skills..."
                    : `Ask ${selectedPersona.name}, type @ for memory, / for skills...`
                }
                rows={1}
                className="w-full resize-none border-0 bg-transparent px-3.5 pt-3 pb-1 pr-7 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 text-foreground placeholder:text-muted-foreground"
              />
              {input.trim() && (
                <div className="absolute right-3.5 top-3.5 text-muted-foreground/40 pointer-events-none hidden sm:block">
                  <CornerDownLeft className="size-3.5" />
                </div>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf,.txt,.md,.json,.csv"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-1">
                {/* Mobile sidebar toggle button */}
                {onMobileMenuToggle && (
                  <button
                    type="button"
                    onClick={onMobileMenuToggle}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                    title="Toggle Chat Sessions"
                  >
                    <MenuIcon className="size-4" />
                  </button>
                )}

                {/* Permission Mode Autonomy Selector */}
                <PermissionModeSelector />

                {/* Persona Selector */}
                <PersonaSelector
                  selectedPersonaId={selectedPersona.id}
                  onSelectPersona={onSelectPersona}
                />

                {/* Web Search Toggle */}
                {onToggleWebSearch && (
                  <button
                    type="button"
                    onClick={toggleWebSearch}
                    className={cn(
                      "flex size-7.5 items-center justify-center rounded-lg transition-colors cursor-pointer",
                      isWebSearchActive
                        ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                    title={isWebSearchActive ? "Web search enabled" : "Enable web search"}
                  >
                    <Globe className="size-3.5" />
                  </button>
                )}

                {/* Image & File Upload Button */}
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="flex size-7.5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground cursor-pointer"
                  title="Attach image, PDF, or document"
                >
                  <PlusIcon className="size-4" />
                </button>

                {/* Dictation (Speech to Text) */}
                {dictationSupported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={cn(
                      "flex size-7.5 items-center justify-center rounded-lg transition-colors cursor-pointer",
                      isListening
                        ? "bg-red-500/15 text-red-600 border border-red-500/30 animate-pulse"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                    title={isListening ? "Listening... click to stop" : "Voice dictation"}
                  >
                    <MicIcon className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Right tools & Submit/Stop */}
              <div className="flex items-center gap-1.5">
                {/* Model Selector */}
                <ModelSelector
                  selectedModelId={model.id}
                  availableModels={availableModels}
                  onSelectModel={onSelectModel}
                />

                {/* Reasoning Effort Popover */}
                <ReasoningEffortPopover />

                {/* Context Window & Token Usage Popover */}
                <ContextUsagePopover model={model} contextTokens={draftTokens} />

                {isLoading ? (
                  <button
                    type="button"
                    onClick={onStop}
                    className="flex size-8 items-center justify-center rounded-xl bg-foreground text-background transition-transform active:scale-95 cursor-pointer shadow-xs"
                    title="Stop generating"
                  >
                    <Square className="size-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!hasValue}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer shadow-xs",
                      hasValue
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                        : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                    )}
                    title="Send message"
                  >
                    <ArrowUp className="size-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export const MemoizedChatInput = memo(ChatInput);
export { ChatInput };

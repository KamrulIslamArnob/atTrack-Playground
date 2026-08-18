"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/attachment";
import { File } from "@/components/file";
import { Image } from "@/components/image";
import { MarkdownText } from "@/components/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/reasoning";
import { ToolFallback } from "@/components/tool-fallback";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/tool-group";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type ToolCallMessagePartComponent,
  useAuiState,
  unstable_useComposerInput,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SquareIcon,
  Brain,
  Zap,
  Sparkles,
  FileText,
  Mail,
  UserCheck,
  Send,
  DollarSign,
  Code2,
  Briefcase,
  Users,
  Terminal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getMemories } from "@/lib/actions/memories";
import { getSkills } from "@/lib/actions/skills";
import type { AiMemory } from "@/lib/types/memories";
import { BUILTIN_SKILLS, type Skill } from "@/lib/types/skills";
import { ArrowUpIcon } from "@/components/ui/arrow-up";
import { MicIcon } from "@/components/ui/mic";
import { CheckIcon } from "@/components/ui/check";
import { CopyIcon } from "@/components/ui/copy";
import { RefreshCWIcon } from "@/components/ui/refresh-cw";
import { SparklesIcon } from "@/components/ui/sparkles";
import { ModelSelector } from "@/components/ai-chatbot/model-selector";
import { Source } from "@/components/source";
import type { AIModel } from "@/lib/ai-chatbot/types";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ComponentType,
  type FC,
  type PropsWithChildren,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadModelContextValue = {
  selectedModel: AIModel;
  onSelectModel: (model: AIModel) => void;
  availableModels?: AIModel[];
};

export const ThreadModelContext =
  createContext<ThreadModelContextValue | null>(null);
export const useThreadModel = () => useContext(ThreadModelContext);

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  modelSelector?: ThreadModelContextValue | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  modelSelector,
}) => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadModelContext.Provider value={modelSelector ?? null}>
        <ThreadRoot isEmpty={isEmpty} />
      </ThreadModelContext.Provider>
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean }> = ({ isEmpty }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "44rem",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            isEmpty && "justify-center",
          )}
        >
          <AuiIf condition={isNewChatView}>
            <Welcome />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-14 flex flex-col gap-y-6 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer bg-background flex flex-col gap-3 overflow-visible pb-4 md:pb-6",
              !isEmpty && "sticky bottom-0 mt-auto",
            )}
          >
            <ThreadScrollToBottom />
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessageComponent />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom
      render={
        <TooltipIconButton
          tooltip="Scroll to bottom"
          variant="outline"
          className="aui-thread-scroll-to-bottom border-border bg-background hover:bg-muted text-foreground active:scale-95 absolute -top-12 z-10 self-center rounded-full size-8 p-1.5 disabled:invisible transition-all cursor-pointer"
        />
      }
    >
      <ArrowDownIcon className="size-3.5" />
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-xl font-semibold text-foreground duration-200">
        How can I help you today?
      </h1>
    </div>
  );
};

const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText: FileText,
  Mail: Mail,
  UserCheck: UserCheck,
  Send: Send,
  DollarSign: DollarSign,
  Code2: Code2,
  Briefcase: Briefcase,
  Users: Users,
  Sparkles: Sparkles,
  Terminal: Terminal,
};

const Composer: FC = () => {
  const { value, setText, send, isDisabled, canSend } = unstable_useComposerInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [atQuery, setAtQuery] = useState<string | null>(null);
  const [atIndex, setAtIndex] = useState(0);
  const [availableMemories, setAvailableMemories] = useState<AiMemory[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>(BUILTIN_SKILLS);

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

  const filteredSkills = useMemo(() => {
    if (slashQuery === null) return [];
    const q = slashQuery.toLowerCase().trim();
    return availableSkills.filter(
      (s) => s.command.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [slashQuery, availableSkills]);

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

  const checkTriggers = useCallback((val: string, cursor: number) => {
    const textBeforeCursor = val.slice(0, cursor);

    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }

    const atMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
    if (atMatch) {
      setAtQuery(atMatch[1].toLowerCase());
      setAtIndex(0);
    } else {
      setAtQuery(null);
    }
  }, []);

  const applySkill = useCallback(
    (skill: Skill) => {
      const cursor = textareaRef.current?.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursor);
      const textAfterCursor = value.slice(cursor);
      const lastSlash = textBeforeCursor.lastIndexOf("/");

      if (textBeforeCursor.trim().startsWith("/") && !textAfterCursor.trim()) {
        setText(skill.instructions);
      } else if (lastSlash >= 0) {
        const replaced = textBeforeCursor.slice(0, lastSlash) + skill.instructions + " " + textAfterCursor;
        setText(replaced);
      } else {
        setText(skill.instructions);
      }

      setSlashQuery(null);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [value, setText]
  );

  const applyMemoryMention = useCallback(
    (mem: AiMemory) => {
      const cursor = textareaRef.current?.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursor);
      const textAfterCursor = value.slice(cursor);
      const atSymbolIndex = textBeforeCursor.lastIndexOf("@");

      const memTag = mem.title ? `@${mem.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}` : `@memory`;
      const prefix = atSymbolIndex >= 0 ? textBeforeCursor.slice(0, atSymbolIndex) : textBeforeCursor;
      const replaced = prefix + `${memTag} ` + textAfterCursor;

      setText(replaced);
      setAtQuery(null);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [value, setText]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (atQuery !== null) {
        if (filteredMemories.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtIndex((i) => Math.min(i + 1, filteredMemories.length - 1));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
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
            setSlashIndex((i) => Math.min(i + 1, Math.max(filteredSkills.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
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

      if (e.key === "Enter" && !e.shiftKey && canSend) {
        e.preventDefault();
        send();
        setSlashQuery(null);
        setAtQuery(null);
      }
    },
    [atQuery, atIndex, filteredMemories, applyMemoryMention, slashQuery, slashIndex, filteredSkills, applySkill, canSend, send]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setText(val);
    checkTriggers(val, cursor);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const cursor = target.selectionStart ?? target.value.length;
    checkTriggers(target.value, cursor);
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const cursor = target.selectionStart ?? target.value.length;
    checkTriggers(target.value, cursor);
  };

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      {/* @ Memory mention popup */}
      <AnimatePresence>
        {atQuery !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: "bottom center" }}
            className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/80 bg-popover/98 p-1.5 shadow-xl backdrop-blur-md max-h-72 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
              <div className="flex items-center gap-1.5">
                <Brain className="size-3.5 text-muted-foreground" />
                <span>Tracky AI Memory (@)</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">{availableMemories.length} saved</span>
            </div>

            {filteredMemories.length > 0 ? (
              filteredMemories.map((mem, idx) => (
                <button
                  key={mem.id}
                  type="button"
                  onMouseEnter={() => setAtIndex(idx)}
                  onClick={() => applyMemoryMention(mem)}
                  className={cn(
                    "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 cursor-pointer hover:bg-muted/50",
                    idx === atIndex && "text-foreground bg-muted"
                  )}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border/60">
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
              ))
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

      {/* / Slash command / Skills popup */}
      <AnimatePresence>
        {slashQuery !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: "bottom center" }}
            className="absolute bottom-full left-0 z-50 mb-2 w-full max-w-md origin-bottom rounded-xl border border-border/80 bg-popover/98 p-1.5 shadow-xl backdrop-blur-md max-h-72 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
              <div className="flex items-center gap-1.5">
                <Zap className="size-3.5 text-muted-foreground" />
                <span>Chat Skills (/)</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">{availableSkills.length} available</span>
            </div>

            {filteredSkills.length > 0 ? (
              filteredSkills.map((skill, idx) => {
                const IconComp = (skill.icon && SKILL_ICONS[skill.icon]) || Sparkles;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onMouseEnter={() => setSlashIndex(idx)}
                    onClick={() => applySkill(skill)}
                    className={cn(
                      "relative z-10 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 cursor-pointer hover:bg-muted/50",
                      idx === slashIndex && "text-foreground bg-muted"
                    )}
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border/60">
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
              })
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

      <ComposerPrimitive.AttachmentDropzone
        render={
          <div
            data-slot="aui_composer-shell"
            className="flex w-full flex-col rounded-2xl border-0 bg-muted/40 p-2.5 shadow-xs transition-all focus-within:ring-1 focus-within:ring-foreground/10 data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/40"
          />
        }
      >
        <ComposerAttachments />
        <textarea
          ref={textareaRef}
          value={value}
          disabled={isDisabled}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          placeholder="Ask Tracky anything, type @ for memory, or / for skills..."
          className="aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-36 min-h-9 w-full resize-none bg-transparent px-2 py-1 text-xs sm:text-[13px] text-foreground outline-none leading-relaxed"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  const modelCtx = useThreadModel();

  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between pt-1">
      <div className="flex items-center gap-0.5">
        <ComposerAddAttachment />
        {modelCtx?.selectedModel && modelCtx?.onSelectModel && (
          <ModelSelector
            selectedModelId={modelCtx.selectedModel.id}
            onSelectModel={modelCtx.onSelectModel}
            availableModels={modelCtx.availableModels}
            direction="up"
          />
        )}
      </div>
      <div className="flex items-center gap-1">
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate
              render={
                <TooltipIconButton
                  tooltip="Voice input"
                  side="bottom"
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="aui-composer-dictate size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all cursor-pointer"
                  aria-label="Start voice input"
                />
              }
            >
              <MicIcon size={14} className="aui-composer-dictate-icon size-3.5" />
            </ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation
              render={
                <TooltipIconButton
                  tooltip="Stop dictation"
                  side="bottom"
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="aui-composer-stop-dictation text-destructive bg-destructive/10 size-7 rounded-lg active:scale-95 transition-all cursor-pointer"
                  aria-label="Stop voice input"
                />
              }
            >
              <SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" />
            </ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send
            render={
              <TooltipIconButton
                tooltip="Send message"
                side="bottom"
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-send size-7 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer"
                aria-label="Send message"
              />
            }
          >
            <ArrowUpIcon size={14} className="aui-composer-send-icon size-3.5" />
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel
            render={
              <Button
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-cancel size-7 rounded-lg bg-gradient-brand text-white shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                aria-label="Stop generating"
              />
            }
          >
            <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive mt-2 rounded-xl border p-3 text-xs">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    ReasoningGroup,
  } = useContext(ThreadComponentsContext);

  const ACTION_BAR_PT = "pt-1.5";
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground px-2 text-xs leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            source: ["group-chainOfThought", "group-source"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return (
                  <div data-slot="aui_chain-of-thought" className="flex flex-col gap-1.5 mb-3.5">
                    {children}
                  </div>
                );
              case "group-source":
                return <div className="flex flex-wrap gap-1">{children}</div>;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (ReasoningGroup) {
                  return (
                    <ReasoningGroup group={part}>{children}</ReasoningGroup>
                  );
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running} variant="ghost">
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "text":
                return <MarkdownText />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "source":
                return <Source {...part} />;
              case "data":
                return part.dataRendererUI;
              case "file":
                return (
                  <div data-slot="aui_assistant-message-file" className="py-1">
                    <File {...part} />
                  </div>
                );
              case "image":
                return (
                  <div data-slot="aui_assistant-message-image" className="py-1">
                    <Image {...part} />
                  </div>
                );
              case "indicator":
                return (
                  <div
                    data-slot="aui_assistant-message-indicator"
                    className="flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground my-0.5"
                    aria-label="Assistant is thinking"
                  >
                    <SparklesIcon size={14} className="size-3.5 shrink-0 text-muted-foreground animate-pulse" />
                    <span className="text-xs font-medium text-foreground">
                      Thinking…
                    </span>
                  </div>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      <ActionBarPrimitive.Copy render={<TooltipIconButton tooltip="Copy" className="size-7 rounded-lg active:scale-95 transition-colors" />}><AuiIf condition={(s) => s.message.isCopied}>
                      <CheckIcon size={14} className="animate-in zoom-in-50 fade-in duration-200 ease-out size-3.5" />
                    </AuiIf><AuiIf condition={(s) => !s.message.isCopied}>
                      <CopyIcon size={14} className="animate-in zoom-in-75 fade-in duration-150 size-3.5" />
                    </AuiIf></ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload render={<TooltipIconButton tooltip="Refresh" className="size-7 rounded-lg active:scale-95 transition-colors" />}><RefreshCWIcon size={14} className="size-3.5" /></ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger render={<TooltipIconButton tooltip="More" className="data-[state=open]:bg-accent size-7 rounded-lg active:scale-95 transition-colors" />}><MoreHorizontalIcon className="size-3.5" /></ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="aui-action-bar-more-content bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border border-border p-1.5 shadow-lg backdrop-blur-sm"
        >
          <ActionBarPrimitive.ExportMarkdown render={<ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs outline-none select-none active:scale-95 transition-colors" />}><DownloadIcon className="size-3.5" />Export as Markdown
                              </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-file" className="py-1">
    <File {...part} />
  </div>
);

const UserImagePart: ImageMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-image" className="py-1">
    <Image {...part} />
  </div>
);

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-[#e3f0fe] dark:bg-[#1a2d42] text-[#0d1e3a] dark:text-[#f0f4fc] rounded-2xl border-0 px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed wrap-break-word empty:hidden">
          <MessagePrimitive.Parts
            components={{ File: UserFilePart, Image: UserImagePart }}
          />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit render={<TooltipIconButton tooltip="Edit" className="aui-user-action-edit size-7 rounded-lg active:scale-95 transition-colors" />}><PencilIcon className="size-3.5" /></ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border ms-auto flex w-full max-w-[85%] flex-col rounded-2xl border bg-card">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-xs outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel render={<Button variant="ghost" size="sm" className="h-7 rounded-lg px-3 text-xs active:scale-95 cursor-pointer">Cancel</Button>} />
          <ComposerPrimitive.Send render={<Button size="sm" className="h-7 rounded-lg px-3 text-xs active:scale-95 cursor-pointer">Update</Button>} />
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = () => {
  return null;
};

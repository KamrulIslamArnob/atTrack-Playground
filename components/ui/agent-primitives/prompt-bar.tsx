"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Paperclip,
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  Globe,
  Database,
  FileText,
  Layers,
  MessageSquare,
  Mail,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR — Agent Composer with @ sources, / commands,
 * model selector, file attachments, and dictation.
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean composer structure, floating shadow only on popups
 * - Tier 2: 4px spacing grid (p-1.5, gap-1.5)
 * - Tier 3: Rounded-2xl composer, rounded-xl dropdowns, rounded-lg chips
 * - Tier 4: Text-xs input/labels, text-[11px] secondary meta
 * - Tier 5: Semantic design tokens (bg-card, text-foreground, etc.)
 * - Tier 6: Active scale-95 and smooth hover transitions
 * - Tier 7: Uniform Lucide icons
 * - Tier 8: Apple spring transitions & reduced motion check
 * ───────────────────────────────────────────────────────── */

type Source = {
  key: string;
  name: string;
  desc: string;
  icon: typeof Globe;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", icon: Paperclip, attach: true },
  { key: "database", name: "Job Database", desc: "Applications & pipeline stats", icon: Database },
  { key: "resume", name: "Resume & Documents", desc: "Active resume variants", icon: FileText },
  { key: "web", name: "Web search", desc: "Real-time search & salary info", icon: Globe },
  { key: "figma", name: "Figma", desc: "Design-to-code workflows", icon: Layers },
  { key: "slack", name: "Slack", desc: "Read workspace channels", icon: MessageSquare },
  { key: "gmail", name: "Gmail", desc: "Sync recruiter emails", icon: Mail, connect: true },
];

const COMMANDS = [
  { key: "compare", name: "/compare", desc: "Compare job fit against resume" },
  { key: "draft-email", name: "/draft-email", desc: "Write follow-up email" },
  { key: "interview-prep", name: "/interview-prep", desc: "Generate technical interview questions" },
  { key: "salary-calc", name: "/salary-calc", desc: "Benchmark compensation against market" },
  { key: "summarize", name: "/summarize", desc: "Summarize chat history" },
];

const MODELS = [
  { key: "gemini-2.5-pro", name: "Gemini 2.5 Pro", tag: "Flagship" },
  { key: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tag: "Fast" },
  { key: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", tag: "Reasoning" },
];

const FILES = ["resume_frontend_2026.pdf", "cover_letter_google.docx", "portfolio_metrics.csv"];
const DICTATION = "Compare my resume against the senior frontend position";

function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export function PromptBar({ variant = "Rounded" }: { variant?: "Rounded" | "Pill" }) {
  const isPill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(MODELS[0]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [connectedSources, setConnectedSources] = useState<Record<string, boolean>>({});

  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const token = dismissed ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
      ? COMMANDS.filter((c) => c.name.slice(1).toLowerCase().startsWith(query))
      : [];

  useEffect(() => {
    setActive(0);
  }, [menu, query]);

  // Adjust textarea auto-resize
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "24px";
    const newHeight = Math.min(Math.max(input.scrollHeight, 24), 120);
    input.style.height = `${newHeight}px`;
  }, [draft]);

  // Dictation simulation
  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => {
      setDraft((curr) => (curr ? `${curr.trimEnd()} ${DICTATION}` : DICTATION));
      setListening(false);
      inputRef.current?.focus();
    }, 2000);
    return () => clearTimeout(t);
  }, [listening]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (item: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === item.key);
    if (source?.attach) {
      setAttachments((current) => [...current, FILES[current.length % FILES.length]]);
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${item.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${item.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const handleSend = () => {
    if (!canSend) return;
    setDraft("");
    setAttachments([]);
    closeMenus();
  };

  return (
    <div className="relative flex w-full max-w-lg flex-col justify-end">
      {/* ── @ / Slash Menu Dropdown ───────────────────────── */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-border bg-popover p-1.5 shadow-md"
          >
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {rows.map((row, i) => {
                const isSelected = i === active;
                const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
                const IconComponent = source?.icon;

                return (
                  <button
                    key={row.key}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(row)}
                    className={cn(
                      "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs transition-colors cursor-pointer",
                      isSelected ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {IconComponent && <IconComponent className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="shrink-0 font-medium">{row.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {row.desc}
                    </span>
                    {source?.connect && (
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnectedSources((prev) => ({ ...prev, [source.key]: !prev[source.key] }));
                        }}
                        className={cn(
                          "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          connectedSources[source.key]
                            ? "bg-success/15 text-success"
                            : "bg-primary/10 text-primary hover:underline"
                        )}
                      >
                        {connectedSources[source.key] ? "Connected" : "Connect"}
                      </span>
                    )}
                  </button>
                );
              })}

              {rows.length === 0 && (
                <div className="flex h-8 items-center px-2 text-xs text-muted-foreground">
                  No matching results for "{query}"
                </div>
              )}
            </div>

            <div className="mt-1 border-t border-border px-2 pt-1.5 pb-0.5 text-[10px] text-muted-foreground">
              {menu === "at" ? "Type to filter sources & files" : "Type to filter commands"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Model Selector Dropdown ──────────────────────── */}
      <AnimatePresence>
        {modelOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="absolute right-0 bottom-full z-20 mb-2 w-48 rounded-xl border border-border bg-popover p-1.5 shadow-md space-y-0.5"
          >
            {MODELS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setModel(m);
                  setModelOpen(false);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "flex h-7.5 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs transition-colors cursor-pointer",
                  m.key === model.key
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="truncate">{m.name}</span>
                <span className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
                  {m.tag}
                  {m.key === model.key && <Check className="size-3 text-primary" />}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Composer Shell ──────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col gap-1.5 border border-border bg-card p-2 transition-colors focus-within:border-primary/50",
          isPill ? "rounded-2xl" : "rounded-xl"
        )}
      >
        {/* Attachments Row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground"
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="max-w-[130px] truncate">{file}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments((curr) => curr.filter((_, idx) => idx !== i))}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input Textarea */}
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDismissed(false);
            setPlusOpen(false);
          }}
          onKeyDown={(e) => {
            if (menu && rows.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((c) => (c + 1) % rows.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((c) => (c - 1 + rows.length) % rows.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(rows[active]);
                return;
              }
            }
            if (e.key === "Escape") {
              setDismissed(true);
              closeMenus();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={listening ? "Listening to voice input…" : "Ask AI or type @ for sources, / for commands…"}
          className="w-full resize-none bg-transparent px-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground leading-relaxed"
        />

        {/* Bottom Control Bar */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1">
            {/* Plus / Attach Action */}
            <button
              type="button"
              aria-label="Add sources or files"
              onClick={() => {
                setModelOpen(false);
                setPlusOpen((c) => !c);
                inputRef.current?.focus();
              }}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer",
                plusOpen && "bg-muted text-foreground"
              )}
            >
              <Plus className="size-4" />
            </button>

            {/* Model Selector Trigger */}
            <button
              type="button"
              onClick={() => {
                setPlusOpen(false);
                setModelOpen((c) => !c);
              }}
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
            >
              <Sparkles className="size-3 text-primary" />
              <span>{model.name}</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Dictation Action */}
            <button
              type="button"
              aria-label="Voice dictation"
              onClick={() => setListening((c) => !c)}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-colors active:scale-95 cursor-pointer",
                listening
                  ? "bg-destructive/15 text-destructive animate-pulse"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Mic className="size-3.5" />
            </button>

            {/* Send Action */}
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
              onClick={handleSend}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground/40"
              )}
            >
              <ArrowUp className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default PromptBar;

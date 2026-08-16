"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, ArrowUp, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

/* ─────────────────────────────────────────────────────────
 * APPROVAL CARD (Human-in-the-loop)
 *
 * Complies with 10-Tier Design System:
 * - Tier 1: Clean card architecture, no noise
 * - Tier 2: 4px spacing rhythm (p-3.5, gap-2)
 * - Tier 3: Rounded-2xl container, rounded-xl buttons, rounded-lg indicators
 * - Tier 4: Text scale (text-sm font-semibold, text-xs body)
 * - Tier 5: Pure semantic color tokens
 * - Tier 6: Active:scale-95, hover transitions
 * - Tier 7: Uniform Lucide icons
 * - Tier 8: Apple spring transitions & reduced motion check
 * ───────────────────────────────────────────────────────── */

const QUESTIONS = [
  {
    q: "How many flavors should we launch?",
    type: "radio" as const,
    options: ["Three (core line)", "Five (full case)", "Just one hero"],
  },
  {
    q: "Which mix-ins should we stock?",
    type: "check" as const,
    options: ["Chocolate chips", "Waffle bits", "Sprinkles"],
  },
  {
    q: "Which market do we enter first?",
    type: "radio" as const,
    options: ["Food trucks", "Grocery freezers", "Scoop shops"],
  },
];

export function ApprovalCard() {
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  const question = QUESTIONS[qi];
  const last = qi === QUESTIONS.length - 1;
  const selected = answers[qi] ?? [];
  const hasAnswer = selected.length > 0 || Boolean(custom[qi]?.trim());

  const toggle = (index: number) => {
    setAnswers((current) => {
      const picked = current[qi] ?? [];
      const next =
        question.type === "radio"
          ? [index]
          : picked.includes(index)
          ? picked.filter((item) => item !== index)
          : [...picked, index];
      return { ...current, [qi]: next };
    });

    if (question.type === "radio") {
      setCustom((current) => ({ ...current, [qi]: "" }));
      window.setTimeout(() => {
        if (qi === QUESTIONS.length - 1) setSent(true);
        else setQi((current) => Math.min(QUESTIONS.length - 1, current + 1));
      }, 400);
    }
  };

  const reset = () => {
    setQi(0);
    setAnswers({});
    setCustom({});
    setSent(false);
    setOpen(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted active:scale-95 cursor-pointer"
      >
        Open approval card
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {sent ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <span className="flex size-8 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-4" />
            </span>
            <span className="text-xs font-semibold text-foreground">Answers submitted</span>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Start over</span>
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={qi}
              initial={shouldReduceMotion ? undefined : { opacity: 0, x: 8 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-foreground leading-snug">
                  {question.q}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {question.options.map((option, i) => {
                  const on = selected.includes(i);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(i)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                        on
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted/70"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center border transition-all",
                          question.type === "radio" ? "rounded-full" : "rounded-md",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-transparent"
                        )}
                      >
                        {question.type === "radio" ? (
                          <span
                            className={cn(
                              "size-1.5 rounded-full bg-primary-foreground transition-transform",
                              on ? "scale-100" : "scale-0"
                            )}
                          />
                        ) : (
                          <Check className="size-3 stroke-[3]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                    </button>
                  );
                })}

                <div className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors focus-within:bg-muted/50">
                  <span className="size-4 shrink-0" />
                  <input
                    value={custom[qi] ?? ""}
                    onChange={(event) => {
                      setCustom((current) => ({ ...current, [qi]: event.target.value }));
                      if (question.type === "radio") {
                        setAnswers((current) => ({ ...current, [qi]: [] }));
                      }
                    }}
                    placeholder="Type custom answer…"
                    className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous"
              disabled={qi === 0 || sent}
              onClick={() => setQi((current) => Math.max(0, current - 1))}
              className="flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            {/* Paging Indicators */}
            <div className="flex items-center gap-1.5">
              {QUESTIONS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to question ${i + 1}`}
                  disabled={sent}
                  onClick={() => setQi(i)}
                  className={cn(
                    "rounded-full transition-all duration-200 cursor-pointer",
                    i === qi && !sent
                      ? "size-2 bg-primary ring-2 ring-primary/20"
                      : sent || i < qi
                      ? "size-1.5 bg-muted-foreground"
                      : "size-1.5 bg-border"
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              aria-label="Next"
              disabled={last || sent}
              onClick={() => setQi((current) => Math.min(QUESTIONS.length - 1, current + 1))}
              className="flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {!sent && (
            <button
              type="button"
              aria-label={last ? "Submit answers" : "Next question"}
              disabled={!hasAnswer}
              onClick={() => (last ? setSent(true) : setQi((current) => current + 1))}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-all duration-200 active:scale-95 cursor-pointer disabled:cursor-not-allowed",
                hasAnswer
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground/50"
              )}
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default ApprovalCard;

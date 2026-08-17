"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSampleDataAction } from "@/lib/actions/onboarding";
import { readCache } from "@/lib/ai-chatbot/sessions";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Briefcase,
  FileText,
  Bot,
  X,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  PartyPopper,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface GettingStartedWidgetProps {
  primaryPositionName?: string;
  hasResume: boolean;
  hasAiProvider: boolean;
  hasChatted?: boolean;
  jobCount: number;
  hasDemoData: boolean;
}

const DISMISS_KEY = "attrack-getting-started-dismissed";

export function GettingStartedWidget({
  primaryPositionName,
  hasResume,
  hasAiProvider,
  hasChatted = false,
  jobCount,
  hasDemoData,
}: GettingStartedWidgetProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [localChatted, setLocalChatted] = useState(hasChatted);
  const [celebrating, setCelebrating] = useState(false);

  // Check client-side mirror cache as fast fallback for chat messages
  useEffect(() => {
    if (localChatted) return;
    const cachedSessions = readCache();
    const hasUserMsg = cachedSessions.some((s) =>
      s.messages?.some((m) => m.role === "user")
    );
    if (hasUserMsg) {
      setLocalChatted(true);
    }
  }, [localChatted]);

  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";
    setDismissed(isDismissed);
  }, []);

  const isChatCompleted = hasChatted || localChatted;

  const items = useMemo(
    () => [
      {
        id: "role",
        title: primaryPositionName ? `Target: ${primaryPositionName}` : "Set target role",
        description: "Defines your primary job search target and experience level",
        href: "/settings",
        completed: Boolean(primaryPositionName),
        icon: Briefcase,
      },
      {
        id: "resume",
        title: hasResume ? "Master resume added" : "Upload your master resume",
        description: "Enables instant fit scoring and automated cover letter drafting",
        href: "/documents",
        completed: hasResume,
        icon: FileText,
      },
      {
        id: "ai",
        title: hasAiProvider ? "AI provider connected" : "Connect AI engine (BYOK)",
        description: "Brings your own API key for Ask Tracky and automated job analysis",
        href: "/settings",
        completed: hasAiProvider,
        icon: Sparkles,
      },
      {
        id: "jobs",
        title: jobCount > 0 ? `${jobCount} jobs on board` : "Add or clip your first job",
        description: "Drag across Kanban stages or clip directly from LinkedIn",
        href: "/jobs",
        completed: jobCount > 0,
        icon: Briefcase,
      },
      {
        id: "tracky",
        title: isChatCompleted ? "Chatted with Ask Tracky" : "Try Ask Tracky assistant",
        description: "Query your local workspace or draft outreach emails",
        href: "/ai-builder/chatbot",
        completed: isChatCompleted,
        icon: Bot,
      },
    ],
    [primaryPositionName, hasResume, hasAiProvider, jobCount, isChatCompleted]
  );

  const completedCount = items.filter((i) => i.completed).length;
  const isAllComplete = completedCount === items.length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  // Trigger celebration animation when all 5 steps are complete
  useEffect(() => {
    if (isAllComplete && !dismissed) {
      setCelebrating(true);
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isAllComplete, dismissed]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const handleClearDemoData = async () => {
    setClearing(true);
    try {
      const res = await clearSampleDataAction();
      if (res.success) {
        toast.success(`Removed ${res.removedCount} sample jobs`);
        router.refresh();
      }
    } catch {
      toast.error("Couldn't remove sample jobs");
    } finally {
      setClearing(false);
    }
  };

  if (dismissed) return null;

  return (
    <AnimatePresence mode="wait">
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, height: 0, y: -12, scale: 0.95, marginBottom: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className={`rounded-2xl border shadow-xs relative overflow-hidden transition-all ${
            celebrating
              ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-teal-500/10 p-5 ring-2 ring-emerald-500/30"
              : "border-primary/20 bg-card p-4 sm:p-5"
          }`}
        >
          {celebrating ? (
            /* 5-Step Complete Celebration State */
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                  <motion.div
                    initial={{ rotate: -20, scale: 0.5 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <PartyPopper className="size-6" />
                  </motion.div>
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                    <Check className="size-2.5" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-bold text-foreground">
                      All 5 Onboarding Steps Completed!
                    </h2>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                      5 / 5 Done
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your local-first career workspace is fully ready. Happy job hunting!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          ) : (
            /* Standard Checklist State */
            <>
              {/* Top Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-sm font-semibold text-foreground">
                        Getting Started Guide
                      </h2>
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {completedCount} of {items.length} completed
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Complete these steps to unlock the full power of atTrack.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasDemoData && (
                    <button
                      onClick={handleClearDemoData}
                      disabled={clearing}
                      className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-muted transition-colors mr-1"
                      title="Remove sample demo jobs"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="hidden sm:inline">Clear demo data</span>
                    </button>
                  )}
                  <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    title={collapsed ? "Expand guide" : "Collapse guide"}
                  >
                    {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    title="Dismiss guide"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Item Checklist */}
              {!collapsed && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                        item.completed
                          ? "border-border/60 bg-muted/20 opacity-85 hover:opacity-100"
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.completed ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-xs font-semibold truncate ${
                              item.completed ? "text-muted-foreground line-through" : "text-foreground"
                            }`}
                          >
                            {item.title}
                          </p>
                          <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

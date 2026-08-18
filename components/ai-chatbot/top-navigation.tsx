"use client";

import { useMemo } from "react";
import { PanelLeft } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ContextSource } from "@/lib/ai-chatbot/types";
import { DatabaseBackupIcon } from "@/components/ai-chatbot/database-backup-icon";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";

interface TopNavigationProps {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  sources?: ContextSource[];
  connectedSourceIds?: string[];
  onOpenDrawer?: () => void;
  className?: string;
}

export function TopNavigation({
  onToggleSidebar,
  onBack,
  showBackButton = false,
  sources = [],
  connectedSourceIds,
  onOpenDrawer,
  className,
}: TopNavigationProps) {
  const summaryText = useMemo(() => {
    if (!sources || sources.length === 0) {
      return "Connected to workspace";
    }

    const isConnected = (id: string) =>
      connectedSourceIds !== undefined
        ? connectedSourceIds.includes(id)
        : (sources.find((s) => s.id === id)?.enabled ?? false);

    const jobsSource = sources.find((s) => s.id === "jobs" || s.type === "jobs");
    const resumesSource = sources.find((s) => s.id === "resume" || s.type === "resume");
    const contactsSource = sources.find((s) => s.id === "contacts" || s.type === "contacts");

    const parts: string[] = [];

    if (jobsSource && isConnected("jobs")) {
      const count = typeof jobsSource.recordCount === "number" ? jobsSource.recordCount : 0;
      parts.push(`${count} ${count === 1 ? "job" : "jobs"}`);
    }

    if (resumesSource && isConnected("resume")) {
      const count = typeof resumesSource.recordCount === "number" ? resumesSource.recordCount : 0;
      parts.push(`${count} ${count === 1 ? "resume" : "resumes"}`);
    }

    if (contactsSource && isConnected("contacts") && parts.length < 2) {
      const count = typeof contactsSource.recordCount === "number" ? contactsSource.recordCount : 0;
      parts.push(`${count} CRM`);
    }

    if (parts.length > 0) {
      return `Connected to workspace: ${parts.join(", ")}`;
    }

    const totalActive =
      connectedSourceIds !== undefined
        ? connectedSourceIds.length
        : sources.filter((s) => s.enabled).length;

    if (totalActive === 0) {
      return "No sources connected";
    }

    return "Connected to workspace";
  }, [sources, connectedSourceIds]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 w-full items-center justify-between bg-background/80 px-3 backdrop-blur-xl md:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && onBack ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer md:hidden"
            title="Back to chats"
          >
            <ChevronLeftIcon size={16} className="size-4" />
            <span className="sr-only">Back to chats</span>
          </motion.button>
        ) : onToggleSidebar ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebar}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
            title="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </motion.button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center ml-auto">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onOpenDrawer}
          className="flex min-w-0 items-center gap-2 rounded-xl border-0 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:scale-95 cursor-pointer"
          title="Manage workspace connections"
        >
          <DatabaseBackupIcon size={14} className="size-3.5 shrink-0 text-muted-foreground inline-flex" />
          <span className="hidden min-w-0 max-w-[200px] truncate sm:inline md:max-w-[320px] text-xs">{summaryText}</span>
          <span className="min-w-0 max-w-[140px] truncate sm:hidden text-xs">{summaryText}</span>
          <ChevronRightIcon size={14} className="size-3.5 shrink-0 text-muted-foreground" />
        </motion.button>
      </div>
    </header>
  );
}

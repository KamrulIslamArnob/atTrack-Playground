"use client";

import { formatDistanceToNow } from "date-fns";
import { motion, useReducedMotion } from "motion/react";
import {
  Building2,
  Tag,
} from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { Link2Icon } from "@/components/ui/link-2";
import { SparklesIcon } from "@/components/ui/sparkles";
import { HourglassIcon } from "@/components/ui/hourglass";
import { CalendarClockIcon } from "@/components/ui/calendar-clock";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  matchScoreBand,
  getEffectiveDeadlineInfo,
  type BoardCard,
  type BoardList,
} from "@/lib/types/board";
import { JOB_TIERS } from "@/lib/types/job";
import { CompanyLogo } from "@/components/company-logo";
import { cn, parseLocalDate } from "@/lib/utils";

interface BoardCardProps {
  card: BoardCard;
  lists: BoardList[];
  accent: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveTo?: (listId: string) => void;
  onOpen: () => void;
}

export function BoardCardItem({
  card,
  lists,
  accent: _accent,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveTo: _onMoveTo,
  onOpen,
}: BoardCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const band = card.match_score !== null ? matchScoreBand(card.match_score) : null;
  const linkCount = card.project_links?.length ?? 0;
  const deadlineInfo = getEffectiveDeadlineInfo(card, lists);

  const isInactive = card.state === "archived" || card.state === "on_hold";

  return (
    <motion.div
      layout={!isDragging && !shouldReduceMotion}
      initial={shouldReduceMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: isDragging ? 0.35 : 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.15 }}
      draggable
      onDragStartCapture={(e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEndCapture={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-colors duration-150",
        "hover:border-border focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none",
        isInactive &&
          "grayscale contrast-90 opacity-75 hover:grayscale-0 hover:opacity-100 transition-all duration-200"
      )}
    >
      {/* Top Section Deadline / Job Deadline Banner covering the whole top */}
      {deadlineInfo && (
        <div
          className={cn(
            "-mx-3.5 -mt-3.5 mb-2.5 flex items-center justify-between px-3.5 py-1.5 text-xs font-semibold tracking-tight transition-colors",
            deadlineInfo.bannerClassName
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {deadlineInfo.kind === "milestone" ? (
              <HourglassIcon
                size={14}
                className="size-3.5 shrink-0 text-purple-600 dark:text-purple-400"
                aria-hidden="true"
              />
            ) : (
              <CalendarClockIcon
                size={14}
                className="size-3.5 shrink-0 text-current"
                aria-hidden="true"
              />
            )}
            <span className="truncate text-xs font-semibold tracking-tight">
              {deadlineInfo.title}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              deadlineInfo.badgeClassName
            )}
          >
            {deadlineInfo.label}
          </span>
        </div>
      )}

      {/* Card Title & Priority Tier */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors flex-1 min-w-0">
          {card.title}
        </p>
        {card.tier && JOB_TIERS[card.tier] && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-tight shadow-2xs",
              JOB_TIERS[card.tier].badgeClass
            )}
            title={`${JOB_TIERS[card.tier].label} · ${JOB_TIERS[card.tier].description}`}
          >
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: JOB_TIERS[card.tier].dotColor }}
            />
            {JOB_TIERS[card.tier].label}
          </span>
        )}
      </div>

      {/* Company Name & Metadata Tags */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground/80">
          <CompanyLogo
            name={card.company_name}
            website={card.company_website}
            logoUrl={card.company_logo_url}
            color={card.company_color}
            className="size-4 rounded-sm"
            iconClassName="size-2.5"
            fallback="initial"
          />
          <span className="truncate">{card.company_name ?? "Unknown company"}</span>
        </span>
        {card.position_name && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Tag className="size-3" aria-hidden="true" />
            <span className="truncate max-w-[7rem]">{card.position_name}</span>
          </span>
        )}
        {card.resume_name && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <FileTextIcon size={12} className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-[7rem]">{card.resume_name}</span>
          </span>
        )}
        {linkCount > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-help">
                <Link2Icon size={12} className="size-3 shrink-0" aria-hidden="true" />
                <span>{linkCount}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-medium py-1 px-2">
              {linkCount} attached project link{linkCount === 1 ? "" : "s"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Footer: Date / Time ago & Score Badge */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="tabular-nums whitespace-nowrap">
            {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
          </span>

          {!deadlineInfo && card.deadline && (() => {
            const norm = card.deadline.trim().toLowerCase();
            const isAsap = norm === "asap";
            const isUnknown = norm === "unknown";
            const parsed = (!isAsap && !isUnknown) ? parseLocalDate(card.deadline) : null;
            const valid = parsed && !isNaN(parsed.getTime());
            const shortLabel = isAsap ? "ASAP" : isUnknown ? "Unknown" : valid ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : card.deadline;
            const fullLabel = isAsap ? "Apply ASAP" : isUnknown ? "Unknown Deadline" : valid ? `Deadline: ${parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : card.deadline;

            return (
              <Tooltip>
                <TooltipTrigger>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-help",
                      isAsap ? "text-destructive font-semibold" : "hover:text-foreground transition-colors"
                    )}
                  >
                    <span className="opacity-40">·</span>
                    <CalendarClockIcon size={12} className="size-3 shrink-0" aria-hidden="true" />
                    {shortLabel}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-medium py-1 px-2">
                  {fullLabel}
                </TooltipContent>
              </Tooltip>
            );
          })()}
        </div>

        {band && (
          <div className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn(
                    "inline-flex items-stretch overflow-hidden rounded-full border text-[10px] font-semibold tracking-tight shadow-2xs whitespace-nowrap shrink-0 cursor-help",
                    band.borderClass
                  )}
                >
                  <span
                    className={cn(
                      "px-2 py-0.5 font-semibold transition-colors",
                      band.labelBgClass,
                      band.labelColorClass
                    )}
                  >
                    {band.label}
                  </span>
                  <span className="flex items-center justify-center bg-white dark:bg-card px-1.5 py-0.5 font-bold tabular-nums text-foreground border-l border-inherit">
                    {Math.round(card.match_score!)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-2.5 text-left">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <SparklesIcon size={14} className="size-3.5 text-warning" />
                  <span>Match Score: {Math.round(card.match_score!)}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Evaluated resume relevance for {card.company_name ?? "this position"}.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </motion.div>
  );
}

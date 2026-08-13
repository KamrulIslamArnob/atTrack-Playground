"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  CalendarClock,
  FileText,
  Link2,
  MoveRight,
  Tag,
  Sparkles,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { updateJobState } from "@/lib/actions/jobs";
import type { JobState } from "@/lib/types/job";
import {
  matchScoreBand,
  getEffectiveDeadlineInfo,
  type BoardCard,
  type BoardList,
} from "@/lib/types/board";
import { cn } from "@/lib/utils";

interface BoardCardProps {
  card: BoardCard;
  lists: BoardList[];
  accent: string;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMoveTo: (listId: string) => void;
  onOpen: () => void;
}

export function BoardCardItem({
  card,
  lists,
  accent,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveTo,
  onOpen,
}: BoardCardProps) {
  const router = useRouter();
  const band = matchScoreBand(card.match_score);
  const linkCount = card.project_links?.length ?? 0;
  const deadlineInfo = getEffectiveDeadlineInfo(card, lists);

  const handleStateChange = async (newState: JobState) => {
    if (card.state === newState) return;
    try {
      await updateJobState(card.id, newState);
      const labelMap: Record<JobState, string> = {
        active: "Active",
        on_hold: "On Hold",
        archived: "Archived",
      };
      toast.success(`Job state changed to ${labelMap[newState]}`);
    } catch (err) {
      console.error("Failed to update job state:", err);
      toast.error("Failed to update job state.");
    }
  };

  const isInactive = card.state === "archived" || card.state === "on_hold";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{ borderLeftColor: accent }}
      className={cn(
        "group cursor-grab rounded-2xl border border-l-4 border-border bg-card p-3 transition-[border-color,box-shadow,transform] duration-160 ease-out active:scale-[0.98] active:cursor-grabbing [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-md overflow-hidden",
        "hover:border-primary/60 focus-within:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        isDragging && "opacity-40",
        isInactive &&
          "grayscale contrast-90 opacity-75 [@media(hover:hover)]:hover:grayscale-0 [@media(hover:hover)]:hover:opacity-100 transition-all duration-300"
      )}
    >
      {/* Top Section Deadline / Job Deadline Banner */}
      {deadlineInfo && (
        <div
          className={cn(
            "-mx-3 -mt-3 mb-2.5 flex items-center justify-between border-b px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-colors",
            deadlineInfo.bannerClassName
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate text-[11px] font-semibold tracking-tight">
              {deadlineInfo.title}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              deadlineInfo.badgeClassName
            )}
          >
            {deadlineInfo.label}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-1.5">
        <p className="flex-1 min-w-0 text-sm font-semibold leading-tight break-words">{card.title}</p>

        {/* The whole card opens the sheet — stop this menu's click from bubbling
            up to that onClick before it navigates the dropdown. */}
        <div onClick={(e) => e.stopPropagation()}>
          <MoveToMenu
            lists={lists}
            currentListId={card.list_id}
            onMoveTo={onMoveTo}
            renderTrigger={
              <button
                aria-label={`Move ${card.title} to another list`}
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary group-hover:opacity-100"
              />
            }
            extraItems={
              <>
                <DropdownMenuItem onClick={() => router.push(`/jobs/${card.id}`)}>
                  Open job details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Change state</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      disabled={!card.state || card.state === "active"}
                      onClick={() => handleStateChange("active")}
                    >
                      🟢 Active
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={card.state === "on_hold"}
                      onClick={() => handleStateChange("on_hold")}
                    >
                      ⏸️ On Hold
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={card.state === "archived"}
                      onClick={() => handleStateChange("archived")}
                    >
                      📦 Archive
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            }
          >
            <MoveRight className="size-3.5" />
          </MoveToMenu>
        </div>
      </div>

      {/* Company + tags share one row — cuts a full line versus stacking them. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <Building2 className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{card.company_name ?? "Unknown company"}</span>
        </span>
        {card.position_name && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium">
            <Tag className="size-2.5" aria-hidden="true" />
            {card.position_name}
          </span>
        )}
        {card.resume_name && (
          <span className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium">
            <FileText className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.resume_name}</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
        </span>

        <div className="flex flex-wrap items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
          {linkCount > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground whitespace-nowrap shrink-0 cursor-help">
                  <Link2 className="size-3 shrink-0" aria-hidden="true" />
                  {linkCount}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                {linkCount} attached project link{linkCount === 1 ? "" : "s"}
              </TooltipContent>
            </Tooltip>
          )}

          {card.deadline && (
            <Tooltip>
              <TooltipTrigger>
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground whitespace-nowrap shrink-0 cursor-help">
                  <CalendarClock className="size-3 shrink-0" aria-hidden="true" />
                  {new Date(card.deadline).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
                Deadline: {new Date(card.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </TooltipContent>
            </Tooltip>
          )}

          {band && (
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums whitespace-nowrap shrink-0 cursor-help",
                    band.className
                  )}
                >
                  {band.label} {Math.round(card.match_score!)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-2.5 text-left">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Match Score: {Math.round(card.match_score!)}%</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                  Evaluated resume relevance for {card.company_name ?? "this position"}.
                </p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

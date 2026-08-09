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
} from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoveToMenu } from "@/components/board/move-to-menu";
import { matchScoreBand, type BoardCard, type BoardList } from "@/lib/types/board";
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
        "group cursor-grab rounded-2xl border border-l-4 border-border bg-card p-3 transition-shadow duration-200",
        "hover:border-primary/60 focus-within:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="flex-1 text-sm font-semibold leading-tight">{card.title}</p>

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
              <DropdownMenuItem onClick={() => router.push(`/jobs/${card.id}`)}>
                Open job details
              </DropdownMenuItem>
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

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}
        </span>

        <div className="flex items-center gap-1.5">
          {linkCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title={`${linkCount} project link${linkCount === 1 ? "" : "s"}`}
            >
              <Link2 className="size-3" aria-hidden="true" />
              {linkCount}
            </span>
          )}
          {card.deadline && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title={`Deadline ${new Date(card.deadline).toLocaleDateString()}`}
            >
              <CalendarClock className="size-3" aria-hidden="true" />
              {new Date(card.deadline).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {band && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums",
                band.className
              )}
            >
              {band.label} {Math.round(card.match_score!)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

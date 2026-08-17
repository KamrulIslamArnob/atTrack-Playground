"use client";

import { Fragment, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  Briefcase,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  Trash2,
  Trophy,
} from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { ClockIcon } from "@/components/ui/clock";
import { HeartIcon } from "@/components/ui/heart";
import { WrenchIcon } from "@/components/ui/wrench";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BoardCardItem } from "@/components/board/board-card";
import {
  DEFAULT_LIST_COLORS,
  type BoardCard,
  type BoardList,
  type ListKind,
} from "@/lib/types/board";
import { cn } from "@/lib/utils";

const LIST_KIND_ICONS: Record<ListKind, React.ComponentType<{ className?: string }>> = {
  wishlist: HeartIcon,
  preparing: WrenchIcon,
  applied: Briefcase,
  interview: Briefcase,
  offer: Trophy,
  accepted: CheckIcon,
  rejected: ThumbsDown,
  custom: Briefcase,
};

const LIST_KIND_TEXT_COLORS: Record<ListKind, string> = {
  wishlist: "text-sky-800 dark:text-sky-400",
  preparing: "text-amber-800 dark:text-amber-400",
  applied: "text-purple-800 dark:text-purple-400",
  interview: "text-lime-900 dark:text-lime-400",
  offer: "text-teal-800 dark:text-teal-400",
  accepted: "text-emerald-800 dark:text-emerald-400",
  rejected: "text-rose-800 dark:text-rose-400",
  custom: "text-sky-800 dark:text-sky-400",
};

export type GroupOption = "none" | "company" | "position" | "resume";

const GROUP_FIELD: Record<Exclude<GroupOption, "none">, keyof BoardCard> = {
  company: "company_name",
  position: "position_name",
  resume: "resume_name",
};

const GROUP_FALLBACK: Record<Exclude<GroupOption, "none">, string> = {
  company: "No company",
  position: "No position",
  resume: "No resume",
};

function groupCards(cards: BoardCard[], groupBy: Exclude<GroupOption, "none">) {
  const field = GROUP_FIELD[groupBy];
  const fallback = GROUP_FALLBACK[groupBy];
  const groups = new Map<string, BoardCard[]>();
  for (const card of cards) {
    const key = (card[field] as string | null) || fallback;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === fallback) return 1;
    if (b === fallback) return -1;
    return a.localeCompare(b);
  });
}

interface BoardColumnProps {
  list: BoardList;
  lists: BoardList[];
  cards: BoardCard[];
  groupBy: GroupOption;
  draggingId: string | null;
  isDropTarget: boolean;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDropColumn: () => void;
  onMoveCard: (jobId: string, listId: string) => void;
  onOpenCard: (jobId: string) => void;
  onAddJob: (listId: string) => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
  onPanStart: (pointerId: number, clientX: number) => void;
  onPanMove: (pointerId: number, clientX: number) => void;
  onPanEnd: (pointerId: number) => void;
  isListDragging: boolean;
  isListDropTarget: boolean;
  onListDragStart: () => void;
  onListDragEnd: () => void;
  onListDragOverColumn: () => void;
  onListDragLeaveColumn: () => void;
  onListDropColumn: () => void;
}

const LIST_DRAG_TYPE = "application/x-board-list";

export function BoardColumn({
  list,
  lists,
  cards,
  groupBy,
  draggingId,
  isDropTarget,
  onDragStartCard,
  onDragEndCard,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropColumn,
  onMoveCard,
  onOpenCard,
  onAddJob,
  onRename,
  onDelete,
  onPanStart,
  onPanMove,
  onPanEnd,
  isListDragging,
  isListDropTarget,
  onListDragStart,
  onListDragEnd,
  onListDragOverColumn,
  onListDragLeaveColumn,
  onListDropColumn,
}: BoardColumnProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(list.name);
  const [onHoldOpen, setOnHoldOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const activeCards = cards.filter((c) => !c.state || c.state === "active");
  const onHoldCards = cards.filter((c) => c.state === "on_hold");
  const archivedCards = cards.filter((c) => c.state === "archived");
  const hasInactiveCards = onHoldCards.length > 0 || archivedCards.length > 0;

  const Icon = LIST_KIND_ICONS[list.kind] ?? Briefcase;
  const accent = DEFAULT_LIST_COLORS[list.kind] ?? list.color ?? "var(--primary)";

  const submitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== list.name) onRename(list.id, trimmed);
    setRenaming(false);
  };

  const renderCardItems = (items: BoardCard[]) => {
    if (groupBy === "none") {
      return (
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((card) => (
            <BoardCardItem
              key={card.id}
              card={card}
              lists={lists}
              accent={accent}
              isDragging={draggingId === card.id}
              onDragStart={() => onDragStartCard(card.id)}
              onDragEnd={onDragEndCard}
              onMoveTo={(listId) => onMoveCard(card.id, listId)}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </AnimatePresence>
      );
    }

    return groupCards(items, groupBy).map(([label, groupedCards]) => (
      <div key={label} className="space-y-1.5">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="tabular-nums font-semibold">{groupedCards.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {groupedCards.map((card) => (
              <BoardCardItem
                key={card.id}
                card={card}
                lists={lists}
                accent={accent}
                isDragging={draggingId === card.id}
                onDragStart={() => onDragStartCard(card.id)}
                onDragEnd={onDragEndCard}
                onMoveTo={(listId) => onMoveCard(card.id, listId)}
                onOpen={() => onOpenCard(card.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    ));
  };

  return (
    <section
      aria-label={`${list.name}, ${cards.length} ${cards.length === 1 ? "job" : "jobs"}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (e.dataTransfer.types.includes(LIST_DRAG_TYPE)) {
          onListDragOverColumn();
        } else {
          onDragOverColumn();
        }
      }}
      onDragLeave={() => {
        onDragLeaveColumn();
        onListDragLeaveColumn();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes(LIST_DRAG_TYPE)) {
          onListDropColumn();
        } else {
          onDropColumn();
        }
      }}
      className={cn(
        "flex min-w-[270px] w-[270px] shrink-0 self-stretch flex-col rounded-2xl p-2.5 transition-all duration-200 min-h-[420px]",
        (isDropTarget || isListDropTarget) && "ring-2 ring-primary/60 bg-primary/10",
        isListDragging && "opacity-40"
      )}
      style={{
        backgroundColor: list.kind === "interview" ? "#bef26425" : `${accent}14`,
      }}
    >
      {/* Column Header */}
      <header
        className="mb-2 flex items-center gap-1.5 rounded-xl border p-1.5 transition-all shrink-0"
        style={{
          backgroundColor: list.kind === "interview" ? "#bef26470" : `${accent}25`,
          borderColor: list.kind === "interview" ? "#84cc16" : `${accent}45`,
        }}
      >
        {/* Column reorder handle */}
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(LIST_DRAG_TYPE, list.id);
            e.dataTransfer.effectAllowed = "move";
            onListDragStart();
          }}
          onDragEnd={onListDragEnd}
          role="button"
          tabIndex={-1}
          aria-label={`Drag to reorder ${list.name}`}
          className="flex size-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </span>

        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full",
            LIST_KIND_TEXT_COLORS[list.kind] ?? "text-foreground"
          )}
          style={{
            backgroundColor: list.kind === "interview" ? "#bef264" : `${accent}35`,
          }}
        >
          <Icon className="size-3" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          {renaming ? (
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setDraftName(list.name);
                  setRenaming(false);
                }
              }}
              aria-label="List name"
              className="h-7 text-xs"
            />
          ) : (
            <div
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onPanStart(e.pointerId, e.clientX);
              }}
              onPointerMove={(e) => onPanMove(e.pointerId, e.clientX)}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                onPanEnd(e.pointerId);
              }}
              onPointerCancel={(e) => onPanEnd(e.pointerId)}
              className="touch-none cursor-grab select-none active:cursor-grabbing"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <h2
                  className={cn(
                    "flex items-baseline gap-1.5 truncate text-xs font-bold uppercase tracking-wider",
                    LIST_KIND_TEXT_COLORS[list.kind] ?? "text-foreground"
                  )}
                >
                  <span className="truncate">{list.name}</span>
                  <span className="shrink-0 text-[10px] font-bold normal-case tabular-nums opacity-90">
                    {cards.length}
                  </span>
                </h2>
              </div>
            </div>
          )}
        </div>

        {list.kind === "wishlist" && !renaming && (
          <button
            type="button"
            onClick={() => onAddJob(list.id)}
            aria-label="Add job to Wishlist"
            className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer active:scale-95"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        )}

        {list.kind === "custom" && !renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${list.name} list options`}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer active:scale-95"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil className="mr-2 size-3.5" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(list.id)}>
                <Trash2 className="mr-2 size-3.5" /> Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Column Content */}
      <div className="flex flex-1 flex-col gap-2">
        {renderCardItems(activeCards)}

        {activeCards.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {list.kind === "wishlist" ? "Save a job here" : "Drag a card here"}
          </p>
        )}

        {hasInactiveCards && (
          <div className="my-2 border-t border-dashed border-border/50" />
        )}

        {onHoldCards.length > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setOnHoldOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-95 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                <span>On Hold ({onHoldCards.length})</span>
              </div>
              {onHoldOpen ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {onHoldOpen && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  {renderCardItems(onHoldCards)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {archivedCards.length > 0 && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setArchivedOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-95 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Archive className="size-3.5" />
                <span>Archived ({archivedCards.length})</span>
              </div>
              {archivedOpen ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {archivedOpen && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  {renderCardItems(archivedCards)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  Archive,
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  Heart,
  MoreHorizontal,
  Pencil,
  Plus,
  ThumbsDown,
  Trash2,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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

const LIST_KIND_ICONS: Record<ListKind, LucideIcon> = {
  wishlist: Heart,
  preparing: Wrench,
  applied: Briefcase,
  interview: Briefcase,
  offer: Trophy,
  accepted: Check,
  rejected: ThumbsDown,
  custom: Briefcase,
};

// Very-light per-lane tints so columns read apart at a glance. Interview keeps
// its own "hot" gradient wash (below) instead of a static entry here.
const LIST_KIND_BG: Partial<Record<ListKind, string>> = {
  wishlist: "bg-white dark:bg-card/40",
  preparing: "bg-amber-50/70 dark:bg-amber-950/20",
  applied: "bg-purple-50/70 dark:bg-purple-950/20",
  interview: "bg-lime-100/90 dark:bg-lime-950/30 border-lime-400/80 dark:border-lime-500/40",
  offer: "bg-teal-50/80 dark:bg-teal-950/20 border-teal-300/80 dark:border-teal-500/30",
};

const LIST_KIND_TEXT_COLORS: Record<ListKind, string> = {
  wishlist: "text-sky-800 dark:text-sky-400",
  preparing: "text-amber-800 dark:text-amber-400",
  applied: "text-purple-800 dark:text-purple-400",
  interview: "text-lime-900 dark:text-lime-400",
  offer: "text-teal-800 dark:text-teal-400",
  accepted: "text-emerald-800 dark:text-emerald-400",
  rejected: "text-red-800 dark:text-red-400",
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

// Cards keep whatever order the caller already sorted them in — grouping only
// clusters them, sorted A–Z by group label with the fallback bucket last.
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

// Custom drag MIME type that marks "this drag is a column reorder, not a card
// move" — checked via dataTransfer.types (readable during dragover, unlike
// getData) so one shared onDragOver/onDrop pair can route to either handler.
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

  const activeCards = cards.filter((c) => !c.state || c.state === "active");
  const onHoldCards = cards.filter((c) => c.state === "on_hold");
  const archivedCards = cards.filter((c) => c.state === "archived");
  const hasInactiveCards = onHoldCards.length > 0 || archivedCards.length > 0;

  const Icon = LIST_KIND_ICONS[list.kind] ?? Briefcase;
  const accent = DEFAULT_LIST_COLORS[list.kind] ?? list.color ?? "#84cc16";
  // Interview lane gets a brand-tinted wash once it's carrying jobs — a quiet
  // "these are hot" signal, not present on any other lane.
  const isHot = list.kind === "interview" && cards.length > 0;

  const submitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== list.name) onRename(list.id, trimmed);
    setRenaming(false);
  };

  const renderCardItems = (items: BoardCard[]) => {
    if (groupBy === "none") {
      return items.map((card) => (
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
      ));
    }

    return groupCards(items, groupBy).map(([label, groupedCards]) => (
      <div key={label}>
        <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className="tabular-nums">{groupedCards.length}</span>
        </div>
        <div className="flex flex-col gap-1.5">
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
        // Dashed outline gives every column its own visible compartment instead of
        // relying on whitespace alone — "separation" the flex gap couldn't carry
        // on its own once boards had 6+ columns side by side.
        "flex min-h-40 min-w-[240px] flex-1 basis-0 flex-col rounded-2xl border border-dashed border-border/70 p-1.5 transition-colors duration-200",
        LIST_KIND_BG[list.kind] ?? "bg-card/40",
        isHot && !isDropTarget && "border-primary/25 bg-gradient-brand-tint",
        (isDropTarget || isListDropTarget) && "border-solid border-primary/50 bg-primary/5",
        isListDragging && "opacity-40"
      )}
    >
      {/* Boxed and accent-tinted so the header reads as its own block, separated
          from the column body below it, instead of just floating text. */}
      <header
        className="mb-1.5 flex items-center gap-1.5 rounded-xl border p-1.5 transition-all shadow-xs"
        style={{
          backgroundColor: list.kind === "interview" ? "#bef26470" : `${accent}25`,
          borderColor: list.kind === "interview" ? "#84cc16" : `${accent}45`,
        }}
      >
        {/* Column reorder handle — separate from the title's pointer-pan drag
            below so the two gestures never fight over the same pointerdown. */}
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
            "flex size-5 shrink-0 items-center justify-center rounded-full shadow-xs",
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
            // Pointer-drag pans the board via the parent's scrollLeft — an
            // alternative to the hidden scrollbar. Pointer capture keeps
            // move/up events firing here even once the cursor leaves the div.
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

        {/* Every other list is a travel-through stage reached by dragging/moving a
            card — only Wishlist creates new jobs, so only it gets the affordance,
            compact inline instead of its own button row. */}
        {list.kind === "wishlist" && !renaming && (
          <button
            type="button"
            onClick={() => onAddJob(list.id)}
            aria-label="Add job to Wishlist"
            className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        )}

        {list.kind === "custom" && !renaming && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${list.name} list options`}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

      <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
        {renderCardItems(activeCards)}

        {activeCards.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {list.kind === "wishlist" ? "Save a job here" : "Drag a card here"}
          </p>
        )}

        {hasInactiveCards && (
          <div className="my-2.5 border-t border-dashed border-border/50" />
        )}

        {onHoldCards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setOnHoldOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>On Hold ({onHoldCards.length})</span>
              </div>
              {onHoldOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
            {onHoldOpen && (
              <div className="flex flex-col gap-1.5">
                {renderCardItems(onHoldCards)}
              </div>
            )}
          </div>
        )}

        {archivedCards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setArchivedOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <div className="flex items-center gap-1.5">
                <Archive className="size-3.5" />
                <span>Archived Jobs ({archivedCards.length})</span>
              </div>
              {archivedOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
            {archivedOpen && (
              <div className="flex flex-col gap-1.5">
                {renderCardItems(archivedCards)}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}


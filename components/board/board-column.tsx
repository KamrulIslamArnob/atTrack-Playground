"use client";

import { useState } from "react";
import {
  Briefcase,
  Check,
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
  preparing: "bg-orange-50/70 dark:bg-orange-950/20",
  applied: "bg-purple-50/70 dark:bg-purple-950/20",
  offer: "bg-emerald-50/70 dark:bg-emerald-950/20",
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

  const Icon = LIST_KIND_ICONS[list.kind] ?? Briefcase;
  const accent = list.color ?? DEFAULT_LIST_COLORS[list.kind];
  // Interview lane gets a brand-tinted wash once it's carrying jobs — a quiet
  // "these are hot" signal, not present on any other lane.
  const isHot = list.kind === "interview" && cards.length > 0;

  const submitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== list.name) onRename(list.id, trimmed);
    setRenaming(false);
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
          backgroundColor: `${accent}25`,
          borderColor: `${accent}45`,
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
          className="flex size-5 shrink-0 items-center justify-center rounded-full shadow-xs"
          style={{ backgroundColor: `${accent}35`, color: accent }}
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
              <h2 className="flex items-baseline gap-1.5 truncate text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                <span className="truncate">{list.name}</span>
                <span className="shrink-0 text-[10px] font-bold normal-case tabular-nums opacity-90" style={{ color: accent }}>
                  {cards.length}
                </span>
              </h2>
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
        {groupBy === "none"
          ? cards.map((card) => (
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
            ))
          : groupCards(cards, groupBy).map(([label, groupedCards]) => (
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
            ))}

        {cards.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {list.kind === "wishlist" ? "Save a job here" : "Drag a card here"}
          </p>
        )}
      </div>
    </section>
  );
}

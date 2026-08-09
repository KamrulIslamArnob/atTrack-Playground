"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddJobDialog } from "@/components/add-job-dialog";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ImportChoice } from "@/components/import-choice";
import { BoardColumn, type GroupOption } from "@/components/board/board-column";
import { JobDetailSheet } from "@/components/job-detail/job-detail-sheet";
import {
  createList,
  deleteList,
  moveCard,
  renameList,
  reorderLists,
} from "@/lib/actions/board";
import type { BoardCard, BoardList } from "@/lib/types/board";

interface BoardViewProps {
  lists: BoardList[];
  cards: BoardCard[];
}

type SortOption = "recent" | "fit" | "deadline" | "title" | "company" | "oldest";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recent",
  fit: "Fit score",
  deadline: "Deadline",
  title: "Title (A–Z)",
  company: "Company (A–Z)",
  oldest: "Oldest first",
};

const GROUP_LABELS: Record<GroupOption, string> = {
  none: "None",
  company: "Company",
  position: "Position",
  resume: "Resume",
};

export function BoardView({ lists, cards }: BoardViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // A drag paints immediately, then React discards the optimistic layer when the
  // transition settles — reverting on failure and picking up server truth on
  // success without mirroring props into state.
  const [optimisticCards, applyMove] = useOptimistic(
    cards,
    (state: BoardCard[], move: { jobId: string; listId: string }) =>
      state.map((c) => (c.id === move.jobId ? { ...c, list_id: move.listId } : c))
  );

  // Same optimistic-then-reconcile pattern as card moves, keyed by the full
  // ordered id list rather than a single field.
  const [optimisticLists, applyReorder] = useOptimistic(
    lists,
    (state: BoardList[], orderedIds: string[]) =>
      orderedIds.map((id) => state.find((l) => l.id === id)).filter((l): l is BoardList => !!l)
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [listDropTarget, setListDropTarget] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addJobListId, setAddJobListId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // Client-only, not persisted. "recent" is each list's own drag order
  // (board_position, already how cards arrive) — every other option re-sorts.
  const [sort, setSort] = useState<SortOption>("recent");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");

  const sortedCards = (() => {
    switch (sort) {
      case "fit":
        return [...optimisticCards].sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
      case "deadline":
        return [...optimisticCards].sort((a, b) => {
          if (!a.deadline) return b.deadline ? 1 : 0;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
      case "title":
        return [...optimisticCards].sort((a, b) => a.title.localeCompare(b.title));
      case "company":
        return [...optimisticCards].sort((a, b) =>
          (a.company_name ?? "").localeCompare(b.company_name ?? "")
        );
      case "oldest":
        return [...optimisticCards].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case "recent":
      default:
        return optimisticCards;
    }
  })();

  // Horizontal panning + edge affordances for once the board overflows
  // (the scrollbar itself is hidden via .no-scrollbar).
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(
    null
  );
  const [canScroll, setCanScroll] = useState(false);
  const COLUMN_SCROLL_WIDTH = 260;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => setCanScroll(el.scrollWidth > el.clientWidth + 1);
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lists.length]);

  // Guard every handler on the pointerId captured at drag start — with two
  // simultaneous touch points, a second pointer's move/up must not touch the
  // first pointer's pan baseline.
  const handlePanStart = (pointerId: number, clientX: number) => {
    if (!scrollRef.current) return;
    panRef.current = { pointerId, startX: clientX, startScrollLeft: scrollRef.current.scrollLeft };
  };
  const handlePanMove = (pointerId: number, clientX: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId || !scrollRef.current) return;
    scrollRef.current.scrollLeft = panRef.current.startScrollLeft - (clientX - panRef.current.startX);
  };
  const handlePanEnd = (pointerId: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId) return;
    panRef.current = null;
  };

  const handleMove = (jobId: string, listId: string) => {
    const card = optimisticCards.find((c) => c.id === jobId);
    if (!card || card.list_id === listId) return;

    const targetIndex = optimisticCards.filter((c) => c.list_id === listId).length;

    startTransition(async () => {
      applyMove({ jobId, listId });
      try {
        await moveCard(jobId, listId, targetIndex);
        router.refresh();
      } catch {
        toast.error("Could not move that card", {
          description: "Your change was reverted. Please try again.",
        });
      }
    });
  };

  // targetId null = drop past the last column (the "Add list" slot).
  const handleReorderList = (draggedId: string, targetId: string | null) => {
    if (draggedId === targetId) return;
    const ids = optimisticLists.map((l) => l.id).filter((id) => id !== draggedId);
    const insertAt = targetId ? ids.indexOf(targetId) : ids.length;
    if (insertAt === -1) return;
    ids.splice(insertAt, 0, draggedId);

    startTransition(async () => {
      applyReorder(ids);
      try {
        await reorderLists(ids);
        router.refresh();
      } catch {
        toast.error("Could not reorder that list");
      }
    });
  };

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) {
      setAddingList(false);
      return;
    }
    setNewListName("");
    setAddingList(false);
    startTransition(async () => {
      try {
        await createList(name);
        router.refresh();
      } catch {
        toast.error("Could not create that list");
      }
    });
  };

  const handleRenameList = (listId: string, name: string) => {
    startTransition(async () => {
      try {
        await renameList(listId, name);
        router.refresh();
      } catch {
        toast.error("Could not rename that list");
      }
    });
  };

  const handleDeleteList = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    const count = optimisticCards.filter((c) => c.list_id === listId).length;
    const message = count
      ? `Delete "${list?.name}"? Its ${count} job${count === 1 ? "" : "s"} will move to Wishlist.`
      : `Delete "${list?.name}"?`;

    if (!window.confirm(message)) return;

    startTransition(async () => {
      try {
        await deleteList(listId);
        router.refresh();
        toast.success("List deleted");
      } catch {
        toast.error("Could not delete that list");
      }
    });
  };

  return (
    <>
      {/* One row: breadcrumb on the left, group/sort/pager/Add Job on the right — the
          reference board keeps these together instead of a standalone breadcrumb
          row plus a separate pager row. Bordered like every other page's header,
          just carrying the toolbar instead of the title block. */}
      <div className="-mx-6 mb-4 flex items-center gap-3 border-b border-border px-6 pb-4">
        <Breadcrumbs />
        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 h-7 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground sm:inline-flex">
            <Layers className="size-3.5" aria-hidden="true" />
            Group: <span className="text-foreground">{GROUP_LABELS[groupBy]}</span>
            <ChevronDown className="size-3" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as GroupOption)}
            >
              {Object.entries(GROUP_LABELS).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground">
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            Sort: <span className="text-foreground">{SORT_LABELS[sort]}</span>
            <ChevronDown className="size-3" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Pager sits in this row, not floating over a column's own header — that
            collided with its title/count text once boards had 6+ columns. */}
        {canScroll && (
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <button
              type="button"
              aria-label="Scroll board left"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: -COLUMN_SCROLL_WIDTH, behavior: "smooth" })
              }
              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <span className="w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              aria-label="Scroll board right"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: COLUMN_SCROLL_WIDTH, behavior: "smooth" })
              }
              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <ImportChoice />
      </div>

      {/* The board owns its horizontal scroll; the dashboard <main> only scrolls vertically. */}
      <div ref={scrollRef} className="no-scrollbar -mx-6 overflow-x-auto px-6 pb-4">
          <div className="flex items-start gap-3">
            {optimisticLists.map((list) => (
              <Fragment key={list.id}>
              <BoardColumn
                list={list}
                lists={optimisticLists}
                cards={sortedCards.filter((c) => c.list_id === list.id)}
                groupBy={groupBy}
                draggingId={draggingId}
                isDropTarget={dropTarget === list.id && draggingId !== null}
                onDragStartCard={setDraggingId}
                onDragEndCard={() => {
                  setDraggingId(null);
                  setDropTarget(null);
                }}
                onDragOverColumn={() => setDropTarget(list.id)}
                onDragLeaveColumn={() =>
                  setDropTarget((cur) => (cur === list.id ? null : cur))
                }
                onDropColumn={() => {
                  if (draggingId) handleMove(draggingId, list.id);
                  setDraggingId(null);
                  setDropTarget(null);
                }}
                onMoveCard={handleMove}
                onOpenCard={setOpenJobId}
                onAddJob={setAddJobListId}
                onRename={handleRenameList}
                onDelete={handleDeleteList}
                onPanStart={handlePanStart}
                onPanMove={handlePanMove}
                onPanEnd={handlePanEnd}
                isListDragging={draggingListId === list.id}
                isListDropTarget={listDropTarget === list.id && draggingListId !== null}
                onListDragStart={() => setDraggingListId(list.id)}
                onListDragEnd={() => {
                  setDraggingListId(null);
                  setListDropTarget(null);
                }}
                onListDragOverColumn={() => setListDropTarget(list.id)}
                onListDragLeaveColumn={() =>
                  setListDropTarget((cur) => (cur === list.id ? null : cur))
                }
                onListDropColumn={() => {
                  if (draggingListId) handleReorderList(draggingListId, list.id);
                  setDraggingListId(null);
                  setListDropTarget(null);
                }}
              />
              {/* Dotted rung between each column, and before "Add list" — matches the
                  row's tallest column since self-stretch ignores the parent's
                  items-start on the flex cross axis. */}
              <span
                aria-hidden="true"
                className="w-px shrink-0 self-stretch border-l-2 border-dotted border-border"
              />
              </Fragment>
            ))}

            {/* Add list — also the drop target for "move this column to the end". */}
            <div
              className="min-w-[240px] flex-1 basis-0"
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("application/x-board-list")) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes("application/x-board-list")) return;
                e.preventDefault();
                if (draggingListId) handleReorderList(draggingListId, null);
                setDraggingListId(null);
                setListDropTarget(null);
              }}
            >
                {addingList ? (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <Input
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateList();
                        if (e.key === "Escape") {
                          setNewListName("");
                          setAddingList(false);
                        }
                      }}
                      placeholder="List name"
                      aria-label="New list name"
                      className="h-9 text-sm"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewListName("");
                          setAddingList(false);
                        }}
                      >
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleCreateList}>
                        Add list
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingList(true)}
                    className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add list
                  </button>
                )}
              </div>
            </div>
          </div>

      <AddJobDialog
        open={addJobListId !== null}
        onOpenChange={(open) => setAddJobListId(open ? addJobListId : null)}
        listId={addJobListId ?? undefined}
      />

      <JobDetailSheet
        jobId={openJobId}
        lists={lists}
        onOpenChange={(open) => setOpenJobId(open ? openJobId : null)}
        onMoveTo={handleMove}
      />
    </>
  );
}

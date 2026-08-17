"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpDown } from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { LayersIcon } from "@/components/ui/layers";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { XIcon } from "@/components/ui/x";
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
import { JobViewHeader } from "@/components/board/board-view-header";
import { ImportChoice } from "@/components/import-choice";
import { BoardColumn, type GroupOption } from "@/components/board/board-column";
import { JobDetailSheet } from "@/components/job-detail/job-detail-sheet";
import { ElasticJogScroller } from "@/components/ui/elastic-jog-scroller";
import {
  createList,
  deleteList,
  moveCard,
  renameList,
  reorderLists,
} from "@/lib/actions/board";
import type { BoardCard, BoardList } from "@/lib/types/board";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface BoardViewProps {
  lists: BoardList[];
  cards: BoardCard[];
  onViewChange?: (view: "board" | "list") => void;
}

type SortOption = "recent" | "tier" | "fit" | "deadline" | "title" | "company" | "oldest";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recent",
  tier: "Priority Tier",
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

export function BoardView({ lists, cards, onViewChange }: BoardViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const shouldReduceMotion = useReducedMotion();

  const [optimisticCards, applyMove] = useOptimistic(
    cards,
    (state: BoardCard[], move: { jobId: string; listId: string; targetIndex?: number }) => {
      const card = state.find((c) => c.id === move.jobId);
      if (!card) return state;
      const withoutCard = state.filter((c) => c.id !== move.jobId);
      const updatedCard = { ...card, list_id: move.listId };

      if (move.targetIndex !== undefined) {
        const listCards = withoutCard.filter((c) => c.list_id === move.listId);
        const otherCards = withoutCard.filter((c) => c.list_id !== move.listId);
        const clampedIndex = Math.max(0, Math.min(move.targetIndex, listCards.length));
        listCards.splice(clampedIndex, 0, updatedCard);
        return [...otherCards, ...listCards];
      }
      return [...withoutCard, updatedCard];
    }
  );

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
  const [sort, setSort] = useState<SortOption>("recent");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");

  // Dual-axis smooth edge auto-scrolling during card or column drag
  useEffect(() => {
    if (!draggingId && !draggingListId) return;

    let animId: number | null = null;
    let pointerY = 0;
    let pointerX = 0;

    const EDGE_SIZE = 90;
    const MAX_SPEED = 18;

    const handleDragOver = (e: DragEvent) => {
      pointerY = e.clientY;
      pointerX = e.clientX;
    };

    const scrollLoop = () => {
      // 1. Vertical auto-scroll (window / page)
      const windowHeight = window.innerHeight;
      if (pointerY > 0 && pointerY < EDGE_SIZE) {
        const factor = (EDGE_SIZE - pointerY) / EDGE_SIZE;
        window.scrollBy(0, -Math.round(factor * MAX_SPEED));
      } else if (pointerY > windowHeight - EDGE_SIZE && pointerY <= windowHeight) {
        const factor = (pointerY - (windowHeight - EDGE_SIZE)) / EDGE_SIZE;
        window.scrollBy(0, Math.round(factor * MAX_SPEED));
      }

      // 2. Horizontal auto-scroll (board scroll container)
      if (scrollRef.current) {
        const boardRect = scrollRef.current.getBoundingClientRect();
        if (pointerX >= boardRect.left && pointerX < boardRect.left + EDGE_SIZE) {
          const factor = (boardRect.left + EDGE_SIZE - pointerX) / EDGE_SIZE;
          scrollRef.current.scrollLeft -= Math.round(factor * MAX_SPEED);
          if (fixedScrollRef.current) {
            fixedScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
          }
        } else if (pointerX > boardRect.right - EDGE_SIZE && pointerX <= boardRect.right) {
          const factor = (pointerX - (boardRect.right - EDGE_SIZE)) / EDGE_SIZE;
          scrollRef.current.scrollLeft += Math.round(factor * MAX_SPEED);
          if (fixedScrollRef.current) {
            fixedScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
          }
        }
      }

      animId = requestAnimationFrame(scrollLoop);
    };

    window.addEventListener("dragover", handleDragOver, { passive: true });
    animId = requestAnimationFrame(scrollLoop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      if (animId !== null) cancelAnimationFrame(animId);
    };
  }, [draggingId, draggingListId]);

  const sortedCards = (() => {
    switch (sort) {
      case "tier":
        return [...optimisticCards].sort((a, b) => {
          const tierA = a.tier ? parseInt(a.tier, 10) : 999;
          const tierB = b.tier ? parseInt(b.tier, 10) : 999;
          return tierA - tierB;
        });
      case "fit":
        return [...optimisticCards].sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
      case "deadline":
        return [...optimisticCards].sort((a, b) => {
          const getVal = (d: string | null | undefined) => {
            if (!d) return Infinity;
            const norm = d.trim().toLowerCase();
            if (norm === "asap") return -Infinity;
            if (norm === "unknown") return Infinity;
            const t = new Date(d).getTime();
            return isNaN(t) ? Infinity : t;
          };
          return getVal(a.deadline) - getVal(b.deadline);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const fixedScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [boardScrollWidth, setBoardScrollWidth] = useState(0);

  const panRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(
    null
  );
  const [canScroll, setCanScroll] = useState(false);
  const COLUMN_SCROLL_WIDTH = 260;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setBoardScrollWidth(el.scrollWidth);
      setCanScroll(el.scrollWidth > el.clientWidth + 1);
    };
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [lists.length, cards.length]);

  const handleMainScroll = () => {
    if (isSyncingScroll.current) return;
    if (fixedScrollRef.current && scrollRef.current) {
      isSyncingScroll.current = true;
      fixedScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleFixedScroll = () => {
    if (isSyncingScroll.current) return;
    if (fixedScrollRef.current && scrollRef.current) {
      isSyncingScroll.current = true;
      scrollRef.current.scrollLeft = fixedScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handlePanStart = (pointerId: number, clientX: number) => {
    if (!scrollRef.current) return;
    panRef.current = { pointerId, startX: clientX, startScrollLeft: scrollRef.current.scrollLeft };
  };
  const handlePanMove = (pointerId: number, clientX: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId || !scrollRef.current) return;
    scrollRef.current.scrollLeft = panRef.current.startScrollLeft - (clientX - panRef.current.startX);
    if (fixedScrollRef.current) {
      fixedScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  };
  const handlePanEnd = (pointerId: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId) return;
    panRef.current = null;
  };

  const handleMove = (jobId: string, listId: string, targetIndex?: number) => {
    const card = optimisticCards.find((c) => c.id === jobId);
    if (!card) return;

    const listSiblings = optimisticCards.filter((c) => c.list_id === listId && c.id !== jobId);
    const resolvedTargetIndex =
      targetIndex !== undefined
        ? Math.max(0, Math.min(targetIndex, listSiblings.length))
        : listSiblings.length;

    startTransition(async () => {
      applyMove({ jobId, listId, targetIndex: resolvedTargetIndex });
      try {
        await moveCard(jobId, listId, resolvedTargetIndex);
        router.refresh();
      } catch {
        toast.error("Couldn't move that card", {
          description: "Your change was reverted. Please try again.",
        });
      }
    });
  };

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
        toast.error("Couldn't reorder that list");
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
        toast.error("Couldn't create that list");
      }
    });
  };

  const handleRenameList = (listId: string, name: string) => {
    startTransition(async () => {
      try {
        await renameList(listId, name);
        router.refresh();
      } catch {
        toast.error("Couldn't rename that list");
      }
    });
  };

  const handleDeleteList = async (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    const count = optimisticCards.filter((c) => c.list_id === listId).length;
    const message = count
      ? `"${list?.name}" will be deleted and its ${count} job${count === 1 ? "" : "s"} will move to Wishlist.`
      : `"${list?.name}" will be deleted. It has no jobs in it.`;

    const confirmed = await confirm({
      title: "Delete this list?",
      description: message,
      confirmText: "Delete list",
      variant: "destructive",
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteList(listId);
        router.refresh();
        toast.success("List deleted");
      } catch {
        toast.error("Couldn't delete that list");
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-full w-full px-6 pt-4 pb-0">
      <JobViewHeader currentView="board" onViewChange={onViewChange}>

        <DropdownMenu>
          <DropdownMenuTrigger className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none cursor-pointer sm:inline-flex">
            <LayersIcon className="size-3.5" aria-hidden="true" />
            Group: <span className="text-foreground">{GROUP_LABELS[groupBy]}</span>
            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
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
          <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none cursor-pointer">
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            Sort: <span className="text-foreground">{SORT_LABELS[sort]}</span>
            <ChevronDownIcon className="size-3.5" aria-hidden="true" />
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

        {canScroll && (
          <div className="inline-flex h-8 overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              aria-label="Scroll board left"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: -COLUMN_SCROLL_WIDTH, behavior: "smooth" })
              }
              className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none cursor-pointer"
            >
              <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
            </button>
            <span className="w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              aria-label="Scroll board right"
              onClick={() =>
                scrollRef.current?.scrollBy({ left: COLUMN_SCROLL_WIDTH, behavior: "smooth" })
              }
              className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none cursor-pointer"
            >
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        <ImportChoice lists={optimisticLists} />
      </JobViewHeader>

      {/* Board Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleMainScroll}
        className="no-scrollbar -mx-6 overflow-x-auto px-6 w-[calc(100%+3rem)] pt-3"
      >
        <div className="flex items-stretch gap-3 w-max min-w-full pb-8 pr-6">
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
              <span
                aria-hidden="true"
                className="w-px shrink-0 self-stretch border-l border-dashed border-border"
              />
            </Fragment>
          ))}

          {/* Add list column */}
          <div
            className="min-w-[270px] w-[270px] shrink-0 self-stretch flex flex-col justify-start"
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
            <AnimatePresence mode="wait" initial={false}>
              {addingList ? (
                <motion.div
                  key="form"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                  className="rounded-2xl border border-border bg-card p-3"
                >
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
                    className="h-8 text-xs"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewListName("");
                        setAddingList(false);
                      }}
                      className="cursor-pointer active:scale-95"
                    >
                      <XIcon className="size-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateList}
                      className="cursor-pointer active:scale-95"
                    >
                      Add list
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="btn"
                  type="button"
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  onClick={() => setAddingList(true)}
                  className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:outline-none cursor-pointer"
                >
                  <PlusIcon className="size-3.5" aria-hidden="true" />
                  Add list
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Spacer for horizontal scroll end clearance */}
          <div className="w-4 shrink-0 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Interactive Spinny Elastic Jog Scroller Widget */}
      <ElasticJogScroller
        scrollRef={scrollRef}
        stages={optimisticLists.map((l) => ({
          id: l.id,
          name: l.name,
          count: sortedCards.filter((c) => c.list_id === l.id).length,
          color: l.color,
        }))}
      />

      <ImportChoice
        open={addJobListId !== null}
        onOpenChange={(open) => setAddJobListId(open ? addJobListId : null)}
        listId={addJobListId ?? undefined}
        lists={optimisticLists}
      />

      <JobDetailSheet
        jobId={openJobId}
        lists={lists}
        onOpenChange={(open) => setOpenJobId(open ? openJobId : null)}
        onMoveTo={handleMove}
      />
      {dialog}
    </div>
  );
}

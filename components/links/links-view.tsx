"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LinkCategory,
  SocialLink,
  CreateLinkInput,
  QuickShortcut,
  CreateQuickShortcutInput,
  UpdateQuickShortcutInput,
} from "@/lib/types/links";
import { CategoryPanel } from "./category-panel";
import { LinkDialog } from "./link-dialog";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { TagManagerDialog, TagInfo } from "./tag-manager-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { LinksJsonImportDialog } from "./links-json-import-dialog";
import { useJsonSyncPreference } from "@/lib/hooks/use-json-sync-preference";
import { QuickShortcutsBar } from "./quick-shortcuts-bar";
import { PageHeader } from "@/components/page-header";
import { Search, Settings2, Tag, FileJson } from "lucide-react";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createLink,
  updateLink,
  deleteLink,
  moveLinkCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  createQuickShortcut,
  updateQuickShortcut,
  deleteQuickShortcut,
  renameTag,
  deleteTag,
} from "@/lib/actions/links";
import { toast } from "sonner";

interface LinksViewProps {
  initialCategories: LinkCategory[];
  initialLinks: SocialLink[];
  initialShortcuts?: QuickShortcut[];
}

type OptimisticAction =
  | { type: "ADD_LINK"; link: SocialLink }
  | { type: "UPDATE_LINK"; link: SocialLink }
  | { type: "DELETE_LINK"; id: string }
  | { type: "MOVE_LINK"; linkId: string; newCategoryId: string }
  | { type: "ADD_CATEGORY"; category: LinkCategory }
  | { type: "UPDATE_CATEGORY"; category: LinkCategory }
  | { type: "DELETE_CATEGORY"; id: string; targetCategoryId?: string }
  | { type: "REORDER_CATEGORIES"; orderedIds: string[] }
  | { type: "RENAME_TAG"; oldName: string; newName: string }
  | { type: "DELETE_TAG"; name: string };

export function LinksView({
  initialCategories,
  initialLinks,
  initialShortcuts = [],
}: LinksViewProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(initialShortcuts);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const { enabled: jsonSyncEnabled } = useJsonSyncPreference();
  const [, startTransition] = useTransition();
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);
  const fixedScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [panelScrollWidth, setPanelScrollWidth] = useState(0);
  const pillsScrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const COLUMN_SCROLL_WIDTH = 380;

  const handleAddShortcut = async (input: CreateQuickShortcutInput) => {
    const temp: QuickShortcut = {
      id: `temp-${Date.now()}`,
      user_id: "local-user",
      title: input.title,
      value: input.value,
      icon: input.icon ?? "link",
      sort_order: shortcuts.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setShortcuts((prev) => [...prev, temp]);
    const res = await createQuickShortcut(input);
    if (res.success && res.data) {
      setShortcuts((prev) => prev.map((s) => (s.id === temp.id ? res.data! : s)));
    } else if (!res.success) {
      setShortcuts((prev) => prev.filter((s) => s.id !== temp.id));
      toast.error(res.error ?? "Failed to add shortcut");
    }
  };

  const handleUpdateShortcut = async (id: string, input: UpdateQuickShortcutInput) => {
    setShortcuts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...input } : s))
    );
    const res = await updateQuickShortcut(id, input);
    if (!res.success) {
      toast.error(res.error ?? "Failed to update shortcut");
    }
  };

  const handleDeleteShortcut = async (id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
    const res = await deleteQuickShortcut(id);
    if (!res.success) {
      toast.error(res.error ?? "Failed to delete shortcut");
    }
  };

  // Modals state
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [manageCatOpen, setManageCatOpen] = useState(false);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const [scopedCatId, setScopedCatId] = useState<string | undefined>();
  const [editingLink, setEditingLink] = useState<SocialLink | null>(null);

  // Optimistic State
  const [{ categories, links }, setOptimisticState] = useOptimistic(
    { categories: initialCategories, links: initialLinks },
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "ADD_LINK":
          return { ...state, links: [action.link, ...state.links] };
        case "UPDATE_LINK":
          return {
            ...state,
            links: state.links.map((l) => (l.id === action.link.id ? action.link : l)),
          };
        case "DELETE_LINK":
          return {
            ...state,
            links: state.links.filter((l) => l.id !== action.id),
          };
        case "MOVE_LINK":
          return {
            ...state,
            links: state.links.map((l) =>
              l.id === action.linkId ? { ...l, category_id: action.newCategoryId } : l
            ),
          };
        case "ADD_CATEGORY":
          return {
            ...state,
            categories: [...state.categories, action.category],
          };
        case "UPDATE_CATEGORY":
          return {
            ...state,
            categories: state.categories.map((c) =>
              c.id === action.category.id ? action.category : c
            ),
          };
        case "DELETE_CATEGORY":
          return {
            categories: state.categories.filter((c) => c.id !== action.id),
            links: action.targetCategoryId
              ? state.links.map((l) =>
                  l.category_id === action.id ? { ...l, category_id: action.targetCategoryId! } : l
                )
              : state.links.filter((l) => l.category_id !== action.id),
          };
        case "REORDER_CATEGORIES": {
          const catMap = new Map(state.categories.map((c) => [c.id, c]));
          const reordered = action.orderedIds
            .map((id, idx) => {
              const item = catMap.get(id);
              return item ? { ...item, sort_order: idx } : null;
            })
            .filter((c): c is LinkCategory => c !== null);
          return { ...state, categories: reordered };
        }
        case "RENAME_TAG":
          return {
            ...state,
            links: state.links.map((l) => ({
              ...l,
              tags: l.tags
                ? Array.from(
                    new Set(
                      l.tags.map((t) =>
                        t.toLowerCase() === action.oldName.toLowerCase() ? action.newName : t
                      )
                    )
                  )
                : [],
            })),
          };
        case "DELETE_TAG":
          return {
            ...state,
            links: state.links.map((l) => ({
              ...l,
              tags: l.tags
                ? l.tags.filter((t) => t.toLowerCase() !== action.name.toLowerCase())
                : [],
            })),
          };
        default:
          return state;
      }
    }
  );

  // Link Dialog Triggers
  const handleOpenAdd = (categoryId?: string) => {
    setEditingLink(null);
    setScopedCatId(categoryId);
    setAddLinkOpen(true);
  };

  const handleOpenEdit = (link: SocialLink) => {
    setEditingLink(link);
    setAddLinkOpen(true);
  };

  // Actions Wrappers with Optimistic Updates
  const handleSaveLink = async (input: CreateLinkInput, editId?: string) => {
    if (editId) {
      const updated: SocialLink = {
        ...editingLink!,
        title: input.title,
        url: input.url,
        category_id: input.category_id,
        notes: input.notes,
        tags: input.tags,
        updated_at: new Date().toISOString(),
      };
      startTransition(() => setOptimisticState({ type: "UPDATE_LINK", link: updated }));
      const res = await updateLink(editId, input);
      if (!res.success) toast.error(res.error ?? "Failed to update link");
      else toast.success("Link updated");
    } else {
      const tempLink: SocialLink = {
        id: `temp-${Date.now()}`,
        user_id: "local-user",
        category_id: input.category_id,
        title: input.title,
        url: input.url,
        notes: input.notes,
        tags: input.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      startTransition(() => setOptimisticState({ type: "ADD_LINK", link: tempLink }));
      const res = await createLink(input);
      if (!res.success) toast.error(res.error ?? "Failed to add link");
      else toast.success("Link created");
    }
  };

  const handleDeleteLink = async (id: string) => {
    startTransition(() => setOptimisticState({ type: "DELETE_LINK", id }));
    const res = await deleteLink(id);
    if (!res.success) toast.error(res.error ?? "Failed to delete link");
    else toast.success("Link deleted");
  };

  const handleMoveLink = async (linkId: string, newCategoryId: string) => {
    startTransition(() =>
      setOptimisticState({ type: "MOVE_LINK", linkId, newCategoryId })
    );
    const res = await moveLinkCategory(linkId, newCategoryId);
    if (!res.success) toast.error(res.error ?? "Failed to move link");
  };

  const handleCreateCategory = async (name: string) => {
    const res = await createCategory({ name });
    if (!res.success) toast.error(res.error ?? "Failed to create category");
    else toast.success("Category created");
  };

  const handleCreateCategoryInline = async (name: string): Promise<string | undefined> => {
    const res = await createCategory({ name });
    if (res.success && res.data) {
      toast.success("Category created");
      return res.data.id;
    }
    toast.error(res.error ?? "Failed to create category");
    return undefined;
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    const res = await updateCategory(id, name);
    if (!res.success) toast.error(res.error ?? "Failed to update category");
    else toast.success("Category updated");
  };

  const handleDeleteCategory = async (id: string, targetCategoryId?: string) => {
    const res = await deleteCategory(id, targetCategoryId);
    if (!res.success) toast.error(res.error ?? "Failed to delete category");
    else toast.success("Category deleted");
  };

  const handleReorderCategories = async (orderedIds: string[]) => {
    const res = await reorderCategories(orderedIds);
    if (!res.success) toast.error(res.error ?? "Failed to reorder categories");
  };

  // Tag Management Handlers
  const handleCreateTag = (name: string) => {
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return;
    setExtraTags((prev) => Array.from(new Set([...prev, clean])));
  };

  const handleRenameTag = async (oldName: string, newName: string) => {
    startTransition(() => {
      setOptimisticState({ type: "RENAME_TAG", oldName, newName });
      setExtraTags((prev) =>
        prev.map((t) => (t.toLowerCase() === oldName.toLowerCase() ? newName : t))
      );
    });
    const res = await renameTag(oldName, newName);
    if (!res.success) {
      toast.error(res.error ?? "Failed to rename tag");
    }
  };

  const handleDeleteTag = async (name: string) => {
    startTransition(() => {
      setOptimisticState({ type: "DELETE_TAG", name });
      setExtraTags((prev) =>
        prev.filter((t) => t.toLowerCase() !== name.toLowerCase())
      );
    });
    const res = await deleteTag(name);
    if (!res.success) {
      toast.error(res.error ?? "Failed to delete tag");
    }
  };

  // Search & Filter Matching
  const query = search.trim().toLowerCase();

  const filteredLinks = links.filter((link) => {
    if (!query) return true;
    const cleanQuery = query.startsWith("#") ? query.slice(1) : query;
    return (
      link.title.toLowerCase().includes(cleanQuery) ||
      link.url.toLowerCase().includes(cleanQuery) ||
      (link.notes && link.notes.toLowerCase().includes(cleanQuery)) ||
      (link.tags && link.tags.some((t) => t.toLowerCase().includes(cleanQuery)))
    );
  });

  const visibleCategories = categories.filter((cat) => {
    if (query) {
      return filteredLinks.some((l) => l.category_id === cat.id);
    }
    return true;
  });

  // Calculate all unique tags with count
  const tagCountsMap = new Map<string, number>();
  for (const link of links) {
    for (const tag of link.tags || []) {
      const clean = tag.trim().replace(/^#/, "");
      if (!clean) continue;
      tagCountsMap.set(clean, (tagCountsMap.get(clean) || 0) + 1);
    }
  }
  for (const extra of extraTags) {
    if (!tagCountsMap.has(extra)) {
      tagCountsMap.set(extra, 0);
    }
  }
  const allTags: TagInfo[] = Array.from(tagCountsMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const existingTags = allTags.map((t) => t.name);

  // Horizontal Scroll & Pan Management
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPanelScrollWidth(el.scrollWidth);
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScroll(hasOverflow);
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [categories.length, links.length, search, updateScrollState]);

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
    panRef.current = {
      pointerId,
      startX: clientX,
      startScrollLeft: scrollRef.current.scrollLeft,
    };
  };

  const handlePanMove = (pointerId: number, clientX: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId || !scrollRef.current) return;
    const deltaX = clientX - panRef.current.startX;
    scrollRef.current.scrollLeft = panRef.current.startScrollLeft - deltaX;
    if (fixedScrollRef.current) {
      fixedScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
    updateScrollState();
  };

  const handlePanEnd = (pointerId: number) => {
    if (!panRef.current || panRef.current.pointerId !== pointerId) return;
    panRef.current = null;
  };

  const scrollByAmount = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -COLUMN_SCROLL_WIDTH : COLUMN_SCROLL_WIDTH;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    if (catId === "all") {
      scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const targetEl = document.getElementById(`category-panel-${catId}`);
    if (targetEl && scrollRef.current) {
      const containerRect = scrollRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const scrollTarget =
        scrollRef.current.scrollLeft + (targetRect.left - containerRect.left);
      scrollRef.current.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: "smooth",
      });
    }
  };

  // Scroll-spy to sync active category indicator with scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      updateScrollState();

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (el.scrollLeft <= 30) {
          setActiveCategory("all");
          return;
        }

        const containerLeft = el.getBoundingClientRect().left;
        let closestCatId = "";
        let minDistance = Infinity;

        for (const cat of visibleCategories) {
          const panel = document.getElementById(`category-panel-${cat.id}`);
          if (panel) {
            const distance = Math.abs(panel.getBoundingClientRect().left - containerLeft);
            if (distance < minDistance) {
              minDistance = distance;
              closestCatId = cat.id;
            }
          }
        }

        if (closestCatId && minDistance < 350) {
          setActiveCategory(closestCatId);
        }
      }, 80);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [visibleCategories, updateScrollState]);

  return (
    <div className="space-y-4">
      {/* Consistent 2-Layer Page Header */}
      <PageHeader
        title="Social Links"
        subtitle="Organize and quick-launch professional links, career resources, and job portals."
      >
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-40 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search links..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-card border-border"
            />
          </div>

          {/* Manage Categories Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManageCatOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground"
          >
            <Settings2 className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Categories</span>
          </Button>

          {/* Manage Tags Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManageTagsOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground"
          >
            <Tag className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Tags</span>
          </Button>

          {/* Import JSON Button */}
          {jsonSyncEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setJsonImportOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground cursor-pointer"
            >
              <FileJson className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Import JSON</span>
            </Button>
          )}

          {/* Add Link Button */}
          <Button
            size="sm"
            onClick={() => handleOpenAdd()}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <PlusIcon className="size-3.5" />
            <span>Add Link</span>
          </Button>
        </div>
      </PageHeader>

      {/* Quick Shortcuts Bar */}
      <QuickShortcutsBar
        shortcuts={shortcuts}
        onAddShortcut={handleAddShortcut}
        onUpdateShortcut={handleUpdateShortcut}
        onDeleteShortcut={handleDeleteShortcut}
      />

      {/* Category Filter & Navigation Bar */}
      {categories.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          {/* Category Navigation Pills */}
          <div
            ref={pillsScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 min-w-0 flex-1"
          >
            <button
              type="button"
              onClick={() => handleCategoryClick("all")}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer active:scale-95",
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              All
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none transition-colors",
                  activeCategory === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background/90 text-muted-foreground border border-border/40"
                )}
              >
                {links.length}
              </span>
            </button>

            {categories.map((cat) => {
              const count = links.filter((l) => l.category_id === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer active:scale-95",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  {cat.name}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none transition-colors",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-background/90 text-muted-foreground border border-border/40"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Horizontal Scroll Navigation Controls */}
          {canScroll && (
            <div className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
              <button
                type="button"
                aria-label="Scroll categories left"
                onClick={() => scrollByAmount("left")}
                disabled={!canScrollLeft}
                className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
              </button>
              <span className="w-px h-3.5 bg-border" aria-hidden="true" />
              <button
                type="button"
                aria-label="Scroll categories right"
                onClick={() => scrollByAmount("right")}
                disabled={!canScrollRight}
                className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Category Panels (Horizontal Scrollable Layout) */}
      {visibleCategories.length > 0 ? (
        <>
          <div
            ref={scrollRef}
            onScroll={handleMainScroll}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                e.currentTarget.setPointerCapture(e.pointerId);
                handlePanStart(e.pointerId, e.clientX);
              }
            }}
            onPointerMove={(e) => {
              if (panRef.current && panRef.current.pointerId === e.pointerId) {
                handlePanMove(e.pointerId, e.clientX);
              }
            }}
            onPointerUp={(e) => {
              if (panRef.current && panRef.current.pointerId === e.pointerId) {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                handlePanEnd(e.pointerId);
              }
            }}
            onPointerCancel={(e) => {
              if (panRef.current && panRef.current.pointerId === e.pointerId) {
                handlePanEnd(e.pointerId);
              }
            }}
            className={cn(
              "flex gap-4 pb-4 items-start no-scrollbar",
              visibleCategories.length === 1 ? "w-full" : "flex-nowrap overflow-x-auto"
            )}
          >
            {visibleCategories.map((cat) => {
              const catLinks = filteredLinks.filter((l) => l.category_id === cat.id);
              return (
                <CategoryPanel
                  key={cat.id}
                  category={cat}
                  categories={categories}
                  links={catLinks}
                  onAddLink={handleOpenAdd}
                  onEditLink={handleOpenEdit}
                  onDeleteLink={handleDeleteLink}
                  onMoveLinkCategory={handleMoveLink}
                  onRenameCategory={() => setManageCatOpen(true)}
                  onDeleteCategory={() => setManageCatOpen(true)}
                  onPanStart={handlePanStart}
                  onPanMove={handlePanMove}
                  onPanEnd={handlePanEnd}
                  isFullWidth={visibleCategories.length === 1}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <h3 className="font-semibold text-base text-foreground">No links found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            {query
              ? `No links matched "${search}". Try adjusting your search query or category filter.`
              : "Get started by adding your first professional link or job portal."}
          </p>
          <Button
            onClick={() => handleOpenAdd()}
            size="sm"
            className="gap-2 text-xs font-medium"
          >
            <PlusIcon className="size-3.5" />
            Add Your First Link
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <LinkDialog
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        categories={categories}
        initialCategoryId={scopedCatId}
        linkToEdit={editingLink}
        existingTags={existingTags}
        onSubmit={handleSaveLink}
        onCreateCategoryInline={handleCreateCategoryInline}
        onOpenCsv={() => setCsvOpen(true)}
        onOpenJson={
          jsonSyncEnabled
            ? () => {
                setAddLinkOpen(false);
                setJsonImportOpen(true);
              }
            : undefined
        }
      />

      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        categories={categories}
        initialCategoryId={scopedCatId}
        onDone={() => {
          setCsvOpen(false);
          router.refresh();
        }}
      />

      <LinksJsonImportDialog
        open={jsonImportOpen}
        onOpenChange={setJsonImportOpen}
      />

      <CategoryManagerDialog
        open={manageCatOpen}
        onOpenChange={setManageCatOpen}
        categories={categories}
        links={links}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onReorderCategories={handleReorderCategories}
      />

      <TagManagerDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        tags={allTags}
        onCreateTag={handleCreateTag}
        onRenameTag={handleRenameTag}
        onDeleteTag={handleDeleteTag}
      />
    </div>
  );
}

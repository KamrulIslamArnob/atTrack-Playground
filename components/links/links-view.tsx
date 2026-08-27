"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
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
import { TagManagerDialog } from "./tag-manager-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { LinksJsonImportDialog } from "./links-json-import-dialog";
import { useJsonSyncPreference } from "@/lib/hooks/use-json-sync-preference";
import { QuickShortcutsBar } from "./quick-shortcuts-bar";
import { PageHeader } from "@/components/page-header";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Search, Settings2, Tag, FileJson, X } from "lucide-react";
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
  backfillLinkFavicons,
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(initialShortcuts);
  const [extraTags, setExtraTags] = useState<string[]>([]);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const { enabled: jsonSyncEnabled } = useJsonSyncPreference();
  const [, startTransition] = useTransition();
  const router = useRouter();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pillsScrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  const [canScroll, setCanScroll] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const COLUMN_SCROLL_WIDTH = 380;

  // One-time automatic background favicon fetch & persistent SQLite storage for existing links
  useEffect(() => {
    const hasMissingIcons = initialLinks.some((l) => l.icon_url === null && l.url);
    if (hasMissingIcons) {
      backfillLinkFavicons()
        .then((res) => {
          if (res && res.updated > 0) {
            router.refresh();
          }
        })
        .catch(() => {});
    }
  }, [initialLinks, router]);

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

  // Search & Tag Filter Matching with memoization
  const query = search.trim().toLowerCase();

  const filteredLinks = useMemo(() => {
    let result = links;
    if (selectedTag) {
      const cleanTag = selectedTag.toLowerCase();
      result = result.filter((link) =>
        link.tags?.some((t) => t.toLowerCase() === cleanTag)
      );
    }
    if (!query) return result;
    const cleanQuery = query.startsWith("#") ? query.slice(1) : query;
    return result.filter((link) => {
      return (
        link.title.toLowerCase().includes(cleanQuery) ||
        link.url.toLowerCase().includes(cleanQuery) ||
        (link.notes && link.notes.toLowerCase().includes(cleanQuery)) ||
        (link.tags && link.tags.some((t) => t.toLowerCase().includes(cleanQuery)))
      );
    });
  }, [links, query, selectedTag]);

  // O(L) Set building for O(1) category membership checks
  const visibleCategories = useMemo(() => {
    let base = categories;
    if (activeCategory !== "all") {
      base = base.filter((cat) => cat.id === activeCategory);
    }
    if (!query && !selectedTag) return base;
    const matchingCatIds = new Set<string>();
    for (const link of filteredLinks) {
      if (link.category_id) matchingCatIds.add(link.category_id);
    }
    return base.filter((cat) => matchingCatIds.has(cat.id));
  }, [categories, filteredLinks, query, selectedTag, activeCategory]);

  // Memoized unique tags calculation
  const allTags = useMemo(() => {
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
    return Array.from(tagCountsMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [links, extraTags]);

  const existingTags = useMemo(() => allTags.map((t) => t.name), [allTags]);

  // Horizontal Scroll & Pan Management
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
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
  }, [categories.length, links.length, search, activeCategory, updateScrollState]);

  const handleMainScroll = () => {
    updateScrollState();
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
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Consistent 2-Layer Page Header */}
      <PageHeader
        title="Resources & Links"
        titleExtra={
          <InfoTooltip
            content="Organize and quick-launch professional links, career resources, and job portals."
            side="right"
            iconClassName="size-4"
          />
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          {/* Left Alignment: Search + Import JSON */}
          <div className="flex items-center gap-2">
            <div className="relative w-40 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search resources, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-card border-border"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

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
          </div>

          {/* Right Alignment: Categories + Tags + Add Resource */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManageCatOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground cursor-pointer"
            >
              <Settings2 className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Categories</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManageTagsOpen(true)}
              className="h-8 gap-1.5 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground cursor-pointer"
            >
              <Tag className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Tags</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenAdd()}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>Add Resource</span>
            </Button>
          </div>
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
          {/* Category Navigation Track */}
          <div
            ref={pillsScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1 p-1 sm:p-1.5 bg-muted/60 dark:bg-muted/30 rounded-xl"
          >
            <button
              type="button"
              onClick={() => handleCategoryClick("all")}
              className={cn(
                "h-8 shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs transition-all cursor-pointer active:scale-95 select-none",
                activeCategory === "all"
                  ? "bg-background text-foreground shadow-2xs font-semibold border border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50 font-medium"
              )}
            >
              All
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none transition-colors",
                  activeCategory === "all"
                    ? "bg-muted text-foreground"
                    : "bg-muted/70 text-muted-foreground"
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
                    "h-8 shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs transition-all cursor-pointer active:scale-95 select-none",
                    isActive
                      ? "bg-background text-foreground shadow-2xs font-semibold border border-border/70"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50 font-medium"
                  )}
                >
                  {cat.name}
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums leading-none transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "bg-muted/70 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Horizontal Scroll Navigation Controls (for Columns mode) */}
          {canScroll && activeCategory === "all" && (
            <div className="inline-flex h-10 sm:h-11 shrink-0 items-center overflow-hidden rounded-xl bg-muted/60 dark:bg-muted/30 p-1 sm:p-1.5 gap-1">
              <button
                type="button"
                aria-label="Scroll categories left"
                onClick={() => scrollByAmount("left")}
                disabled={!canScrollLeft}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Scroll categories right"
                onClick={() => scrollByAmount("right")}
                disabled={!canScrollRight}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Tag Filter Chips Bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs font-medium text-muted-foreground shrink-0 mr-0.5 flex items-center gap-1">
            <Tag className="size-3.5 text-muted-foreground/80" /> Tags:
          </span>
          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/20 transition-colors shrink-0 shadow-2xs active:scale-95"
            >
              <span>Clear (#{selectedTag})</span>
              <X className="size-3" />
            </button>
          )}
          {allTags.slice(0, 15).map((t) => {
            const isTagActive = selectedTag?.toLowerCase() === t.name.toLowerCase();
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setSelectedTag(isTagActive ? null : t.name)}
                className={cn(
                  "h-8 inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all cursor-pointer shrink-0 active:scale-95 select-none",
                  isTagActive
                    ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                    : "bg-card border-border/80 hover:bg-accent/40 text-muted-foreground hover:text-foreground shadow-2xs"
                )}
              >
                <span>#{t.name}</span>
                <span className="text-[10px] opacity-75 tabular-nums font-mono">({t.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category Panels (Swimlanes Column Layout) */}
      {visibleCategories.length > 0 ? (
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
                layout={visibleCategories.length === 1 ? "grid" : "columns"}
                isFullWidth={visibleCategories.length === 1}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <h3 className="font-semibold text-base text-foreground">No resources found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            {query || selectedTag
              ? `No items matched your current filters. Try resetting search or tag selection.`
              : "Get started by adding your first professional link or job portal."}
          </p>
          <Button
            onClick={() => handleOpenAdd()}
            size="sm"
            className="gap-2 text-xs font-medium"
          >
            <PlusIcon className="size-3.5" />
            Add Resource
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
        onSubmitShortcut={handleAddShortcut}
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

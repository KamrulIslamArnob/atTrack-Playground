"use client";

import { useOptimistic, useState, useTransition } from "react";
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
import { CsvImportDialog } from "./csv-import-dialog";
import { QuickShortcutsBar } from "./quick-shortcuts-bar";
import { Search, Plus, Settings2, Link2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  | { type: "REORDER_CATEGORIES"; orderedIds: string[] };

export function LinksView({
  initialCategories,
  initialLinks,
  initialShortcuts = [],
}: LinksViewProps) {
  const [search, setSearch] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState("all");
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(initialShortcuts);
  const [, startTransition] = useTransition();
  const router = useRouter();

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

  // Search & Filter Matching
  const query = search.trim().toLowerCase();

  const filteredLinks = links.filter((link) => {
    if (selectedCatFilter !== "all" && link.category_id !== selectedCatFilter) {
      return false;
    }
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
    if (selectedCatFilter !== "all" && cat.id !== selectedCatFilter) {
      return false;
    }
    // If search is active, show category only if it has matching links
    if (query) {
      return filteredLinks.some((l) => l.category_id === cat.id);
    }
    return true;
  });

  // Unique existing tags across all links
  const existingTags = Array.from(
    new Set(links.flatMap((l) => l.tags || []))
  ).sort();

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Social Links</h1>
            <span className="inline-flex items-center rounded-full bg-lime-500/15 border border-lime-500/30 px-2.5 py-0.5 text-xs font-semibold text-lime-950 dark:text-lime-200">
              <Link2 className="mr-1 size-3 text-lime-700 dark:text-lime-300" />
              {links.length} Resources
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize, categorize, and quick-launch your professional links, job portals, and online communities.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setManageCatOpen(true)}
            className="rounded-lg gap-2 text-xs font-medium active:scale-[0.98] transition-transform"
          >
            <Settings2 className="size-3.5 text-muted-foreground" />
            Manage Categories
          </Button>

          <Button
            onClick={() => handleOpenAdd()}
            className="rounded-lg gap-2 bg-gradient-brand text-foreground font-medium text-xs shadow-xs active:scale-[0.98] transition-transform"
          >
            <Plus className="size-4" />
            Add Link
          </Button>
        </div>
      </div>

      {/* Toolbar: Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search links by title, URL, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-lg text-sm bg-card border-border"
        />
      </div>

      {/* Quick Copy Shortcuts Bar (Red Spot location) */}
      <QuickShortcutsBar
        shortcuts={shortcuts}
        onAddShortcut={handleAddShortcut}
        onUpdateShortcut={handleUpdateShortcut}
        onDeleteShortcut={handleDeleteShortcut}
      />

      {/* Category Filter Bar: Horizontally scrollable pill container */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
        <button
          type="button"
          onClick={() => setSelectedCatFilter("all")}
          className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
            selectedCatFilter === "all"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          }`}
        >
          All
          <span
            className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
              selectedCatFilter === "all"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-muted-foreground"
            }`}
          >
            {links.length}
          </span>
        </button>

        {categories.map((cat) => {
          const count = links.filter((l) => l.category_id === cat.id).length;
          const isActive = selectedCatFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCatFilter(cat.id);
                const el = document.getElementById(`category-panel-${cat.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
                }
              }}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {cat.name}
              <span
                className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background/80 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Category View (Slider when "All", Full Width Grid when Single Category) */}
      {visibleCategories.length > 0 ? (
        selectedCatFilter === "all" ? (
          <div className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 no-scrollbar scroll-smooth">
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
                  isFullWidth={false}
                />
              );
            })}
          </div>
        ) : (
          <div className="w-full">
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
                  isFullWidth={true}
                />
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 py-16 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
            <Sparkles className="size-6" />
          </div>
          <h3 className="font-semibold text-base text-foreground">No links found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            {query
              ? `No links matched "${search}". Try adjusting your search query or category filter.`
              : "Get started by adding your first professional link or job portal."}
          </p>
          <Button
            onClick={() => handleOpenAdd()}
            className="rounded-lg gap-2 bg-gradient-brand text-foreground text-xs font-medium active:scale-[0.98] transition-transform"
          >
            <Plus className="size-4" /> Add Your First Link
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
    </div>
  );
}

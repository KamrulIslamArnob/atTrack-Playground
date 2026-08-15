"use client";

import { useState } from "react";
import { LinkCategory, SocialLink } from "@/lib/types/links";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowUp, ArrowDown, Edit2, Trash2, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: LinkCategory[];
  links: SocialLink[];
  onCreateCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string, targetCategoryIdForReassignment?: string) => Promise<void>;
  onReorderCategories: (orderedIds: string[]) => Promise<void>;
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
  categories,
  links,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
}: CategoryManagerDialogProps) {
  const [newCatName, setNewCatName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  
  // State for category deletion confirmation modal / sub-prompt
  const [deletingCat, setDeletingCat] = useState<LinkCategory | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onCreateCategory(newCatName.trim());
    setNewCatName("");
    toast.success("Category created");
  };

  const handleStartEdit = (cat: LinkCategory) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    await onUpdateCategory(id, editingName.trim());
    setEditingId(null);
    toast.success("Category updated");
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrder = [...categories];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    await onReorderCategories(newOrder.map((c) => c.id));
  };

  const handleInitiateDelete = (cat: LinkCategory) => {
    const activeLinksCount = links.filter((l) => l.category_id === cat.id).length;
    if (activeLinksCount > 0) {
      // Find default target category for reassignment
      const otherCat = categories.find((c) => c.id !== cat.id);
      setReassignTargetId(otherCat?.id ?? "");
      setDeletingCat(cat);
    } else {
      onDeleteCategory(cat.id);
      toast.success("Category deleted");
    }
  };

  const handleConfirmDelete = async (action: "reassign" | "deleteAll") => {
    if (!deletingCat) return;

    if (action === "reassign" && !reassignTargetId) {
      toast.error("Please select a target category for reassignment");
      return;
    }

    await onDeleteCategory(
      deletingCat.id,
      action === "reassign" ? reassignTargetId : undefined
    );

    setDeletingCat(null);
    toast.success("Category deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Manage Categories</DialogTitle>
        </DialogHeader>

        {/* Deletion Warning / Reassignment Modal Sub-Step */}
        {deletingCat ? (
          <div className="space-y-4 py-3">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-sm">Category Contains Active Links</p>
                <p>
                  &quot;{deletingCat.name}&quot; has{" "}
                  {links.filter((l) => l.category_id === deletingCat.id).length} link(s). Reassign them to another category or delete them.
                </p>
              </div>
            </div>

            {categories.filter((c) => c.id !== deletingCat.id).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reassign links to:</Label>
                <Select value={reassignTargetId} onValueChange={(val) => setReassignTargetId(val ?? "")}>
                  <SelectTrigger className="rounded-lg text-xs">
                    <SelectValue placeholder="Select target category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories
                      .filter((c) => c.id !== deletingCat.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {categories.filter((c) => c.id !== deletingCat.id).length > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleConfirmDelete("reassign")}
                  className="rounded-lg bg-primary text-primary-foreground text-xs active:scale-[0.98] transition-transform"
                >
                  Reassign Links & Delete Category
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleConfirmDelete("deleteAll")}
                className="rounded-lg text-xs active:scale-[0.98] transition-transform"
              >
                Delete Category & All Its Links
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingCat(null)}
                className="rounded-lg text-xs active:scale-[0.98] transition-transform"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Create Category Form */}
            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <Input
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="rounded-lg text-xs flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newCatName.trim()}
                className="rounded-lg gap-1 text-xs shrink-0 active:scale-[0.98] transition-transform"
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </form>

            {/* List of Categories */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs"
                >
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="rounded-lg text-xs h-7"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-lg text-emerald-500 hover:text-emerald-600"
                        onClick={() => handleSaveEdit(cat.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 rounded-lg text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-medium text-foreground truncate">{cat.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                          ({links.filter((l) => l.category_id === cat.id).length})
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, "up")}
                          className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === categories.length - 1}
                          onClick={() => handleMove(idx, "down")}
                          className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(cat)}
                          className="size-6 rounded-md text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleInitiateDelete(cat)}
                          className="size-6 rounded-md text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-lg active:scale-[0.98] transition-transform"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

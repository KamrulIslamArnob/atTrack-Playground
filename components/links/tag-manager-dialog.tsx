"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Tag, AlertTriangle } from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { XIcon } from "@/components/ui/x";
import { toast } from "sonner";

export interface TagInfo {
  name: string;
  count: number;
}

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagInfo[];
  onCreateTag: (name: string) => Promise<void> | void;
  onRenameTag: (oldName: string, newName: string) => Promise<void>;
  onDeleteTag: (name: string) => Promise<void>;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
}: TagManagerDialogProps) {
  const [newTagName, setNewTagName] = useState("");
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [deletingTag, setDeletingTag] = useState<TagInfo | null>(null);
  const [searchFilter, setSearchFilter] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagName.trim().replace(/^#/, "");
    if (!clean) return;

    if (tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      toast.error("A tag with this name already exists");
      return;
    }

    await onCreateTag(clean);
    setNewTagName("");
    toast.success(`Tag #${clean} added`);
  };

  const handleStartEdit = (tag: TagInfo) => {
    setEditingTagName(tag.name);
    setEditingValue(tag.name);
  };

  const handleSaveEdit = async (oldName: string) => {
    const clean = editingValue.trim().replace(/^#/, "");
    if (!clean) {
      toast.error("Tag name cannot be empty");
      return;
    }

    if (
      clean.toLowerCase() !== oldName.toLowerCase() &&
      tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())
    ) {
      toast.error("A tag with this name already exists");
      return;
    }

    await onRenameTag(oldName, clean);
    setEditingTagName(null);
    toast.success("Tag updated");
  };

  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    await onDeleteTag(deletingTag.name);
    setDeletingTag(null);
    toast.success(`Tag #${deletingTag.name} deleted`);
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchFilter.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <DialogTitle className="text-lg font-semibold">Manage Tags</DialogTitle>
          </div>
        </DialogHeader>

        {/* Delete Confirmation Step */}
        {deletingTag ? (
          <div className="space-y-4 py-3">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-foreground">
                  Delete Tag #{deletingTag.name}?
                </p>
                <p className="text-muted-foreground">
                  {deletingTag.count > 0
                    ? `This tag is currently attached to ${deletingTag.count} link${
                        deletingTag.count === 1 ? "" : "s"
                      }. Deleting it will remove the tag from those links.`
                    : "This tag is not currently attached to any links."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingTag(null)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                className="rounded-xl text-xs gap-1.5"
              >
                <Trash2 className="size-3.5" />
                Delete Tag
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Create New Tag Form */}
            <form onSubmit={handleAdd} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  #
                </span>
                <Input
                  placeholder="New tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="pl-7 rounded-xl text-xs bg-background h-9"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!newTagName.trim()}
                className="rounded-xl text-xs gap-1.5 shrink-0 h-9"
              >
                <Plus className="size-3.5" />
                Add Tag
              </Button>
            </form>

            {/* Filter Search if many tags */}
            {tags.length > 5 && (
              <Input
                placeholder="Filter tags..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="rounded-xl text-xs bg-background/60 h-8"
              />
            )}

            {/* Tags List */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const isEditing = editingTagName === tag.name;

                  return (
                    <div
                      key={tag.name}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors text-xs"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xs font-semibold text-muted-foreground">#</span>
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEdit(tag.name);
                              } else if (e.key === "Escape") {
                                setEditingTagName(null);
                              }
                            }}
                            autoFocus
                            className="h-7 text-xs px-2 py-0 rounded-lg flex-1 min-w-0"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveEdit(tag.name)}
                            className="size-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                          >
                            <CheckIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingTagName(null)}
                            className="size-7 rounded-lg text-muted-foreground hover:bg-muted shrink-0"
                          >
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium text-foreground truncate">
                              #{tag.name}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
                              {tag.count} {tag.count === 1 ? "link" : "links"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartEdit(tag)}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Rename Tag"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeletingTag(tag)}
                              className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete Tag"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  {searchFilter ? "No matching tags found" : "No tags created yet"}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

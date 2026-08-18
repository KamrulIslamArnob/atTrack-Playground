"use client";

import { useEffect, useState } from "react";
import { LinkCategory, SocialLink, CreateLinkInput } from "@/lib/types/links";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { Plus, FileSpreadsheet, FileJson } from "lucide-react";
import { WebsiteFavicon } from "./website-favicon";

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: LinkCategory[];
  initialCategoryId?: string;
  linkToEdit?: SocialLink | null;
  existingTags?: string[];
  onSubmit: (data: CreateLinkInput, editId?: string) => Promise<void>;
  onCreateCategoryInline: (name: string) => Promise<string | undefined>;
  onOpenCsv?: () => void;
  onOpenJson?: () => void;
}

export function LinkDialog({
  open,
  onOpenChange,
  categories,
  initialCategoryId,
  linkToEdit,
  existingTags = [],
  onSubmit,
  onCreateCategoryInline,
  onOpenCsv,
  onOpenJson,
}: LinkDialogProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    if (linkToEdit) {
      setTitle(linkToEdit.title);
      setUrl(linkToEdit.url);
      setCategoryId(linkToEdit.category_id);
      setNotes(linkToEdit.notes ?? "");
      setTags(linkToEdit.tags ?? []);
    } else {
      setTitle("");
      setUrl("");
      setCategoryId(initialCategoryId ?? categories[0]?.id ?? "");
      setNotes("");
      setTags([]);
    }
    setShowInlineCat(false);
    setNewCatName("");
  }, [linkToEdit, initialCategoryId, categories, open]);

  // Auto populate title from URL domain if title is empty
  const handleUrlBlur = () => {
    if (url && !title) {
      try {
        const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
        const domain = parsed.hostname.replace(/^www\./, "");
        if (domain) {
          setTitle(domain.charAt(0).toUpperCase() + domain.slice(1));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleCreateInlineCategory = async () => {
    if (!newCatName.trim()) return;
    const newId = await onCreateCategoryInline(newCatName.trim());
    if (newId) {
      setCategoryId(newId);
      setShowInlineCat(false);
      setNewCatName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !categoryId) return;

    setLoading(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          url: url.trim(),
          category_id: categoryId,
          notes: notes.trim() || null,
          tags: tags,
        },
        linkToEdit?.id
      );
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {linkToEdit ? "Edit Link" : "Add New Link"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* URL Input */}
          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-xs font-medium text-foreground">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="url"
              placeholder="https://example.com/job-board"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              required
              className="rounded-lg"
            />
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-foreground">
              Title <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              {url.trim() && (
                <WebsiteFavicon url={url} title={title} className="size-9 rounded-lg shrink-0" />
              )}
              <Input
                id="title"
                placeholder="e.g. LinkedIn Job Search"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="rounded-lg flex-1"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="category" className="text-xs font-medium text-foreground">
                Category <span className="text-destructive">*</span>
              </Label>
              {!showInlineCat && (
                <button
                  type="button"
                  onClick={() => setShowInlineCat(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="size-3" /> New Category
                </button>
              )}
            </div>

            {showInlineCat ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="rounded-lg text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateInlineCategory}
                  className="rounded-lg text-xs shrink-0"
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInlineCat(false)}
                  className="rounded-lg text-xs shrink-0"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select value={categoryId} onValueChange={(val) => val && setCategoryId(val)}>
                <SelectTrigger
                  id="category"
                  className="rounded-lg w-full max-w-full whitespace-normal break-words min-w-0"
                >
                  <SelectValue placeholder="Select a category">
                    {(value: string | null) =>
                      value
                        ? categories.find((c) => c.id === value)?.name ?? value
                        : "Select a category"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl w-56 max-w-[80vw] whitespace-normal">
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="whitespace-normal break-words">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notion-like Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Tags (Optional)
            </Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              existingTags={existingTags}
              placeholder="Write a tag and press Enter..."
            />
          </div>

          {/* Notes Input */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium text-foreground">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add key notes, password hints, or target filters..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-lg resize-none text-xs"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {!linkToEdit && (
              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenJson && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenJson}
                    className="rounded-lg gap-1.5 text-xs font-medium active:scale-[0.98] transition-transform"
                  >
                    <FileJson className="size-3.5 text-muted-foreground" />
                    JSON
                  </Button>
                )}
                {onOpenCsv && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenCsv}
                    className="rounded-lg gap-1.5 text-xs font-medium active:scale-[0.98] transition-transform"
                  >
                    <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                    CSV
                  </Button>
                )}
              </div>
            )}
            <DialogFooter className="pt-0 flex-1 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-lg active:scale-[0.98] transition-transform"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-brand text-foreground font-medium active:scale-[0.98] transition-transform"
              >
                {loading ? "Saving..." : linkToEdit ? "Update Link" : "Add Link"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

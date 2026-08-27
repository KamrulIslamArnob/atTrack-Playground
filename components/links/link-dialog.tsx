"use client";

import { useEffect, useState } from "react";
import { LinkCategory, SocialLink, CreateLinkInput, CreateQuickShortcutInput } from "@/lib/types/links";
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
import { Plus, FileSpreadsheet, FileJson, Folder, Bookmark, Zap } from "lucide-react";
import { WebsiteFavicon } from "./website-favicon";
import { PRESET_ICONS } from "./quick-shortcut-dialog";
import { Switch } from "@/components/settings/startup-service-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function detectShortcutIcon(urlStr: string, titleStr: string): string {
  const combined = `${urlStr} ${titleStr}`.toLowerCase();
  if (combined.includes("linkedin")) return "linkedin";
  if (combined.includes("github")) return "github";
  if (combined.includes("facebook")) return "facebook";
  if (combined.includes("instagram")) return "instagram";
  if (combined.includes("twitter") || combined.includes("x.com")) return "twitter";
  if (combined.includes("mail") || combined.includes("@")) return "mail";
  if (combined.includes("tel:") || combined.includes("phone")) return "phone";
  if (combined.includes("leetcode") || combined.includes("code")) return "code";
  if (combined.includes("discord")) return "message";
  if (combined.includes("t.me") || combined.includes("telegram")) return "send";
  if (combined.includes("resume") || combined.includes("cv")) return "file-text";
  if (combined.includes("job") || combined.includes("career")) return "briefcase";
  return "link";
}

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: LinkCategory[];
  initialCategoryId?: string;
  linkToEdit?: SocialLink | null;
  existingTags?: string[];
  onSubmit: (data: CreateLinkInput, editId?: string) => Promise<void>;
  onSubmitShortcut?: (input: CreateQuickShortcutInput) => Promise<void>;
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
  onSubmitShortcut,
  onCreateCategoryInline,
  onOpenCsv,
  onOpenJson,
}: LinkDialogProps) {
  const [activeTab, setActiveTab] = useState<"folder" | "collection" | "shortcut">("folder");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [addToShortcut, setAddToShortcut] = useState(false);

  // Shortcut specific state
  const [shortcutTitle, setShortcutTitle] = useState("");
  const [shortcutValue, setShortcutValue] = useState("");
  const [shortcutIcon, setShortcutIcon] = useState("link");

  const [loading, setLoading] = useState(false);
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  useEffect(() => {
    if (linkToEdit) {
      setActiveTab("folder");
      setTitle(linkToEdit.title);
      setUrl(linkToEdit.url);
      setCategoryId(linkToEdit.category_id);
      setNotes(linkToEdit.notes ?? "");
      setTags(linkToEdit.tags ?? []);
      setAddToShortcut(false);
    } else {
      setTitle("");
      setUrl("");
      setCategoryId(initialCategoryId ?? categories[0]?.id ?? "");
      setNotes("");
      setTags([]);
      setAddToShortcut(false);
      setShortcutTitle("");
      setShortcutValue("");
      setShortcutIcon("link");
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
          const autoTitle = domain.charAt(0).toUpperCase() + domain.slice(1);
          setTitle(autoTitle);
          if (!shortcutTitle) setShortcutTitle(autoTitle);
        }
      } catch {
        // ignore
      }
    }
    if (url && !shortcutValue) {
      setShortcutValue(url);
    }
    if (url) {
      setShortcutIcon(detectShortcutIcon(url, title));
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

    if (activeTab === "shortcut") {
      if (!shortcutTitle.trim()) return;
      setLoading(true);
      try {
        if (onSubmitShortcut) {
          await onSubmitShortcut({
            title: shortcutTitle.trim(),
            value: shortcutValue.trim(),
            icon: shortcutIcon,
          });
          toast.success("Added to Quick Shortcuts");
        }
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
      return;
    }

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

      if (addToShortcut && onSubmitShortcut && !linkToEdit) {
        await onSubmitShortcut({
          title: title.trim(),
          value: url.trim(),
          icon: detectShortcutIcon(url, title),
        });
      }

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
            {linkToEdit ? "Edit Link" : "Add Link & Shortcut"}
          </DialogTitle>
        </DialogHeader>

        {!linkToEdit && (
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/40 p-1 text-xs font-medium border border-border/60 mt-1">
            <button
              type="button"
              onClick={() => setActiveTab("folder")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer select-none",
                activeTab === "folder"
                  ? "bg-background text-foreground shadow-2xs font-semibold border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Folder className="size-3.5 text-amber-500" />
              <span>Bookmark Folder</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("collection")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer select-none",
                activeTab === "collection"
                  ? "bg-background text-foreground shadow-2xs font-semibold border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bookmark className="size-3.5 text-primary" />
              <span>Collection</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("shortcut")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all cursor-pointer select-none",
                activeTab === "shortcut"
                  ? "bg-background text-foreground shadow-2xs font-semibold border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className="size-3.5 text-amber-400" />
              <span>Shortcut</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {activeTab === "shortcut" ? (
            <>
              {/* Shortcut Title */}
              <div className="space-y-1.5">
                <Label htmlFor="shortcut-title" className="text-xs font-medium text-foreground">
                  Shortcut Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="shortcut-title"
                  placeholder="e.g. LinkedIn, Portfolio, Discord..."
                  value={shortcutTitle}
                  onChange={(e) => setShortcutTitle(e.target.value)}
                  required
                  className="rounded-lg"
                />
              </div>

              {/* Shortcut Value / URL */}
              <div className="space-y-1.5">
                <Label htmlFor="shortcut-value" className="text-xs font-medium text-foreground">
                  URL or Text Value
                </Label>
                <Input
                  id="shortcut-value"
                  placeholder="https://... or username"
                  value={shortcutValue}
                  onChange={(e) => {
                    setShortcutValue(e.target.value);
                    setShortcutIcon(detectShortcutIcon(e.target.value, shortcutTitle));
                  }}
                  className="rounded-lg"
                />
              </div>

              {/* Shortcut Icon Picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Choose Icon</Label>
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 rounded-xl border border-border/60 bg-muted/20">
                  {PRESET_ICONS.map((preset) => {
                    const isSelected = shortcutIcon === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setShortcutIcon(preset.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border text-[11px] transition-all cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                            : "border-transparent hover:bg-background/80 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {preset.render("size-4")}
                        <span className="truncate max-w-full">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
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

              {/* Category Dropdown (Primary in Folder tab, secondary in Collection) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category" className="text-xs font-medium text-foreground">
                    {activeTab === "folder" ? "Bookmark Folder" : "Category"} <span className="text-destructive">*</span>
                  </Label>
                  {!showInlineCat && (
                    <button
                      type="button"
                      onClick={() => setShowInlineCat(true)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
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

              {/* Tags Section (Highlighted in Collection tab) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>{activeTab === "collection" ? "Collection Tags" : "Tags (Optional)"}</span>
                  {activeTab === "collection" && (
                    <span className="text-[10px] text-primary font-normal">Organize into collections</span>
                  )}
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

              {/* Add to Shortcut Toggle */}
              {!linkToEdit && onSubmitShortcut && (
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Add to Shortcut</p>
                      <p className="text-[11px] text-muted-foreground">Pin to top quick-access shortcuts bar</p>
                    </div>
                  </div>
                  <Switch
                    checked={addToShortcut}
                    onCheckedChange={() => setAddToShortcut(!addToShortcut)}
                    label="Add to Quick Shortcuts"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {!linkToEdit && activeTab !== "shortcut" && (
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
                {loading
                  ? "Saving..."
                  : linkToEdit
                  ? "Update Link"
                  : activeTab === "shortcut"
                  ? "Add to Shortcuts"
                  : "Save Bookmark"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import type { AiMemory } from "@/lib/types/memories";
import {
  createMemory,
  updateMemory,
  deleteMemory,
} from "@/lib/actions/memories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/components/ai-chatbot/markdown";
import {
  Brain,
  Plus,
  Search,
  Upload,
  FileText,
  Trash2,
  Edit2,
  Copy,
  Check,
  Sparkles,
  Eye,
  Code,
  X,
  FileCode2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MemoriesTabProps {
  initialMemories: AiMemory[];
}

export function MemoriesTab({ initialMemories }: MemoriesTabProps) {
  const [memories, setMemories] = useState<AiMemory[]>(initialMemories);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<AiMemory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const filteredMemories = memories.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchTitle = m.title ? m.title.toLowerCase().includes(q) : false;
    const matchDesc = m.description.toLowerCase().includes(q);
    return matchTitle || matchDesc;
  });

  const openCreateDialog = () => {
    setEditingMemory(null);
    setTitle("");
    setDescription("");
    setPreviewMode("edit");
    setIsDialogOpen(true);
  };

  const openEditDialog = (memory: AiMemory) => {
    setEditingMemory(memory);
    setTitle(memory.title || "");
    setDescription(memory.description);
    setPreviewMode("edit");
    setIsDialogOpen(true);
  };

  const handleFileRead = useCallback((file: File, autoSave = false) => {
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || "";
      if (autoSave) {
        startTransition(async () => {
          try {
            const saved = await createMemory({
              title: fileNameWithoutExt,
              description: content,
            });
            setMemories((prev) => [saved, ...prev]);
            toast.success(`Imported memory from "${file.name}"`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to import markdown file");
          }
        });
      } else {
        setTitle(fileNameWithoutExt);
        setDescription(content);
        toast.info(`Loaded content from "${file.name}"`);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => handleFileRead(file, true));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleModalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileRead(file, false);
    if (modalFileInputRef.current) modalFileInputRef.current.value = "";
  };

  const handleSaveMemory = () => {
    if (!description.trim()) {
      toast.error("Memory markdown content cannot be empty");
      return;
    }

    startTransition(async () => {
      try {
        if (editingMemory) {
          const updated = await updateMemory(editingMemory.id, {
            title: title.trim() || null,
            description: description.trim(),
          });
          setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          toast.success("AI Memory updated");
        } else {
          const created = await createMemory({
            title: title.trim() || null,
            description: description.trim(),
          });
          setMemories((prev) => [created, ...prev]);
          toast.success("AI Memory created");
        }
        setIsDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save memory");
      }
    });
  };

  const handleDeleteMemory = async (id: string, memoryTitle: string | null) => {
    const confirmed = await confirm({
      title: "Delete this memory?",
      description: `"${memoryTitle || "Untitled memory"}" will be permanently deleted, and the assistant will stop using it. This can't be undone.`,
      confirmText: "Delete memory",
      variant: "destructive",
    });
    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteMemory(id);
        setMemories((prev) => prev.filter((m) => m.id !== id));
        toast.success("AI Memory deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete memory");
      }
    });
  };

  const handleCopyMarkdown = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success("Copied markdown content to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const charCount = description.length;

  return (
    <div className="space-y-6">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories by title or markdown text..."
            className="w-full rounded-xl border border-border/70 bg-card py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            className="hidden"
            onChange={handleGlobalFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-border/70 gap-1.5 text-xs font-medium hover:bg-muted/80 active:scale-[0.98] cursor-pointer"
            title="Import markdown (.md) file directly"
          >
            <Upload className="size-3.5" />
            <span>Upload .md file</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={openCreateDialog}
            className="rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white gap-1.5 text-xs font-medium shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Memory</span>
          </Button>
        </div>
      </div>

      {/* Empty State or Grid */}
      {filteredMemories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-10 text-center flex flex-col items-center justify-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs">
            <Brain className="size-7" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {searchQuery ? "No matching memories found" : "No AI Memories Saved Yet"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {searchQuery
                ? `No memories matched "${searchQuery}". Try a different keyword.`
                : "Save your resume notes, personal guidelines, project details, or company preferences as Markdown. The AI Chatbot automatically grounds responses in your memories and you can connect them in chat using '@'."}
            </p>
          </div>
          {!searchQuery && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={openCreateDialog}
                className="rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>Create Memory</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl text-xs gap-1.5 cursor-pointer"
              >
                <Upload className="size-3.5" />
                <span>Upload .md file</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map((mem) => {
            const memWordCount = mem.description.trim().split(/\s+/).length;
            const isCopied = copiedId === mem.id;
            const updatedDate = new Date(mem.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={mem.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <Brain className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-foreground tracking-tight">
                          {mem.title || <span className="italic text-muted-foreground">Untitled Memory</span>}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>Updated {updatedDate}</span>
                          <span>·</span>
                          <span>{memWordCount} words</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyMarkdown(mem.id, mem.description)}
                        className="flex size-7 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-100/90 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700/60 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all duration-150 shadow-2xs cursor-pointer"
                        title="Copy Markdown"
                      >
                        {isCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditDialog(mem)}
                        className="flex size-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100/90 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-700 transition-all duration-150 shadow-2xs cursor-pointer"
                        title="Edit Memory"
                      >
                        <Edit2 className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(mem.id, mem.title)}
                        className="flex size-7 items-center justify-center rounded-lg border border-rose-200/70 bg-rose-50/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 transition-all duration-150 shadow-2xs cursor-pointer"
                        title="Delete Memory"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Markdown Content Body */}
                  <div className="mt-3.5 max-h-[160px] overflow-y-auto rounded-xl bg-muted/20 p-3 border border-border/40 font-mono text-[11px] leading-relaxed text-muted-foreground scrollbar-thin">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed">
                      {mem.description}
                    </pre>
                  </div>
                </div>

                {/* Footer Tag */}
                <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-border/30 text-[11px] text-muted-foreground/80">
                  <span className="flex items-center gap-1 text-primary">
                    <Sparkles className="size-3" />
                    Available in Chatbot & @ Mentions
                  </span>
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    @{mem.title ? mem.title.replace(/\s+/g, "_") : "memory"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Memory Modal */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && setIsDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Brain className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  {editingMemory ? "Edit AI Memory" : "Create New AI Memory"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Save structured notes, career context, or personal rules in Markdown.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Title field (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="memory-title" className="text-xs font-semibold text-foreground">
                  Memory Title <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept=".md,.markdown,.txt"
                  className="hidden"
                  onChange={handleModalFileUpload}
                />
                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="size-3" /> Load from .md file
                </button>
              </div>
              <Input
                id="memory-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Career Goals, Project Guidelines, Coding Rules..."
                className="rounded-xl border-border/70 text-xs py-2 bg-background focus:border-blue-500"
              />
            </div>

            {/* Markdown Content Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="memory-desc" className="text-xs font-semibold text-foreground">
                  Markdown Content <span className="text-rose-500">*</span>
                </Label>
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("edit")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                      previewMode === "edit"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Code className="size-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("preview")}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer",
                      previewMode === "preview"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Eye className="size-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {previewMode === "edit" ? (
                <Textarea
                  id="memory-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="# My Career & Project Context&#10;- Preferred roles: Senior Fullstack Engineer&#10;- Key skills: Next.js, React, TypeScript, Python&#10;- Writing style: Concise, impactful, professional"
                  rows={10}
                  className="font-mono text-xs leading-relaxed rounded-xl border-border/70 bg-background/50 focus:bg-background resize-y"
                />
              ) : (
                <div className="min-h-[220px] max-h-[300px] overflow-y-auto rounded-xl border border-border/70 bg-background/40 p-4 prose dark:prose-invert prose-xs max-w-none">
                  {description.trim() ? (
                    <Markdown content={description} />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nothing to preview yet. Type some markdown content first.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>Supports standard GitHub Markdown, lists, headers, codeblocks</span>
                <span className="font-mono">{wordCount} words · {charCount} chars</span>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveMemory}
              disabled={isPending || !description.trim()}
              className="rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs gap-1.5"
            >
              {isPending ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
              <span>{editingMemory ? "Update Memory" : "Save Memory"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Brain, Trash2, Edit2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface MemoriesTabProps {
  initialMemories: AiMemory[];
}

const MEMORY_PRESETS = [
  {
    title: "Tech Stack & Core Skills",
    description: "5+ years experience in React, Next.js, TypeScript, Node.js, TailwindCSS, and PostgreSQL. Strong focus on frontend architecture and performance.",
  },
  {
    title: "Target Roles & Locations",
    description: "Targeting Senior Frontend Engineer or Full-stack Engineer positions. Open to Remote (US/Europe) or Hybrid in New York.",
  },
  {
    title: "Salary & Compensation Goals",
    description: "Target base compensation: $140,000 - $175,000 USD/year + equity. Minimum acceptable base: $130,000 USD.",
  },
  {
    title: "Communication Style & Tone",
    description: "Prefers direct, concise responses with minimal fluff. Always provide concrete code examples and quantifiable metrics in resume bullets.",
  },
];

export function MemoriesTab({ initialMemories }: MemoriesTabProps) {
  const [memories, setMemories] = useState<AiMemory[]>(initialMemories);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<AiMemory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const filteredMemories = memories.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchTitle = m.title ? m.title.toLowerCase().includes(q) : false;
    const matchDesc = m.description.toLowerCase().includes(q);
    return matchTitle || matchDesc;
  });

  const openCreateDialog = (preset?: { title: string; description: string }) => {
    setEditingMemory(null);
    setTitle(preset?.title || "");
    setDescription(preset?.description || "");
    setIsDialogOpen(true);
  };

  const openEditDialog = (memory: AiMemory) => {
    setEditingMemory(memory);
    setTitle(memory.title || "");
    setDescription(memory.description);
    setIsDialogOpen(true);
  };

  const handleSaveMemory = () => {
    if (!description.trim()) {
      toast.error("Memory content cannot be empty");
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
          toast.success("AI Memory saved to Tracky context");
        }
        setIsDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save memory");
      }
    });
  };

  const handleDeleteMemory = async (memory: AiMemory) => {
    const ok = await confirm({
      title: "Delete AI memory?",
      description: "Tracky will no longer retain this context in future chat conversations.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteMemory(memory.id);
        setMemories((prev) => prev.filter((m) => m.id !== memory.id));
        toast.success("AI Memory deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete memory");
      }
    });
  };

  return (
    <div className="space-y-5">
      {dialog}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              Tracky Workspace Memory
            </h2>
            <span className="rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
              {memories.length} memories
            </span>
          </div>
          <p className="max-w-[56ch] text-xs leading-relaxed text-muted-foreground">
            Persistent profile facts Tracky always retains. Type <code className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">@memory</code> in chat to reference context.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => openCreateDialog()}
          className="micro-press h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-medium shadow-xs"
        >
          <Plus className="size-3.5" />
          Add memory
        </Button>
      </div>

      {memories.length < 4 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Quick add preset:</span>
          {MEMORY_PRESETS.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => openCreateDialog(preset)}
              className="h-7.5 inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-all duration-140 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground active:scale-95 shadow-2xs cursor-pointer"
            >
              <span className="text-primary text-[11px] font-bold">+</span>
              {preset.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search memories by title, tag, or content…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 rounded-lg bg-card ps-9 text-xs border border-border/80 placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredMemories.map((memory) => {
          const mentionTag = memory.title ? `@${memory.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}` : "@memory";
          return (
            <div
              key={memory.id}
              className="group flex flex-col justify-between gap-3.5 rounded-2xl bg-muted/50 dark:bg-muted/25 p-4 transition-all duration-200 hover:bg-muted/70"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background text-primary shrink-0 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors shadow-2xs">
                      <Brain className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                        {memory.title || "User Profile Context"}
                      </h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                          {mentionTag}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(memory)}
                      aria-label="Edit memory"
                      className="size-7.5 rounded-lg text-muted-foreground hover:text-foreground border border-border/60 hover:border-border bg-card hover:bg-muted shadow-2xs"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteMemory(memory)}
                      aria-label="Delete memory"
                      className="size-7.5 rounded-lg text-muted-foreground hover:text-destructive border border-border/60 hover:border-destructive/30 bg-card hover:bg-muted shadow-2xs"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {memory.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-[10px] leading-none text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
                  Active in Chat Context
                </span>
                <span className="tabular-nums">
                  Updated {new Date(memory.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMemories.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <Brain className="size-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">No memories found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchQuery ? "Try a different search query." : "Add core facts and preferences so Tracky always remembers your background."}
          </p>
          {!searchQuery && (
            <Button size="sm" onClick={() => openCreateDialog()} className="mt-4 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add First Memory
            </Button>
          )}
        </div>
      )}

      {/* Memory Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              {editingMemory ? "Edit AI Memory" : "Add AI Memory"}
            </DialogTitle>
            <DialogDescription>
              Core facts, background information, or goals that Tracky will always hold in context.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="mem-title" className="text-xs">Memory Label / Tag</Label>
              <Input
                id="mem-title"
                placeholder="e.g. Target Roles, Core Stack, Preferred Salary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mem-desc" className="text-xs">Fact / Information</Label>
              <Textarea
                id="mem-desc"
                placeholder="e.g. 5+ years experience in React and TypeScript. Targeting Senior Frontend roles with $150k+ base salary."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="text-xs resize-y"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveMemory} disabled={isPending} className="gap-1.5">
              {isPending && <Spinner className="size-3" />}
              {editingMemory ? "Save Changes" : "Add Memory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

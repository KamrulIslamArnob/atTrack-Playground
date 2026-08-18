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
import {
  Brain,
  Trash2,
  Edit2,
  Plus,
  Search,
  Sparkles,
  User,
  Briefcase,
  Target,
  DollarSign,
  Tag,
} from "lucide-react";
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
        toast.error(err instanceof Error ? err.message : "Failed to save memory");
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
        toast.error(err instanceof Error ? err.message : "Failed to delete memory");
      }
    });
  };

  return (
    <div className="space-y-6">
      {dialog}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            Tracky AI Memory & Core Context
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Core facts and profile details about you that Tracky always holds in the active context window. Mention in chat with{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">@memory</code>.
          </p>
        </div>

        <Button size="sm" onClick={() => openCreateDialog()} className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90">
          <Plus className="size-3.5" />
          Add Memory
        </Button>
      </div>

      {/* Presets if few memories */}
      {memories.length < 3 && (
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Quick Presets — Tell Tracky about yourself:
          </div>
          <div className="flex flex-wrap gap-2">
            {MEMORY_PRESETS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => openCreateDialog(preset)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-background border border-border/60 hover:border-primary/50 hover:text-primary transition-colors text-muted-foreground flex items-center gap-1"
              >
                <Plus className="size-2.5" />
                {preset.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search memories by keyword or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredMemories.map((memory) => {
          const mentionTag = memory.title ? `@${memory.title.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}` : "@memory";
          return (
            <div
              key={memory.id}
              className="flex flex-col justify-between p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-xs transition-all text-left group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Brain className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {memory.title || "User Profile Context"}
                      </h3>
                      <p className="text-[11px] font-mono text-muted-foreground/80 truncate">
                        {mentionTag}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(memory)}
                      title="Edit memory"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteMemory(memory)}
                      title="Delete memory"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-foreground/90 mt-3 leading-relaxed whitespace-pre-wrap">
                  {memory.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Tag className="size-2.5" />
                  Active in Tracky Context
                </span>
                <span>Updated {new Date(memory.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMemories.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/70 bg-muted/10">
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

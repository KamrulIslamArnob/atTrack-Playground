"use client";

import { useState, useTransition, useRef } from "react";
import type { Skill } from "@/lib/types/skills";
import { createSkill, updateSkill, deleteSkill } from "@/lib/actions/skills";
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
import { Markdown } from "@/components/ai-chatbot/markdown";
import {
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Code2,
  FileText,
  UserCheck,
  Send,
  Briefcase,
  Users,
  DollarSign,
  Terminal,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SkillsTabProps {
  initialSkills: Skill[];
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  FileText,
  UserCheck,
  Send,
  DollarSign,
  Code2,
  Briefcase,
  Users,
  Terminal,
};

export function SkillsTab({ initialSkills }: SkillsTabProps) {
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [iconName, setIconName] = useState("Sparkles");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  const filteredSkills = skills.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchName = s.name.toLowerCase().includes(q);
    const matchCmd = s.command.toLowerCase().includes(q);
    const matchDesc = s.description ? s.description.toLowerCase().includes(q) : false;
    const matchInst = s.instructions.toLowerCase().includes(q);
    return matchName || matchCmd || matchDesc || matchInst;
  });

  const openCreateDialog = () => {
    setEditingSkill(null);
    setName("");
    setCommand("");
    setDescription("");
    setInstructions("");
    setIconName("Sparkles");
    setPreviewMode("edit");
    setIsDialogOpen(true);
  };

  const openEditDialog = (skill: Skill) => {
    if (skill.is_builtin) {
      toast.info("Built-in skills cannot be directly edited. Duplicate to create a custom version.");
      setEditingSkill(null);
      setName(`${skill.name} (Custom)`);
      setCommand(`${skill.command}-custom`);
      setDescription(skill.description || "");
      setInstructions(skill.instructions);
      setIconName(skill.icon || "Sparkles");
      setPreviewMode("edit");
      setIsDialogOpen(true);
      return;
    }
    setEditingSkill(skill);
    setName(skill.name);
    setCommand(skill.command);
    setDescription(skill.description || "");
    setInstructions(skill.instructions);
    setIconName(skill.icon || "Sparkles");
    setPreviewMode("edit");
    setIsDialogOpen(true);
  };

  const handleSaveSkill = () => {
    if (!name.trim()) {
      toast.error("Please provide a skill name");
      return;
    }
    const cleanCmd = command.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanCmd) {
      toast.error("Please provide a valid slash command (e.g. resume, review)");
      return;
    }
    if (!instructions.trim()) {
      toast.error("Please provide instructions for the skill");
      return;
    }

    startTransition(async () => {
      try {
        if (editingSkill) {
          const updated = await updateSkill(editingSkill.id, {
            name,
            command: cleanCmd,
            description,
            instructions,
            icon: iconName,
          });
          setSkills((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          toast.success(`Updated skill "/${cleanCmd}"`);
        } else {
          const created = await createSkill({
            name,
            command: cleanCmd,
            description,
            instructions,
            icon: iconName,
          });
          setSkills((prev) => [created, ...prev]);
          toast.success(`Created skill "/${cleanCmd}"`);
        }
        setIsDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save skill");
      }
    });
  };

  const handleDeleteSkill = async (skill: Skill) => {
    if (skill.is_builtin) return;
    const ok = await confirm({
      title: `Delete skill "/${skill.command}"?`,
      description: "This custom skill will be permanently removed from your chatbot slash commands.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteSkill(skill.id);
        setSkills((prev) => prev.filter((s) => s.id !== skill.id));
        toast.success(`Deleted skill "/${skill.command}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete skill");
      }
    });
  };

  const handleCopyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(`/${cmd}`);
    setCopiedId(id);
    toast.success(`Copied "/${cmd}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = (evt.target?.result as string) || "";
        if (content.trim()) {
          startTransition(async () => {
            try {
              const cmd = fileName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
              const created = await createSkill({
                name: fileName,
                command: cmd || "custom",
                description: `Imported from ${file.name}`,
                instructions: content,
                icon: "Sparkles",
              });
              setSkills((prev) => [created, ...prev]);
              toast.success(`Imported skill "/${created.command}" from ${file.name}`);
            } catch (err) {
              toast.error(`Couldn't import ${file.name}: ${err instanceof Error ? err.message : ""}`);
            }
          });
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="space-y-5">
      {dialog}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Skills & Slash Commands</h2>
            <span className="rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
              {skills.length} available
            </span>
          </div>
          <p className="max-w-[56ch] text-xs leading-relaxed text-muted-foreground">
            Custom prompt routines for Tracky AI chat. Type <code className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">/resume</code> in chat to execute.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportMarkdown}
            multiple
            accept=".md,.txt,.prompt"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="micro-press h-8 rounded-lg gap-1.5 border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Upload className="size-3.5 text-muted-foreground" />
            Import (.md)
          </Button>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="micro-press h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-medium shadow-xs"
          >
            <Plus className="size-3.5" />
            New skill
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search skills by name, command, or instructions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 rounded-lg bg-card ps-9 text-xs border border-border/80 placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredSkills.map((skill) => {
          const IconComp = (skill.icon && ICON_MAP[skill.icon]) || Sparkles;
          return (
            <div
              key={skill.id}
              className="group flex flex-col justify-between gap-3.5 rounded-2xl bg-muted/50 dark:bg-muted/25 p-4 transition-all duration-200 hover:bg-muted/70"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-background text-primary shrink-0 group-hover:border-primary/30 group-hover:bg-primary/5 transition-colors shadow-2xs">
                      <IconComp className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
                          {skill.name}
                        </h3>
                        {skill.is_builtin && (
                          <span className="shrink-0 rounded-full border border-border/80 bg-background px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground shadow-2xs">
                            Built-in
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                          /{skill.command}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCopyCommand(skill.command, skill.id)}
                      aria-label="Copy command"
                      className="size-7.5 rounded-lg text-muted-foreground hover:text-foreground border border-border/60 hover:border-border bg-card hover:bg-muted shadow-2xs"
                    >
                      {copiedId === skill.id ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(skill)}
                      aria-label={skill.is_builtin ? "Duplicate skill" : "Edit skill"}
                      className="size-7.5 rounded-lg text-muted-foreground hover:text-foreground border border-border/60 hover:border-border bg-card hover:bg-muted shadow-2xs"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    {!skill.is_builtin && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteSkill(skill)}
                        aria-label="Delete skill"
                        className="size-7.5 rounded-lg text-muted-foreground hover:text-destructive border border-border/60 hover:border-destructive/30 bg-card hover:bg-muted shadow-2xs"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {skill.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {skill.description}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
                <p className="line-clamp-3 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {skill.instructions}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <Sparkles className="size-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">No skills found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchQuery ? "Try a different search query." : "Create your first custom prompt skill to automate your chat workflows."}
          </p>
          {!searchQuery && (
            <Button size="sm" onClick={openCreateDialog} className="mt-4 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Create Skill
            </Button>
          )}
        </div>
      )}

      {/* Skill Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {editingSkill ? "Edit Custom Skill" : "Create New Skill"}
            </DialogTitle>
            <DialogDescription>
              Define a reusable prompt instruction set invoked via slash command in Tracky AI Chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="skill-name" className="text-xs">Skill Name</Label>
                <Input
                  id="skill-name"
                  placeholder="e.g. Technical Interviewer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8.5 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="skill-command" className="text-xs">Slash Command</Label>
                <div className="relative">
                  <span className="absolute start-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">/</span>
                  <Input
                    id="skill-command"
                    placeholder="interview"
                    value={command}
                    onChange={(e) => setCommand(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    className="ps-6 h-8.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-description" className="text-xs">Short Description (Optional)</Label>
              <Input
                id="skill-description"
                placeholder="e.g. Conducts a mock behavioral interview using STAR method"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="skill-instructions" className="text-xs">Prompt Instructions (Markdown)</Label>
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("edit")}
                    className={cn(
                      "px-2 py-0.5 text-[11px] rounded transition-colors",
                      previewMode === "edit" ? "bg-background shadow-2xs font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("preview")}
                    className={cn(
                      "px-2 py-0.5 text-[11px] rounded transition-colors",
                      previewMode === "preview" ? "bg-background shadow-2xs font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {previewMode === "edit" ? (
                <Textarea
                  id="skill-instructions"
                  placeholder="Enter detailed instructions for how Tracky should act and respond when this skill is invoked..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={8}
                  className="text-xs font-mono resize-y"
                />
              ) : (
                <div className="min-h-[160px] max-h-[260px] overflow-y-auto p-3 rounded-md border bg-muted/20 text-xs">
                  <Markdown content={instructions || "*No instructions entered yet.*"} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveSkill} disabled={isPending} className="gap-1.5">
              {isPending && <Spinner className="size-3" />}
              {editingSkill ? "Update Skill" : "Create Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

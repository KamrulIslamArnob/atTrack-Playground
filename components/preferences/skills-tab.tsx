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
        toast.error(err instanceof Error ? err.message : "Failed to save skill");
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
        toast.error(err instanceof Error ? err.message : "Failed to delete skill");
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
              toast.error(`Failed to import ${file.name}: ${err instanceof Error ? err.message : ""}`);
            }
          });
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="space-y-6">
      {dialog}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Chatbot Skills & Instructions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Skills are dedicated prompt instruction packs invoked via slash commands (e.g.{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">/resume</code>,{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">/interview</code>) in Tracky AI Chat.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
            className="h-8 gap-1.5 text-xs"
          >
            <Upload className="size-3.5" />
            Import .md
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90">
            <Plus className="size-3.5" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search skills by name, command, or instructions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredSkills.map((skill) => {
          const IconComp = (skill.icon && ICON_MAP[skill.icon]) || Sparkles;
          return (
            <div
              key={skill.id}
              className="flex flex-col justify-between p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-xs transition-all text-left group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <IconComp className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                        {skill.name}
                        {skill.is_builtin && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
                            Built-in
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] font-mono text-primary font-medium mt-0.5">
                        /{skill.command}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCopyCommand(skill.command, skill.id)}
                      title="Copy command"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === skill.id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(skill)}
                      title={skill.is_builtin ? "Duplicate to customize" : "Edit skill"}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3" />
                    </Button>
                    {!skill.is_builtin && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteSkill(skill)}
                        title="Delete skill"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {skill.description && (
                  <p className="text-xs text-muted-foreground mt-2.5 line-clamp-2">
                    {skill.description}
                  </p>
                )}

                <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border border-border/40 font-mono text-[11px] text-muted-foreground/90 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {skill.instructions}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/70 bg-muted/10">
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
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">/</span>
                  <Input
                    id="skill-command"
                    placeholder="interview"
                    value={command}
                    onChange={(e) => setCommand(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    className="pl-6 h-8.5 text-xs font-mono"
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

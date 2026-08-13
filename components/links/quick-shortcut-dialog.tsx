"use client";

import { useEffect, useState } from "react";
import { QuickShortcut, CreateQuickShortcutInput } from "@/lib/types/links";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  LinkedinIcon,
  GithubIcon,
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  RenderShortcutIcon,
} from "./social-icons";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Code,
  User,
  Link as LinkIcon,
  MessageSquare,
  Send,
  FileText,
  Briefcase,
} from "lucide-react";

export const PRESET_ICONS = [
  { id: "linkedin", label: "LinkedIn", render: (cls: string) => <LinkedinIcon className={cls} /> },
  { id: "github", label: "GitHub", render: (cls: string) => <GithubIcon className={cls} /> },
  { id: "facebook", label: "Facebook", render: (cls: string) => <FacebookIcon className={cls} /> },
  { id: "mail", label: "Email", render: (cls: string) => <Mail className={cls} /> },
  { id: "phone", label: "Phone", render: (cls: string) => <Phone className={cls} /> },
  { id: "map-pin", label: "Address / Location", render: (cls: string) => <MapPin className={cls} /> },
  { id: "instagram", label: "Instagram", render: (cls: string) => <InstagramIcon className={cls} /> },
  { id: "twitter", label: "X / Twitter", render: (cls: string) => <TwitterIcon className={cls} /> },
  { id: "globe", label: "Portfolio / Web", render: (cls: string) => <Globe className={cls} /> },
  { id: "code", label: "LeetCode / Code", render: (cls: string) => <Code className={cls} /> },
  { id: "user", label: "Profile", render: (cls: string) => <User className={cls} /> },
  { id: "link", label: "Custom Link", render: (cls: string) => <LinkIcon className={cls} /> },
  { id: "message", label: "Discord / Chat", render: (cls: string) => <MessageSquare className={cls} /> },
  { id: "send", label: "Telegram", render: (cls: string) => <Send className={cls} /> },
  { id: "file-text", label: "Resume", render: (cls: string) => <FileText className={cls} /> },
  { id: "briefcase", label: "Work / Portal", render: (cls: string) => <Briefcase className={cls} /> },
] as const;

interface QuickShortcutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcutToEdit?: QuickShortcut | null;
  onSubmit: (input: CreateQuickShortcutInput, editId?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function QuickShortcutDialog({
  open,
  onOpenChange,
  shortcutToEdit,
  onSubmit,
  onDelete,
}: QuickShortcutDialogProps) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState("link");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shortcutToEdit) {
      setTitle(shortcutToEdit.title);
      setValue(shortcutToEdit.value ?? "");
      setIcon(shortcutToEdit.icon ?? "link");
    } else {
      setTitle("");
      setValue("");
      setIcon("link");
    }
  }, [shortcutToEdit, open]);

  const handleSelectPreset = (preset: (typeof PRESET_ICONS)[number]) => {
    if (!title || PRESET_ICONS.some((p) => p.label === title)) {
      setTitle(preset.label);
    }
    setIcon(preset.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          value: value.trim(),
          icon: icon,
        },
        shortcutToEdit?.id
      );
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!shortcutToEdit || !onDelete) return;
    setLoading(true);
    try {
      await onDelete(shortcutToEdit.id);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {shortcutToEdit ? `Edit "${shortcutToEdit.title}" Shortcut` : "Add Quick Copy Shortcut"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Quick Presets row */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Quick Platform Presets
            </Label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar p-1 border border-border/50 rounded-xl bg-muted/20">
              {PRESET_ICONS.map((p) => {
                const isSelected = icon === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                        : "bg-background hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.render("size-3.5")}
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title input */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-title" className="text-xs font-medium">
              Shortcut Title / Label
            </Label>
            <Input
              id="sc-title"
              placeholder="e.g. LinkedIn, My GitHub, Primary Email, Phone"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="rounded-xl text-sm"
            />
          </div>

          {/* Value input */}
          <div className="space-y-1.5">
            <Label htmlFor="sc-value" className="text-xs font-medium">
              Value to Copy (URL, Handle, Email, Phone, or Text)
            </Label>
            <Input
              id="sc-value"
              placeholder="e.g. https://linkedin.com/in/username or +1 234 567 890"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Clicking the button on your dashboard will copy this exact value to your clipboard.
            </p>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
            {shortcutToEdit && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1 text-xs"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !title.trim()}
                className="rounded-xl bg-gradient-brand text-foreground text-xs font-medium"
              >
                {loading ? "Saving..." : shortcutToEdit ? "Save Changes" : "Add Shortcut"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  createCompanyContact,
  createPersonContact,
  updateContact,
  type Contact,
} from "@/lib/actions/contacts";
import { createCompany, type CrmCompany } from "@/lib/actions/companies";
import { getJobsForMention, type JobMentionOption } from "@/lib/actions/jobs-list";
import { insertMentionToken } from "@/lib/mentions";
import { getTagColorClass, cn } from "@/lib/utils";
import { Plus, Trash2, X, Link2, Building2 } from "lucide-react";
import { parseContactSocialLinks, type SocialLinkItem } from "./contact-card";

const NO_COMPANY = "__none__";
const NEW_COMPANY = "__new__";

const PRESET_TAGS = [
  "Recruiter",
  "Hiring Manager",
  "Employee",
  "Alumni",
  "Referral",
  "HR",
  "Technical Lead",
];

const SOCIAL_PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
  { value: "twitter", label: "Twitter / X" },
  { value: "website", label: "Portfolio / Website" },
  { value: "dribbble", label: "Dribbble" },
  { value: "youtube", label: "YouTube" },
  { value: "custom", label: "Custom Link" },
];

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  companies: CrmCompany[];
  lockedCompanyId?: string;
  tagSuggestions: string[];
  onSaved: (contact: Contact) => void;
}

interface SocialLinkStateItem {
  id: string;
  platform: string;
  url: string;
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  companies,
  lockedCompanyId,
  tagSuggestions,
  onSaved,
}: ContactFormDialogProps) {
  const mode = contact ? "edit" : "create";
  const [pending, setPending] = useState(false);
  
  // Company state
  const [companyId, setCompanyId] = useState<string>(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
  const [customCompanyName, setCustomCompanyName] = useState("");

  // Notion-style Tags state
  const [tags, setTags] = useState<string[]>(
    contact?.role
      ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
      : []
  );
  const [tagInput, setTagInput] = useState("");

  // Social Links state
  const [socialLinks, setSocialLinks] = useState<SocialLinkStateItem[]>([]);

  // Notes & Mentions state
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [jobOptions, setJobOptions] = useState<JobMentionOption[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset local state on open/contact change
  useEffect(() => {
    if (!open) return;
    setCompanyId(contact?.company_id ?? lockedCompanyId ?? NO_COMPANY);
    setCustomCompanyName("");
    setTags(
      contact?.role
        ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
        : []
    );
    setTagInput("");

    // Populate social links
    if (contact) {
      const parsed = parseContactSocialLinks(contact);
      setSocialLinks(
        parsed.map((item) => ({
          id: crypto.randomUUID(),
          platform: item.platform,
          url: item.url,
        }))
      );
    } else {
      setSocialLinks([
        { id: crypto.randomUUID(), platform: "linkedin", url: "" },
      ]);
    }

    setNotes(contact?.notes ?? "");
    setMention(null);
  }, [open, contact, lockedCompanyId]);

  useEffect(() => {
    if (!open) return;
    getJobsForMention().then(setJobOptions);
  }, [open]);

  const companyName = (id: string | null) => {
    if (id === NEW_COMPANY) return customCompanyName || "New Company";
    return companies.find((c) => c.id === id)?.name ?? null;
  };

  const handleAddTag = (newTag: string) => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleAddSocialLink = () => {
    setSocialLinks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), platform: "linkedin", url: "" },
    ]);
  };

  const handleUpdateSocialLink = (id: string, field: "platform" | "url", val: string) => {
    setSocialLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleRemoveSocialLink = (id: string) => {
    setSocialLinks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    const caret = e.target.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const at = uptoCaret.lastIndexOf("@");
    if (at === -1 || /\s/.test(uptoCaret.slice(at + 1))) {
      setMention(null);
    } else {
      setMention({ start: at, query: uptoCaret.slice(at + 1) });
    }
  };

  const pickMentionJob = (job: JobMentionOption) => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? notes.length;
    if (caret < mention.start || caret > mention.start + 1 + mention.query.length) {
      setMention(null);
      return;
    }
    const before = notes.slice(0, mention.start);
    const after = notes.slice(caret);
    const token = insertMentionToken(job.title, job.id);
    const next = `${before}${token} ${after}`;
    setNotes(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = (before + token + " ").length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const closeMentionIfCaretMoved = () => {
    if (!mention) return;
    const caret = textareaRef.current?.selectionStart ?? 0;
    const spanEnd = mention.start + 1 + mention.query.length;
    if (caret < mention.start || caret > spanEnd) {
      setMention(null);
    }
  };

  const filteredJobs = mention
    ? jobOptions.filter((j) => j.title.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 6)
    : [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nameVal = (e.currentTarget.elements.namedItem("name") as HTMLInputElement)?.value.trim();
    if (!nameVal) {
      toast.error("Name is required");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      
      // If user selected "create new company" or typed a new company name
      let resolvedCompanyId = lockedCompanyId ?? (companyId === NO_COMPANY ? null : companyId);
      if (companyId === NEW_COMPANY && customCompanyName.trim()) {
        const compFormData = new FormData();
        compFormData.append("name", customCompanyName.trim());
        const { id: newCompId } = await createCompany(compFormData);
        resolvedCompanyId = newCompId;
      }

      // Serialize tags and social links
      formData.set("role", tags.join(", "));
      
      const cleanSocialLinks = socialLinks
        .filter((l) => l.url.trim() !== "")
        .map((l) => ({ platform: l.platform, url: l.url.trim() }));
      formData.set("social_links", JSON.stringify(cleanSocialLinks));

      const linkedinItem = cleanSocialLinks.find((l) => l.platform === "linkedin");
      const githubItem = cleanSocialLinks.find((l) => l.platform === "github");
      if (linkedinItem) formData.set("linkedin_url", linkedinItem.url);
      if (githubItem) formData.set("github_url", githubItem.url);

      const fields = {
        name: nameVal,
        role: tags.join(", ") || null,
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
        position: (formData.get("position") as string) || null,
        linkedin_url: linkedinItem?.url ?? (formData.get("linkedin_url") as string) ?? null,
        github_url: githubItem?.url ?? (formData.get("github_url") as string) ?? null,
        social_links: JSON.stringify(cleanSocialLinks),
        notes: (formData.get("notes") as string) || null,
      };

      if (mode === "edit" && contact) {
        formData.set("company_id", resolvedCompanyId ?? "");
        await updateContact(contact.id, formData);
        onSaved({
          ...contact,
          ...fields,
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      } else if (resolvedCompanyId) {
        const { id } = await createCompanyContact(resolvedCompanyId, formData);
        onSaved({
          id,
          ...fields,
          role: fields.role ?? "other",
          company_id: resolvedCompanyId,
          company_name: companyName(resolvedCompanyId),
        });
      } else {
        const { id } = await createPersonContact(formData);
        onSaved({
          id,
          ...fields,
          role: fields.role ?? "other",
          company_id: null,
          company_name: null,
        });
      }
      onOpenChange(false);
    } catch {
      toast.error(mode === "edit" ? "Could not update contact" : "Could not create contact");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name *</Label>
              <Input id="contact-name" name="name" required placeholder="e.g. Sarah Connor" defaultValue={contact?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" name="email" type="email" placeholder="sarah@example.com" defaultValue={contact?.email ?? ""} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {lockedCompanyId ? (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 text-sm font-medium">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {companyName(lockedCompanyId)}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? NO_COMPANY)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="No company">
                      {companyId === NO_COMPANY
                        ? "No company"
                        : companyId === NEW_COMPANY
                        ? "+ Create New Company"
                        : companyName(companyId)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COMPANY}>No company</SelectItem>
                    <SelectItem value={NEW_COMPANY}>+ Create New Company</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {companyId === NEW_COMPANY && (
                  <Input
                    autoFocus
                    placeholder="Enter new company name..."
                    value={customCompanyName}
                    onChange={(e) => setCustomCompanyName(e.target.value)}
                    className="mt-1.5 h-8 text-xs"
                  />
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="contact-position">Position / Job Title</Label>
              <Input id="contact-position" name="position" placeholder="e.g. Senior Recruiter" defaultValue={contact?.position ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input id="contact-phone" name="phone" placeholder="+1 (555) 000-0000" defaultValue={contact?.phone ?? ""} />
          </div>

          {/* Notion-style Colorful Tag System */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tags (Notion-style)
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-primary/20">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className={cn(
                    "flex items-center gap-1 border font-medium text-xs px-2 py-0.5 rounded-md",
                    getTagColorClass(tag)
                  )}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => handleAddTag(tagInput)}
                placeholder={tags.length === 0 ? "Type tag & press comma or enter..." : "Add tag..."}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground min-w-[120px]"
              />
            </div>

            {/* Quick preset tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium">Presets:</span>
              {PRESET_TAGS.map((preset) => {
                const isSelected = tags.some((t) => t.toLowerCase() === preset.toLowerCase());
                return (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => (isSelected ? handleRemoveTag(preset) : handleAddTag(preset))}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      isSelected
                        ? getTagColorClass(preset)
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    + {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Social Media Links */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Social Media Links
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSocialLink}
                className="h-7 text-xs"
              >
                <Plus className="mr-1 size-3" />
                Add Link
              </Button>
            </div>

            {socialLinks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No social media links added yet.</p>
            ) : (
              <div className="space-y-2">
                {socialLinks.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Select
                      value={item.platform}
                      onValueChange={(v) => handleUpdateSocialLink(item.id, "platform", v ?? "custom")}
                    >
                      <SelectTrigger className="h-9 w-36 shrink-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="url"
                      placeholder="https://..."
                      value={item.url}
                      onChange={(e) => handleUpdateSocialLink(item.id, "url", e.target.value)}
                      className="h-9 flex-1 text-xs"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSocialLink(item.id)}
                      className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes with @mentions */}
          <div className="relative space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              name="notes"
              ref={textareaRef}
              rows={3}
              placeholder="Type @ to link a saved job..."
              value={notes}
              onChange={handleNotesChange}
              onClick={closeMentionIfCaretMoved}
              onKeyUp={closeMentionIfCaretMoved}
            />
            {mention && filteredJobs.length > 0 && (
              <Command className="absolute z-10 mt-1 w-full" value="">
                <CommandList>
                  <CommandGroup heading="Link a job">
                    {filteredJobs.map((job) => (
                      <CommandItem key={job.id} onItemSelect={() => pickMentionJob(job)}>
                        {job.title}
                        {job.company_name ? ` — ${job.company_name}` : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner className="mr-2" />}
              {mode === "edit" ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

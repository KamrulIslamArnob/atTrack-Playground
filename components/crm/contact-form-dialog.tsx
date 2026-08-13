"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/tooltip";
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
  uploadContactAvatar,
  deleteContact,
  type Contact,
} from "@/lib/actions/contacts";
import { createCompany, type CrmCompany } from "@/lib/actions/companies";
import { getJobsForMention, type JobMentionOption } from "@/lib/actions/jobs-list";
import { insertMentionToken } from "@/lib/mentions";
import { getTagColorClass, getContactAvatarColorClass, cn } from "@/lib/utils";
import { Plus, Trash2, X, Building2, Camera, Link as LinkIcon, Upload, Loader2 } from "lucide-react";
import { parseContactSocialLinks } from "./contact-card";

const NO_COMPANY = "__none__";
const NEW_COMPANY = "__new__";

const PRESET_TAGS = [
  "Alumni",
  "Recruiter",
  "Hiring Manager",
  "Employee",
  "Executive",
  "Referral",
  "Peer",
  "Primary Contact",
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
  contact?: Contact | null;
  companies: CrmCompany[];
  lockedCompanyId?: string | null;
  tagSuggestions?: string[];
  onSaved: (contact: Contact, createdCompany?: CrmCompany) => void;
  onDeleted?: (contactId: string) => void;
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
  onDeleted,
}: ContactFormDialogProps) {
  const mode = contact ? "edit" : "create";
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteContact = async () => {
    if (!contact) return;
    if (!confirm(`Are you sure you want to delete "${contact.name}"?`)) return;

    try {
      setDeleting(true);
      await deleteContact(contact.id);
      toast.success("Contact deleted");
      onDeleted?.(contact.id);
      onOpenChange(false);
    } catch {
      toast.error("Could not delete contact");
    } finally {
      setDeleting(false);
    }
  };
  
  // Name & Avatar state
  const [contactName, setContactName] = useState(contact?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(contact?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setContactName(contact?.name ?? "");
    setAvatarUrl(contact?.avatar_url ?? null);
    setShowUrlInput(false);
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

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("name", contactName);
      formData.append("company_name", companyName(companyId) ?? "");
      formData.append("role", tags.join(", "));
      formData.append("email", contact?.email ?? "");
      // Pass the current avatar URL so the server can delete the old file
      if (avatarUrl) formData.append("old_avatar_url", avatarUrl);

      const url = await uploadContactAvatar(formData);
      setAvatarUrl(url);
      toast.success("Contact photo processed & uploaded");
    } catch {
      toast.error("Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

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
    const nameVal = contactName.trim();
    if (!nameVal) {
      toast.error("Name is required");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("name", nameVal);
      formData.set("avatar_url", avatarUrl ?? "");

      let resolvedCompanyId = lockedCompanyId ?? (companyId === NO_COMPANY ? null : companyId);
      let resolvedCompanyName: string | null = companyName(resolvedCompanyId);
      let createdCompanyObj: CrmCompany | undefined = undefined;

      if (!lockedCompanyId && companyId === NEW_COMPANY && customCompanyName.trim()) {
        const compName = customCompanyName.trim();
        const existingComp = companies.find((c) => c.name.toLowerCase() === compName.toLowerCase());
        if (existingComp) {
          resolvedCompanyId = existingComp.id;
          resolvedCompanyName = existingComp.name;
        } else {
          const compFormData = new FormData();
          compFormData.append("name", compName);
          const { id: newCompId } = await createCompany(compFormData);
          resolvedCompanyId = newCompId;
          resolvedCompanyName = compName;
          createdCompanyObj = {
            id: newCompId,
            name: compName,
            website: null,
            location: null,
            color: null,
            job_count: 0,
            contact_count: 1,
          };
        }
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
        avatar_url: avatarUrl || null,
        notes: (formData.get("notes") as string) || null,
        company_id: resolvedCompanyId,
        company_name: resolvedCompanyName,
      };

      if (mode === "edit" && contact) {
        formData.set("company_id", resolvedCompanyId ?? "");
        await updateContact(contact.id, formData);
        onSaved(
          {
            ...contact,
            ...fields,
          },
          createdCompanyObj
        );
      } else if (resolvedCompanyId) {
        const { id } = await createCompanyContact(resolvedCompanyId, formData);
        onSaved(
          {
            id,
            ...fields,
            role: fields.role ?? "other",
          },
          createdCompanyObj
        );
      } else {
        const { id } = await createPersonContact(formData);
        onSaved(
          {
            id,
            ...fields,
            role: fields.role ?? "other",
            company_id: null,
            company_name: null,
          },
          createdCompanyObj
        );
      }
      onOpenChange(false);
    } catch {
      toast.error(mode === "edit" ? "Could not update contact" : "Could not create contact");
    } finally {
      setPending(false);
    }
  };

  const initialLetter = (contactName.trim()[0] || "C").toUpperCase();
  const avatarColorClass = getContactAvatarColorClass(tags, contactName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Contact" : "Add Contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Photo / Avatar Option */}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/10 p-3">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Contact avatar"
                  className="size-14 rounded-full object-cover border-2 border-border shadow-xs"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full text-xl font-bold shadow-xs transition-colors",
                    avatarColorClass
                  )}
                >
                  {initialLetter}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Profile Picture
                </Label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[11px] font-medium text-destructive hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-xs"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Upload className="mr-1 size-3" />
                  )}
                  Upload photo
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUrlInput((v) => !v)}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LinkIcon className="mr-1 size-3" />
                  {showUrlInput ? "Hide Image URL" : "Image URL"}
                </Button>
              </div>

              {showUrlInput && (
                <Input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl ?? ""}
                  onChange={(e) => setAvatarUrl(e.target.value.trim() || null)}
                  className="h-8 text-xs mt-1"
                />
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name *</Label>
              <Input
                id="contact-name"
                name="name"
                required
                placeholder="e.g. Sarah Connor"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
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
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags (Notion-style)
              </Label>
              <InfoTooltip
                content="Notion-Style Tag System: Type custom tags separated by commas or Enter (e.g., #alumni, #recruiter), or click quick preset pills below to categorize contacts."
                side="top"
              />
            </div>
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

            {/* Available tag suggestions (Presets + Created Tags) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground font-medium">Tags:</span>
              {Array.from(new Set([...PRESET_TAGS, ...(tagSuggestions ?? [])]))
                .sort((a, b) => a.localeCompare(b))
                .map((suggestion) => {
                  const isSelected = tags.some((t) => t.toLowerCase() === suggestion.toLowerCase());
                  return (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => (isSelected ? handleRemoveTag(suggestion) : handleAddTag(suggestion))}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1",
                        isSelected
                          ? getTagColorClass(suggestion)
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span>{isSelected ? "✓" : "+"} {suggestion}</span>
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

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between w-full pt-2">
            {mode === "edit" && contact ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 px-2.5"
                disabled={pending || deleting}
                onClick={handleDeleteContact}
              >
                {deleting ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5 text-destructive" />}
                <span>Delete contact</span>
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending || deleting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || deleting}>
                {pending && <Spinner className="mr-2" />}
                {mode === "edit" ? "Save changes" : "Add contact"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

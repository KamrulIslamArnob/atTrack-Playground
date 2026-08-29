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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createCompanyContact, createPersonContact, updateContact, uploadContactAvatar, openContactAvatarFolder, deleteContact, type Contact, } from "@/lib/actions/contacts";
import { createCompany, type CrmCompany } from "@/lib/actions/companies";
import { getJobsForMention, type JobMentionOption } from "@/lib/actions/jobs-list";
import { insertMentionToken } from "@/lib/mentions";
import { getTagColorClass, generateUUID, cn } from "@/lib/utils";
import { Plus, Trash2, Building2, Camera, Loader2, Link2, X, FolderOpen } from "lucide-react";
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
  label?: string;
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
  const { confirm, dialog: confirmDialog } = useConfirm();

  const handleDeleteContact = async () => {
    if (!contact) return;
    const confirmed = await confirm({
      title: "Delete this contact?",
      description: `"${contact.name}" will be permanently deleted. This can't be undone.`,
      confirmText: "Delete contact",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteContact(contact.id);
      toast.success("Contact deleted");
      onDeleted?.(contact.id);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't delete contact");
    } finally {
      setDeleting(false);
    }
  };
  
  // Name & Avatar state
  const [contactName, setContactName] = useState(contact?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(contact?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    setIsDragging(false);
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
          id: generateUUID(),
          platform: item.platform,
          url: item.url,
          label: item.label,
        }))
      );
    } else {
      setSocialLinks([
        { id: generateUUID(), platform: "linkedin", url: "", label: "" },
      ]);
    }

    setNotes(contact?.notes ?? "");
    setMention(null);
  }, [open, contact, lockedCompanyId]);

  useEffect(() => {
    if (!open) return;
    getJobsForMention().then(setJobOptions);
  }, [open]);

function dataUrlToFile(dataUrl: string, filename = "dropped-image.png"): File | null {
  try {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

  const processAvatarFile = async (file: File) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const validExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "tiff", "tif", "ico", "heic", "heif"];
    if (!file.type.startsWith("image/") && !validExts.includes(ext)) {
      toast.error("Please drop an image file");
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("name", contactName);
      formData.append("company_name", companyName(companyId) ?? "");
      formData.append("role", tags.join(", "));
      formData.append("email", contact?.email ?? "");
      if (avatarUrl) formData.append("old_avatar_url", avatarUrl);

      const url = await uploadContactAvatar(formData);
      setAvatarUrl(url);
      toast.success("Photo uploaded");
    } catch {
      toast.error("Couldn't upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processAvatarFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 1. Check for dropped file from filesystem
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        await processAvatarFile(file);
        return;
      }
    }

    // 2. Check for dropped data URL / base64 string
    const plainText = e.dataTransfer.getData("text/plain");
    if (plainText && /^data:image\//i.test(plainText.trim())) {
      const file = dataUrlToFile(plainText.trim());
      if (file) {
        await processAvatarFile(file);
        return;
      }
    }

    // 3. Check for dragged URI / link from another tab or web page
    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList && /^https?:\/\//i.test(uriList)) {
      setAvatarUrl(uriList.split("\n")[0].trim());
      toast.success("Photo link applied");
      return;
    }

    const htmlData = e.dataTransfer.getData("text/html");
    if (htmlData) {
      const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
      const src = match?.[1];
      if (src) {
        if (/^data:image\//i.test(src)) {
          const file = dataUrlToFile(src);
          if (file) {
            await processAvatarFile(file);
            return;
          }
        }
        if (/^https?:\/\//i.test(src) || src.startsWith("/api/files/")) {
          setAvatarUrl(src);
          toast.success("Photo link applied");
          return;
        }
      }
    }

    if (plainText && (/^https?:\/\//i.test(plainText.trim()) || plainText.trim().startsWith("/api/files/"))) {
      setAvatarUrl(plainText.trim());
      toast.success("Photo link applied");
      return;
    }

    toast.info("Couldn't use that image — click upload square to choose a file");
  };

  const [openingFolder, setOpeningFolder] = useState(false);

  const handleOpenFolder = async () => {
    setOpeningFolder(true);
    try {
      await openContactAvatarFolder(avatarUrl);
      toast.success("Opened avatar folder");
    } catch {
      toast.error("Couldn't open avatar folder");
    } finally {
      setOpeningFolder(false);
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
      { id: generateUUID(), platform: "linkedin", url: "" },
    ]);
  };

  const handleUpdateSocialLink = (
    id: string,
    field: "platform" | "url" | "label",
    val: string
  ) => {
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
    if (uploadingAvatar) {
      toast.info("Please wait for photo upload to finish");
      return;
    }

    const nameVal = contactName.trim();
    if (!nameVal) {
      toast.error("Name is required");
      return;
    }

    let finalAvatarUrl = avatarUrl?.trim() || null;

    // If a base64 data URL was entered, upload it to storage before saving
    if (finalAvatarUrl && finalAvatarUrl.startsWith("data:image/")) {
      const file = dataUrlToFile(finalAvatarUrl);
      if (file) {
        setUploadingAvatar(true);
        try {
          const avatarFormData = new FormData();
          avatarFormData.append("avatar", file);
          avatarFormData.append("name", nameVal);
          avatarFormData.append("company_name", companyName(companyId) ?? "");
          avatarFormData.append("role", tags.join(", "));
          avatarFormData.append("email", contact?.email ?? "");
          finalAvatarUrl = await uploadContactAvatar(avatarFormData);
          setAvatarUrl(finalAvatarUrl);
        } catch {
          finalAvatarUrl = null;
        } finally {
          setUploadingAvatar(false);
        }
      }
    }

    const avatarIsUsable =
      !finalAvatarUrl ||
      finalAvatarUrl.startsWith("/") ||
      finalAvatarUrl.startsWith("http://") ||
      finalAvatarUrl.startsWith("https://");

    if (finalAvatarUrl && !avatarIsUsable) {
      toast.info("Saved without photo — the image link wasn't a valid URL");
    }
    const safeAvatarUrl = avatarIsUsable ? finalAvatarUrl : null;

    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("name", nameVal);
      formData.set("avatar_url", safeAvatarUrl ?? "");

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
        .map((l) => ({
          platform: l.platform,
          url: l.url.trim(),
          ...(l.platform === "custom" && l.label?.trim() ? { label: l.label.trim() } : {}),
        }));
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
        avatar_url: safeAvatarUrl || null,
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
      toast.error(mode === "edit" ? "Couldn't update contact" : "Couldn't create contact");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Drop Zone & URL Placement */}
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "group/drop relative flex items-center gap-3.5 rounded-2xl border p-3 transition-all duration-200",
              isDragging
                ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-[-8px_0_20px_-4px_rgba(14,165,233,0.45)] dark:shadow-[-8px_0_20px_-4px_rgba(56,189,248,0.35)]"
                : "border-border/80 bg-muted/20 hover:border-border hover:bg-muted/30"
            )}
          >
            {/* Avatar Trigger & Drop Target */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group/avatar relative size-15 shrink-0 rounded-2xl cursor-pointer overflow-hidden border transition-all duration-150 select-none",
                avatarUrl
                  ? "border-border ring-2 ring-background shadow-xs"
                  : "border-2 border-dashed border-border/80 hover:border-primary/60 bg-background/90 hover:bg-background shadow-2xs"
              )}
              title={avatarUrl ? "Click or drop image to replace" : "Click to upload or drag & drop photo"}
            >
              {uploadingAvatar ? (
                <div className="flex size-full items-center justify-center bg-muted/60">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : avatarUrl ? (
                <>
                  <img
                    src={avatarUrl}
                    alt="Contact avatar"
                    className="size-full object-cover rounded-2xl transition-transform duration-200 group-hover/avatar:scale-105"
                  />
                  {/* Dark overlay on hover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-2xl text-white">
                    <Camera className="size-4.5" />
                    <span className="text-[9px] font-medium mt-0.5 tracking-tight">Change</span>
                  </div>
                </>
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/70 group-hover/avatar:text-primary transition-colors">
                  <Camera className="size-5" />
                  <span className="text-[9px] font-semibold tracking-tight uppercase">Upload</span>
                </div>
              )}
            </div>

            {/* Input alongside the avatar */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="relative flex items-center">
                <Link2 className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground/70" />
                <Input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste image link or drop photo here..."
                  value={avatarUrl ?? ""}
                  onChange={async (e) => {
                    const val = e.target.value.trim();
                    if (val.startsWith("data:image/")) {
                      const file = dataUrlToFile(val);
                      if (file) {
                        await processAvatarFile(file);
                        return;
                      }
                    }
                    setAvatarUrl(val || null);
                  }}
                  className="h-9 pl-8 pr-16 text-xs bg-background/85 border-border/70 placeholder:text-muted-foreground/60 focus:bg-background"
                />
                <div className="absolute right-1.5 flex items-center gap-0.5">
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Remove photo"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    disabled={openingFolder}
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                    title="Open native folder where contact avatars are stored"
                  >
                    <FolderOpen className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 px-0.5">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-1 rounded-full bg-primary/60" />
                  Drag from web or click square to upload
                </span>
                {uploadingAvatar && <span className="text-primary font-medium">Processing photo…</span>}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />
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

          {/* Colorful Tag System */}
          <div className="space-y-2 rounded-2xl border border-border bg-muted/10 p-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags
              </Label>
              <InfoTooltip
                content="Type custom tags separated by commas or Enter (e.g., Alumni, Recruiter), or click quick preset pills below to categorize contacts."
                side="top"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-primary/20">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className={cn(
                    "flex items-center gap-1 border font-medium text-xs px-2 py-0.5 rounded-full",
                    getTagColorClass(tag)
                  )}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag}`}
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
                  <div key={item.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
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

                    {item.platform === "custom" && (
                      <Input
                        type="text"
                        placeholder="Platform name (e.g. Facebook)"
                        value={item.label ?? ""}
                        onChange={(e) => handleUpdateSocialLink(item.id, "label", e.target.value)}
                        className="h-9 w-40 shrink-0 text-xs"
                      />
                    )}

                    <Input
                      type="url"
                      placeholder="https://..."
                      value={item.url}
                      onChange={(e) => handleUpdateSocialLink(item.id, "url", e.target.value)}
                      className="h-9 flex-1 min-w-[140px] text-xs"
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
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending || deleting || uploadingAvatar}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending || deleting || uploadingAvatar}>
                {(pending || uploadingAvatar) && <Spinner className="mr-2" />}
                {uploadingAvatar ? "Uploading photo…" : mode === "edit" ? "Save changes" : "Add contact"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {confirmDialog}
    </>
  );
}

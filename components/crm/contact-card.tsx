"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { updateContactNotes, type Contact } from "@/lib/actions/contacts";
import { parseNoteMentions } from "@/lib/mentions";
import { getContactAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/company-logo";
import { toast } from "sonner";
import {
  Globe,
  Mail,
  Palette,
  Pencil,
  Video,
  AtSign,
  User,
} from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { CopyIcon } from "@/components/ui/copy";
import { Link2Icon } from "@/components/ui/link-2";
import { PhoneIcon } from "@/components/ui/phone";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";

export interface SocialLinkItem {
  platform: string;
  url: string;
  label?: string;
}

export function parseContactSocialLinks(contact: Contact): SocialLinkItem[] {
  let list: SocialLinkItem[] = [];
  if (contact.social_links) {
    try {
      const parsed = JSON.parse(contact.social_links);
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((item) => item && typeof item.url === "string" && item.url.trim())
          .map((item) => ({
            platform: item.platform || "custom",
            url: item.url.trim(),
            label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : undefined,
          }));
      }
    } catch {}
  }
  if (list.length === 0) {
    if (contact.linkedin_url) list.push({ platform: "linkedin", url: contact.linkedin_url });
    if (contact.github_url) list.push({ platform: "github", url: contact.github_url });
  }
  return list;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase().trim();
  if (p === "linkedin") return <span className="font-bold text-xs tracking-tight">in</span>;
  if (p === "github") return <span className="font-bold text-xs tracking-tight">gh</span>;
  if (p === "twitter" || p === "x") return <AtSign className="size-3.5" />;
  if (p === "website" || p === "portfolio") return <Globe className="size-3.5" />;
  if (p === "dribbble") return <Palette className="size-3.5" />;
  if (p === "youtube") return <Video className="size-3.5" />;
  if (p === "facebook") return <span className="font-bold text-xs tracking-tight">fb</span>;
  if (p === "instagram") return <span className="font-bold text-xs tracking-tight">ig</span>;
  if (p === "discord") return <span className="font-bold text-xs tracking-tight">dc</span>;
  if (p === "medium") return <span className="font-bold text-xs tracking-tight">m</span>;
  if (p.length <= 3 && p !== "custom") return <span className="font-bold text-[10px] uppercase">{p}</span>;
  return <Link2Icon className="size-3.5" />;
}

function getSocialButtonClass(platform: string): string {
  const p = platform.toLowerCase().trim();
  if (p === "linkedin") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white";
  }
  if (p === "github") {
    return "border-zinc-700/25 dark:border-zinc-300/25 bg-muted text-foreground hover:bg-foreground hover:text-background";
  }
  if (p === "twitter" || p === "x") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white";
  }
  if (p === "website" || p === "portfolio") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white";
  }
  if (p === "dribbble") {
    return "border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-600 hover:text-white";
  }
  if (p === "youtube") {
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white";
  }
  return "border-border/70 bg-muted/60 text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary";
}

export function ContactCard({
  contact,
  index = 0,
  onEdit,
}: {
  contact: Contact;
  index?: number;
  onEdit: (contact: Contact) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(contact.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [copiedField, setCopiedField] = useState<"phone" | "email" | null>(null);

  const tags = contact.role
    ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const socialLinks = parseContactSocialLinks(contact);

  const copy = (value: string, field: "phone" | "email", label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success(`${label} copied`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await updateContactNotes(contact.id, noteText);
      setNoteText(noteText.trim());
      setEditingNote(false);
      toast.success("Note updated");
    } catch {
      toast.error("Couldn't save note");
    } finally {
      setSavingNote(false);
    }
  };

  const handleCancelNote = () => {
    setNoteText(contact.notes ?? "");
    setEditingNote(false);
  };

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [contact.avatar_url]);

  const noteSegments = noteText ? parseNoteMentions(noteText) : [];

  return (
    <div
      className="agent-fade-up group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs transition-all duration-300 hover:border-border hover:shadow-xs"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <div>
        {/* ========================================================================= */}
        {/* HERO IMAGE (3:4 Ratio) & BLUR GRADIENT OVERLAY                            */}
        {/* ========================================================================= */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-muted/40 select-none">
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="size-full text-left focus-visible:outline-none cursor-pointer"
            title="Click to view/edit contact"
          >
            {contact.avatar_url && !imgError ? (
              <img
                src={contact.avatar_url}
                alt={contact.name}
                onError={() => setImgError(true)}
                className="size-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div
                className={cn(
                  "size-full flex flex-col items-center justify-center text-center font-heading font-bold text-5xl transition-transform duration-700 ease-out group-hover:scale-105",
                  getContactAvatarColorClass(contact.role, contact.name)
                )}
              >
                {initials(contact.name) || <User className="size-16 opacity-60" />}
              </div>
            )}
          </button>

          {/* Floating Edit Button in Top-Right */}
          <button
            type="button"
            onClick={() => onEdit(contact)}
            aria-label="Edit contact"
            className="absolute top-2.5 right-2.5 z-20 flex size-7 items-center justify-center rounded-full bg-background/85 backdrop-blur-md border border-border/70 text-muted-foreground hover:text-foreground shadow-xs transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
            title="Edit contact"
          >
            <Pencil className="size-3" />
          </button>

          {/* Ambient Fade & Blur into Card Body */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-card via-card/85 to-transparent pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* CARD BODY: Name -> Company Logo (2-row) -> Tags -> Social & Direct Links */}
        {/* ========================================================================= */}
        <div className="relative -mt-8 z-10 px-3.5 sm:px-4 space-y-2.5">
          {/* 1. Name */}
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="text-left group/title focus-visible:outline-none block w-full"
          >
            <h3 className="truncate font-heading text-base font-bold text-foreground group-hover/title:text-primary transition-colors tracking-tight leading-snug">
              {contact.name}
            </h3>
          </button>

          {/* 2. Company Logo (2-row height) + Position (Row 1) & Company Name (Row 2) */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2 shadow-2xs">
            <div className="size-9 shrink-0 rounded-lg border border-border/80 bg-background/90 p-1 flex items-center justify-center shadow-2xs overflow-hidden">
              <CompanyLogo
                name={contact.company_name || "Company"}
                className="size-full rounded-xs object-contain"
                iconClassName="size-4 text-muted-foreground"
                fallback="initial"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground leading-tight">
                {contact.position || contact.role || "No title specified"}
              </p>
              <p className="truncate text-[11px] font-medium text-muted-foreground leading-tight mt-0.5">
                {contact.company_name || "Independent"}
              </p>
            </div>
          </div>

          {/* 3. Tags Row */}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className={cn(
                    "border font-medium text-[10px] px-2 py-0.5 rounded-full tabular-nums shadow-2xs",
                    getTagColorClass(tag)
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* 4. Social Media & Direct Contact Links */}
          {(socialLinks.length > 0 || contact.email || contact.phone) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {/* Social icons */}
              {socialLinks.map((link, idx) => {
                const fullUrl = link.url.startsWith("http") ? link.url : `https://${link.url}`;
                const displayLabel = link.label || (link.platform === "custom" ? "Link" : link.platform);
                return (
                  <a
                    key={idx}
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${displayLabel}: ${fullUrl}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg border text-xs transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer",
                      getSocialButtonClass(link.platform)
                    )}
                    title={`Open ${displayLabel}: ${fullUrl}`}
                  >
                    <SocialIcon platform={link.platform} />
                  </a>
                );
              })}

              {/* Email */}
              {contact.email && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 truncate max-w-[140px]"
                    title={`Email ${contact.email}`}
                  >
                    <Mail className="size-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate text-[11px] font-medium">{contact.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(contact.email!, "email", "Email")}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer ml-0.5"
                    title="Copy email"
                  >
                    {copiedField === "email" ? (
                      <CheckIcon className="size-3 text-success" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </button>
                </div>
              )}

              {/* Phone */}
              {contact.phone && (
                <div className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1.5 truncate max-w-[120px]"
                    title={`Call ${contact.phone}`}
                  >
                    <PhoneIcon className="size-3 text-muted-foreground/70 shrink-0" />
                    <span className="truncate text-[11px] font-medium">{contact.phone}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(contact.phone!, "phone", "Phone number")}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer ml-0.5"
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? (
                      <CheckIcon className="size-3 text-success" />
                    ) : (
                      <CopyIcon className="size-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTTOM SECTION: Notes Card with Inline Editing & @job mentions         */}
      {/* ========================================================================= */}
      <div className="p-3.5 pt-2.5 sm:px-4 sm:pb-3.5 border-t border-border/60 mt-2.5">
        {editingNote ? (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-3 text-xs shadow-2xs space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Notes
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveNote();
                }
                if (e.key === "Escape") handleCancelNote();
              }}
              autoFocus
              placeholder="Write a note... (@ to mention a job)"
              className="w-full min-h-[56px] bg-transparent outline-none resize-none text-xs text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/50">
              <button
                type="button"
                onClick={handleCancelNote}
                className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="rounded-lg bg-primary text-primary-foreground px-3 py-1 text-[11px] font-semibold shadow-2xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        ) : noteText.trim() ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setEditingNote(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditingNote(true);
              }
            }}
            className="group/note relative rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs leading-relaxed cursor-pointer transition-colors hover:bg-muted/40 hover:border-border shadow-2xs"
            title="Click to edit notes"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Notes
            </div>
            <div className="pr-4 line-clamp-3 text-foreground/90">
              {noteSegments.map((seg, idx) =>
                seg.jobId ? (
                  <Link
                    key={idx}
                    href={`/jobs/${seg.jobId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-primary underline underline-offset-2 hover:opacity-80 mx-0.5"
                  >
                    @{seg.text}
                  </Link>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
            </div>
            <Pencil className="absolute right-2.5 top-2.5 size-3 opacity-0 group-hover/note:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="w-full flex items-center justify-between rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 hover:border-border transition-colors cursor-pointer"
          >
            <span className="text-[11px]">Add a note...</span>
            <PlusIcon className="size-3 text-muted-foreground/60" />
          </button>
        )}
      </div>
    </div>
  );
}

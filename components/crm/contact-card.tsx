"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { updateContactNotes, type Contact } from "@/lib/actions/contacts";
import { parseNoteMentions } from "@/lib/mentions";
import { getContactAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Copy,
  Globe,
  Link2,
  Mail,
  Palette,
  Pencil,
  Phone,
  Plus,
  Video,
  AtSign,
  X,
} from "lucide-react";

export interface SocialLinkItem {
  platform: string;
  url: string;
}

export function parseContactSocialLinks(contact: Contact): SocialLinkItem[] {
  let list: SocialLinkItem[] = [];
  if (contact.social_links) {
    try {
      const parsed = JSON.parse(contact.social_links);
      if (Array.isArray(parsed)) list = parsed.filter((item) => item && item.url);
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
  const p = platform.toLowerCase();
  if (p === "linkedin") return <span className="font-bold text-[11px]">in</span>;
  if (p === "github") return <span className="font-bold text-[11px]">gh</span>;
  if (p === "twitter" || p === "x") return <AtSign className="size-3.5" />;
  if (p === "website" || p === "portfolio") return <Globe className="size-3.5" />;
  if (p === "dribbble") return <Palette className="size-3.5" />;
  if (p === "youtube") return <Video className="size-3.5" />;
  return <Link2 className="size-3.5" />;
}

export function ContactCard({
  contact,
  onEdit,
}: {
  contact: Contact;
  index?: number;
  onEdit: (contact: Contact) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(contact.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);

  const tags = contact.role
    ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const socialLinks = parseContactSocialLinks(contact);

  const linkedinLink = socialLinks.find((l) => l.platform.toLowerCase() === "linkedin")?.url || contact.linkedin_url;
  const githubLink = socialLinks.find((l) => l.platform.toLowerCase() === "github")?.url || contact.github_url;
  const extraLinks = socialLinks.filter(
    (l) => l.platform.toLowerCase() !== "linkedin" && l.platform.toLowerCase() !== "github"
  );

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
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

  const noteSegments = noteText ? parseNoteMentions(noteText) : [];

  return (
    <div className="group micro-hover-lift relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 transition-all hover:bg-muted/40">
      <div className="space-y-3">
        {/* Header: Avatar + Name & Position (Clicking opens Edit mode) */}
        <button
          type="button"
          onClick={() => onEdit(contact)}
          className="flex w-full min-w-0 items-center gap-3 text-left group/head"
        >
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={contact.name}
              className="size-11 shrink-0 rounded-full object-cover shadow-xs border border-border"
            />
          ) : (
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs transition-colors",
                getContactAvatarColorClass(contact.role, contact.name)
              )}
            >
              {initials(contact.name) || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold text-foreground group-hover/head:text-primary transition-colors">
              {contact.name}
            </h4>
            {contact.position ? (
              <p className="truncate text-xs font-medium text-muted-foreground">{contact.position}</p>
            ) : (
              <p className="truncate text-xs text-muted-foreground/60 italic">No job title</p>
            )}
          </div>
        </button>

        {/* Company & Tags Row */}
        <div className="space-y-1.5 pt-0.5">
          {contact.company_name && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{contact.company_name}</span>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  className={cn(
                    "border font-medium text-[11px] px-2 py-0.5 rounded-full",
                    getTagColorClass(tag)
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Sticky-note affordance, reusing the Warning family's amber tint (§1.2) instead of one-off hexes. */}
        <div className="h-[76px] min-h-[76px] rounded-xl border border-warning-border bg-warning-surface text-warning p-2.5 text-xs relative group/note overflow-y-auto leading-relaxed transition-all hover:border-warning/40">
          {editingNote ? (
            <div className="flex h-full flex-col justify-between">
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
                className="size-full bg-transparent outline-none resize-none text-xs text-warning placeholder:text-warning/50"
              />
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelNote}
                  aria-label="Cancel"
                  className="rounded p-0.5 text-warning hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  title="Cancel"
                >
                  <X className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  aria-label="Save note"
                  className="rounded p-0.5 text-warning font-bold hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  title="Save note (Enter)"
                >
                  <Check className="size-3.5" />
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
              className="size-full cursor-pointer pr-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
              title="Click to edit note"
            >
              {noteSegments.map((seg, idx) =>
                seg.jobId ? (
                  <Link
                    key={idx}
                    href={`/jobs/${seg.jobId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-warning underline underline-offset-2 hover:text-warning/80 mx-0.5"
                  >
                    @{seg.text}
                  </Link>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNote(true);
                }}
                aria-label="Edit note"
                className="absolute top-2 right-2 opacity-0 group-hover/note:opacity-100 transition-opacity rounded p-1 text-warning hover:bg-warning/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                title="Edit note"
              >
                <Pencil className="size-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className="flex size-full items-center gap-1.5 text-warning/60 font-medium hover:text-warning transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
            >
              <Plus className="size-3.5 shrink-0" />
              <span>Click to add note...</span>
            </button>
          )}
        </div>

        {/* Phone + Email with copy buttons */}
        {(contact.phone || contact.email) && (
          <div className="space-y-1 text-xs text-muted-foreground pt-0.5">
            {contact.phone && (
              <div className="flex items-center justify-between gap-1.5">
                <a
                  href={`tel:${contact.phone}`}
                  className="flex min-w-0 items-center gap-1.5 truncate hover:text-foreground"
                  title={contact.phone}
                >
                  <Phone className="size-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{contact.phone}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copy(contact.phone!, "Phone")}
                  className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label="Copy phone number"
                  title="Copy phone"
                >
                  <Copy className="size-3" />
                </button>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center justify-between gap-1.5">
                <a
                  href={`mailto:${contact.email}`}
                  className="flex min-w-0 items-center gap-1.5 truncate hover:text-foreground"
                  title={contact.email}
                >
                  <Mail className="size-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate">{contact.email}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copy(contact.email!, "Email")}
                  className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label="Copy email"
                  title="Copy email"
                >
                  <Copy className="size-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: LinkedIn & GitHub always present with basic button visibility, colorful on hover when link exists */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-2.5">
        {/* LinkedIn */}
        {linkedinLink ? (
          <a
            href={linkedinLink.startsWith("http") ? linkedinLink : `https://${linkedinLink}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`LinkedIn: ${linkedinLink}`}
            className="flex size-7 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[11px] transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={`LinkedIn: ${linkedinLink}`}
          >
            in
          </a>
        ) : (
          <span
            className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground/80 font-bold text-[11px] cursor-not-allowed select-none"
            title="No LinkedIn profile added"
          >
            in
          </span>
        )}

        {/* GitHub */}
        {githubLink ? (
          <a
            href={githubLink.startsWith("http") ? githubLink : `https://${githubLink}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`GitHub: ${githubLink}`}
            className="flex size-7 items-center justify-center rounded-lg border border-zinc-700/40 dark:border-zinc-300/40 bg-zinc-900/10 dark:bg-zinc-100/10 text-zinc-900 dark:text-zinc-100 font-bold text-[11px] transition-all hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 hover:border-zinc-900 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={`GitHub: ${githubLink}`}
          >
            gh
          </a>
        ) : (
          <span
            className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground/80 font-bold text-[11px] cursor-not-allowed select-none"
            title="No GitHub profile added"
          >
            gh
          </span>
        )}

        {/* Additional custom social links — no fixed brand hue, so this uses the primary token like any other interactive chip. */}
        {extraLinks.map((link, idx) => (
          <a
            key={idx}
            href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`${link.platform}: ${link.url}`}
            className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary font-medium text-[11px] transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={`${link.platform}: ${link.url}`}
          >
            <SocialIcon platform={link.platform} />
          </a>
        ))}
      </div>
    </div>
  );
}



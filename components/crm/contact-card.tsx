"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { updateContactNotes, type Contact } from "@/lib/actions/contacts";
import { parseNoteMentions } from "@/lib/mentions";
import { getContactAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2, Globe, Mail, Palette, Pencil, Video, AtSign } from "lucide-react";
import { CheckIcon } from "@/components/ui/check";
import { CopyIcon } from "@/components/ui/copy";
import { Link2Icon } from "@/components/ui/link-2";
import { PhoneIcon } from "@/components/ui/phone";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { XIcon } from "@/components/ui/x";

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
  return <Link2Icon className="size-3.5" />;
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

  const linkedinLink = socialLinks.find((l) => l.platform.toLowerCase() === "linkedin")?.url || contact.linkedin_url;
  const githubLink = socialLinks.find((l) => l.platform.toLowerCase() === "github")?.url || contact.github_url;
  const extraLinks = socialLinks.filter(
    (l) => l.platform.toLowerCase() !== "linkedin" && l.platform.toLowerCase() !== "github"
  );

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

  const noteSegments = noteText ? parseNoteMentions(noteText) : [];

  return (
    <div
      className="agent-fade-up group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="space-y-2.5">
        {/* Top Header: Avatar + Identity + Edit Trigger */}
        <div className="flex items-start justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onEdit(contact)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left group/head focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
          >
            {contact.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt={contact.name}
                className="size-10 shrink-0 rounded-full object-cover shadow-2xs border border-border ring-1 ring-border/50"
              />
            ) : (
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-2xs transition-transform group-hover/head:scale-105",
                  getContactAvatarColorClass(contact.role, contact.name)
                )}
              >
                {initials(contact.name) || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-bold text-foreground group-hover/head:text-primary transition-colors">
                {contact.name}
              </h4>
              <p className="truncate text-[11px] text-muted-foreground">
                {contact.position || (contact.company_name ? contact.company_name : "No job title")}
              </p>
            </div>
          </button>

          {/* Top Quick Actions: Socials + Edit */}
          <div className="flex shrink-0 items-center gap-1">
            {linkedinLink && (
              <a
                href={linkedinLink.startsWith("http") ? linkedinLink : `https://${linkedinLink}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`LinkedIn: ${linkedinLink}`}
                className="flex size-6 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] transition-all hover:bg-blue-600 hover:text-white"
                title={`LinkedIn: ${linkedinLink}`}
              >
                in
              </a>
            )}
            {githubLink && (
              <a
                href={githubLink.startsWith("http") ? githubLink : `https://${githubLink}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`GitHub: ${githubLink}`}
                className="flex size-6 items-center justify-center rounded-md border border-zinc-700/30 dark:border-zinc-300/30 bg-muted text-foreground font-bold text-[10px] transition-all hover:bg-foreground hover:text-background"
                title={`GitHub: ${githubLink}`}
              >
                gh
              </a>
            )}
            {extraLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${link.platform}: ${link.url}`}
                className="flex size-6 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground"
                title={`${link.platform}: ${link.url}`}
              >
                <SocialIcon platform={link.platform} />
              </a>
            ))}
            <button
              type="button"
              onClick={() => onEdit(contact)}
              aria-label="Edit contact"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all focus-visible:opacity-100"
              title="Edit contact"
            >
              <Pencil className="size-3" />
            </button>
          </div>
        </div>

        {/* Company & Role Badges */}
        {(contact.company_name || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {contact.company_name && contact.position && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Building2 className="size-3 text-muted-foreground/70" />
                <span className="truncate max-w-[120px]">{contact.company_name}</span>
              </span>
            )}
            {tags.map((tag) => (
              <Badge
                key={tag}
                className={cn(
                  "border font-medium text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                  getTagColorClass(tag)
                )}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Compact Notes Callout */}
        {editingNote ? (
          <div className="rounded-xl border border-warning-border bg-warning-surface p-2 text-xs text-warning shadow-2xs">
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
              className="w-full min-h-[48px] bg-transparent outline-none resize-none text-xs text-warning placeholder:text-warning/50 leading-snug"
            />
            <div className="flex items-center justify-end gap-1 pt-1 border-t border-warning-border/40">
              <button
                type="button"
                onClick={handleCancelNote}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-warning hover:bg-warning/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote}
                className="rounded bg-warning text-warning-foreground px-2 py-0.5 text-[10px] font-bold shadow-2xs hover:opacity-90 disabled:opacity-50"
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
            className="group/note relative rounded-lg border border-warning-border/60 bg-warning-surface/40 p-2 text-xs text-warning leading-snug cursor-pointer transition-all hover:bg-warning-surface hover:border-warning-border"
            title="Click to edit note"
          >
            <div className="pr-4 line-clamp-2">
              {noteSegments.map((seg, idx) =>
                seg.jobId ? (
                  <Link
                    key={idx}
                    href={`/jobs/${seg.jobId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-bold text-warning underline underline-offset-2 hover:opacity-80 mx-0.5"
                  >
                    @{seg.text}
                  </Link>
                ) : (
                  <span key={idx}>{seg.text}</span>
                )
              )}
            </div>
            <Pencil className="absolute right-1.5 top-1.5 size-2.5 opacity-0 group-hover/note:opacity-100 transition-opacity text-warning/80" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="inline-flex items-center gap-1 rounded-md py-0.5 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <PlusIcon className="size-3" />
            <span>Add note...</span>
          </button>
        )}
      </div>

      {/* Footer: Compact Contact Action Pills */}
      {(contact.phone || contact.email) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5 text-[11px]">
          {contact.phone && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-1 truncate max-w-[120px]"
                title={contact.phone}
              >
                <PhoneIcon className="size-3 text-muted-foreground/70" />
                <span className="truncate">{contact.phone}</span>
              </a>
              <button
                type="button"
                onClick={() => copy(contact.phone!, "phone", "Phone")}
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                title="Copy phone"
              >
                {copiedField === "phone" ? (
                  <CheckIcon className="size-2.5 text-success" />
                ) : (
                  <CopyIcon className="size-2.5" />
                )}
              </button>
            </div>
          )}

          {contact.email && (
            <div className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1 truncate max-w-[140px]"
                title={contact.email}
              >
                <Mail className="size-3 text-muted-foreground/70" />
                <span className="truncate">{contact.email}</span>
              </a>
              <button
                type="button"
                onClick={() => copy(contact.email!, "email", "Email")}
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                title="Copy email"
              >
                {copiedField === "email" ? (
                  <CheckIcon className="size-2.5 text-success" />
                ) : (
                  <CopyIcon className="size-2.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

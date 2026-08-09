"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { parseNoteMentions } from "@/lib/mentions";
import type { Contact } from "@/lib/actions/contacts";
import { getAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import {
  Building2,
  Globe,
  Link2,
  Mail,
  Palette,
  Phone,
  Trash2,
  Video,
  AtSign,
  Share2,
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

function NotePreview({ notes }: { notes: string }) {
  const segments = parseNoteMentions(notes);
  return (
    <p className="line-clamp-2 text-xs text-muted-foreground">
      {segments.map((segment, i) =>
        segment.jobId ? (
          <Link key={i} href={`/jobs/${segment.jobId}`} className="font-medium text-primary hover:underline">
            {segment.text}
          </Link>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}

export function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  const tags = contact.role
    ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const socialLinks = parseContactSocialLinks(contact);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onEdit(contact)} className="flex min-w-0 items-center gap-3 text-left">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-xs",
              getAvatarColorClass(contact.name)
            )}
          >
            {initials(contact.name) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold hover:text-primary transition-colors">{contact.name}</p>
            {contact.position && <p className="truncate text-xs text-muted-foreground">{contact.position}</p>}
          </div>
        </button>
        <button
          onClick={() => onDelete(contact)}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Delete contact"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {contact.company_name && (
          <Badge variant="outline" className="border-border/80 bg-muted/30 font-medium">
            <Building2 className="mr-1 size-3 text-muted-foreground" />
            {contact.company_name}
          </Badge>
        )}
        {tags.map((tag) => (
          <Badge key={tag} className={cn("border font-medium text-xs px-2 py-0.5 rounded-md", getTagColorClass(tag))}>
            {tag}
          </Badge>
        ))}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {contact.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="size-3.5 shrink-0 text-muted-foreground/70" /> <span className="truncate">{contact.email}</span>
          </p>
        )}
        {contact.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0 text-muted-foreground/70" /> {contact.phone}
          </p>
        )}
      </div>

      {socialLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {socialLinks.map((link, idx) => (
            <a
              key={idx}
              href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={`${link.platform}: ${link.url}`}
            >
              <SocialIcon platform={link.platform} />
              <span className="capitalize">{link.platform}</span>
            </a>
          ))}
        </div>
      )}

      {contact.notes && <NotePreview notes={contact.notes} />}
    </div>
  );
}

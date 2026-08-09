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
    <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-muted/10">
      {/* Top Header Row: Avatar, Name, Position, Social Icons & Actions */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onEdit(contact)}
          className="flex min-w-0 items-center gap-2.5 text-left"
        >
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-xs",
              getAvatarColorClass(contact.name)
            )}
          >
            {initials(contact.name) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold hover:text-primary transition-colors">
              {contact.name}
            </p>
            {contact.position && (
              <p className="truncate text-xs text-muted-foreground">{contact.position}</p>
            )}
          </div>
        </button>

        {/* Right side: Clickable Social Icons & Delete Button */}
        <div className="flex items-center gap-1 shrink-0">
          {socialLinks.map((link, idx) => (
            <a
              key={idx}
              href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              title={`${link.platform}: ${link.url}`}
            >
              <SocialIcon platform={link.platform} />
            </a>
          ))}

          <button
            onClick={() => onDelete(contact)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 transition-all"
            aria-label="Delete contact"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Middle Row: Badges (Company + Colorful Notion Tags) */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {contact.company_name && (
          <Badge variant="outline" className="border-border/80 bg-muted/40 text-[11px] font-medium py-0.5">
            <Building2 className="mr-1 size-3 text-muted-foreground" />
            {contact.company_name}
          </Badge>
        )}
        {tags.map((tag) => (
          <Badge
            key={tag}
            className={cn(
              "border font-medium text-[11px] px-2 py-0.5 rounded-md",
              getTagColorClass(tag)
            )}
          >
            {tag}
          </Badge>
        ))}
      </div>

      {/* Bottom Row: Contact Info (Email + Phone inline) */}
      {(contact.email || contact.phone) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 truncate hover:text-foreground max-w-[240px]"
              title={contact.email}
            >
              <Mail className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1.5 hover:text-foreground"
              title={contact.phone}
            >
              <Phone className="size-3 shrink-0 text-muted-foreground/70" />
              <span>{contact.phone}</span>
            </a>
          )}
        </div>
      )}

      {contact.notes && (
        <div className="mt-1.5 pt-1 text-xs text-muted-foreground">
          <NotePreview notes={contact.notes} />
        </div>
      )}
    </div>
  );
}

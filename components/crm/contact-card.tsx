"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@/lib/actions/contacts";
import { getAvatarColorClass, getTagColorClass, cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  Copy,
  Globe,
  Link2,
  Mail,
  Palette,
  Phone,
  Trash2,
  Video,
  AtSign,
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
  index,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  index: number;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  const [revealDelete, setRevealDelete] = useState(false);
  const tags = contact.role
    ? contact.role.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const socialLinks = parseContactSocialLinks(contact);

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
    setRevealDelete(true);
  };

  return (
    <div className="group relative flex aspect-square flex-col overflow-hidden rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-muted/10">
      {/* 1. Serial */}
      <span className="text-[10px] font-semibold text-muted-foreground/60">#{index + 1}</span>

      {/* Delete — hidden until a copy button below is used */}
      {revealDelete && (
        <button
          onClick={() => onDelete(contact)}
          className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
          aria-label="Delete contact"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {/* 2-3. Name + Position */}
      <button
        type="button"
        onClick={() => onEdit(contact)}
        className="mt-1.5 flex min-w-0 items-center gap-2.5 text-left"
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

      {/* 4. Company */}
      {contact.company_name && (
        <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Building2 className="size-3 shrink-0" />
          {contact.company_name}
        </p>
      )}

      {/* 5. Tags */}
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
      )}

      <div className="flex-1" />

      {/* 6-7. Phone + Email, each with a copy button */}
      {(contact.phone || contact.email) && (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-2 text-xs text-muted-foreground">
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
                onClick={() => copy(contact.phone!, "Phone")}
                className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                aria-label="Copy phone number"
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
                onClick={() => copy(contact.email!, "Email")}
                className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
                aria-label="Copy email"
              >
                <Copy className="size-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. Social links, one by one */}
      {socialLinks.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 border-t border-border/40 pt-1.5">
          {socialLinks.map((link, idx) => (
            <a
              key={idx}
              href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noreferrer"
              className="flex size-6 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              title={`${link.platform}: ${link.url}`}
            >
              <SocialIcon platform={link.platform} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

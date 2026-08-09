"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { parseNoteMentions } from "@/lib/mentions";
import type { Contact } from "@/lib/actions/contacts";
import { Building2, ExternalLink, Mail, Phone, Trash2 } from "lucide-react";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onEdit(contact)} className="flex min-w-0 items-center gap-3 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initials(contact.name) || "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{contact.name}</p>
            {contact.position && <p className="truncate text-xs text-muted-foreground">{contact.position}</p>}
          </div>
        </button>
        <button
          onClick={() => onDelete(contact)}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete contact"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {contact.role && <Badge variant="secondary">{contact.role}</Badge>}
        {contact.company_name && (
          <Badge variant="outline">
            <Building2 className="mr-1 size-3" />
            {contact.company_name}
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {contact.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="size-3 shrink-0" /> <span className="truncate">{contact.email}</span>
          </p>
        )}
        {contact.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3 shrink-0" /> {contact.phone}
          </p>
        )}
      </div>

      {(contact.linkedin_url || contact.github_url) && (
        <div className="flex gap-2">
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="LinkedIn">
              <ExternalLink className="size-4" />
            </a>
          )}
          {contact.github_url && (
            <a href={contact.github_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      )}

      {contact.notes && <NotePreview notes={contact.notes} />}
    </div>
  );
}

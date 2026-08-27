"use client";

import Link from "next/link";
import { Mail, Phone, Building2 } from "lucide-react";
import type { ContactArtifactSnapshot } from "@/lib/types/chat-artifact";

export function ContactChatCard({ snapshot }: { snapshot: ContactArtifactSnapshot }) {
  return (
    <Link
      href={`/crm?contactId=${snapshot.id}`}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30 hover:bg-accent/30"
    >
      <p className="text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary flex-1 min-w-0 truncate">
        {snapshot.name}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {snapshot.role && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">{snapshot.role}</span>
        )}
        {snapshot.company_name && (
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3" /> {snapshot.company_name}
          </span>
        )}
      </div>
      {(snapshot.email || snapshot.phone || snapshot.linkedin_url) && (
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          {snapshot.email && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5">
              <Mail className="size-3" /> {snapshot.email}
            </span>
          )}
          {snapshot.phone && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5">
              <Phone className="size-3" /> {snapshot.phone}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

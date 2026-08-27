"use client";

import Link from "next/link";
import { Building2, MapPin, Briefcase, Banknote, Clock } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { cn, formatDistanceToNow } from "@/lib/utils";
import type { JobArtifactSnapshot } from "@/lib/types/chat-artifact";

interface JobChatCardProps {
  snapshot: JobArtifactSnapshot;
  artifactId: string;
}

export function JobChatCard({ snapshot, artifactId }: JobChatCardProps) {
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true });
    } catch {
      return "just now";
    }
  })();

  const listBadge = snapshot.list_name
    ? {
        label: snapshot.list_name,
        kind: snapshot.list_kind,
      }
    : null;

  const isInterview = snapshot.list_kind === "interview";

  return (
    <Link
      href={`/board?jobId=${snapshot.id}`}
      className={cn(
        "group flex flex-col gap-2.5 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        isInterview && "border-primary/20 bg-primary/[0.04]"
      )}
      title={`Open ${snapshot.title} in board`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors flex-1 min-w-0">
          {snapshot.title}
        </p>
        {listBadge && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-tight capitalize",
              isInterview
                ? "bg-primary/15 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            {listBadge.label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CompanyLogo
          name={snapshot.company_name ?? undefined}
          website={snapshot.company_website ?? undefined}
          logoUrl={snapshot.company_logo_url ?? undefined}
          color={snapshot.company_color ?? undefined}
          className="size-4"
          iconClassName="size-4"
          fallback="glyph"
        />
        <span className="truncate font-medium text-foreground/80 flex items-center gap-1">
          <Building2 className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
          {snapshot.company_name ?? "Unknown company"}
        </span>
        <span className="opacity-30">·</span>
        <span className="inline-flex items-center gap-1 truncate">
          <Clock className="size-3 shrink-0" aria-hidden="true" />
          {timeAgo}
        </span>
      </div>

      {(snapshot.location || snapshot.employment_type || snapshot.work_location || snapshot.salary_range) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {snapshot.location && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {snapshot.location}
            </span>
          )}
          {snapshot.employment_type && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Briefcase className="size-3" aria-hidden="true" />
              {snapshot.employment_type}
            </span>
          )}
          {snapshot.work_location && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {snapshot.work_location}
            </span>
          )}
          {snapshot.salary_range ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Banknote className="size-3" aria-hidden="true" />
              {snapshot.salary_range}
            </span>
          ) : snapshot.salary_min || snapshot.salary_max ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Banknote className="size-3" aria-hidden="true" />
              {[snapshot.salary_min, snapshot.salary_max].filter(Boolean).join(" – ")}
            </span>
          ) : null}
        </div>
      )}
    </Link>
  );
}

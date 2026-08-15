"use client";

import { memo } from "react";
import {
  Briefcase,
  FileText,
  Users,
  Link2,
  Database,
  Sparkles,
  Code2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceProps {
  title?: string;
  url?: string;
  sourceType?: string;
  id?: string;
  mediaType?: string;
  className?: string;
}

function SourceIcon({ title }: { title: string }) {
  const lower = title.toLowerCase();
  const cls = "size-3 shrink-0 text-primary/70";
  if (lower.includes("job") || lower.includes("application")) return <Briefcase className={cls} />;
  if (lower.includes("resume") || lower.includes("document")) return <FileText className={cls} />;
  if (lower.includes("contact") || lower.includes("crm")) return <Users className={cls} />;
  if (lower.includes("link") || lower.includes("category")) return <Link2 className={cls} />;
  if (lower.includes("github") || lower.includes("repo") || lower.includes("code")) return <Code2 className={cls} />;
  if (lower.includes("database") || lower.includes("sql") || lower.includes("table")) return <Database className={cls} />;
  if (lower.includes("web") || lower.includes("search")) return <Globe className={cls} />;
  return <Sparkles className={cls} />;
}

function SourceImpl({ title, url, className }: SourceProps) {
  const displayTitle = title || url || "Workspace Source";

  return (
    <div
      data-slot="source-badge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground my-0.5 mr-1.5",
        className
      )}
      title={`Retrieved workspace context: ${displayTitle}`}
    >
      <SourceIcon title={displayTitle} />
      <span className="truncate max-w-[200px]">{displayTitle}</span>
    </div>
  );
}

export const Source = memo(SourceImpl);
Source.displayName = "Source";

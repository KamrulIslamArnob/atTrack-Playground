"use client";

import { memo } from "react";
import {
  Briefcase,
  Database,
  Code2,
  Globe,
  Brain,
} from "lucide-react";
import { FileTextIcon } from "@/components/ui/file-text";
import { UsersIcon } from "@/components/ui/users";
import { Link2Icon } from "@/components/ui/link-2";
import { SparklesIcon } from "@/components/ui/sparkles";
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
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  if (lower.includes("memor")) return <Brain className={cls} />;
  if (lower.includes("job") || lower.includes("application")) return <Briefcase className={cls} />;
  if (lower.includes("resume") || lower.includes("document")) return <FileTextIcon className={cls} />;
  if (lower.includes("contact") || lower.includes("crm")) return <UsersIcon className={cls} />;
  if (lower.includes("link") || lower.includes("category")) return <Link2Icon className={cls} />;
  if (lower.includes("github") || lower.includes("repo") || lower.includes("code")) return <Code2 className={cls} />;
  if (lower.includes("database") || lower.includes("sql") || lower.includes("table")) return <Database className={cls} />;
  if (lower.includes("web") || lower.includes("search")) return <Globe className={cls} />;
  return <SparklesIcon className={cls} />;
}

function SourceImpl({ title, url, className }: SourceProps) {
  const displayTitle = title || url || "Workspace Source";

  return (
    <div
      data-slot="source-badge"
      className={cn(
        "-mx-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors cursor-pointer my-0.5",
        className
      )}
      title={`Retrieved workspace context: ${displayTitle}`}
    >
      <SourceIcon title={displayTitle} />
      <span className="truncate max-w-[240px] text-xs">{displayTitle}</span>
    </div>
  );
}

export const Source = memo(SourceImpl);
Source.displayName = "Source";

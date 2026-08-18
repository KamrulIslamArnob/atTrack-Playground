"use client";

import { useState } from "react";
import { SocialLink, LinkCategory } from "@/lib/types/links";
import { Globe, MoreVertical, Edit2, Trash2, FolderOutput } from "lucide-react";
import { ExternalLinkIcon } from "@/components/ui/external-link";
import { CopyIcon } from "@/components/ui/copy";
import { CheckIcon } from "@/components/ui/check";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LinkRowProps {
  link: SocialLink;
  categories: LinkCategory[];
  onEdit: (link: SocialLink) => void;
  onDelete: (linkId: string) => void;
  onMoveCategory: (linkId: string, newCategoryId: string) => void;
}

export function LinkRow({ link, categories, onEdit, onDelete, onMoveCategory }: LinkRowProps) {
  const [copied, setCopied] = useState(false);

  // Extract clean domain for the subtitle
  let domain = "";
  try {
    const parsed = new URL(link.url);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    domain = link.url;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="group relative flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs transition-all duration-150 ease-out hover:border-border hover:shadow-xs active:scale-[0.99]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Icon. Deliberately not a remote favicon: fetching one told Google the
            domain of every link the user saved, and atTrack is a local, offline
            job search. It also never resolved without a connection. */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 overflow-hidden text-muted-foreground shadow-2xs transition-transform duration-150 group-hover:scale-105">
          <Globe className="size-4 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-150">
              {link.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="truncate text-xs text-muted-foreground/80">{domain}</span>

            {/* Tag Pills */}
            {link.tags && link.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {link.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Copy Button */}
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all duration-150"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon className="size-3.5 text-emerald-500 animate-in zoom-in-75 duration-150" /> : <CopyIcon className="size-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
            {copied ? "Copied to clipboard!" : "Copy link"}
          </TooltipContent>
        </Tooltip>

        {/* Open External Link */}
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/ext inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all duration-150"
            >
              <ExternalLinkIcon className="size-3.5 transition-transform duration-150 ease-out group-hover/ext:translate-x-0.5 group-hover/ext:-translate-y-0.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
            Open in new tab
          </TooltipContent>
        </Tooltip>

        {/* More Options Popover Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all duration-150">
            <MoreVertical className="size-3.5" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            <DropdownMenuItem onClick={() => onEdit(link)} className="gap-2 cursor-pointer">
              <Edit2 className="size-3.5 text-muted-foreground" />
              Edit Link
            </DropdownMenuItem>

            {/* Move Category Submenu */}
            {categories.length > 1 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                  <FolderOutput className="size-3.5 text-muted-foreground" />
                  Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 rounded-xl">
                  {categories
                    .filter((c) => c.id !== link.category_id)
                    .map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={() => onMoveCategory(link.id, cat.id)}
                        className="truncate cursor-pointer"
                      >
                        {cat.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => onDelete(link.id)}
              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Delete Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

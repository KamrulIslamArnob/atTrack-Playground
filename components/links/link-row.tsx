"use client";

import { useState } from "react";
import { SocialLink, LinkCategory } from "@/lib/types/links";
import { Globe, ExternalLink, Copy, MoreVertical, Edit2, Trash2, FolderOutput, Check } from "lucide-react";
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
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract clean domain for subtitle and favicon
  let domain = "";
  try {
    const parsed = new URL(link.url);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    domain = link.url;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="group relative flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xs hover:border-lime-500/40 active:scale-[0.99]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Favicon / Icon with subtle group hover scale */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 overflow-hidden text-muted-foreground shadow-2xs transition-all duration-200 group-hover:scale-105 group-hover:border-lime-500/40">
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faviconUrl}
              alt=""
              className="size-4 object-contain transition-transform duration-200 group-hover:scale-110"
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe className="size-4 text-muted-foreground transition-transform duration-200 group-hover:scale-110 group-hover:text-lime-700 dark:group-hover:text-lime-300" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="truncate text-sm font-medium text-foreground group-hover:text-lime-800 dark:group-hover:text-lime-300 transition-colors duration-150">
              {link.title}
            </h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="truncate text-xs text-muted-foreground/80">{domain}</span>

            {/* Notion-style Tag Pills with micro-hover scale */}
            {link.tags && link.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {link.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-muted/60 hover:bg-lime-500/15 border border-border/60 hover:border-lime-500/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-lime-900 dark:hover:text-lime-200 transition-all duration-150 shadow-2xs hover:scale-105 active:scale-[0.97]"
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
              {copied ? <Check className="size-3.5 text-emerald-500 animate-in zoom-in-75 duration-150" /> : <Copy className="size-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[11px] font-medium py-1 px-2">
            {copied ? "Copied to clipboard!" : "Copy link"}
          </TooltipContent>
        </Tooltip>

        {/* Open External Link with top-right shift */}
        <Tooltip>
          <TooltipTrigger>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/ext inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all duration-150"
            >
              <ExternalLink className="size-3.5 transition-transform duration-150 ease-out group-hover/ext:translate-x-0.5 group-hover/ext:-translate-y-0.5" />
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

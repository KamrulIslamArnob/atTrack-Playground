"use client";

import { LinkCategory, SocialLink } from "@/lib/types/links";
import { LinkRow } from "./link-row";
import { InfoTooltip } from "@/components/ui/tooltip";
import { Plus, MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CategoryPanelProps {
  category: LinkCategory;
  categories: LinkCategory[];
  links: SocialLink[];
  onAddLink: (categoryId: string) => void;
  onEditLink: (link: SocialLink) => void;
  onDeleteLink: (linkId: string) => void;
  onMoveLinkCategory: (linkId: string, newCategoryId: string) => void;
  onRenameCategory: (category: LinkCategory) => void;
  onDeleteCategory: (category: LinkCategory) => void;
  isFullWidth?: boolean;
}

export function CategoryPanel({
  category,
  categories,
  links,
  onAddLink,
  onEditLink,
  onDeleteLink,
  onMoveLinkCategory,
  onRenameCategory,
  onDeleteCategory,
  isFullWidth = false,
}: CategoryPanelProps) {
  return (
    <div
      id={`category-panel-${category.id}`}
      className={`${
        isFullWidth
          ? "w-full p-5 md:p-6"
          : "min-w-[320px] md:min-w-[380px] snap-start flex-none p-4"
      } flex flex-col justify-between rounded-2xl border border-border bg-card shadow-2xs transition-all duration-200 ease-out hover:border-border/80`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${isFullWidth ? "text-base md:text-lg" : "text-sm"} text-foreground tracking-tight`}>
              {category.name}
            </h3>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {links.length}
            </span>
            <InfoTooltip
              content="Link Category: Group job portals, career pages, and resources. Use '+' at the bottom to add links or '...' to manage category settings."
              side="top"
            />
          </div>

          {/* Category Actions Popover */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.98] transition-transform">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem onClick={() => onRenameCategory(category)} className="gap-2 cursor-pointer">
                <Edit3 className="size-3.5 text-muted-foreground" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteCategory(category)}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Links List / Grid */}
        {links.length > 0 ? (
          <div className={isFullWidth ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4" : "space-y-2 mb-3"}>
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                categories={categories}
                onEdit={onEditLink}
                onDelete={onDeleteLink}
                onMoveCategory={onMoveLinkCategory}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-8 my-2 text-center">
            <p className="text-xs text-muted-foreground">No links in this category yet.</p>
          </div>
        )}
      </div>

      {/* Footer Add Link Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onAddLink(category.id)}
        className="w-full justify-start gap-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all"
      >
        <Plus className="size-3.5" />
        Add Link
      </Button>
    </div>
  );
}

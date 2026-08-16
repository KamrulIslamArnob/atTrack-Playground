"use client";

import { LinkCategory, SocialLink } from "@/lib/types/links";
import { LinkRow } from "./link-row";
import { Plus, MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  onPanStart?: (pointerId: number, clientX: number) => void;
  onPanMove?: (pointerId: number, clientX: number) => void;
  onPanEnd?: (pointerId: number) => void;
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
  onPanStart,
  onPanMove,
  onPanEnd,
  isFullWidth = false,
}: CategoryPanelProps) {
  return (
    <div
      id={`category-panel-${category.id}`}
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xs transition-all duration-150 ease-out",
        isFullWidth
          ? "w-full"
          : "min-w-[320px] sm:min-w-[360px] md:min-w-[380px] max-w-[420px] flex-none"
      )}
    >
      <div>
        {/* Category Header with Drag-to-Scroll support */}
        <div
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button, a, input, [role='menuitem']")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            onPanStart?.(e.pointerId, e.clientX);
          }}
          onPointerMove={(e) => {
            onPanMove?.(e.pointerId, e.clientX);
          }}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
            onPanEnd?.(e.pointerId);
          }}
          onPointerCancel={(e) => {
            onPanEnd?.(e.pointerId);
          }}
          className={cn(
            "flex items-center justify-between mb-3.5 pb-2.5 border-b border-border/50 select-none",
            !isFullWidth && "cursor-grab active:cursor-grabbing touch-none"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-foreground tracking-tight truncate">
              {category.name}
            </h3>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
              {links.length}
            </span>
          </div>

          {/* Header Action Controls: Add Link (+) and More Options (...) */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAddLink(category.id)}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all"
              title={`Add link to ${category.name}`}
            >
              <Plus className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.95] transition-all">
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
        </div>

        {/* Links List */}
        {links.length > 0 ? (
          <div className={isFullWidth ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5" : "space-y-2.5"}>
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-6 my-1 text-center">
            <p className="text-xs text-muted-foreground">No links in this category yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

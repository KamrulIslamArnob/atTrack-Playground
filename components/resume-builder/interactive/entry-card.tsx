"use client";

import { useState, useCallback } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { ChevronUpIcon } from "@/components/ui/chevron-up";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { PlusIcon } from "@/components/ai-chatbot/plus-icon";
import { cn } from "@/lib/utils";

interface EntryCardProps {
  children: React.ReactNode;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onAddAfter?: () => void;
  ariaLabel: string;
  className?: string;
}

export function EntryCard({
  children,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddAfter,
  ariaLabel,
  className,
}: EntryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState<"above" | "below" | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setIsDragging(true);
  }, [index]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOver(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOver(e.clientY < midY ? "above" : "below");
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    if (fromIndex === index) {
      setDragOver(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const toIndex = e.clientY < midY ? index : index + 1;
    if (fromIndex < toIndex) {
      onMoveDown();
    } else {
      onMoveUp();
    }
    setDragOver(null);
  }, [index, onMoveUp, onMoveDown]);

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-border transition-all duration-200 p-4 shadow-2xs",
        isDragging && "opacity-50",
        dragOver === "above" && "border-t-2 border-t-primary",
        dragOver === "below" && "border-b-2 border-b-primary",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="group"
      aria-roledescription="entry"
      aria-label={ariaLabel}
    >
      {/* Hover Floating Island Toolbar */}
      <div
        className={cn(
          "absolute -top-3.5 right-4 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-md p-0.5 transition-all duration-150 z-10",
          isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          aria-label={`Drag to reorder ${ariaLabel}`}
          className="inline-flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Move ${ariaLabel} up`}
          disabled={index === 0}
          onClick={onMoveUp}
          className="inline-flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronUpIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Move ${ariaLabel} down`}
          disabled={index === total - 1}
          onClick={onMoveDown}
          className="inline-flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDownIcon className="size-3.5" />
        </button>
        {onAddAfter && (
          <button
            type="button"
            aria-label={`Add entry after ${ariaLabel}`}
            onClick={onAddAfter}
            className="inline-flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusIcon className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${ariaLabel}`}
          onClick={onDelete}
          className="inline-flex items-center justify-center size-6 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {children}
    </div>
  );
}

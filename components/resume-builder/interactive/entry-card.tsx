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
        "group relative rounded-xl border border-border p-3 transition-all",
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
      {/* Hover toolbar */}
      <div
        className={cn(
          "absolute -top-3 right-3 flex items-center gap-0.5 rounded-md border border-border bg-card shadow-sm transition-opacity",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <button
          type="button"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          aria-label={`Drag to reorder ${ariaLabel}`}
          className="inline-flex items-center justify-center size-6 rounded-l-md hover:bg-muted cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <GripVertical className="size-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          aria-label={`Move ${ariaLabel} up`}
          disabled={index === 0}
          onClick={onMoveUp}
          className="inline-flex items-center justify-center size-6 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <ChevronUpIcon className="size-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          aria-label={`Move ${ariaLabel} down`}
          disabled={index === total - 1}
          onClick={onMoveDown}
          className="inline-flex items-center justify-center size-6 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
        {onAddAfter && (
          <button
            type="button"
            aria-label={`Add entry after ${ariaLabel}`}
            onClick={onAddAfter}
            className="inline-flex items-center justify-center size-6 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <PlusIcon className="size-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${ariaLabel}`}
          onClick={onDelete}
          className="inline-flex items-center justify-center size-6 rounded-r-md hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </button>
      </div>

      {children}
    </div>
  );
}

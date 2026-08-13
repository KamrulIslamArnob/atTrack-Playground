"use client";

import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  existingTags?: string[];
  placeholder?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  className?: string;
}

export function TagInput({
  tags,
  onChange,
  existingTags = [],
  placeholder = "Type a tag and press Enter...",
  badgeVariant = "secondary",
  className = "",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  // Filter existing tags not yet added
  const suggestions = existingTags
    .filter((t) => !tags.includes(t))
    .filter((t) => (!inputValue.trim() ? true : t.toLowerCase().includes(inputValue.trim().toLowerCase())));

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag, idx) => (
          <Badge
            key={idx}
            variant={badgeVariant}
            className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={() => removeTag(idx)}
              className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <div className="flex-1 flex items-center min-w-[140px]">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTag(inputValue)}
            placeholder={tags.length === 0 ? placeholder : "Add tag..."}
            className="h-7 text-xs border-0 focus-visible:ring-0 shadow-none px-1 bg-transparent"
          />
        </div>
      </div>

      {/* Suggested Existing Tags */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground/80 mr-1">Existing Tags:</span>
          {suggestions.slice(0, 8).map((sugg) => (
            <button
              key={sugg}
              type="button"
              onClick={() => addTag(sugg)}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-0.5 text-[11px] font-medium transition-all active:scale-[0.98] border border-border/40"
            >
              <Plus className="size-3" /> #{sugg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  className?: string;
}

export function TagInput({
  tags,
  onChange,
  placeholder = "Type and press Enter...",
  badgeVariant = "secondary",
  className = "",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim();
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

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag, idx) => (
          <Badge
            key={idx}
            variant={badgeVariant}
            className="flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg"
          >
            <span>{tag}</span>
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
    </div>
  );
}

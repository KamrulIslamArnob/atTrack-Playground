"use client";

import { useState, useRef, useCallback } from "react";
import { Bold, Italic, Badge, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseInline } from "@/lib/resume/inline";
import { ResumeInline } from "@/lib/resume/render-html";

interface InlineRichTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

export function InlineRichText({
  value,
  onChange,
  placeholder = "Click to edit…",
  ariaLabel,
  className,
}: InlineRichTextProps) {
  const [isActive, setIsActive] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleActivate = useCallback(() => {
    setIsActive(true);
    setEditValue(value);
  }, [value]);

  const handleCommit = useCallback(() => {
    setIsActive(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  const handleCancel = useCallback(() => {
    setIsActive(false);
    setEditValue(value);
  }, [value]);

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = editValue.slice(start, end);
      const next = editValue.slice(0, start) + before + selected + after + editValue.slice(end);
      setEditValue(next);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
    },
    [editValue]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const next = editValue.slice(0, start) + text + editValue.slice(textarea.selectionEnd);
      setEditValue(next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [editValue]
  );

  const toolbarButtonClass =
    "inline-flex items-center justify-center size-7 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring";

  if (isActive) {
    return (
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={false}
            className={toolbarButtonClass}
            onClick={() => wrapSelection("**", "**")}
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Italic"
            aria-pressed={false}
            className={toolbarButtonClass}
            onClick={() => wrapSelection("*", "*")}
          >
            <Italic className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Separator"
            className={toolbarButtonClass}
            onClick={() => insertAtCursor(" | ")}
          >
            <span className="text-xs font-bold">·</span>
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            aria-label="Insert badge (live link)"
            className={toolbarButtonClass}
            onClick={() => insertAtCursor('[live](https://example.com "Label")')}
          >
            <Badge className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Insert chip"
            className={toolbarButtonClass}
            onClick={() => insertAtCursor("[cat](Label)")}
          >
            <Type className="size-3.5" />
          </button>
        </div>

        {/* Editor */}
        <textarea
          ref={textareaRef}
          aria-label={`Edit ${ariaLabel}`}
          className={cn(
            "w-full rounded-md border border-ring bg-background px-3 py-2 text-sm",
            "ring-2 ring-ring ring-offset-2 ring-offset-background",
            "focus:outline-none min-h-24 resize-y font-mono",
            className
          )}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              handleCommit();
            }
          }}
        />

        {/* Mini preview */}
        {editValue && (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Preview:</p>
            <ResumeInline nodes={parseInline(editValue)} />
          </div>
        )}
      </div>
    );
  }

  const isEmpty = !value.trim();

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel}: ${value || "empty"}. Click to edit.`}
      className={cn(
        "cursor-text rounded px-1 -mx-1 transition-colors block",
        isEmpty && "italic text-muted-foreground/60",
        !isEmpty && "hover:bg-muted/40 focus:bg-muted/40",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      {isEmpty ? placeholder : <ResumeInline nodes={parseInline(value)} />}
    </span>
  );
}

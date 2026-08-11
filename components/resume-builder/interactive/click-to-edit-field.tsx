"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ClickToEditFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  ariaLabel: string;
  className?: string;
  displayClassName?: string;
}

export function ClickToEditField({
  value,
  onChange,
  placeholder = "Click to edit…",
  multiline = false,
  ariaLabel,
  className,
  displayClassName,
}: ClickToEditFieldProps) {
  const [isActive, setIsActive] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isActive]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        handleCommit();
      } else if (e.key === "Enter" && e.metaKey && multiline) {
        e.preventDefault();
        handleCommit();
      }
    },
    [handleCancel, handleCommit, multiline]
  );

  if (isActive) {
    const sharedClassName = cn(
      "w-full rounded-md border border-ring bg-background px-2 py-1 text-sm",
      "ring-2 ring-ring ring-offset-2 ring-offset-background",
      "focus:outline-none",
      multiline ? "min-h-20 resize-y" : "h-9",
      className
    );

    return (
      <>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            aria-label={`Edit ${ariaLabel}`}
            className={sharedClassName}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            aria-label={`Edit ${ariaLabel}`}
            className={sharedClassName}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            type="text"
          />
        )}
      </>
    );
  }

  const isEmpty = !value.trim();

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel}: ${value || "empty"}. Click to edit.`}
      className={cn(
        "cursor-text rounded px-1 -mx-1 transition-colors",
        isEmpty && "italic text-muted-foreground/60",
        !isEmpty && "hover:bg-muted/40 focus:bg-muted/40",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        displayClassName
      )}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      {isEmpty ? placeholder : value}
    </span>
  );
}

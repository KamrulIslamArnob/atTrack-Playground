"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { EyeIcon } from "@/components/ui/eye";
import { EyeOffIcon } from "@/components/ui/eye-off";
import { cn } from "@/lib/utils";

interface SectionAccordionProps {
  title: string;
  visible?: boolean;
  onToggleVisibility?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function SectionAccordion({
  title,
  visible,
  onToggleVisibility,
  children,
  defaultOpen = false,
  className,
}: SectionAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <section
      aria-labelledby={`${title}-heading`}
      className={cn("rounded-2xl border border-border bg-card overflow-hidden", className)}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <h3 id={`${title}-heading`} className="flex-1">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`${title}-panel`}
            onClick={handleToggle}
            className={cn(
              "flex w-full items-center gap-2 text-left text-sm font-semibold",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            )}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isOpen && "rotate-180"
              )}
            />
            <span>{title}</span>
            {!visible && (
              <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                hidden
              </span>
            )}
          </button>
        </h3>
        <button
          type="button"
          aria-label={`Toggle visibility: ${title} ${visible ? "shown" : "hidden"}`}
          aria-pressed={visible}
          onClick={onToggleVisibility}
          className={cn(
            "inline-flex items-center justify-center size-7 rounded-md",
            "hover:bg-muted transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
        >
          {visible ? (
            <EyeIcon className="size-4 text-muted-foreground" />
          ) : (
            <EyeOffIcon className="size-4 text-muted-foreground/50" />
          )}
        </button>
      </div>
      <div
        ref={contentRef}
        id={`${title}-panel`}
        role="region"
        aria-labelledby={`${title}-heading`}
        hidden={!isOpen}
        className="border-t border-border"
      >
        <div className="p-4">{children}</div>
      </div>
    </section>
  );
}

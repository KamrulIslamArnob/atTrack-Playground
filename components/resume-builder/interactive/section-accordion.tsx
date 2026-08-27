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
      className={cn(
        "rounded-2xl border border-border/80 bg-card shadow-2xs hover:border-border transition-all duration-200 overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h3 id={`${title}-heading`} className="flex-1 min-w-0">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={`${title}-panel`}
            onClick={handleToggle}
            className={cn(
              "group/btn flex w-full items-center gap-2.5 text-left text-sm font-semibold text-foreground select-none",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg cursor-pointer"
            )}
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-muted/60 text-muted-foreground group-hover/btn:bg-muted group-hover/btn:text-foreground transition-colors duration-150 shrink-0">
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200 ease-out",
                  isOpen && "rotate-180"
                )}
              />
            </div>
            <span className="truncate">{title}</span>
            {visible === false && (
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">
                Hidden in PDF
              </span>
            )}
          </button>
        </h3>
        {onToggleVisibility && (
          <button
            type="button"
            aria-label={`Toggle visibility: ${title} ${visible ? "shown" : "hidden"}`}
            aria-pressed={visible}
            onClick={onToggleVisibility}
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-lg",
              "hover:bg-muted/80 transition-all duration-150 cursor-pointer active:scale-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {visible ? (
              <EyeIcon className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
            ) : (
              <EyeOffIcon className="size-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
            )}
          </button>
        )}
      </div>
      <div
        ref={contentRef}
        id={`${title}-panel`}
        role="region"
        aria-labelledby={`${title}-heading`}
        hidden={!isOpen}
        className="border-t border-border/60 bg-background/30"
      >
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </section>
  );
}

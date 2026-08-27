"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    id: "light",
    label: "Light",
    previewBg: "bg-white border-zinc-200 text-zinc-900",
    previewSidebar: "bg-zinc-50 border-zinc-200",
    previewAccent: "bg-sky-500",
  },
  {
    id: "dark",
    label: "Dark",
    previewBg: "bg-zinc-950 border-zinc-800 text-zinc-100",
    previewSidebar: "bg-zinc-900 border-zinc-800",
    previewAccent: "bg-sky-400",
  },
  {
    id: "system",
    label: "System",
    previewBg: "bg-gradient-to-br from-white via-zinc-100 to-zinc-900 border-zinc-300 text-zinc-800",
    previewSidebar: "bg-zinc-200/80 border-zinc-300",
    previewAccent: "bg-sky-500",
  },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme || "light" : null;

  return (
    <section
      aria-labelledby="appearance-heading"
      className="rounded-2xl bg-muted p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 id="appearance-heading" className="text-sm font-semibold tracking-tight text-foreground">
          Interface theme
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Select your preferred visual mode for the BetterJob application
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const isSelected = currentTheme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={isSelected}
              className={cn(
                "group rounded-xl p-2 text-left transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "bg-background ring-2 ring-primary" : "hover:bg-background/60"
              )}
            >
              {/* Miniature mockup */}
              <div className={cn("flex h-14 w-full gap-1 overflow-hidden rounded-lg border p-1.5", t.previewBg)}>
                <div className={cn("h-full w-1/4 shrink-0 rounded-sm border", t.previewSidebar)} />
                <div className="flex flex-1 flex-col gap-1">
                  <div className={cn("h-2 w-1/3 rounded-xs", t.previewAccent)} />
                  <div className="h-1.5 w-full rounded-xs bg-current opacity-20" />
                  <div className="h-1.5 w-2/3 rounded-xs bg-current opacity-15" />
                </div>
              </div>
              <span className="mt-2 flex items-center justify-between gap-2 px-0.5 pb-0.5">
                <span className="text-sm font-medium">{t.label}</span>
                {isSelected && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

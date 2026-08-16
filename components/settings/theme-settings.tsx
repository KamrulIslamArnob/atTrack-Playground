"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  {
    id: "light",
    label: "Light (Default)",
    description: "Crisp, bright white interface.",
    icon: Sun,
    previewBg: "bg-white border-zinc-200 text-zinc-900",
    previewSidebar: "bg-zinc-50 border-zinc-200",
    previewAccent: "bg-blue-500",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Deep, sleek dark mode.",
    icon: Moon,
    previewBg: "bg-zinc-950 border-zinc-800 text-zinc-100",
    previewSidebar: "bg-zinc-900 border-zinc-800",
    previewAccent: "bg-blue-600",
  },
  {
    id: "system",
    label: "System",
    description: "Matches your operating system.",
    icon: Monitor,
    previewBg: "bg-gradient-to-br from-white via-zinc-100 to-zinc-900 border-zinc-300 text-zinc-800",
    previewSidebar: "bg-zinc-200/80 border-zinc-300",
    previewAccent: "bg-blue-500",
  },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sun className="size-4" />
            Appearance
          </CardTitle>
          <CardDescription>Choose your preferred interface theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentTheme = theme || "light";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sun className="size-4" />
          Appearance & Theme
        </CardTitle>
        <CardDescription>
          Select your default workspace theme. Light mode is enabled by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isSelected = currentTheme === t.id;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  "group relative flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer select-none",
                  isSelected
                    ? "border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-xs"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/40"
                )}
              >
                {/* Visual miniature mockup */}
                <div className={cn("w-full h-16 rounded-lg border overflow-hidden p-1.5 flex gap-1 mb-3", t.previewBg)}>
                  <div className={cn("w-1/4 h-full rounded-sm border shrink-0", t.previewSidebar)} />
                  <div className="flex-1 flex flex-col gap-1">
                    <div className={cn("h-2.5 w-1/3 rounded-xs", t.previewAccent)} />
                    <div className="h-2 w-full rounded-xs bg-current opacity-20" />
                    <div className="h-2 w-2/3 rounded-xs bg-current opacity-15" />
                  </div>
                </div>

                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium text-foreground">{t.label}</span>
                  </div>
                  {isSelected && (
                    <div className="flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xs">
                      <Check className="size-3" strokeWidth={3} />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground mt-1">{t.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

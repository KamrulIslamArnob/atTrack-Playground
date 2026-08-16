"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { Menu } from "lucide-react";
import { XIcon } from "@/components/ui/x";
import { Sidebar, type SidebarProps } from "@/components/sidebar";
import { cn } from "@/lib/utils";

export function DashboardHeader({ user, avatarUrl, fullName, role, showRawDatabase }: SidebarProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const homeHref = role === "admin" ? "/admin" : "/overview";

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileNavOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="app-drag-region flex h-14 items-center justify-between rounded-2xl border border-border bg-card px-4 md:hidden">
        <Link href={homeHref} className="app-no-drag flex items-center gap-2">
          <ThemeLogo width={24} height={24} />
          <span className="font-heading text-base font-semibold">atTrack</span>
        </Link>

        <button
          onClick={() => setMobileNavOpen(true)}
          className="app-no-drag flex size-9 items-center justify-center rounded-2xl border border-border text-foreground transition-[background-color,transform] duration-160 ease-out active:scale-[0.96] hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileNavOpen ? "" : "pointer-events-none"
        )}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity duration-200 ease-out",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 right-0 flex h-full w-60 flex-col border-l border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]",
            mobileNavOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-end border-b border-border/60 px-4 py-3">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-[background-color,color,transform] duration-160 ease-out active:scale-[0.96] hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {mobileNavOpen && (
              <Sidebar user={user} avatarUrl={avatarUrl} fullName={fullName} role={role} showRawDatabase={showRawDatabase} onNavigate={() => setMobileNavOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

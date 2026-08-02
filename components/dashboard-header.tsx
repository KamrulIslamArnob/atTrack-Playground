"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { Bell, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export function DashboardHeader() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <header className="flex h-14 items-center justify-between rounded-4xl border border-border bg-card px-4">
        <div className="flex items-center gap-6">
          <Link href="/overview" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Aven"
              width={24}
              height={24}
              priority
            />
            <span className="font-heading text-base font-semibold">Aven</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { name: "Overview", href: "/overview" },
              { name: "Applications", href: "/applications" },
              { name: "Saved", href: "/saved" },
              { name: "Interviews", href: "/interviews" },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="rounded-4xl px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-4xl border border-border px-2.5 text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            <Search className="size-4" />
            <span className="hidden md:inline">Search...</span>
            <kbd className="pointer-events-none hidden select-none rounded-4xl border border-border bg-muted px-1.5 text-[10px] font-medium md:inline">
              ⌘K
            </kbd>
          </Button>
          <Button variant="ghost" size="icon" className="size-9 rounded-4xl">
            <Bell className="size-4" />
          </Button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Command className="w-full max-w-lg">
            <div className="flex items-center border-b border-border px-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 size-4 shrink-0 opacity-50"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                autoFocus
                placeholder="Search..."
                className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="pointer-events-none ml-1 hidden select-none rounded-4xl border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
                esc
              </kbd>
              <button
                onClick={() => setOpen(false)}
                className="ml-1 flex size-6 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <CommandList>
                <CommandGroup heading="Navigation">
                  <CommandItem
                    value="overview"
                    onItemSelect={() => {
                      window.location.href = "/overview";
                      setOpen(false);
                    }}
                  >
                    Overview
                  </CommandItem>
                  <CommandItem
                    value="applications"
                    onItemSelect={() => {
                      window.location.href = "/applications";
                      setOpen(false);
                    }}
                  >
                    Applications
                  </CommandItem>
                  <CommandItem
                    value="saved"
                    onItemSelect={() => {
                      window.location.href = "/saved";
                      setOpen(false);
                    }}
                  >
                    Saved Jobs
                  </CommandItem>
                  <CommandItem
                    value="interviews"
                    onItemSelect={() => {
                      window.location.href = "/interviews";
                      setOpen(false);
                    }}
                  >
                    Interviews
                  </CommandItem>
                  <CommandItem
                    value="documents"
                    onItemSelect={() => {
                      window.location.href = "/documents";
                      setOpen(false);
                    }}
                  >
                    Documents
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Account">
                  <CommandItem
                    value="settings"
                    onItemSelect={() => {
                      window.location.href = "/settings";
                      setOpen(false);
                    }}
                  >
                    Settings
                  </CommandItem>
                  <CommandItem
                    value="insights"
                    onItemSelect={() => {
                      window.location.href = "/insights";
                      setOpen(false);
                    }}
                  >
                    Insights
                  </CommandItem>
                </CommandGroup>
              </CommandList>
          </Command>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

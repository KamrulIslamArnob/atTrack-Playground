"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Menu, Search, X, Briefcase, Send, Calendar, FileText, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, type SidebarProps } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { globalSearch, type SearchResult } from "@/lib/actions/search";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  page: <File className="size-4 shrink-0 text-muted-foreground" />,
  job: <Briefcase className="size-4 shrink-0 text-blue-500" />,
  application: <Send className="size-4 shrink-0 text-violet-500" />,
  interview: <Calendar className="size-4 shrink-0 text-emerald-500" />,
  document: <FileText className="size-4 shrink-0 text-amber-500" />,
};

const NAV_ITEMS = [
  { name: "Overview", href: "/overview", keywords: "dashboard home summary" },
  { name: "Jobs", href: "/jobs", keywords: "job listings saved interested" },
  { name: "Applications", href: "/applications", keywords: "application drafts sent" },
  { name: "Interviews", href: "/interviews", keywords: "interview schedule upcoming" },
  { name: "Documents", href: "/documents", keywords: "resume cv cover letter" },
  { name: "Settings", href: "/settings", keywords: "account profile preferences" },
];

export function DashboardHeader({ user, avatarUrl, fullName }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Reset state when dialog closes
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
    prevOpen.current = open;
  }, [open]);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(value);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const hasQuery = query.trim().length >= 2;

  // Filter nav items for quick results when no server query
  const filteredNav = hasQuery
    ? []
    : NAV_ITEMS;

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
              { name: "Home", href: "/" },
              { name: "Features", href: "/#features" },
              { name: "How it works", href: "/#how-it-works" },
              { name: "AI", href: "/#ai" },
              { name: "Testimonials", href: "/#testimonials" },
              { name: "FAQ", href: "/#faq" },
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
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex size-9 items-center justify-center rounded-4xl border border-border text-foreground transition-colors hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
        </div>
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
            "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 right-0 flex h-full w-60 flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
            mobileNavOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <Link href="/overview" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Aven" width={24} height={24} />
              <span className="font-heading text-base font-semibold">Aven</span>
            </Link>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 p-2">
            <Sidebar user={user} avatarUrl={avatarUrl} fullName={fullName} />
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
          <Command value={query} onValueChange={handleSearch} className="w-full max-w-lg">
            <CommandInput placeholder="Search jobs, applications, documents..." />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </div>
              )}

              {!loading && hasQuery && results.length === 0 && (
                <CommandEmpty>No results found for &ldquo;{query}&rdquo;</CommandEmpty>
              )}

              {!loading && !hasQuery && (
                <CommandGroup heading="Quick Navigation">
                  {NAV_ITEMS.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onItemSelect={() => {
                        window.location.href = item.href;
                        setOpen(false);
                      }}
                    >
                      <File className="mr-2 size-4 shrink-0 text-muted-foreground" />
                      {item.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.page && (
                <CommandGroup heading="Pages">
                  {grouped.page.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`page-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setOpen(false);
                      }}
                    >
                      {TYPE_ICONS.page}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.job && (
                <CommandGroup heading="Jobs">
                  {grouped.job.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`job-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setOpen(false);
                      }}
                    >
                      {TYPE_ICONS.job}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.application && (
                <CommandGroup heading="Applications">
                  {grouped.application.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`app-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setOpen(false);
                      }}
                    >
                      {TYPE_ICONS.application}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.interview && (
                <CommandGroup heading="Interviews">
                  {grouped.interview.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`interview-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setOpen(false);
                      }}
                    >
                      {TYPE_ICONS.interview}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.document && (
                <CommandGroup heading="Documents">
                  {grouped.document.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`doc-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setOpen(false);
                      }}
                    >
                      {TYPE_ICONS.document}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
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

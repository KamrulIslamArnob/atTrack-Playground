"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { globalSearch, adminGlobalSearch, type SearchResult, type AdminSearchResult } from "@/lib/actions/search";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Briefcase,
  Send,
  Calendar,
  FileText,
  Settings,
  Sun,
  Moon,
  Monitor,
  Users,
  Activity,
  Cpu,
  KanbanSquare,
  Search,
  Bell,
  File,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
];

const pipelineNavigation = [
  { name: "Board", href: "/board", icon: KanbanSquare },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
];

const resourceNavigation = [
  { name: "Resume/CV", href: "/documents", icon: FileText },
  { name: "CRM", href: "/crm", icon: Users },
];

const secondaryNavigation = [
  // { name: "Insights", href: "/insights", icon: Lightbulb },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminOverviewNavigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
];

const adminManagementNavigation = [
  { name: "Users", href: "/admin/users", icon: Users },
];

const adminMonitoringNavigation = [
  { name: "Activity Log", href: "/admin/activity", icon: Activity },
  { name: "AI Usage", href: "/admin/ai-usage", icon: Cpu },
];

const NAV_ITEMS = [
  { name: "Overview", href: "/overview", keywords: "home summary stats" },
  { name: "Board", href: "/board", keywords: "kanban pipeline stages drag" },
  { name: "Jobs", href: "/jobs", keywords: "job listings saved interested" },
  { name: "Resume/CV", href: "/documents", keywords: "resume cv cover letter" },
  { name: "CRM", href: "/crm", keywords: "contacts companies network" },
  { name: "Settings", href: "/settings", keywords: "profile preferences email" },
];

const ADMIN_NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", keywords: "admin dashboard overview" },
  { name: "Users", href: "/admin/users", keywords: "users accounts manage" },
  { name: "Activity Log", href: "/admin/activity", keywords: "activity audit log" },
  { name: "AI Usage", href: "/admin/ai-usage", keywords: "ai usage tokens cost" },
];

const ADMIN_NAV_ICONS: Record<string, React.ReactNode> = {
  "/admin": <LayoutDashboard className="mr-2 size-4 shrink-0 text-muted-foreground" />,
  "/admin/users": <Users className="mr-2 size-4 shrink-0 text-muted-foreground" />,
  "/admin/activity": <Activity className="mr-2 size-4 shrink-0 text-muted-foreground" />,
  "/admin/ai-usage": <Cpu className="mr-2 size-4 shrink-0 text-muted-foreground" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  page: <File className="size-4 shrink-0 text-muted-foreground" />,
  job: <Briefcase className="size-4 shrink-0 text-blue-500" />,
  application: <Send className="size-4 shrink-0 text-violet-500" />,
  interview: <Calendar className="size-4 shrink-0 text-emerald-500" />,
  document: <FileText className="size-4 shrink-0 text-amber-500" />,
};

export interface SidebarProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  avatarUrl?: string | null;
  fullName?: string | null;
  role?: string;
  onNavigate?: () => void;
  /** Desktop shell only — draggable width, persisted. The mobile drawer's own
      fixed-width panel passes this false and Sidebar just fills it. */
  resizable?: boolean;
}

const SIDEBAR_WIDTH_KEY = "attrack-sidebar-width";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 224;

export function Sidebar({ user, avatarUrl, fullName: profileName, role, onNavigate, resizable }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  useEffect(() => {
    if (!resizable) return;
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (stored < SIDEBAR_MIN_WIDTH || stored > SIDEBAR_MAX_WIDTH) return;
    // Deferred like `mounted` below — avoids a synchronous setState-in-effect.
    const timeout = setTimeout(() => setWidth(stored), 0);
    return () => clearTimeout(timeout);
  }, [resizable]);

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const clamp = (w: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w));
    const onMove = (ev: PointerEvent) => setWidth(clamp(startWidth + (ev.clientX - startX)));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamp(startWidth + (ev.clientX - startX))));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [width]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(SearchResult | AdminSearchResult)[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset state when dialog closes
  const prevSearchOpen = useRef(searchOpen);
  useEffect(() => {
    if (prevSearchOpen.current && !searchOpen) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
    prevSearchOpen.current = searchOpen;
  }, [searchOpen]);

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
        const data = isAdmin ? await adminGlobalSearch(value) : await globalSearch(value);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [isAdmin]);

  // Group results by type
  const grouped = results.reduce<Record<string, (SearchResult | AdminSearchResult)[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  const hasQuery = query.trim().length >= 2;
  const homeHref = isAdmin ? "/admin" : "/overview";

  const fullName = profileName || user.user_metadata?.full_name || "User";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleCopyEmail = useCallback(async () => {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy email");
    }
  }, [user.email]);

  return (
    <>
      <aside
        className={cn(
          "relative flex h-full flex-col bg-background",
          resizable ? "border-r border-border" : "w-full"
        )}
        style={resizable ? { width } : undefined}
      >
        <div className="border-b border-border/50 p-3">
          <Link href={homeHref} onClick={onNavigate} className="mb-2 flex items-center gap-2 px-1">
            <Image src="/logo.png" alt="AtTrack" width={22} height={22} priority />
            <span className="font-heading text-sm font-semibold">AtTrack</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-1 items-center gap-1.5 justify-start rounded-2xl border border-border px-2.5 text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="pointer-events-none select-none rounded-2xl border border-border bg-muted px-1.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-2xl">
              <Bell className="size-4" />
            </Button>
          </div>
        </div>

        <div className="border-b border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium leading-none truncate">
                  {fullName}
                </p>
                {role === "admin" && (
                  <span className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={handleCopyEmail}
                className="mt-1 flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground transition-colors group"
                title="Copy email"
              >
                <span className="truncate">{user.email || "No email"}</span>
                {copied ? (
                  <Check className="size-3 shrink-0 text-emerald-500" />
                ) : (
                  <Copy className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              {role === "admin" && (
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/60">
                  Admin Panel
                </p>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {role === "admin" ? (
            <>
              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Admin
              </div>

              <div className="space-y-0.5">
                {adminOverviewNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-border/50" />

              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Management
              </div>
              <div className="space-y-0.5">
                {adminManagementNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-border/50" />

              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Monitoring
              </div>
              <div className="space-y-0.5">
                {adminMonitoringNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-0.5">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-border/50" />

              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Job Search
              </div>
              <div className="space-y-0.5">
                {pipelineNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-border/50" />

              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Network
              </div>
              <div className="space-y-0.5">
                {resourceNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-border/50" />

              <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                Preferences
              </div>
              <div className="space-y-0.5">
                {secondaryNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-border/50 p-3">
          <div className="mb-3">
            <div className="flex items-center justify-between px-3">
              <span className="text-xs font-medium text-muted-foreground">
                Theme
              </span>
              {mounted && (
                <div className="flex items-center gap-1 rounded-2xl border border-border p-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-2xl transition-colors",
                      theme === "light"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Sun className="size-3" />
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-2xl transition-colors",
                      theme === "dark"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Moon className="size-3" />
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-2xl transition-colors",
                      theme === "system"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Monitor className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={handleResizeStart}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none hover:bg-primary/20 active:bg-primary/30"
          />
        )}
      </aside>

      {mounted && searchOpen && createPortal(
        <>
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
          <Command value={query} onValueChange={handleSearch} className="w-full max-w-lg">
              <CommandInput placeholder={isAdmin ? "Search users, activity, AI usage..." : "Search jobs, applications, interviews..."} />
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
                        setSearchOpen(false);
                      }}
                    >
                      <File className="mr-2 size-4 shrink-0 text-muted-foreground" />
                      {item.name}
                    </CommandItem>
                  ))}
                  {isAdmin && ADMIN_NAV_ITEMS.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={`admin-${item.name}`}
                      onItemSelect={() => {
                        window.location.href = item.href;
                        setSearchOpen(false);
                      }}
                    >
                      {ADMIN_NAV_ICONS[item.href] ?? <File className="mr-2 size-4 shrink-0 text-muted-foreground" />}
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
                        setSearchOpen(false);
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

              {!loading && hasQuery && grouped.user && (
                <CommandGroup heading="Users">
                  {grouped.user.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`user-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      <Users className="mr-2 size-4 shrink-0 text-blue-500" />
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.activity && (
                <CommandGroup heading="Activity Logs">
                  {grouped.activity.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`activity-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      <Activity className="mr-2 size-4 shrink-0 text-emerald-500" />
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.ai_usage && (
                <CommandGroup heading="AI Usage">
                  {grouped.ai_usage.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`ai-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      <Cpu className="mr-2 size-4 shrink-0 text-violet-500" />
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
                        setSearchOpen(false);
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
                        setSearchOpen(false);
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
                        setSearchOpen(false);
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
                        setSearchOpen(false);
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
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSearchOpen(false)}
        />
        </>,
        document.body
      )}
    </>
  );
}

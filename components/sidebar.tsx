"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { cn } from "@/lib/utils";
import { globalSearch, adminGlobalSearch, type SearchResult, type AdminSearchResult } from "@/lib/actions/search";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { NotificationButton } from "@/components/ui/notification-button";
import {
  LayoutDashboard,
  Briefcase,
  Send,
  Calendar,
  FileText,
  Settings,
  Sparkles,
  Users,
  Activity,
  Cpu,
  Search,
  Loader2,
  Copy,
  Check,
  MoreVertical,
  ChevronRight,
  Building2,
  User,
  Database,
  Gauge,
  Link2,
  Bot,
  Clock,
  CornerDownLeft,
  Compass,
} from "lucide-react";
import { toast } from "sonner";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
];

const resourceNavigation = [
  { name: "Document", href: "/documents", icon: FileText },
  { name: "Network", href: "/network", icon: Users },
  { name: "Resources", href: "/resources", icon: Link2 },
  { name: "Prompts", href: "/prompts", icon: Sparkles },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Database", href: "/preferences/database", icon: Database },
  { name: "Performance", href: "/preferences", icon: Gauge },
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
  { name: "Ask Tracky", href: "/ai-builder/chatbot", keywords: "ai builder chatbot ask tracky tracky gpt gemini claude assistant prompt chat" },
  { name: "Jobs", href: "/jobs", keywords: "jobs board kanban pipeline stages drag job listings saved interested table list" },
  { name: "Document", href: "/documents", keywords: "document resume cv cover letter" },
  { name: "Network", href: "/network", keywords: "contacts companies network crm" },
  { name: "Resources", href: "/resources", keywords: "social links resources portals bookmarks directory" },
  { name: "Settings", href: "/settings", keywords: "profile preferences email" },
  { name: "Prompts", href: "/prompts", keywords: "ai prompts memory custom instructions" },
  { name: "Performance", href: "/preferences", keywords: "performance ram cpu memory port system root path version" },
];

const ADMIN_NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", keywords: "admin dashboard overview" },
  { name: "Users", href: "/admin/users", keywords: "users accounts manage" },
  { name: "AI Usage", href: "/admin/ai-usage", keywords: "ai usage tokens cost" },
];

const ADMIN_NAV_ICONS: Record<string, React.ReactNode> = {
  "/admin": <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" />,
  "/admin/users": <Users className="size-4 shrink-0 text-muted-foreground" />,
  "/admin/ai-usage": <Cpu className="size-4 shrink-0 text-muted-foreground" />,
};

const ENTITY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string; badge: string }
> = {
  job: {
    label: "Job",
    icon: Briefcase,
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  company: {
    label: "Company",
    icon: Building2,
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  contact: {
    label: "Contact",
    icon: User,
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  application: {
    label: "Application",
    icon: Send,
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  interview: {
    label: "Interview",
    icon: Calendar,
    tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  document: {
    label: "Document",
    icon: FileText,
    tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  deadline: {
    label: "Deadline",
    icon: Clock,
    tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  position: {
    label: "Position",
    icon: Briefcase,
    tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    badge: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  page: {
    label: "Page",
    icon: LayoutDashboard,
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    badge: "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  user: {
    label: "User",
    icon: Users,
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  ai_usage: {
    label: "AI Log",
    icon: Cpu,
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
};

function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult | AdminSearchResult;
  onSelect: (href: string) => void;
}) {
  const cfg = ENTITY_CONFIG[result.type] ?? ENTITY_CONFIG.page;
  const Icon = cfg.icon;

  return (
    <CommandItem
      value={`${result.type}-${result.id}`}
      onItemSelect={() => onSelect(result.href)}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
    >
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", cfg.tone)}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {result.title}
          </p>
          <span
            className={cn(
              "rounded border px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider shrink-0",
              cfg.badge
            )}
          >
            {cfg.label}
          </span>
        </div>
        {result.subtitle && (
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {result.subtitle}
          </p>
        )}
        {"contentSnippet" in result && result.contentSnippet && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80 bg-muted/40 rounded-md px-2 py-0.5 border border-border/40">
            <span className="truncate">{result.contentSnippet}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground shrink-0">
        <span className="text-[11px] font-medium">Open</span>
        <CornerDownLeft className="size-3" />
      </div>
    </CommandItem>
  );
}

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
  /** Gates the "Database" nav item — off by default, see lib/db/schema.sql. */
  showRawDatabase?: boolean;
  onNavigate?: () => void;
  /** Desktop shell only — draggable width, persisted. The mobile drawer's own
      fixed-width panel passes this false and Sidebar just fills it. */
  resizable?: boolean;
}

const SIDEBAR_WIDTH_KEY = "attrack-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "attrack-sidebar-collapsed";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 224;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export function Sidebar({ user, avatarUrl, fullName: profileName, role, showRawDatabase, onNavigate, resizable }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const visibleSecondaryNavigation = showRawDatabase
    ? secondaryNavigation
    : secondaryNavigation.filter((item) => item.href !== "/preferences/database");

  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!resizable) return;
    const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (storedWidth >= SIDEBAR_MIN_WIDTH && storedWidth <= SIDEBAR_MAX_WIDTH) {
      const timeout = setTimeout(() => setWidth(storedWidth), 0);
      return () => clearTimeout(timeout);
    }
  }, [resizable]);

  useEffect(() => {
    if (!resizable) return;
    const storedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (storedCollapsed === "true") {
      setIsCollapsed(true);
    }
  }, [resizable]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

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
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState<(SearchResult | AdminSearchResult)[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientSearchCache = useRef<Map<string, (SearchResult | AdminSearchResult)[]>>(new Map());

  const isAdmin = role === "admin";

  const handleSelectResult = useCallback((href: string) => {
    setSearchOpen(false);
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank");
    } else {
      router.push(href);
    }
  }, [router]);

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      if (resizable) {
        e.preventDefault();
        toggleCollapse();
      }
    }
  }, [resizable, toggleCollapse]);

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
      setActiveTab("all");
      setLoading(false);
    }
    prevSearchOpen.current = searchOpen;
  }, [searchOpen]);

  // Debounced search with client LRU cache and snappy 120ms debounce
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${isAdmin ? "admin" : "user"}:${trimmed.toLowerCase()}`;
    const cached = clientSearchCache.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = isAdmin ? await adminGlobalSearch(value) : await globalSearch(value);
        if (clientSearchCache.current.size >= 50) {
          const oldest = clientSearchCache.current.keys().next().value;
          if (oldest) clientSearchCache.current.delete(oldest);
        }
        clientSearchCache.current.set(cacheKey, data);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 120);
  }, [isAdmin]);

  const filteredResults = activeTab === "all" ? results : results.filter((r) => r.type === activeTab);

  // Group results by type
  const grouped = filteredResults.reduce<Record<string, (SearchResult | AdminSearchResult)[]>>((acc, r) => {
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
      toast.error("Couldn't copy email");
    }
  }, [user.email]);

  return (
    <>
      <aside
        className={cn(
          "relative z-30 flex h-full flex-col bg-background transition-[width] duration-300 ease-in-out select-none",
          resizable ? "border-r border-border" : "w-full"
        )}
        style={resizable ? { width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : width } : undefined}
      >
        {resizable && (
          <button
            type="button"
            onClick={toggleCollapse}
            className={cn(
              "app-no-drag absolute -right-2.5 top-8 z-50 flex h-7 w-4.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-all duration-200 hover:scale-110 hover:bg-primary hover:text-white hover:border-primary hover:shadow-md focus:outline-none"
            )}
            title={isCollapsed ? "Expand sidebar (⌘B)" : "Minimize sidebar (⌘B)"}
          >
            {isCollapsed ? (
              <ChevronRight className="size-3" />
            ) : (
              <MoreVertical className="size-3" />
            )}
          </button>
        )}

        {/* Top Section: User Profile */}
        <div className={cn("app-drag-region border-b border-border/50", isCollapsed ? "p-2.5 flex justify-center" : "p-4")}>
          {isCollapsed ? (
            <button
              onClick={handleCopyEmail}
              className="relative group rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              title={`${fullName} (${user.email || "No email"}) — Click to copy email`}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  width={36}
                  height={36}
                  unoptimized
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    width={36}
                    height={36}
                    unoptimized
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
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-2", isCollapsed ? "px-2" : "px-3")}>
          {role === "admin" ? (
            <>
              {!isCollapsed && (
                <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                  Admin
                </div>
              )}

              <div className="space-y-1">
                {adminOverviewNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className={cn("my-3 h-px bg-border/50", isCollapsed && "mx-1")} />

              {!isCollapsed && (
                <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                  Management
                </div>
              )}
              <div className="space-y-1">
                {adminManagementNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className={cn("my-3 h-px bg-border/50", isCollapsed && "mx-1")} />

              {!isCollapsed && (
                <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                  Monitoring
                </div>
              )}
              <div className="space-y-1">
                {adminMonitoringNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                {navigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/board" && (pathname === "/jobs" || pathname.startsWith("/jobs"))) ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className={cn("my-3 h-px bg-border/50", isCollapsed && "mx-1")} />

              <div className="space-y-1">
                {resourceNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>

              <div className={cn("my-3 h-px bg-border/50", isCollapsed && "mx-1")} />

              {!isCollapsed && (
                <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
                  Preferences
                </div>
              )}
              <div className="space-y-1">
                {visibleSecondaryNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "size-10 mx-auto justify-center p-0 rounded-xl" : "gap-3 px-3 py-2 rounded-lg",
                        isActive
                          ? "bg-gradient-brand text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* Ask Tracky Button (Pinned directly above the bottom divider and logo) */}
        <div className={cn("px-3 pb-2.5", isCollapsed && "px-2 pb-2.5")}>
          <Link
            href="/ai-builder/chatbot"
            onClick={onNavigate}
            title={isCollapsed ? "Ask Tracky" : undefined}
            className={cn(
              "btn-liquid-tracky group flex items-center font-semibold text-sm shadow-xs active:scale-[0.97] select-none",
              isCollapsed
                ? "size-10 justify-center mx-auto p-0"
                : "w-full justify-center gap-2 px-3.5 py-2.5 h-10",
              (pathname.startsWith("/ai-builder/chatbot") || pathname === "/chatbot") && "active"
            )}
          >
            <Bot className="size-4.5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-12 group-hover:scale-110" />

            {!isCollapsed && (
              <span className="truncate tracking-tight font-semibold text-sm">
                Ask Tracky
              </span>
            )}
          </Link>
        </div>

        {/* Bottom Section: atTrack Logo, Search, Notification & Theme */}
        <div className={cn("border-t border-border/50 space-y-2.5", isCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3")}>
          {/* Row 1: Logo & Notification Button */}
          <div className="app-no-drag flex items-center justify-between">
            <Link
              href={homeHref}
              onClick={onNavigate}
              className="flex items-center gap-2 min-w-0 px-1"
              title={isCollapsed ? "atTrack Overview" : undefined}
            >
              <ThemeLogo width={22} height={22} />
              {!isCollapsed && <span className="font-heading text-sm font-semibold truncate">atTrack</span>}
            </Link>
            {!isCollapsed && <NotificationButton />}
          </div>

          {/* Row 2: Search Bar (Full Width) */}
          {isCollapsed ? (
            <div className="app-no-drag flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg border border-border text-muted-foreground"
                onClick={() => setSearchOpen(true)}
                title="Search... (⌘K)"
              >
                <Search className="size-4" />
              </Button>
              <NotificationButton />
            </div>
          ) : (
            <div className="app-no-drag w-full">
              <Button
                variant="ghost"
                size="sm"
                className="flex w-full items-center gap-1.5 justify-start rounded-lg border border-border px-2.5 text-muted-foreground"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 text-left text-xs">Search...</span>
                <kbd className="pointer-events-none select-none rounded border border-border bg-muted px-1.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </Button>
            </div>
          )}
        </div>

        {resizable && !isCollapsed && (
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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <Command value={query} onValueChange={handleSearch} className="w-full max-w-[660px] rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/25 overflow-hidden ring-1 ring-border/50 animate-in zoom-in-95 duration-150">
            <CommandInput
              placeholder={isAdmin ? "Search users, AI usage logs, or navigation..." : "Search jobs, companies, contacts, documents, interviews..."}
              onClear={() => {
                setQuery("");
                setResults([]);
                setActiveTab("all");
              }}
            />

            {!loading && hasQuery && results.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 bg-muted/25 px-3 py-2 scrollbar-minimal">
                {[
                  { id: "all", label: "All", count: results.length },
                  { id: "job", label: "Jobs", count: results.filter((r) => r.type === "job").length },
                  { id: "company", label: "Companies", count: results.filter((r) => r.type === "company").length },
                  { id: "contact", label: "Contacts", count: results.filter((r) => r.type === "contact").length },
                  { id: "application", label: "Applications", count: results.filter((r) => r.type === "application").length },
                  { id: "interview", label: "Interviews", count: results.filter((r) => r.type === "interview").length },
                  { id: "document", label: "Documents", count: results.filter((r) => r.type === "document").length },
                  { id: "deadline", label: "Deadlines", count: results.filter((r) => r.type === "deadline").length },
                  { id: "position", label: "Positions", count: results.filter((r) => r.type === "position").length },
                  { id: "page", label: "Pages", count: results.filter((r) => r.type === "page").length },
                  { id: "user", label: "Users", count: results.filter((r) => r.type === "user").length },
                  { id: "ai_usage", label: "AI Usage", count: results.filter((r) => r.type === "ai_usage").length },
                ]
                  .filter((tab) => tab.id === "all" || tab.count > 0)
                  .map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all shrink-0",
                        activeTab === tab.id
                          ? "bg-foreground text-background shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-semibold leading-none",
                          activeTab === tab.id
                            ? "bg-background/25 text-background"
                            : "bg-muted-foreground/15 text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
              </div>
            )}

            <CommandList className="max-h-[55vh] overflow-y-auto p-2 scrollbar-minimal">
              {loading && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-xs">Searching across your workspace...</span>
                </div>
              )}

              {!loading && hasQuery && filteredResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
                    <Search className="size-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No results for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Try searching for a different company name, job role, contact tag, or status.
                  </p>
                </div>
              )}

              {!loading && !hasQuery && (
                <div className="space-y-3 p-1">
                  <CommandGroup heading="Quick Navigation">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {NAV_ITEMS.map((item) => (
                        <CommandItem
                          key={item.name}
                          value={item.name}
                          onItemSelect={() => handleSelectResult(item.href)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground">
                            <Compass className="size-3.5" />
                          </div>
                          <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                        </CommandItem>
                      ))}
                      {isAdmin && ADMIN_NAV_ITEMS.map((item) => (
                        <CommandItem
                          key={item.name}
                          value={`admin-${item.name}`}
                          onItemSelect={() => handleSelectResult(item.href)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground">
                            {ADMIN_NAV_ICONS[item.href] ?? <Compass className="size-3.5" />}
                          </div>
                          <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                        </CommandItem>
                      ))}
                    </div>
                  </CommandGroup>
                </div>
              )}

              {!loading && hasQuery && (
                <>
                  {[
                    { key: "page", heading: "Pages" },
                    { key: "job", heading: "Jobs" },
                    { key: "company", heading: "Companies" },
                    { key: "contact", heading: "Contacts" },
                    { key: "application", heading: "Applications" },
                    { key: "interview", heading: "Interviews" },
                    { key: "document", heading: "Documents" },
                    { key: "deadline", heading: "Deadlines" },
                    { key: "position", heading: "Positions" },
                    { key: "user", heading: "Users" },
                    { key: "ai_usage", heading: "AI Logs" },
                  ].map(({ key, heading }) => {
                    const items = grouped[key];
                    if (!items || items.length === 0) return null;
                    return (
                      <CommandGroup key={key} heading={heading}>
                        {items.map((r) => (
                          <SearchResultItem
                            key={r.id}
                            result={r}
                            onSelect={handleSelectResult}
                          />
                        ))}
                      </CommandGroup>
                    );
                  })}
                </>
              )}
            </CommandList>

            {/* Bottom Keyboard Hint Bar */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-3.5 py-2 text-[11px] text-muted-foreground select-none">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/80 px-1 py-0.5 text-[10px] font-medium leading-none">↑</kbd>
                  <kbd className="rounded border border-border bg-muted/80 px-1 py-0.5 text-[10px] font-medium leading-none">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium leading-none">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium leading-none">esc</kbd>
                  Close
                </span>
              </div>
              {hasQuery && (
                <span className="font-semibold text-foreground/80">
                  {filteredResults.length} {filteredResults.length === 1 ? "match" : "matches"}
                </span>
              )}
            </div>
          </Command>
        </div>,
        document.body
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeLogo } from "@/components/ui/theme-logo";
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
import { NotificationButton } from "@/components/ui/notification-button";
import {
  LayoutDashboard,
  Briefcase,
  Send,
  Calendar,
  FileText,
  Settings,
  Sparkles,
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
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Database,
  Gauge,
  Link2,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
];

const aiBuilderNavigation = [
  { name: "Chatbot", href: "/ai-builder/chatbot", icon: Bot },
];

const pipelineNavigation = [
  { name: "Board", href: "/board", icon: KanbanSquare },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
];

const resourceNavigation = [
  { name: "Resume/CV", href: "/documents", icon: FileText },
  { name: "CRM", href: "/crm", icon: Users },
  { name: "Social Links", href: "/links", icon: Link2 },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "AI Prompts", href: "/preferences/ai-prompts", icon: Sparkles },
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
  { name: "Chatbot", href: "/ai-builder/chatbot", keywords: "ai builder chatbot gpt gemini claude assistant prompt chat" },
  { name: "Board", href: "/board", keywords: "kanban pipeline stages drag" },
  { name: "Jobs", href: "/jobs", keywords: "job listings saved interested" },
  { name: "Resume/CV", href: "/documents", keywords: "resume cv cover letter" },
  { name: "CRM", href: "/crm", keywords: "contacts companies network" },
  { name: "Social Links", href: "/links", keywords: "social links resources portals bookmarks directory" },
  { name: "Settings", href: "/settings", keywords: "profile preferences email" },
  { name: "Performance", href: "/preferences", keywords: "performance ram cpu memory port system root path version" },
];

const ADMIN_NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", keywords: "admin dashboard overview" },
  { name: "Users", href: "/admin/users", keywords: "users accounts manage" },
  { name: "AI Usage", href: "/admin/ai-usage", keywords: "ai usage tokens cost" },
];

const ADMIN_NAV_ICONS: Record<string, React.ReactNode> = {
  "/admin": <LayoutDashboard className="mr-2 size-4 shrink-0 text-muted-foreground" />,
  "/admin/users": <Users className="mr-2 size-4 shrink-0 text-muted-foreground" />,
  "/admin/ai-usage": <Cpu className="mr-2 size-4 shrink-0 text-muted-foreground" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  page: <File className="size-4 shrink-0 text-muted-foreground" />,
  job: <Briefcase className="size-4 shrink-0 text-blue-500" />,
  company: <Building2 className="size-4 shrink-0 text-indigo-500" />,
  contact: <User className="size-4 shrink-0 text-teal-500" />,
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
const SIDEBAR_COLLAPSED_KEY = "attrack-sidebar-collapsed";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_DEFAULT_WIDTH = 224;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export function Sidebar({ user, avatarUrl, fullName: profileName, role, onNavigate, resizable }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

  const isAdmin = role === "admin";

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
          "relative flex h-full flex-col bg-background transition-[width] duration-300 ease-in-out select-none",
          resizable ? "border-r border-border" : "w-full"
        )}
        style={resizable ? { width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : width } : undefined}
      >
        {resizable && (
          <button
            type="button"
            onClick={toggleCollapse}
            className={cn(
              "app-no-drag absolute -right-2.5 top-8 z-30 flex h-7 w-4.5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-all duration-200 hover:scale-110 hover:bg-accent hover:text-foreground hover:shadow-md focus:outline-none"
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
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                  Job Search
                </div>
              )}
              <div className="space-y-1">
                {pipelineNavigation.map((item) => {
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
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                  Network
                </div>
              )}
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
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                  AI Builder
                </div>
              )}
              <div className="space-y-1">
                {aiBuilderNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 transition-transform duration-180 ease-out group-hover:scale-110 group-hover:translate-x-0.5 text-emerald-600 dark:text-emerald-400" />
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
                {secondaryNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onNavigate}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98]",
                        isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                        isActive
                          ? "bg-sidebar-primary/25 text-foreground font-semibold border border-sidebar-primary/30"
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
                className="flex w-full items-center gap-1.5 justify-start rounded-2xl border border-border px-2.5 text-muted-foreground"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 text-left text-xs">Search...</span>
                <kbd className="pointer-events-none select-none rounded-2xl border border-border bg-muted px-1.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </Button>
            </div>
          )}

          {/* Theme Selector */}
          {isCollapsed ? (
            mounted && (
              <button
                onClick={() => {
                  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
                  setTheme(nextTheme);
                }}
                className="flex size-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground transition-colors"
                title={`Theme: ${theme ?? "system"} (Click to cycle)`}
              >
                {theme === "light" ? <Sun className="size-4" /> : theme === "dark" ? <Moon className="size-4" /> : <Monitor className="size-4" />}
              </button>
            )
          ) : (
            <div className="flex items-center justify-between px-1 pt-0.5">
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
                    title="Light Theme"
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
                    title="Dark Theme"
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
                    title="System Theme"
                  >
                    <Monitor className="size-3" />
                  </button>
                </div>
              )}
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
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <Command value={query} onValueChange={handleSearch} className="w-full max-w-[600px] border border-border shadow-2xl rounded-2xl">
            <CommandInput placeholder={isAdmin ? "Search users, AI usage..." : "Omni-Search: Search jobs, contacts, documents, interviews..."} />
            {!loading && hasQuery && results.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
                {[
                  { id: "all", label: `All (${results.length})` },
                  { id: "job", label: "Jobs" },
                  { id: "contact", label: "Contacts" },
                  { id: "company", label: "Companies" },
                  { id: "application", label: "Applications" },
                  { id: "interview", label: "Interviews" },
                  { id: "document", label: "Documents" },
                  { id: "deadline", label: "Deadlines" },
                  { id: "position", label: "Positions" },
                  { id: "page", label: "Pages" },
                ].map((tab) => {
                  const count = tab.id === "all" ? results.length : results.filter((r) => r.type === tab.id).length;
                  if (tab.id !== "all" && count === 0) return null;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "rounded-lg px-2 py-1 font-medium transition-colors shrink-0",
                        activeTab === tab.id
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
            <CommandList className="max-h-[60vh] overflow-y-auto p-2">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Searching everything...
                </div>
              )}

              {!loading && hasQuery && filteredResults.length === 0 && (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  No results found for &ldquo;{query}&rdquo;
                </CommandEmpty>
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
                        {"contentSnippet" in r && r.contentSnippet && (
                          <p className="line-clamp-1 text-xs text-muted-foreground/75 font-mono mt-0.5">{r.contentSnippet}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.company && (
                <CommandGroup heading="Companies">
                  {grouped.company.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`company-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      {TYPE_ICONS.company}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.contact && (
                <CommandGroup heading="Contacts">
                  {grouped.contact.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`contact-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      {TYPE_ICONS.contact}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                        {"contentSnippet" in r && r.contentSnippet && (
                          <p className="line-clamp-1 text-xs text-muted-foreground/75 font-mono mt-0.5">{r.contentSnippet}</p>
                        )}
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
                        {"contentSnippet" in r && r.contentSnippet && (
                          <p className="line-clamp-1 text-xs text-muted-foreground/75 font-mono mt-0.5">{r.contentSnippet}</p>
                        )}
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
                        {"contentSnippet" in r && r.contentSnippet && (
                          <p className="line-clamp-1 text-xs text-muted-foreground/75 font-mono mt-0.5">{r.contentSnippet}</p>
                        )}
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
                        {"contentSnippet" in r && r.contentSnippet && (
                          <p className="line-clamp-1 text-xs text-muted-foreground/75 font-mono mt-0.5">{r.contentSnippet}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.deadline && (
                <CommandGroup heading="Deadlines">
                  {grouped.deadline.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`deadline-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      {TYPE_ICONS.deadline}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {!loading && hasQuery && grouped.position && (
                <CommandGroup heading="Positions">
                  {grouped.position.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`pos-${r.id}`}
                      onItemSelect={() => {
                        window.location.href = r.href;
                        setSearchOpen(false);
                      }}
                    >
                      {TYPE_ICONS.position}
                      <div className="ml-2 min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Admin-only groups */}
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
            </CommandList>
          </Command>
        </div>,
        document.body
      )}
    </>
  );
}

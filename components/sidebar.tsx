"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import {
  LayoutDashboard,
  Briefcase,
  Bookmark,
  Calendar,
  FileText,
  Lightbulb,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Applications", href: "/applications", icon: Briefcase },
  { name: "Saved", href: "/saved", icon: Bookmark },
  { name: "Interviews", href: "/interviews", icon: Calendar },
  { name: "Documents", href: "/documents", icon: FileText },
];

const secondaryNavigation = [
  { name: "Insights", href: "/insights", icon: Lightbulb },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  avatarUrl?: string | null;
}

export function Sidebar({ user, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  const fullName = user.user_metadata?.full_name || "User";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <aside className="flex h-full w-56 flex-col rounded-4xl border border-border bg-card">
        <div className="border-b border-border/50 p-4">
          <div className="flex items-center gap-3">
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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-none truncate">
                {fullName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {user.email || "No email"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground/80 px-3 mb-2">
            Workspace
          </div>
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-4xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/35 text-foreground dark:bg-primary/10 dark:text-primary"
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
            Account
          </div>
          <div className="space-y-0.5">
            {secondaryNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-4xl px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/35 text-foreground dark:bg-primary/10 dark:text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border/50 p-3">
          <div className="mb-3">
            <div className="flex items-center justify-between px-3">
              <span className="text-xs font-medium text-muted-foreground">
                Theme
              </span>
              {mounted && (
                <div className="flex items-center gap-1 rounded-4xl border border-border p-1">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-4xl transition-colors",
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
                      "flex size-6 items-center justify-center rounded-4xl transition-colors",
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
                      "flex size-6 items-center justify-center rounded-4xl transition-colors",
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

          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setOpen(true);
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-4xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5">
            <h2 className="font-heading text-base font-medium text-card-foreground">
              Sign out
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Are you sure you want to sign out?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="inline-flex shrink-0 items-center justify-center rounded-4xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted"
              >
                Cancel
              </button>
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-all hover:bg-destructive/20"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

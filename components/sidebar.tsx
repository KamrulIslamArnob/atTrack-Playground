"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
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
  Plus,
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

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <Briefcase className="size-5 text-sidebar-primary" />
        <span className="font-heading text-lg font-medium">Aven</span>
      </div>

      <div className="px-3">
        <Link
          href="/applications/new"
          className="flex w-full items-center gap-2 rounded-4xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add Job
        </Link>
      </div>

      <nav className="mt-6 flex-1 space-y-0.5 px-3">
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/50 px-3 py-3">
        <nav className="space-y-0.5">
          {secondaryNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-4xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setOpen(true);
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-4xl px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </div>
        </nav>
      </div>

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
    </aside>
  );
}

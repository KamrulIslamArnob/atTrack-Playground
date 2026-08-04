"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Users, Activity, Cpu, ArrowLeft, BarChart3 } from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: BarChart3 },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Activity Log", href: "/admin/activity", icon: Activity },
  { name: "AI Usage", href: "/admin/ai-usage", icon: Cpu },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <div className="flex items-center gap-2 border-b px-6 py-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-3 py-4">
          <Link
            href="/overview"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Mobile admin nav */}
      <div className="flex flex-col flex-1 lg:hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">Admin</span>
          <Link href="/overview" className="ml-auto text-sm text-muted-foreground">
            ← Back
          </Link>
        </div>

        {/* Mobile nav tabs */}
        <div className="flex overflow-x-auto border-b px-4 py-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>

      {/* Desktop content */}
      <main className="hidden lg:flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

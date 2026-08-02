"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
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
        <Button variant="ghost" size="icon" className="size-9 rounded-4xl">
          <Search className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-9 rounded-4xl">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}

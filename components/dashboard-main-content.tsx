"use client";

import { usePathname } from "next/navigation";

export function DashboardMainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullBleed = pathname.startsWith("/preferences/database");

  if (isFullBleed) {
    return (
      <main className="flex-1 overflow-hidden h-full w-full flex flex-col min-w-0 min-h-0">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="px-6 py-8">{children}</div>
    </main>
  );
}

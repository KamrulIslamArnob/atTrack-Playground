"use client";

import { usePathname } from "next/navigation";

export function DashboardMainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullBleed =
    pathname.startsWith("/preferences/database") ||
    pathname.startsWith("/chatbot") ||
    pathname.startsWith("/ai-builder") ||
    pathname.startsWith("/jobs") ||
    pathname === "/";

  if (isFullBleed) {
    return (
      <main className="flex-1 overflow-y-auto overflow-x-hidden h-full w-full flex flex-col min-w-0 min-h-0">
        {children}
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      <div className="px-6 pt-6 pb-20 min-h-full">
        {children}
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { setShowRawDatabase } from "@/lib/actions/auth";

export function RawDatabaseToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await setShowRawDatabase(next);
        router.refresh();
      } catch {
        setEnabled(!next);
        toast.error("Couldn't update the setting");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="size-4" />
          Advanced
        </CardTitle>
        <CardDescription>Raw access to the database this app runs on.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show the raw database viewer</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adds a full table browser to the sidebar, with inline cell editing and no confirmation
              before a change is saved. It shows every table and column, including the ones the rest
              of atTrack keeps out of view. Built for engineers — if you&apos;re not comfortable reading a
              database schema, leave this off.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle raw database viewer"
            disabled={pending}
            onClick={handleToggle}
            className={cn(
              "mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
              enabled ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block size-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-out",
                enabled ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

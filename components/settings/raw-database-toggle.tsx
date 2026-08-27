"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/settings/startup-service-card";
import { toast } from "sonner";
import { setShowRawDatabase } from "@/lib/actions/auth";

/** Bare row for the General section. */
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
    <div className="flex items-center justify-between gap-4 py-3 px-1">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground">Raw database browser</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Direct SQLite table inspector with live inline editing
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={handleToggle}
        label="Toggle raw database browser"
      />
    </div>
  );
}

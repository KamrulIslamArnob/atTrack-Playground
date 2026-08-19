"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw, Users } from "lucide-react";
import { RotateCCWIcon } from "@/components/ui/rotate-ccw";
import { Button, buttonVariants } from "@/components/ui/button";

export default function NetworkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[NetworkError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive shadow-xs">
        <Users className="size-6" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Couldn&apos;t load Network</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          An error occurred while loading your contacts or companies. Your network data is safe in your local database.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
        <Button size="sm" onClick={() => reset()} className="gap-1.5 text-xs">
          <RotateCCWIcon className="size-3.5" />
          Try again
        </Button>
        <Link
          href="/overview"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "gap-1.5 text-xs",
          })}
        >
          <Home className="size-3.5" />
          Overview
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className="size-3.5" />
          Reload app
        </Button>
      </div>
    </div>
  );
}

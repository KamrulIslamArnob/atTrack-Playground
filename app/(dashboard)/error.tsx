"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold">Couldn&apos;t load this page</h2>
        <p className="text-sm text-muted-foreground">Something went wrong loading this part of atTrack.</p>
      </div>
      <Button onClick={() => reset()}>
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </div>
  );
}

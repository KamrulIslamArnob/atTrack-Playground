"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ArrowLeftIcon } from "@/components/ui/arrow-left";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { Button, buttonVariants } from "@/components/ui/button";

export default function RootError({
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
    <div className="auth-bg flex min-h-screen items-center justify-center px-4 selection:bg-primary/20">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2.5 opacity-90 transition-opacity hover:opacity-100">
          <ThemeLogo width={28} height={28} className="drop-shadow-sm" />
          <span className="font-heading text-xl font-semibold tracking-tight">BetterJob</span>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="relative flex size-24 items-center justify-center rounded-full border border-border/50 bg-background/50 shadow-sm ring-1 ring-border/20 backdrop-blur-sm">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-muted/40 to-transparent" />
            <AlertTriangle className="relative size-10 text-destructive" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="mt-8 font-heading text-2xl font-semibold tracking-tight">
          Couldn&apos;t load this page
        </h1>
        <p className="mt-4 text-base text-muted-foreground/90">
          Something went wrong. Try again, or head back to the dashboard.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Button size="lg" className="h-11 rounded-full px-6" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/overview"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 rounded-full px-6",
            })}
          >
            <ArrowLeftIcon size={16} className="mr-2 size-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

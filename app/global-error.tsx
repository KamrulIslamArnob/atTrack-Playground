"use client";

import { useEffect } from "react";
import "./globals.css";

// Outermost catch-all error boundary. Renders its own <html>/<body> because it
// replaces the entire root layout (including Providers) when it fires, so it
// must not depend on anything that layout normally sets up.
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground antialiased">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/10 font-heading font-semibold text-destructive">
            !
          </div>
          <h1 className="mt-6 font-heading text-xl font-semibold tracking-tight">
            Couldn&apos;t load BetterJob
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Something went wrong. Try again, or restart the app.
          </p>
          <button
            onClick={() => reset()}
            className="mt-8 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NoApiKeyOverlayProps {
  message?: string;
  className?: string;
}

export function NoApiKeyOverlay({
  message = "Please connect your first API key from settings to enable the chatbot feature.",
  className,
}: NoApiKeyOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-background/40 p-4 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl shadow-black/20 backdrop-blur-md">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="size-6" />
        </div>
        <p className="text-sm text-foreground">{message}</p>
        <Link href="/settings" className={cn(buttonVariants(), "mt-1")}>
          Go to settings
        </Link>
      </div>
    </div>
  );
}

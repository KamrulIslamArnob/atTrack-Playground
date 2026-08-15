import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { MapPinOff, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-4 selection:bg-primary/20">
      <div className="w-full max-w-md text-center">
        {/* Brand Logo */}
          <div className="flex items-center justify-center gap-2.5 opacity-90 transition-opacity hover:opacity-100">
          <ThemeLogo width={28} height={28} className="drop-shadow-sm" />
          <span className="font-heading text-xl font-semibold tracking-tight">atTrack</span>
        </div>

        {/* Premium Icon Container */}
        <div className="mt-10 flex justify-center">
          <div className="relative flex size-24 items-center justify-center rounded-full border border-border/50 bg-background/50 shadow-sm ring-1 ring-border/20 backdrop-blur-sm">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-muted/40 to-transparent" />
            <MapPinOff 
              className="relative size-10 text-muted-foreground/80" 
              strokeWidth={1.5} 
            />
          </div>
        </div>

        {/* Typography */}
        <h1 className="mt-8 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-heading text-8xl font-black tracking-tighter text-transparent">
          404
        </h1>
        <p className="mt-4 text-base text-muted-foreground/90">
          This page doesn&apos;t exist. It may have been moved or never existed.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/overview"
            className={buttonVariants({ 
              size: "default", 
              className: "h-11 rounded-full px-6 shadow-sm transition-all hover:shadow-md active:scale-[0.98]" 
            })}
          >
            <ArrowLeft className="mr-2 size-4" strokeWidth={2} />
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
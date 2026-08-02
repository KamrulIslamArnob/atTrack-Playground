import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { MapPinOff, ArrowLeft, LogIn } from "lucide-react";

export default function NotFound() {
  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-4 selection:bg-primary/20">
      <div className="w-full max-w-md text-center">
        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-2.5 opacity-90 transition-opacity hover:opacity-100">
          <Image
            src="/logo.png"
            alt="Aven"
            width={28}
            height={28}
            priority
            className="drop-shadow-sm"
          />
          <span className="font-heading text-xl font-semibold tracking-tight">Aven</span>
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
          The page you are looking for doesn't exist or has been moved.
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
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border/60 bg-background/50 px-6 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-all hover:border-border hover:bg-muted active:scale-[0.98]"
          >
            Sign in
            <LogIn className="ml-2 size-4 text-muted-foreground" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
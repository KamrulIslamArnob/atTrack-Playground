import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { MapPinOff, ArrowLeft, LogIn } from "lucide-react";

export default function NotFound() {
  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/logo.png"
            alt="Aven"
            width={28}
            height={28}
            priority
          />
          <span className="font-heading text-xl font-semibold">Aven</span>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-muted">
            <MapPinOff className="size-10 text-muted-foreground/60" />
          </div>
        </div>

        <h1 className="mt-8 font-heading text-8xl font-bold tracking-tight text-foreground">
          404
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page could not be found.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/overview"
            className={buttonVariants({ size: "sm", className: "h-10 px-5" })}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-4xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
          >
            Sign in
            <LogIn className="ml-1.5 size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

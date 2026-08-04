"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 mx-auto mt-4 px-4 transition-all duration-300",
      scrolled ? "max-w-7xl" : "max-w-360"
    )}>
      <header
        className={cn(
          "grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 transition-all duration-300 will-change-[transform,opacity]",
          scrolled
            ? "rounded-4xl border border-white/10 dark:border-white/8 bg-white/60 dark:bg-white/6 shadow-lg shadow-black/5 backdrop-blur-md"
            : "rounded-none border-transparent bg-transparent"
        )}
      >
        <Link href="/" className="flex items-center gap-2.5 justify-self-start">
          <Image
            src="/logo.png"
            alt="Aven"
            width={24}
            height={24}
            priority
          />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Aven
          </span>
        </Link>
        <nav className="hidden items-center justify-self-center gap-1 text-sm text-muted-foreground md:flex">
          <a href="#features" className="rounded-4xl px-3 py-1.5 transition-colors hover:text-foreground">Features</a>
          <a href="#how-it-works" className="rounded-4xl px-3 py-1.5 transition-colors hover:text-foreground">How it works</a>
          <a href="#ai" className="rounded-4xl px-3 py-1.5 transition-colors hover:text-foreground">AI</a>
          <a href="#testimonials" className="rounded-4xl px-3 py-1.5 transition-colors hover:text-foreground">Testimonials</a>
          <a href="#faq" className="rounded-4xl px-3 py-1.5 transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center justify-self-end gap-3">
          {mounted && (
            <div className="flex items-center gap-0.5 rounded-4xl border border-border/50 bg-card/50 p-0.5">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-4xl transition-colors",
                  theme === "light"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sun className="size-3.5" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-4xl transition-colors",
                  theme === "dark"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Moon className="size-3.5" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-4xl transition-colors",
                  theme === "system"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Monitor className="size-3.5" />
              </button>
            </div>
          )}
          <Link
            href="/login"
            className="rounded-4xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-4xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Get started
          </Link>
        </div>
      </header>
    </div>
  );
}

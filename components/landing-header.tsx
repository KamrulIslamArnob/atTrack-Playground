"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#ai", label: "AI" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#faq", label: "FAQ" },
];

interface LandingHeaderProps {
  isAuthenticated?: boolean;
}

export function LandingHeader({ isAuthenticated = false }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = navItems.map((item) => item.href.slice(1));
    const onScroll = () => {
      const scrollY = window.scrollY + 120;
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) {
          current = `#${id}`;
        }
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [menuOpen]);

  return (
    <>
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 mx-auto mt-4 px-4 transition-all duration-300",
        scrolled ? "max-w-7xl" : "max-w-360"
      )}>
        <header
          className={cn(
            "flex h-14 items-center justify-between px-4 transition-all duration-300 will-change-[transform,opacity] md:grid md:grid-cols-[1fr_auto_1fr]",
            scrolled
              ? "rounded-4xl border border-white/10 bg-linear-to-r from-white/75 via-white/55 to-primary/10 shadow-lg shadow-black/5 backdrop-blur-md dark:border-white/8 dark:from-white/10 dark:via-white/6 dark:to-primary/20"
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
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-4xl px-3.5 py-1.5 transition-colors",
                  activeSection === item.href
                    ? "text-primary"
                    : "hover:text-foreground"
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-self-end gap-3">
            {mounted && (
              <div className="hidden items-center gap-0.5 rounded-4xl border border-border/50 bg-card/50 p-0.5 md:flex">
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
              </div>
            )}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated ? (
                <Link
                  href="/overview"
                  className="rounded-4xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  Dashboard
                </Link>
              ) : (
                <>
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
                </>
              )}
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex size-8 items-center justify-center rounded-4xl border border-border/50 bg-card/50 text-foreground transition-colors hover:bg-muted md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </button>
          </div>
        </header>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          menuOpen ? "" : "pointer-events-none"
        )}
        aria-hidden={!menuOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
            menuOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 right-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              onClick={() => setMenuOpen(false)}
            >
              <Image src="/logo.png" alt="Aven" width={24} height={24} />
              <span className="font-heading text-lg font-semibold tracking-tight">
                Aven
              </span>
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex size-8 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X className="size-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-4xl px-4 py-2.5 text-sm font-medium transition-colors",
                  activeSection === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="space-y-3 border-t border-border/60 px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Theme</span>
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
                </div>
              )}
            </div>
            {isAuthenticated ? (
              <Link
                href="/overview"
                onClick={() => setMenuOpen(false)}
                className="flex h-11 items-center justify-center rounded-4xl bg-primary text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center justify-center rounded-4xl border border-border bg-card text-sm font-medium transition-colors hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center justify-center rounded-4xl bg-primary text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

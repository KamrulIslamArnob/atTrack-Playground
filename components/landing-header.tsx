"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { motion, AnimatePresence } from "motion/react";
import { Sun } from "lucide-react";
import { MoonIcon } from "@/components/ui/moon";
import { MenuIcon } from "@/components/ui/menu";
import { XIcon } from "@/components/ui/x";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#ai", label: "AI" },
  { href: "#testimonials", label: "Stories" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
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
              ? "rounded-2xl border border-white/10 bg-linear-to-r from-white/75 via-white/55 to-primary/10 shadow-lg shadow-black/5 backdrop-blur-md dark:border-white/8 dark:from-white/10 dark:via-white/6 dark:to-primary/20"
              : "rounded-none border-transparent bg-transparent"
          )}
        >
          <Link href="/" className="flex items-center gap-2.5 justify-self-start">
            <ThemeLogo width={24} height={24} />
            <span className="font-heading text-lg font-semibold tracking-tight">
              atTrack
            </span>
          </Link>
          <nav className="hidden items-center justify-self-center gap-1 text-sm text-muted-foreground md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-2xl px-3.5 py-1.5 transition-colors",
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
              <div className="hidden items-center gap-0.5 rounded-2xl border border-border/50 bg-card/50 p-0.5 md:flex">
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-2xl transition-colors",
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
                    "flex size-7 items-center justify-center rounded-2xl transition-colors",
                    theme === "dark"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MoonIcon className="size-3.5" />
                </button>
              </div>
            )}
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/overview"
                className="rounded-2xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Open atTrack
              </Link>
            </div>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex size-8 items-center justify-center rounded-2xl border border-border/50 bg-card/50 text-foreground transition-colors hover:bg-muted md:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="size-4" />
            </button>
          </div>
        </header>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            aria-hidden={!menuOpen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="absolute top-0 right-0 flex h-full w-72 max-w-[85vw] flex-col border-l border-border bg-background shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-2.5"
              onClick={() => setMenuOpen(false)}
            >
              <ThemeLogo width={24} height={24} />
              <span className="font-heading text-lg font-semibold tracking-tight">
                atTrack
              </span>
            </Link>
            <button
              onClick={() => setMenuOpen(false)}
              className="flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors",
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
                <div className="flex items-center gap-0.5 rounded-2xl border border-border/50 bg-card/50 p-0.5">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-2xl transition-colors",
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
                      "flex size-7 items-center justify-center rounded-2xl transition-colors",
                      theme === "dark"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MoonIcon className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            <Link
              href="/overview"
              onClick={() => setMenuOpen(false)}
              className="flex h-11 items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              Open atTrack
            </Link>
          </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

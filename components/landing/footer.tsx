"use client";

import Link from "next/link";
import { Reveal } from "@/components/landing/motion";
import { ThemeLogo } from "@/components/ui/theme-logo";

const productLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "AI", href: "/#ai" },
  { label: "FAQ", href: "/#faq" },
];

const resourceLinks = [
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-foreground text-background dark:border-foreground/10 dark:bg-card dark:text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-12">
            <div className="sm:col-span-2 lg:col-span-4">
              <Link href="/" className="inline-flex items-center gap-2.5">
                <ThemeLogo width={18} height={18} />
                <span className="font-heading text-lg font-semibold">
                  atTrack
                </span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-background/70 dark:text-foreground/70">
                A private workspace for your job search — save jobs, track
                applications, practice interviews, and see how you&apos;re doing.
                All on your own machine.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-medium text-background/70 dark:border-foreground/20 dark:bg-foreground/10 dark:text-foreground/70">
                  Free, forever
                </span>
                <span className="rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-medium text-background/70 dark:border-foreground/20 dark:bg-foreground/10 dark:text-foreground/70">
                  Runs on your machine
                </span>
                <span className="rounded-full border border-background/20 bg-background/10 px-3 py-1 text-xs font-medium text-background/70 dark:border-foreground/20 dark:bg-foreground/10 dark:text-foreground/70">
                  No sign-up
                </span>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h4 className="text-sm font-semibold">Product</h4>
              <ul className="mt-4 space-y-3">
                {productLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-background/70 transition-colors hover:text-background dark:text-foreground/70 dark:hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h4 className="text-sm font-semibold">Resources</h4>
              <ul className="mt-4 space-y-3">
                {resourceLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-background/70 transition-colors hover:text-background dark:text-foreground/70 dark:hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <div className="rounded-2xl border border-background/15 bg-background/10 p-6 dark:border-foreground/15 dark:bg-foreground/10">
                <h4 className="text-base font-semibold">
                  Start using atTrack
                </h4>
                <p className="mt-1.5 text-sm text-background/70 dark:text-foreground/70">
                  It runs on this machine. No account, no cloud, no setup.
                </p>
                <div className="mt-5 flex gap-3">
                  <Link
                    href="/overview"
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                  >
                    Open atTrack
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-background/15 pt-8 sm:flex-row dark:border-foreground/15">
          <p className="text-xs text-background/50 dark:text-foreground/50">
            &copy; {new Date().getFullYear()} atTrack. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-background/50 dark:text-foreground/50">
            <Link
              href="/privacy-policy"
              className="transition-colors hover:text-background dark:hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-background dark:hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import Image from "next/image";

const productLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "AI", href: "/#ai" },
  { label: "FAQ", href: "/#faq" },
];

const resourceLinks = [
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Privacy", href: "/#privacy" },
  { label: "Sign in", href: "/login" },
  { label: "Get started", href: "/signup" },
];

export function Footer() {
  return (
    <footer className="relative bg-background">
      <div className="mx-auto h-px max-w-6xl bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.png" alt="Aven" width={24} height={24} />
              <span className="font-heading text-lg font-semibold">Aven</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI-powered workspace that carries your job search from first
              sight to signed offer — jobs, applications, interviews, and
              practice in one private place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                Free forever
              </span>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                Private by design
              </span>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                No credit card
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
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-4xl border border-border bg-gradient-to-br from-primary/[0.05] via-card to-card p-6">
              <h4 className="text-base font-semibold">
                Start tracking your job search
              </h4>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create your free account in under a minute. No credit card
                required.
              </p>
              <div className="mt-5 flex gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center gap-2 rounded-4xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center rounded-4xl border border-border bg-card px-5 text-sm font-medium transition-all hover:bg-muted"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Aven. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link
              href="/#privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/#faq"
              className="transition-colors hover:text-foreground"
            >
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

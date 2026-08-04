import Link from "next/link";
import { Sparkles, ArrowRight, Check } from "lucide-react";

export function Cta() {
  return (
    <section id="cta" className="relative scroll-mt-24 overflow-hidden px-6 py-40">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-4xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card px-6 py-20 text-center sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[28px_28px] opacity-40" />
          <div className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/[0.12] blur-3xl" />
          <div className="absolute -right-24 -bottom-24 size-80 rounded-full bg-primary/[0.08] blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-4xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              Start in under a minute
            </div>
            <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Ready to organize
              <br />
              <span className="text-primary">your job search?</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              Join thousands of job seekers who track their applications,
              ace their interviews, and land better offers.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-4xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
              >
                Get started for free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-4xl border border-border bg-card px-8 text-sm font-medium transition-all hover:bg-muted sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                  <Check className="size-3 text-primary" />
                </span>
                Free forever
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                  <Check className="size-3 text-primary" />
                </span>
                No credit card
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

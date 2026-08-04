import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export function Cta() {
  return (
    <section id="cta" className="relative scroll-mt-24 overflow-hidden px-6 py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />
      <div className="absolute -left-48 top-0 size-96 rounded-full bg-primary/[0.08] blur-3xl" />
      <div className="absolute -right-48 bottom-0 size-96 rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Ready to organize
          <br />
          your job search?
        </h2>
        <p className="mx-auto mt-6 max-w-md text-muted-foreground">
          Join thousands of job seekers who track their applications,
          ace their interviews, and land better offers.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center gap-2 rounded-4xl bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            Get started for free
            <ArrowRight className="size-4" />
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" />
              Free forever
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" />
              No credit card
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

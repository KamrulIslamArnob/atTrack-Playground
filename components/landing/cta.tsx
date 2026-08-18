"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { CheckIcon } from "@/components/ui/check";
import { Reveal } from "@/components/landing/motion";

export function Cta() {
  return (
    <section
      id="cta"
      className="relative scroll-mt-24 overflow-hidden px-6 py-40"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card px-6 py-20 text-center sm:py-24">
            <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[28px_28px] opacity-40" />
            <motion.div
              className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/[0.12] blur-3xl"
              animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute -right-24 -bottom-24 size-80 rounded-full bg-primary/[0.08] blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
            />

            <div className="relative mx-auto max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3" />
                No sign-up required
              </div>
              <h2 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Stop losing track of
                <br />
                <span className="text-primary">where you applied.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground sm:text-base">
                Open atTrack, save your first job, and see what a job search
                looks like when it&apos;s all in one place.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/overview"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
                >
                  Open atTrack
                  <ArrowRightIcon className="size-4" />
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                    <CheckIcon className="size-3 text-primary" />
                  </span>
                  Free, forever
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/15">
                    <CheckIcon className="size-3 text-primary" />
                  </span>
                  No sign-up
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

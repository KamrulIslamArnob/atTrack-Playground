"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import ShinyText from "@/components/ShinyText";
import { Avatar, AvatarImage, AvatarGroup } from "@/components/ui/avatar";
import {
  fadeUp,
  scaleIn,
  staggerContainer,
} from "@/components/landing/motion";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background px-6 pt-36 pb-24 sm:pt-45 sm:pb-32">
      <div className="absolute inset-0 -top-18 bg-linear-to-b from-primary/3 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[32px_32px] opacity-40" />
      <motion.div
        className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/[0.07] blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/5 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <motion.div
        className="relative mx-auto max-w-4xl text-center"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={fadeUp}
          className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-primary"
        >
          <Sparkles className="size-3.5 shimmer-icon" />
          <ShinyText
            text="Your job search, finally in one place"
            speed={3}
            color="hsl(240 3.8% 46.1%)"
            shineColor="var(--primary)"
          />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-display text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl"
        >
          <span className="inline-block bg-primary/15 px-3 -skew-x-6 text-primary">
            Every application.
          </span>
          <span className="text-foreground"> One board.</span>
          <br />
          <span className="text-foreground">No more </span>
          <span className="inline-block bg-primary/15 px-3 -skew-x-6 text-primary">
            spreadsheets.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          You&apos;re tracking applications in a spreadsheet, a notes app, your
          browser history, and your email inbox — all at once. atTrack puts it
          all in one place: every job, every interview, every follow-up. Private,
          local, and yours.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/overview"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
          >
            Open atTrack
            <ArrowRightIcon className="size-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <AvatarGroup>
            <Avatar>
              <AvatarImage
                src="/user-avatars/alex-suprun-mynsNaNwVDc-unsplash.jpg"
                alt="User"
              />
            </Avatar>
            <Avatar>
              <AvatarImage
                src="/user-avatars/diego-hernandez-MSepzbKFz10-unsplash.jpg"
                alt="User"
              />
            </Avatar>
            <Avatar>
              <AvatarImage
                src="/user-avatars/ihssan-rami-azouagh-gKzxWyJmKLQ-unsplash.jpg"
                alt="User"
              />
            </Avatar>
            <Avatar>
              <AvatarImage
                src="/user-avatars/jake-nackos-IF9TK5Uy-KI-unsplash.jpg"
                alt="User"
              />
            </Avatar>
            <Avatar>
              <AvatarImage
                src="/user-avatars/alex-suprun-ZHvM3XIOHoE-unsplash.jpg"
                alt="User"
              />
            </Avatar>
          </AvatarGroup>
          <p className="text-xs text-muted-foreground">
            Built for job seekers who want their data to stay theirs
          </p>
        </motion.div>

        <motion.div
          variants={scaleIn}
          className="mt-16 rounded-2xl border border-border/60 bg-card p-2 shadow-2xl shadow-primary/5"
        >
          <div className="overflow-hidden rounded-3xl border border-border/50">
            <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-red-400/60" />
                <div className="size-2.5 rounded-full bg-amber-400/60" />
                <div className="size-2.5 rounded-full bg-emerald-400/60" />
              </div>
              <div className="flex-1 text-center text-[11px] text-muted-foreground">
                app.attrack.dev/overview
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3 bg-background p-4">
              <div className="col-span-1 space-y-2">
                <div className="h-8 rounded-3xl bg-muted/50" />
                <div className="h-8 rounded-3xl bg-primary/15" />
                <div className="h-8 rounded-3xl bg-muted/30" />
                <div className="h-8 rounded-3xl bg-muted/30" />
                <div className="h-8 rounded-3xl bg-muted/30" />
              </div>
              <div className="col-span-5 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5" />
                  <div className="h-16 rounded-3xl bg-gradient-to-br from-violet-500/10 to-violet-500/5" />
                  <div className="h-16 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3 h-32 rounded-3xl bg-gradient-to-br from-primary/5 via-muted/20 to-muted/10" />
                  <div className="h-32 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/5" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 rounded-3xl bg-gradient-to-br from-blue-500/8 to-blue-500/3" />
                  <div className="h-20 rounded-3xl bg-gradient-to-br from-rose-500/8 to-rose-500/3" />
                  <div className="h-20 rounded-3xl bg-gradient-to-br from-emerald-500/8 to-emerald-500/3" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

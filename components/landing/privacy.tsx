"use client";

import { motion } from "motion/react";
import {
  ShieldCheck,
  Database,
  Lock,
  Mail,
  Check,
  EyeOff,
} from "lucide-react";
import {
  staggerContainer,
  staggerItem,
  Reveal,
} from "@/components/landing/motion";

export function Privacy() {
  return (
    <section
      id="privacy"
      className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-primary/[0.04] to-background px-6 py-36"
    >
      <div className="absolute -left-40 top-24 size-96 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="absolute -right-40 bottom-24 size-96 rounded-full bg-emerald-500/[0.05] blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal className="text-center">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="size-3" />
            Privacy
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Your job search isn&apos;t anyone else&apos;s business
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            atTrack runs on your machine. Your data never leaves it.
          </p>
        </Reveal>

        <motion.div
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px", amount: 0.1 }}
        >
          <motion.article
            variants={staggerItem}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 sm:col-span-2"
          >
            <div className="absolute -top-24 -right-24 size-64 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-70" />
            <div className="relative flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10">
                <ShieldCheck className="size-5 text-emerald-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-600">
                <EyeOff className="size-3" />
                Visible only to you
              </span>
            </div>
            <h3 className="relative mt-5 font-heading text-lg font-semibold">
              Not a job board
            </h3>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              atTrack is a personal workspace. Your jobs, applications, resumes,
              and interview notes live on your machine — not on a server, not in
              a database someone else controls.
            </p>

            <div className="relative mt-6 flex-1 space-y-2">
              {["Job applications", "Interview notes", "Resumes", "Match scores"].map(
                (row, i) => (
                  <div
                    key={row}
                    className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium">{row}</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      <Lock className="size-3" />
                      {i === 0 ? "Locked" : "Private"}
                    </span>
                  </div>
                )
              )}
            </div>
          </motion.article>

          <motion.article
            variants={staggerItem}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:border-primary/30"
          >
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex size-11 items-center justify-center rounded-2xl bg-primary/10">
              <Database className="size-5 text-primary" />
            </div>
            <h3 className="relative mt-5 font-heading text-base font-semibold">
              Your data stays on your machine
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              There is no cloud sync, no server, no account system. Your database
              file lives on your computer, and that&apos;s the only place it exists.
            </p>
          </motion.article>

          <motion.article
            variants={staggerItem}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:border-pink-500/30"
          >
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-pink-500/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex size-11 items-center justify-center rounded-2xl bg-pink-500/10">
              <Lock className="size-5 text-pink-500" />
            </div>
            <h3 className="relative mt-5 font-heading text-base font-semibold">
              Encrypted email credentials
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              If you connect an email account to send applications, your password
              is encrypted and only decrypted when it&apos;s time to send.
            </p>
          </motion.article>

          <motion.article
            variants={staggerItem}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 sm:col-span-2"
          >
            <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-violet-500/10 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-500/10">
                <Mail className="size-5 text-violet-500" />
              </div>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                Gmail
              </span>
            </div>
            <h3 className="relative mt-5 font-heading text-lg font-semibold">
              You send from your own email
            </h3>
            <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Application emails come from your Gmail, Outlook, or whatever you
              set up. atTrack doesn&apos;t have its own email address — it uses yours.
            </p>

            <div className="relative mt-6 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex size-6 items-center justify-center rounded-full bg-violet-500/10">
                  <ShieldCheck className="size-3.5 text-violet-500" />
                </div>
                <span className="text-xs font-medium">Your SMTP</span>
              </div>
              <span className="text-muted-foreground/40">&rarr;</span>
              <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2.5">
                <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-3.5 text-emerald-500" />
                </div>
                <span className="text-xs font-medium">Recruiter</span>
              </div>
            </div>
          </motion.article>
        </motion.div>

        <Reveal
          className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-border/60 bg-card/60 px-6 py-5"
        >
          {["No ads", "No data selling", "No tracking"].map(
            (item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-4 text-emerald-500" />
                {item}
              </span>
            )
          )}
        </Reveal>
      </div>
    </section>
  );
}

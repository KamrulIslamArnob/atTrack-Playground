"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import {
  Camera,
  Send,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  staggerContainer,
  staggerItem,
  Reveal,
} from "@/components/landing/motion";

const steps = [
  {
    step: "01",
    title: "Discover",
    description:
      "Paste a screenshot of a job posting — or several — and AI extracts every detail: title, company, salary, requirements, and how to apply. Saved to your pipeline in seconds.",
    icon: Camera,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    step: "02",
    title: "Apply",
    description:
      "AI writes a personalized application email tailored to the role and your resume. Edit, preview, attach your resume, and send it straight from Aven.",
    icon: Send,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    step: "03",
    title: "Interview",
    description:
      "Track interviews with dates, prep notes, and types. Add them to Google Calendar in one click and practice with role-specific MCQs.",
    icon: Calendar,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    step: "04",
    title: "Accept",
    description:
      "Log applications and interviews as you go. Aven tracks each one from submitted to offer — so when the right offer lands, you're ready to accept.",
    icon: CheckCircle2,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

const pipeline = ["Saved", "Interested", "Preparing"];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-gradient-to-b from-primary/[0.03] to-background px-6 py-40"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            From first sight to signed offer
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Four stages. One workspace. Aven carries your application from the
            moment you spot the role to the day you accept the offer.
          </p>
        </Reveal>

        <div className="relative mt-16">
          <motion.div
            className="absolute top-7 right-0 left-0 hidden h-px bg-linear-to-r from-transparent via-primary/40 to-transparent shadow-[0_0_8px_0] shadow-primary/20 lg:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          />
          <motion.div
            className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px", amount: 0.15 }}
          >
            {steps.map((item) => (
              <motion.div
                key={item.step}
                variants={staggerItem}
                className="relative text-center lg:px-4"
              >
                <div className="relative mx-auto w-fit rounded-4xl bg-background p-1">
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-4xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]",
                      item.bg
                    )}
                  >
                    <item.icon className={cn("size-6", item.color)} />
                  </div>
                </div>
                <div className="mt-6 font-heading text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase">
                  Step {item.step}
                </div>
                <h3 className="mt-1.5 font-heading text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <Reveal className="mt-20 rounded-4xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {pipeline.map((stage, i) => (
              <Fragment key={stage}>
                <span className="rounded-4xl border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                  {stage}
                </span>
                {i < pipeline.length - 1 && (
                  <ArrowRight className="size-3.5 text-muted-foreground/40" />
                )}
              </Fragment>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Jobs start in your pipeline as Saved, Interested, or Preparing —
            then move to applications, interviews, and offers as you log them.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

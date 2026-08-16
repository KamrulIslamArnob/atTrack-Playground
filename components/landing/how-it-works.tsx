"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import {
  Camera, Calendar, CheckCircle2 } from "lucide-react";
import { SendIcon } from "@/components/ui/send";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { cn } from "@/lib/utils";
import {
  staggerContainer,
  staggerItem,
  Reveal,
} from "@/components/landing/motion";

const steps = [
  {
    step: "01",
    title: "Find a job",
    description:
      "Screenshot a posting or paste a link. atTrack pulls out the title, company, salary, and requirements — so you don&apos;t have to copy them by hand.",
    icon: Camera,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    step: "02",
    title: "Apply to it",
    description:
      "atTrack drafts an application email using your resume and the job details. You edit it, attach your resume, and send it from your own email address.",
    icon: SendIcon,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    step: "03",
    title: "Interview",
    description:
      "When you get a call, log the interview. Add prep notes, sync it to your calendar, and run a practice test tailored to the role.",
    icon: Calendar,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    step: "04",
    title: "Get the offer",
    description:
      "Move each job through your board as it progresses. When an offer comes in, you&apos;ll know exactly how you got there — and what worked.",
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
            A job search has a beginning and an end
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            You find a job, you apply, you interview, you get an offer. atTrack
            walks through each step with you — nothing more, nothing less.
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
                <div className="relative mx-auto w-fit rounded-2xl bg-background p-1">
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]",
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

        <Reveal className="mt-20 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {pipeline.map((stage, i) => (
              <Fragment key={stage}>
                <span className="rounded-2xl border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                  {stage}
                </span>
                {i < pipeline.length - 1 && (
                  <ArrowRightIcon className="size-3.5 text-muted-foreground/40" />
                )}
              </Fragment>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            A job enters your board when you save it. It moves forward as you apply,
            interview, and — if things go well — get an offer.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

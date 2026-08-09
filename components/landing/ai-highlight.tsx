"use client";

import { motion } from "motion/react";
import {
  Camera,
  Send,
  Target,
  Sparkles,
  ImagePlus,
  WandSparkles,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  slideInLeft,
  slideInRight,
  staggerContainer,
  staggerItem,
} from "@/components/landing/motion";

const capabilities = [
  {
    icon: Camera,
    title: "Screenshot import",
    description:
      "Screenshot a job posting and AtTrack reads it — title, salary, requirements, all filled in.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
  {
    icon: Send,
    title: "Application drafts",
    description:
      "AtTrack writes a first draft of your application email using the job details and your resume.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: Target,
    title: "Resume scoring",
    description: "See how your resume stacks up against each job before you apply.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: Sparkles,
    title: "Practice tests",
    description:
      "Generate interview questions for a specific role, take the test, and see where to improve.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
];

const fields = [
  { label: "Title", value: "Senior Flutter Developer" },
  { label: "Company", value: "XpertLab" },
  { label: "Salary", value: "$80k — $120k" },
  { label: "Location", value: "Remote" },
];

export function AiHighlight() {
  return (
    <section
      id="ai"
      className="relative scroll-mt-24 overflow-hidden px-6 py-40"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-background to-background" />
      <div className="absolute -left-40 top-16 size-96 rounded-full bg-pink-500/[0.06] blur-3xl" />
      <div className="absolute -right-40 bottom-16 size-96 rounded-full bg-violet-500/[0.06] blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 sm:gap-16 lg:grid-cols-2">
          <motion.div
            variants={slideInLeft}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px", amount: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              AI that does the boring parts
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              You shouldn&apos;t have to copy-paste
              <br />
              <span className="text-primary">job details by hand.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              AtTrack uses AI to read job postings, draft application emails, score
              your resume, and generate practice questions. You review, edit, and
              send — it handles the repetitive stuff.
            </p>

            <motion.ul
              className="mt-8 space-y-4"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px", amount: 0.2 }}
            >
              {capabilities.map((item) => (
                <motion.li
                  key={item.title}
                  variants={staggerItem}
                  className="flex items-start gap-3.5"
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-3xl",
                      item.bg
                    )}
                  >
                    <item.icon className={cn("size-5", item.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            variants={slideInRight}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px", amount: 0.2 }}
            className="rounded-2xl border border-border/60 bg-card p-2 shadow-2xl shadow-primary/10"
          >
            <div className="flex items-center gap-2 rounded-3xl border border-border/50 bg-muted/30 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-400/60" />
                <span className="size-2.5 rounded-full bg-amber-400/60" />
                <span className="size-2.5 rounded-full bg-emerald-400/60" />
              </div>
              <div className="flex-1 text-center text-[11px] text-muted-foreground">
                ai.attrack.dev/capture
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center gap-3 rounded-3xl border border-border/60 bg-background p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10">
                  <ImagePlus className="size-5 text-pink-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Screenshot uploaded</p>
                  <p className="truncate text-xs text-muted-foreground">
                    job_posting.png · 3 images
                  </p>
                </div>
                <Check className="size-4 shrink-0 text-emerald-500" />
              </div>

              <div className="mx-auto h-4 w-px bg-linear-to-b from-border to-transparent" />

              <div className="flex items-center gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  <WandSparkles className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Reading the posting…</p>
                  <p className="text-xs text-muted-foreground">
                    Extracting title, salary, requirements…
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
                  95% confidence
                </span>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background p-4">
                <div className="grid grid-cols-2 gap-3">
                  {fields.map((field) => (
                    <div key={field.label}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        {field.label}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Your resume vs. this job
                  </span>
                  <span className="text-sm font-semibold text-emerald-600">
                    87%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "motion/react";
import {
  Camera,
  Send,
  Target,
  Calendar,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  staggerContainer,
  staggerItem,
  Reveal,
} from "@/components/landing/motion";

const features = [
  {
    icon: Camera,
    title: "AI Screenshot Import",
    description:
      "Paste a job posting screenshot and AI extracts title, company, salary, requirements — everything structured in seconds.",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    border: "hover:border-pink-500/30",
    accent: "from-pink-500/[0.07]",
  },
  {
    icon: Send,
    title: "AI Email Composer",
    description:
      "Generate personalized application emails with AI that understands your resume and the role. Send directly via SMTP.",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "hover:border-violet-500/30",
    accent: "from-violet-500/[0.07]",
  },
  {
    icon: Target,
    title: "Resume Matching",
    description:
      "AI scores how well your resume matches each job. Know your chances before you even apply.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "hover:border-amber-500/30",
    accent: "from-amber-500/[0.07]",
  },
  {
    icon: Calendar,
    title: "Interview Tracker",
    description:
      "Schedule, prep, and follow up on interviews. Add to Google Calendar in one click. Never miss a call.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "hover:border-emerald-500/30",
    accent: "from-emerald-500/[0.07]",
  },
  {
    icon: Sparkles,
    title: "MCQ Practice Tests",
    description:
      "Generate role-specific multiple choice questions. Track your scores and identify weak areas to study.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "hover:border-blue-500/30",
    accent: "from-blue-500/[0.07]",
  },
  {
    icon: BarChart3,
    title: "Smart Insights",
    description:
      "Visualize your pipeline, response rates, time-to-interview, and application trends. Know where you stand.",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "hover:border-rose-500/30",
    accent: "from-rose-500/[0.07]",
  },
];

const extractedFields = [
  { label: "Title", value: "Senior Software Engineer" },
  { label: "Company", value: "Aven" },
  { label: "Salary", value: "80k — 120k BDT" },
  { label: "Location", value: "Dhaka, Bangladesh" },
];

export function Features() {
  const [featured, ...rest] = features;

  return (
    <section id="features" className="scroll-mt-24 px-6 py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to land the job
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            A complete toolkit designed to streamline every step of your job
            search — from saving your first listing to accepting an offer.
          </p>
        </Reveal>

        <motion.div
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px", amount: 0.1 }}
        >
          <motion.article
            variants={staggerItem}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 sm:col-span-2 lg:row-span-2",
              featured.border
            )}
          >
            <div
              className={cn(
                "absolute -top-24 -right-24 size-64 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-70",
                featured.bg
              )}
            />
            <div className="relative flex items-start justify-between">
              <div
                className={cn(
                  "flex size-12 items-center justify-center rounded-4xl",
                  featured.bg
                )}
              >
                <featured.icon className={cn("size-6", featured.color)} />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-600">
                <Sparkles className="size-3" />
                AI-powered
              </span>
            </div>
            <h3 className="relative mt-5 font-heading text-xl font-semibold">
              {featured.title}
            </h3>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
              {featured.description}
            </p>

            <div
              className={cn(
                "relative mt-6 flex-1 rounded-3xl bg-gradient-to-br to-transparent p-4",
                featured.accent
              )}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                    featured.bg
                  )}
                >
                  <Camera className={cn("size-4", featured.color)} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-3/4 rounded-full bg-muted" />
                  <div className="h-2 w-1/2 rounded-full bg-muted/70" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                  87% match
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {extractedFields.map((field) => (
                  <div
                    key={field.label}
                    className="rounded-2xl border border-border/60 bg-card p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {field.label}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium">
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.article>

          {rest.map((feature) => (
            <motion.article
              key={feature.title}
              variants={staggerItem}
              className={cn(
                "group relative overflow-hidden rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5",
                feature.border
              )}
            >
              <div
                className={cn(
                  "absolute -top-16 -right-16 size-40 rounded-full blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                  feature.bg
                )}
              />
              <div
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-4xl",
                  feature.bg
                )}
              >
                <feature.icon className={cn("size-5", feature.color)} />
              </div>
              <h3 className="relative mt-5 font-heading text-base font-semibold">
                {feature.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

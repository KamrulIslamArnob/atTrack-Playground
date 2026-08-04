import Link from "next/link";
import Image from "next/image";
import {
  Briefcase,
  Target,
  Calendar,
  FileText,
  Send,
  BarChart3,
  Camera,
  Sparkles,
  ArrowRight,
  Check,
  Mail,
  Lock,
} from "lucide-react";
import { LandingHeader } from "@/components/landing-header";
import ShinyText from "@/components/ShinyText";
import { Avatar, AvatarImage, AvatarGroup } from "@/components/ui/avatar";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <LandingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-background px-6 pt-36 pb-24 sm:pt-54 sm:pb-32">
          {/* Full-height gradient behind header */}
          <div className="absolute inset-0 -top-18 bg-linear-to-b from-primary/3 via-background to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-size-[32px_32px] opacity-40" />
          <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="size-3.5 shimmer-icon" />
              <ShinyText text="AI-powered job application tracker" speed={3} color="hsl(240 3.8% 46.1%)" shineColor="var(--primary)" />
            </div>
            <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="inline-block bg-primary/15 px-3 -skew-x-6 text-primary">Organize</span>
              <span className="text-foreground"> your applications</span>
              <br />
              <span className="text-foreground">Accelerate your </span>
              <span className="inline-block bg-primary/15 px-3 -skew-x-6 text-primary">career.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-muted-foreground leading-relaxed">
              Stop juggling spreadsheets, browser tabs, and forgotten follow-ups.
              Aven brings your entire job search into one intelligent workspace —
              from the moment you discover a role to the day you accept the offer.
              AI handles the busywork so you can focus on what matters: landing the job.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-4xl bg-primary px-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Start for free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-4xl border border-border bg-card px-8 text-sm font-medium transition-all hover:bg-muted"
              >
                Sign in
              </Link>
            </div>

            {/* Dashboard preview */}
            <div className="mt-16 rounded-4xl border border-border/60 bg-card p-2 shadow-2xl shadow-primary/5">
              <div className="overflow-hidden rounded-3xl border border-border/50">
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-red-400/60" />
                    <div className="size-2.5 rounded-full bg-amber-400/60" />
                    <div className="size-2.5 rounded-full bg-emerald-400/60" />
                  </div>
                  <div className="flex-1 text-center text-[11px] text-muted-foreground">
                    app.aven.dev/overview
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
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything you need to land the job
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                A complete toolkit designed to streamline every step of your
                job search — from saving your first listing to accepting an offer.
              </p>
            </div>

            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Camera,
                  title: "AI Screenshot Import",
                  description:
                    "Paste a job posting screenshot and AI extracts title, company, salary, requirements — everything structured in seconds.",
                  color: "text-pink-500",
                  bg: "bg-pink-500/10",
                  border: "hover:border-pink-500/20",
                },
                {
                  icon: Send,
                  title: "AI Email Composer",
                  description:
                    "Generate personalized application emails with AI that understands your resume and the role. Send directly via SMTP.",
                  color: "text-violet-500",
                  bg: "bg-violet-500/10",
                  border: "hover:border-violet-500/20",
                },
                {
                  icon: Target,
                  title: "Resume Matching",
                  description:
                    "AI scores how well your resume matches each job. Know your chances before you even apply.",
                  color: "text-amber-500",
                  bg: "bg-amber-500/10",
                  border: "hover:border-amber-500/20",
                },
                {
                  icon: Calendar,
                  title: "Interview Tracker",
                  description:
                    "Schedule, prep, and follow up on interviews. Add to Google Calendar in one click. Never miss a call.",
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                  border: "hover:border-emerald-500/20",
                },
                {
                  icon: Sparkles,
                  title: "MCQ Practice Tests",
                  description:
                    "Generate role-specific multiple choice questions. Track your scores and identify weak areas to study.",
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                  border: "hover:border-blue-500/20",
                },
                {
                  icon: BarChart3,
                  title: "Smart Insights",
                  description:
                    "Visualize your pipeline, response rates, time-to-interview, and application trends. Know where you stand.",
                  color: "text-rose-500",
                  bg: "bg-rose-500/10",
                  border: "hover:border-rose-500/20",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className={`group rounded-4xl border border-border bg-card p-6 transition-all hover:shadow-lg hover:shadow-black/5 ${feature.border}`}
                >
                  <div
                    className={`flex size-11 items-center justify-center rounded-4xl ${feature.bg}`}
                  >
                    <feature.icon className={`size-5 ${feature.color}`} />
                  </div>
                  <h3 className="mt-5 font-heading text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-y border-border/50 bg-gradient-to-b from-primary/[0.03] to-background px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                From screenshot to sent
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                Three steps. No copy-pasting. No tab-switching. Just you and
                your next career move.
              </p>
            </div>

            <div className="mt-16 grid gap-8 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Import",
                  description:
                    "Screenshot a job posting or paste a URL. AI extracts every detail — title, company, salary, requirements, and how to apply.",
                  icon: Camera,
                  color: "text-pink-500",
                  bg: "bg-pink-500/10",
                },
                {
                  step: "02",
                  title: "Compose",
                  description:
                    "AI writes a personalized email tailored to the role and your experience. Edit, preview, and attach your resume.",
                  icon: Mail,
                  color: "text-violet-500",
                  bg: "bg-violet-500/10",
                },
                {
                  step: "03",
                  title: "Track",
                  description:
                    "Send the email and watch your application move through the pipeline. From submitted to interview to offer.",
                  icon: Briefcase,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/10",
                },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className={`mx-auto flex size-14 items-center justify-center rounded-4xl ${item.bg} ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04]`}>
                    <item.icon className={`size-6 ${item.color}`} />
                  </div>
                  <div className="mt-6 font-heading text-4xl font-bold text-primary/20">
                    {item.step}
                  </div>
                  <h3 className="mt-2 font-heading text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Highlight - AI Extraction */}
        <section id="ai" className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="inline-flex items-center gap-2 rounded-4xl border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="size-3" />
                  AI-Powered
                </div>
                <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
                  Stop copy-pasting
                  <br />
                  job details
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Paste a screenshot of any job posting and our AI extracts
                  everything — title, company, salary, location, requirements,
                  and how to apply. Structured data in seconds, not minutes.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Multi-image support for long postings",
                    "Automatic company detection and matching",
                    "Match score against your resume",
                    "One-click save to your pipeline",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <Check className="size-3 text-primary" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-4xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6 shadow-xl shadow-primary/5">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-3xl bg-primary/5 p-3 ring-1 ring-inset ring-primary/10">
                    <div className="flex size-10 items-center justify-center rounded-3xl bg-primary/15">
                      <Camera className="size-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="h-3 w-32 rounded-full bg-primary/15" />
                      <div className="mt-2 h-2 w-48 rounded-full bg-primary/8" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-border/60 bg-card p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        Title
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        Senior Flutter Developer
                      </div>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-card p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        Company
                      </div>
                      <div className="mt-1 text-sm font-medium">XpertLab</div>
                    </div>
                    <div className="rounded-3xl border border-border/60 bg-card p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        Salary
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        $80k — $120k
                      </div>
                    </div>
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-600/70">
                        Match
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-600">
                        87% match
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-border/60 bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      How to apply
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="size-3.5" />
                      hr@xpertlab.com
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="border-y border-border/50 bg-gradient-to-b from-primary/[0.04] to-background px-6 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-4xl bg-primary/10 ring-1 ring-inset ring-primary/10">
              <Lock className="size-6 text-primary" />
            </div>
            <h2 className="mt-6 font-heading text-2xl font-semibold tracking-tight">
              Your data stays yours
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Aven is a private workspace, not a job board. Your applications,
              resumes, and interview notes are encrypted and never shared with
              third parties.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden px-6 py-24">
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Aven" width={20} height={20} />
            <span className="font-heading text-sm font-semibold">
              Aven
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Get started
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Aven. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

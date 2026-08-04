import {
  Camera,
  Send,
  Target,
  Calendar,
  Sparkles,
  BarChart3,
} from "lucide-react";

const features = [
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
];

export function Features() {
  return (
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
          {features.map((feature) => (
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
  );
}
